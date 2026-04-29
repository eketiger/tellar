import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChatBackend, SystemBlock } from '../agent/chat-backend';
import { AUTHORING_TOOLS } from './authoring.tools';

const SYSTEM_PERSONA = `You are Tellar's authoring co-pilot — a conversational editor that creates and refines decks ("tellars") on the user's behalf.

Behaviour:
- You operate by calling the provided tools. Don't describe an edit — *make* it.
- Always anchor edits to a specific slideIdx. Use list_slides if the user says "the pricing one" without a number.
- Keep slide titles ≤ 8 words. Subtitles are one sentence, mid-conversation tone.
- After every batch of tool calls, write ONE sentence summarising what changed for the user. No bullet list of every tool call.
- If you cannot resolve a request to a concrete edit, ask exactly one clarifying question instead of guessing.
- Never invent data the user hasn't given you. For numbers/quotes, ask first or scaffold a placeholder titled "TODO: …".`;

interface SessionInput {
  tellerId: string;
  workspaceId: string;
  message: string;
  /** Conversation so far — assistant + user turns. Tool turns stay inside the loop. */
  history?: { role: 'user' | 'assistant'; content: string }[];
}

export interface AuthoringTurn {
  reply: string;
  appliedTools: { name: string; input: any; result: any }[];
  fallback: boolean;
  usage?: { inputTokens: number; outputTokens: number; cacheReadInputTokens?: number };
}

const MAX_TOOL_ITERATIONS = 8;

@Injectable()
export class AuthoringService {
  private readonly log = new Logger(AuthoringService.name);
  private readonly chat = new ChatBackend();

  constructor(private prisma: PrismaService) {}

  async chatTurn(input: SessionInput): Promise<AuthoringTurn> {
    const teller = await this.prisma.teller.findUnique({
      where: { id: input.tellerId },
      include: { slides: { orderBy: { idx: 'asc' } } },
    });
    if (!teller) throw new ForbiddenException('teller-not-found');
    if (teller.workspaceId !== input.workspaceId) throw new ForbiddenException('cross-workspace');

    if (!this.chat.available()) {
      return {
        reply: 'Authoring agent is in mock mode (set ANTHROPIC_API_KEY). Try the manual editor for now.',
        appliedTools: [],
        fallback: true,
      };
    }

    // System prompt: persona is cached; the live deck snapshot is *not*
    // cached because the agent itself mutates it during the turn.
    const system: SystemBlock[] = [
      { text: SYSTEM_PERSONA, cache: { type: 'ephemeral' } },
      {
        text:
          `CURRENT_DECK\n============\nTitle: ${teller.title}\nSlides:\n` +
          teller.slides.map(s => `${s.idx}. [${s.layoutId || 'title'}] ${s.title}${s.subtitle ? ' — ' + s.subtitle : ''}`).join('\n'),
      },
    ];

    const messages: any[] = [];
    for (const h of input.history || []) {
      messages.push({ role: h.role, content: h.content });
    }
    messages.push({ role: 'user', content: input.message });

    const applied: { name: string; input: any; result: any }[] = [];

    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const r = await this.chat.completeRich({
        system,
        messages,
        tools: AUTHORING_TOOLS,
        tool_choice: { type: 'auto' },
        maxTokens: 1200,
      });

      const toolUses = r.content.filter((b: any) => b.type === 'tool_use');
      if (toolUses.length === 0) {
        // Final assistant turn — return its text.
        return { reply: r.text || '(no reply)', appliedTools: applied, fallback: false, usage: r.usage };
      }

      // Execute every tool the model emitted in this turn, in order.
      messages.push({ role: 'assistant', content: r.content });
      const toolResults: any[] = [];
      for (const tu of toolUses) {
        const result = await this.runTool(input.tellerId, tu.name as string, (tu as any).input).catch(e => ({
          error: String(e?.message || e),
        }));
        applied.push({ name: tu.name as string, input: (tu as any).input, result });
        toolResults.push({
          type: 'tool_result',
          tool_use_id: (tu as any).id,
          content: JSON.stringify(result),
        });
      }
      messages.push({ role: 'user', content: toolResults });

      if (r.stopReason !== 'tool_use') {
        // Defensive: if the model returned tool_use blocks but a different
        // stop_reason, run them but bail rather than loop forever.
        break;
      }
    }

