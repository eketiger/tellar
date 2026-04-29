import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { ChatBackend, SystemBlock } from '../agent/chat-backend';

export interface InsightItem {
  kind: 'win' | 'risk' | 'recommendation' | 'observation';
  title: string;
  detail: string;
  /** Optional slide index this insight points at (1-based). */
  slideIdx?: number;
  /** Optional confidence label so the UI can de-emphasise weak claims. */
  confidence?: 'high' | 'medium' | 'low';
}

export interface InsightsResult {
  generatedAt: string;
  fallback: boolean;
  summary: string;
  insights: InsightItem[];
  /** Token usage so the dashboard can show cost transparency. */
  usage?: { inputTokens: number; outputTokens: number; cacheReadInputTokens?: number };
}

const SYSTEM_PERSONA = `You are Tellar's deck-analysis advisor. You receive a deck's structure and a 30-day analytics summary, and produce *honest* recommendations for the creator.

Output rules — NON-NEGOTIABLE:
- Output ONLY a JSON object with shape { "summary": string, "insights": Array<{ "kind": "win"|"risk"|"recommendation"|"observation", "title": string, "detail": string, "slideIdx"?: number, "confidence"?: "high"|"medium"|"low" }> }.
- No markdown, no preamble, no fences. JSON parsing must succeed on the raw response.
- Title ≤ 8 words. Detail ≤ 2 sentences. Refer to slides by their idx (1-based).
- "win" = something working; "risk" = drop-off, friction, ambiguity; "recommendation" = concrete change to make; "observation" = neutral pattern.
- Be specific. "Slide 7 loses 38% of viewers" beats "engagement could be improved".
- 4 to 8 items total. Include at least one win and one recommendation.
- If data is too thin (uniqueViewers < 5 or totalSlides < 3) say so in summary and emit at most 2 observation items with confidence: "low".`;

@Injectable()
export class InsightsService {
  private readonly log = new Logger(InsightsService.name);
  private readonly chat = new ChatBackend();

  constructor(private prisma: PrismaService, private events: EventsService) {}

  /**
   * Generate insights for a teller. Wires:
   *   - Prompt caching: persona + deck structure are sent as cacheable
   *     system blocks. Subsequent calls for the same deck within ~5min
   *     re-use the cache and only pay output tokens + the analytics diff.
   *   - Structured output: prompted to emit pure JSON. Validated; on
   *     failure we degrade to the deterministic mock.
   *   - Mock fallback when no ANTHROPIC_API_KEY.
   */
  async forTeller(tellerId: string): Promise<InsightsResult> {
    const teller = await this.prisma.teller.findUnique({
      where: { id: tellerId },
      include: { slides: { orderBy: { idx: 'asc' } } },
    });
    if (!teller) throw new Error('teller-not-found');

    const funnelData = await this.events.funnel(tellerId).catch(() => null);

    if (!this.chat.available() || !funnelData) {
      return this.mockInsights(teller, funnelData);
    }

    const deckStructure = teller.slides
      .map(s => `${s.idx}. ${stripHtml(s.title)}${s.subtitle ? ' — ' + stripHtml(s.subtitle) : ''}`)
      .join('\n');

    const summaryStats = JSON.stringify(
      {
        totalSlides: funnelData.totalSlides,
        uniqueViewers: funnelData.uniqueViewers,
        completion: funnelData.completion,
        avgSessionMs: funnelData.avgSessionMs,
        biggestDrop: funnelData.biggestDrop,
        agentQueriesToday: funnelData.agentQueriesToday,
        agentQueries: funnelData.agentQueries,
        funnel: funnelData.funnel.map(f => ({ idx: f.idx, title: f.title, views: f.views, pct: f.pct, drop: f.drop })),
        topQuestions: funnelData.topQuestions,
      },
      null,
      2,
    );

    // System payload: persona is ALWAYS cached; the deck structure block
    // gets its own cache breakpoint so two consecutive calls for the
    // same deck pay zero input-token cost on the structure.
    const system: SystemBlock[] = [
      { text: SYSTEM_PERSONA, cache: { type: 'ephemeral' } },
      { text: `DECK_STRUCTURE\n=============\nTitle: ${teller.title}\nSlides:\n${deckStructure}`, cache: { type: 'ephemeral' } },
    ];

    try {
      const r = await this.chat.completeRich({
        system,
        maxTokens: 1200,
        retries: 2,
        messages: [
          {
            role: 'user',
            content: `ANALYTICS_30D\n=============\n${summaryStats}\n\nProduce the JSON.`,
          },
        ],
      });
      const parsed = parseInsightsJson(r.text);
      if (!parsed) {
        this.log.warn('Insights JSON parse failed; falling back to mock');
        return this.mockInsights(teller, funnelData);
      }
      return {
        generatedAt: new Date().toISOString(),
        fallback: false,
        summary: parsed.summary,
        insights: parsed.insights,
        usage: r.usage,
      };
    } catch (e: any) {
      this.log.warn(`Anthropic insights failed: ${e?.message}; falling back to mock`);
      return this.mockInsights(teller, funnelData);
    }
  }

