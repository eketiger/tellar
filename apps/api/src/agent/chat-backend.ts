import Anthropic from '@anthropic-ai/sdk';

/**
 * Anthropic chat backend — single source of truth for every Claude call.
 *
 * Tellar uses Claude for: agent Ask, copilot rewrites, tellar insights,
 * and the authoring (conversational tellar editor). All four paths share
 * this class so we apply the same best practices everywhere:
 *
 *   - **Prompt caching** (`cache_control: { type: 'ephemeral' }`) on the
 *     system prompt and any large stable context (full slide deck, KB,
 *     transcripts). Reduces per-request cost dramatically when the same
 *     deck is queried repeatedly.
 *   - **Retries** on transient 429/529 with exponential backoff, capped
 *     at three attempts. Anthropic's API surfaces overloads cleanly so
 *     we propagate the error after the cap.
 *   - **Tool use** support — pass `tools` and the SDK returns
 *     `tool_use` blocks; the caller orchestrates the loop.
 *   - **Mock fallback** when ANTHROPIC_API_KEY is unset, so the app
 *     boots with no external dependencies (per CLAUDE.md).
 */
export type ChatKind = 'anthropic' | 'none';

export type CacheBreakpoint = { type: 'ephemeral' };

export interface ChatMessage {
  role: 'user' | 'assistant';
  /** Either a plain string or a structured content array (Claude tool-use). */
  content: any;
}

/** A cacheable chunk of system text. Marking the *last* chunk with
 *  `cache: { type: 'ephemeral' }` tells Claude to cache up to that point.
 *  Subsequent calls with the same prefix hit the cache. */
export interface SystemBlock {
  text: string;
  cache?: CacheBreakpoint;
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: any;
}

export interface ChatCompleteInput {
  system: string | SystemBlock[];
  messages: ChatMessage[];
  maxTokens?: number;
  tools?: ToolDefinition[];
  /** Force the model to pick a specific tool, or any tool. */
  tool_choice?: { type: 'auto' } | { type: 'any' } | { type: 'tool'; name: string };
  /** Hard cap on retries for transient errors. Default 2. */
  retries?: number;
}

export interface ChatCompleteOutput {
  /** Concatenated text blocks (excluding tool_use). */
  text: string;
  /** Raw content array for callers that need tool_use blocks. */
  content: any[];
  stopReason: string | null;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationInputTokens?: number;
    cacheReadInputTokens?: number;
  };
}

const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';
const TRANSIENT_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504, 529]);

export class ChatBackend {
  private kind: ChatKind = 'none';
  private anthropic: Anthropic | null = null;
  private model = process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL;

  constructor() {
    const key = process.env.ANTHROPIC_API_KEY?.trim();
    if (key) {
      this.anthropic = new Anthropic({ apiKey: key });
      this.kind = 'anthropic';
    }
  }

  available(): boolean {
    return this.kind === 'anthropic' && this.anthropic !== null;
  }

  describe(): string {
    return this.available() ? `anthropic:${this.model}` : 'mock';
  }

  /** Backwards-compatible thin completion that returns just the text. */
  async complete(input: ChatCompleteInput): Promise<string> {
    const r = await this.completeRich(input);
    return r.text;
  }

  /** Full-shape completion for callers that need tool_use / usage stats. */
  async completeRich({
    system,
    messages,
    maxTokens = 512,
    tools,
    tool_choice,
    retries = 2,
  }: ChatCompleteInput): Promise<ChatCompleteOutput> {
    if (!this.anthropic) throw new Error('Anthropic chat backend not configured');

    // System: a string is auto-converted to a single ephemeral-cache block.
    // An explicit SystemBlock[] lets callers cache only stable prefixes.
    const systemPayload = Array.isArray(system)
      ? system.map(s => ({
          type: 'text',
          text: s.text,
          ...(s.cache ? { cache_control: s.cache } : {}),
        }))
      : [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } as const }];

    let attempt = 0;
    while (true) {
      try {
        const resp = await this.anthropic.messages.create({
          model: this.model,
          max_tokens: maxTokens,
          system: systemPayload as any,
          messages: messages as any,
          ...(tools ? { tools: tools as any } : {}),
          ...(tool_choice ? { tool_choice: tool_choice as any } : {}),
        });
        const text = (resp.content || [])
          .filter((c: any) => c.type === 'text')
          .map((c: any) => c.text)
          .join('\n');
        return {
          text,
          content: resp.content as any[],
          stopReason: (resp as any).stop_reason ?? null,
          usage: {
            inputTokens: (resp.usage as any)?.input_tokens ?? 0,
            outputTokens: (resp.usage as any)?.output_tokens ?? 0,
            cacheCreationInputTokens: (resp.usage as any)?.cache_creation_input_tokens,
            cacheReadInputTokens: (resp.usage as any)?.cache_read_input_tokens,
          },
        };
      } catch (e: any) {
        const status: number | undefined = e?.status ?? e?.response?.status;
        if (attempt >= retries || !status || !TRANSIENT_STATUSES.has(status)) throw e;
        const backoffMs = 250 * Math.pow(2, attempt) + Math.floor(Math.random() * 100);
        await new Promise(r => setTimeout(r, backoffMs));
        attempt++;
      }
    }
  }
}