    return { reply: 'Reached the tool-call iteration cap; stopping.', appliedTools: applied, fallback: false };
  }

  private async runTool(tellerId: string, name: string, input: any): Promise<any> {
    switch (name) {
      case 'list_slides':
        return (
          await this.prisma.slide.findMany({
            where: { tellerId },
            orderBy: { idx: 'asc' },
            select: { idx: true, title: true, subtitle: true, eyebrow: true, layoutId: true },
          })
        );

      case 'add_slide': {
        const layoutId = String(input.layoutId || 'title');
        const title = String(input.title || '').slice(0, 200);
        const afterIdx: number | null = typeof input.afterIdx === 'number' ? input.afterIdx : null;

        const all = await this.prisma.slide.findMany({ where: { tellerId }, orderBy: { idx: 'asc' } });
        const insertAt = afterIdx ? Math.min(Math.max(afterIdx + 1, 1), all.length + 1) : all.length + 1;

        if (insertAt <= all.length) {
          // Same two-pass shift the editor uses; avoids @@unique([tellerId, idx]) collisions.
          const OFFSET = 10_000;
          for (const s of all.slice(insertAt - 1)) {
            await this.prisma.slide.update({ where: { id: s.id }, data: { idx: s.idx + OFFSET } });
          }
          for (const s of all.slice(insertAt - 1)) {
            await this.prisma.slide.update({ where: { id: s.id }, data: { idx: s.idx + 1 } });
          }
        }
        const created = await this.prisma.slide.create({
          data: {
            tellerId,
            idx: insertAt,
            layoutId,
            layout: {} as any,
            background: {} as any,
            title,
            subtitle: input.subtitle ? String(input.subtitle).slice(0, 400) : null,
            eyebrow: input.eyebrow ? String(input.eyebrow).slice(0, 120) : null,
            notes: input.notes ? String(input.notes) : null,
          },
        });
        await this.prisma.teller.update({ where: { id: tellerId }, data: { revision: { increment: 1 } } });
        return { ok: true, id: created.id, idx: created.idx };
      }

      case 'update_slide': {
        const idx = Number(input.slideIdx);
        const slide = await this.prisma.slide.findFirst({ where: { tellerId, idx } });
        if (!slide) return { error: `no slide at idx ${idx}` };
        const data: any = {};
        for (const k of ['title', 'subtitle', 'eyebrow', 'notes', 'layoutId'] as const) {
          if (typeof input[k] === 'string') data[k] = input[k];
        }
        const updated = await this.prisma.slide.update({ where: { id: slide.id }, data });
        await this.prisma.teller.update({ where: { id: tellerId }, data: { revision: { increment: 1 } } });
        return { ok: true, idx: updated.idx, title: updated.title };
      }

      case 'delete_slide': {
        const idx = Number(input.slideIdx);
        const slide = await this.prisma.slide.findFirst({ where: { tellerId, idx } });
        if (!slide) return { error: `no slide at idx ${idx}` };
        await this.prisma.slide.delete({ where: { id: slide.id } });
        const rest = await this.prisma.slide.findMany({ where: { tellerId }, orderBy: { idx: 'asc' } });
        for (let i = 0; i < rest.length; i++) {
          if (rest[i].idx !== i + 1) {
            await this.prisma.slide.update({ where: { id: rest[i].id }, data: { idx: i + 1 } });
          }
        }
        await this.prisma.teller.update({ where: { id: tellerId }, data: { revision: { increment: 1 } } });
        return { ok: true, removedIdx: idx };
      }

      case 'reorder_slides': {
        const order: number[] = Array.isArray(input.order) ? input.order.map(Number) : [];
        const all = await this.prisma.slide.findMany({ where: { tellerId }, orderBy: { idx: 'asc' } });
        if (order.length !== all.length) return { error: 'order length must equal slide count' };
        const byIdx = new Map(all.map(s => [s.idx, s]));
        if (!order.every(o => byIdx.has(o))) return { error: 'order references unknown slideIdx' };
        const OFFSET = 10_000;
        for (let i = 0; i < order.length; i++) {
          const s = byIdx.get(order[i])!;
          await this.prisma.slide.update({ where: { id: s.id }, data: { idx: OFFSET + i + 1 } });
        }
        for (let i = 0; i < order.length; i++) {
          const s = byIdx.get(order[i])!;
          await this.prisma.slide.update({ where: { id: s.id }, data: { idx: i + 1 } });
        }
        await this.prisma.teller.update({ where: { id: tellerId }, data: { revision: { increment: 1 } } });
        return { ok: true };
      }

      default:
        return { error: `unknown tool: ${name}` };
    }
  }
}