  private mockInsights(teller: any, funnelData: any): InsightsResult {
    const items: InsightItem[] = [];
    if (funnelData?.biggestDrop?.idx) {
      items.push({
        kind: 'risk',
        title: `Slide ${funnelData.biggestDrop.idx} loses viewers`,
        detail: `Drop-off of ${funnelData.biggestDrop.pct}% at "${stripHtml(funnelData.biggestDrop.title || '')}". Tighten the message or move it later.`,
        slideIdx: funnelData.biggestDrop.idx,
        confidence: funnelData.uniqueViewers >= 5 ? 'medium' : 'low',
      });
    }
    if (funnelData?.completion != null) {
      items.push({
        kind: funnelData.completion > 50 ? 'win' : 'observation',
        title: `${funnelData.completion}% completion rate`,
        detail: funnelData.completion > 50 ? 'Above the 40% benchmark — your structure is keeping people through.' : 'Below the 40% benchmark — the back half may be losing them.',
        confidence: 'low',
      });
    }
    items.push({
      kind: 'recommendation',
      title: 'Add a knowledge-base source',
      detail: "Drop the FAQ or a financial appendix into the KB so the agent can answer questions you didn't pre-record.",
      confidence: 'high',
    });
    return {
      generatedAt: new Date().toISOString(),
      fallback: true,
      summary: this.chat.available()
        ? 'Anthropic call failed; showing deterministic insights.'
        : 'ANTHROPIC_API_KEY not configured; showing deterministic insights.',
      insights: items,
    };
  }
}

function stripHtml(s: string) {
  return (s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

/** Tolerant JSON extractor — Claude is asked for raw JSON but
 *  occasionally wraps it. We strip ``` fences and pick the outermost
 *  brace pair. Returns null on any malformed payload. */
function parseInsightsJson(text: string): { summary: string; insights: InsightItem[] } | null {
  if (!text) return null;
  const stripped = text.replace(/```json|```/g, '').trim();
  const first = stripped.indexOf('{');
  const last = stripped.lastIndexOf('}');
  if (first < 0 || last < 0 || last < first) return null;
  try {
    const obj = JSON.parse(stripped.slice(first, last + 1));
    if (!obj || typeof obj.summary !== 'string' || !Array.isArray(obj.insights)) return null;
    return {
      summary: obj.summary,
      insights: obj.insights
        .filter((i: any) => i && typeof i.title === 'string' && typeof i.detail === 'string')
        .map((i: any) => ({
          kind: ['win', 'risk', 'recommendation', 'observation'].includes(i.kind) ? i.kind : 'observation',
          title: String(i.title).slice(0, 120),
          detail: String(i.detail).slice(0, 600),
          slideIdx: typeof i.slideIdx === 'number' ? i.slideIdx : undefined,
          confidence: ['high', 'medium', 'low'].includes(i.confidence) ? i.confidence : undefined,
        })),
    };
  } catch {
    return null;
  }
}

export const __test = { parseInsightsJson };
