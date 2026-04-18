import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { AgentAskDto } from '@tellar/api-types';

const SYSTEM = `You are the Tellar agent for a deck ("teller"). You answer viewer questions using only the deck, the creator's narration, and the attached knowledge base. Rules:
- Cite sources inline using this EXACT syntax:
  [cite:slide:N]     for a slide reference
  [cite:audio:N]     for narration of slide N
  [cite:kb:NAME]     for a knowledge-base source
- Keep answers short (2-4 sentences), conversational, no bullet lists unless essential.
- When you don't know, say so and suggest what the creator could add.
- End with one "Sources: ..." line listing the citations plainly.`;

function stripHtml(s: string) {
  return (s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function keywordScore(text: string, question: string): number {
  const q = question.toLowerCase().split(/\W+/).filter(Boolean);
  const t = text.toLowerCase();
  return q.reduce((acc, term) => acc + (t.includes(term) ? 1 : 0), 0);
}

@Injectable()
export class AgentService {
  private anthropic = process.env.ANTHROPIC_API_KEY
    ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    : null;
  private openai = process.env.OPENAI_API_KEY
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;

  constructor(private prisma: PrismaService, private events: EventsService) {}

  async ask(dto: AgentAskDto) {
    const teller = await this.prisma.teller.findUnique({
      where: { id: dto.tellerId },
      include: {
        slides: { orderBy: { idx: 'asc' } },
        kbSources: { include: { chunks: true } },
        recordings: true,
      },
    });
    if (!teller) return { answer: 'Teller not found.', citations: [] };

    // RETRIEVE: mix 60% slides, 30% transcripts, 10% kb
    const scored: Array<{ text: string; label: string; score: number; ref: string }> = [];
    for (const s of teller.slides) {
      const text = [stripHtml(s.title), stripHtml(s.subtitle || ''), stripHtml(s.notes || '')].join(' ');
      scored.push({
        text,
        label: `[slide ${s.idx}] ${stripHtml(s.title)}`,
        score: keywordScore(text, dto.question),
        ref: `[cite:slide:${s.idx}]`,
      });
    }
    for (const r of teller.recordings) {
      const text = r.transcript || '';
      if (!text) continue;
      scored.push({
        text,
        label: `[audio slide ${r.slideId ? '#' : ''}] ${text.slice(0, 80)}…`,
        score: keywordScore(text, dto.question) * 0.8,
        ref: `[cite:audio:${r.slideId || ''}]`,
      });
    }
    for (const src of teller.kbSources) {
      for (const ch of src.chunks) {
        scored.push({
          text: ch.text,
          label: `[${src.kind}] ${src.name}${ch.page ? ` p.${ch.page}` : ''}`,
          score: keywordScore(ch.text, dto.question) * 0.7,
          ref: `[cite:kb:${src.name}]`,
        });
      }
      // If no chunks yet, include name as fallback
      if (src.chunks.length === 0) {
        scored.push({
          text: src.name,
          label: `[${src.kind}] ${src.name}`,
          score: keywordScore(src.name, dto.question) * 0.3,
          ref: `[cite:kb:${src.name}]`,
        });
      }
    }

    const top = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .filter(x => x.score > 0 || scored.indexOf(x) < 4);

    const context = top.map(t => `${t.label}\n${t.text}`).join('\n\n---\n\n');

    let answer: string;
    if (this.anthropic) {
      try {
        const resp = await this.anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 400,
          system: SYSTEM,
          messages: [
            ...dto.history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
            {
              role: 'user',
              content: `QUESTION: ${dto.question}\n\nRELEVANT CONTEXT:\n${context}`,
            },
          ],
        });
        answer = resp.content
          .filter(c => c.type === 'text')
          .map((c: any) => c.text)
          .join('\n');
      } catch (e: any) {
        answer = this.mockAnswer(dto.question, top);
      }
    } else {
      answer = this.mockAnswer(dto.question, top);
    }

    await this.events.track({
      type: 'AGENT_QUERY',
      tellerId: dto.tellerId,
      sessionId: dto.email || 'anon',
      email: dto.email,
      meta: { question: dto.question, answer },
    });

    return {
      answer,
      citations: top.slice(0, 4).map(t => ({ ref: t.ref, label: t.label })),
    };
  }

  private mockAnswer(question: string, top: any[]) {
    const refs = top
      .slice(0, 2)
      .map(t => t.ref)
      .join(' ');
    const lead = top[0]?.text?.slice(0, 160) || 'I don\'t have enough context to answer yet.';
    return `${lead} ${refs}\n\nSources: ${top
      .slice(0, 2)
      .map(t => t.label)
      .join('; ') || '(none)'}`;
  }

  async copilot(kind: 'rewrite' | 'tighten' | 'narration' | 'structure', slideId: string) {
    const slide = await this.prisma.slide.findUnique({ where: { id: slideId } });
    if (!slide) return { suggestion: '' };
    const prompts: Record<typeof kind, string> = {
      rewrite: `Rewrite this pitch slide to be punchier while staying editorial. Current title: "${stripHtml(
        slide.title,
      )}". Subtitle: "${stripHtml(slide.subtitle || '')}". Return ONE alternative title (<=14 words) and ONE subtitle (<=24 words) separated by "|". Wrap the strongest word in <em>...</em>. No preamble.`,
      tighten: `Make this slide subtitle more specific. Current: "${stripHtml(slide.subtitle || '')}". Return only the new subtitle.`,
      narration: `Write a 20-second first-person narration for a pitch slide titled "${stripHtml(
        slide.title,
      )}" and subtitle "${stripHtml(slide.subtitle || '')}". No filler words.`,
      structure: `Propose a new slide to insert after "${stripHtml(slide.title)}". Return one title (<=10 words) and one subtitle (<=24 words) separated by "|". Wrap the strongest word in <em>...</em>.`,
    };
    if (!this.anthropic) {
      return { suggestion: `${slide.title.replace(/<em>|<\/em>/g, '')} | ${slide.subtitle || 'Refine me.'}` };
    }
    try {
      const r = await this.anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompts[kind] }],
      });
      const text = r.content
        .filter(c => c.type === 'text')
        .map((c: any) => c.text)
        .join('\n');
      return { suggestion: text };
    } catch (e: any) {
      return { suggestion: 'Copilot offline.' };
    }
  }
}
