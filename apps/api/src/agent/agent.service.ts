import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { AgentAskDto } from '@tellar/api-types';
import { KnowledgeBaseService } from './knowledge-base';
import { ChatBackend } from './chat-backend';

const COPILOT_DAILY_LIMIT = 50;
const ASK_DAILY_LIMIT_PER_TELLER = 20;

const ASK_SYSTEM = `You are the Tellar agent for a deck ("teller"). You answer viewer questions using only the deck, the creator's narration, and the attached knowledge base. Rules:
- Cite sources inline using this EXACT syntax:
  [cite:slide:N]     for a slide reference
  [cite:audio:N]     for narration of slide N
  [cite:kb:NAME]     for a knowledge-base source
- Keep answers short (2-4 sentences), conversational, no bullet lists unless essential.
- When you don't know, say so and suggest what the creator could add.
- End with one "Sources: ..." line listing the citations plainly.`;

const COPILOT_SYSTEM = `You are a writing copilot embedded in a content creation platform. You assist Tellers (content authors) in improving their work. Be concise, constructive, and match the author's existing voice. Respond ONLY with the improved or suggested text — no explanations, no preamble, no markdown wrappers.`;

function stripHtml(s: string) {
  return (s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

@Injectable()
export class AgentService {
  // Anthropic-only chat backend (Claude). Falls back to mock when
  // ANTHROPIC_API_KEY is unset so the app boots with no external keys.
  private chat = new ChatBackend();

  constructor(
    private prisma: PrismaService,
    private events: EventsService,
    private kb: KnowledgeBaseService,
  ) {
    // eslint-disable-next-line no-console
    console.log(`[agent] chat backend = ${this.chat.describe()}`);
  }

  async ask(dto: AgentAskDto & { userId?: string }) {
    if (dto.userId) await this.enforceAskLimit(dto.userId, dto.tellerId);

    const teller = await this.prisma.teller.findUnique({
      where: { id: dto.tellerId },
      include: {
        slides: { orderBy: { idx: 'asc' } },
      },
    });
    if (!teller) return { answer: 'Teller not found.', citations: [] };

    const chunks = await this.kb.retrieve(dto.tellerId, dto.question, 5);
    // Lean slide pool always present for citation targets
    const slidePool = teller.slides.map(s => ({
      text: [stripHtml(s.title), stripHtml(s.subtitle || '')].join(' '),
      label: `[slide ${s.idx}] ${stripHtml(s.title)}`,
      ref: `[cite:slide:${s.idx}]`,
      score: 0,
    }));

    const context =
      [...chunks, ...slidePool.slice(0, 4)]
        .slice(0, 8)
        .map((t, i) => `(${i + 1}) ${t.label || ''}\n${t.text}`)
        .join('\n\n---\n\n');

    let answer: string;
    if (this.chat.available()) {
      try {
        answer = await this.chat.complete({
          system: ASK_SYSTEM,
          maxTokens: 512,
          messages: [
            ...(dto.history || []).map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
            {
              role: 'user',
              content: `QUESTION: ${dto.question}\n\nRELEVANT CONTEXT:\n${context}`,
            },
          ],
        });
      } catch {
        answer = this.mockAnswer(dto.question, chunks, slidePool);
      }
    } else {
      answer = this.mockAnswer(dto.question, chunks, slidePool);
    }

    // NOTE: AGENT_QUERY is tracked client-side via the /api/events beacon so
    // the event carries the real viewer sessionId + slideIdx. We deliberately
    // do NOT track it here as well — doing so produced a duplicate event
    // with a synthetic sessionId and no slideIdx.

    if (dto.userId) {
      await this.prisma.tellerAsk.create({
        data: { tellerId: dto.tellerId, userId: dto.userId, question: dto.question, answer },
      });
      await this.bumpAskCount(dto.userId, dto.tellerId);
    }

    return {
      answer,
      citations: [...chunks, ...slidePool.slice(0, 2)].slice(0, 4).map(t => ({ ref: t.ref, label: t.label })),
    };
  }

  private mockAnswer(question: string, chunks: any[], slidePool: any[]) {
    const top = chunks[0]?.text || slidePool[0]?.text || "I don't have enough context to answer yet.";
    const refs = [chunks[0]?.ref, slidePool[0]?.ref].filter(Boolean).join(' ');
    return `${top.slice(0, 200)} ${refs}\n\nSources: ${[chunks[0]?.label, slidePool[0]?.label].filter(Boolean).join('; ') || '(none)'}`;
  }

  async copilot(
    kind: 'rewrite' | 'tighten' | 'narration' | 'structure' | 'improve' | 'expand' | 'summarize' | 'fix_grammar' | 'change_tone',
    opts: { slideId?: string; selectedText?: string; context?: string; toneTarget?: string; userId?: string },
  ) {
    if (opts.userId) await this.enforceCopilotLimit(opts.userId);

    const slide = opts.slideId ? await this.prisma.slide.findUnique({ where: { id: opts.slideId } }) : null;
    const source = opts.selectedText || (slide ? `${stripHtml(slide.title)} — ${stripHtml(slide.subtitle || '')}` : '');

    const prompt = this.copilotPrompt(kind, { ...opts, source });
    let suggestion = '';
    if (this.chat.available()) {
      try {
        suggestion = await this.chat.complete({
          system: COPILOT_SYSTEM,
          maxTokens: 400,
          messages: [{ role: 'user', content: prompt }],
        });
      } catch {
        suggestion = this.mockCopilot(kind, source);
      }
    } else {
      suggestion = this.mockCopilot(kind, source);
    }

    if (opts.userId) await this.bumpCopilotCount(opts.userId);
    return { suggestion };
  }

  private copilotPrompt(kind: string, opts: any) {
    const src = opts.source || '';
    switch (kind) {
      case 'rewrite':
        return `Rewrite this pitch slide to be punchier while staying editorial. Source: "${src}". Return ONE new title (<=14 words) and ONE subtitle (<=24 words) separated by "|". Wrap the strongest word in <em>...</em>. No preamble.`;
      case 'tighten':
        return `Make this shorter and more specific. Source: "${src}". Return only the new text.`;
      case 'narration':
        return `Write a 20-second first-person narration for: "${src}". No filler words.`;
      case 'structure':
        return `Propose a new slide to insert after "${src}". Return one title (<=10 words) and one subtitle (<=24 words) separated by "|". Wrap the strongest word in <em>...</em>.`;
      case 'improve':
        return `Improve this text while preserving its meaning and voice: "${src}"`;
      case 'expand':
        return `Expand this text with one more relevant sentence: "${src}"`;
      case 'summarize':
        return `Summarize: "${src}" in one sentence.`;
      case 'fix_grammar':
        return `Fix grammar and punctuation only, keep voice intact: "${src}"`;
      case 'change_tone':
        return `Rewrite in a ${opts.toneTarget || 'more confident'} tone: "${src}"`;
      default:
        return `Rewrite: "${src}"`;
    }
  }

  private mockCopilot(kind: string, source: string) {
    if (kind === 'rewrite' || kind === 'structure') return `${source.split('—')[0]?.trim() || 'Untitled'} | ${source.split('—')[1]?.trim() || 'Refine me.'}`;
    return source;
  }

  private async enforceCopilotLimit(userId: string) {
    const row = await this.prisma.copilotUsage.findUnique({
      where: { userId_date: { userId, date: today() } },
    });
    if ((row?.count || 0) >= COPILOT_DAILY_LIMIT)
      throw new ForbiddenException('Daily Copilot limit reached. Upgrade for unlimited access.');
  }

  private async enforceAskLimit(userId: string, tellerId: string) {
    const row = await this.prisma.askUsage.findUnique({
      where: { userId_tellerId_date: { userId, tellerId, date: today() } },
    });
    if ((row?.count || 0) >= ASK_DAILY_LIMIT_PER_TELLER)
      throw new ForbiddenException('Daily Ask limit for this teller reached.');
  }

  private bumpCopilotCount(userId: string) {
    return this.prisma.copilotUsage.upsert({
      where: { userId_date: { userId, date: today() } },
      update: { count: { increment: 1 } },
      create: { userId, date: today(), count: 1 },
    });
  }

  private bumpAskCount(userId: string, tellerId: string) {
    return this.prisma.askUsage.upsert({
      where: { userId_tellerId_date: { userId, tellerId, date: today() } },
      update: { count: { increment: 1 } },
      create: { userId, tellerId, date: today(), count: 1 },
    });
  }
}
