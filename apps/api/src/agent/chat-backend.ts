import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

/**
 * Pluggable chat backend. Unifies the three LLM surfaces Tellar supports:
 *
 *   - **Ollama** (or any OpenAI-compatible local server) — set
 *     `OPENAI_BASE_URL=http://localhost:11434/v1` + `OPENAI_MODEL=qwen2.5:7b`.
 *     Explicit setting of OPENAI_BASE_URL wins over everything so "point at
 *     my local LLM" works even if a real Anthropic key is present.
 *   - **Anthropic Claude** — set `ANTHROPIC_API_KEY`.
 *   - **OpenAI (cloud)** — set `OPENAI_API_KEY` without `OPENAI_BASE_URL`.
 *   - **None** — every caller falls back to the mock responder.
 *
 * Override precedence can be forced with `LLM_BACKEND=anthropic|openai` when
 * both credentials are configured (useful for A/B tests).
 */
export type ChatKind = 'openai' | 'anthropic' | 'none';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatCompleteInput {
  system: string;
  messages: ChatMessage[];
  maxTokens?: number;
}

const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';

export class ChatBackend {
  private kind: ChatKind = 'none';
  private anthropic: Anthropic | null = null;
  private openai: OpenAI | null = null;
  private openaiModel = process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL;
  private anthropicModel = process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL;

  constructor() {
    const baseURL = process.env.OPENAI_BASE_URL?.trim() || undefined;
    const openaiKey = process.env.OPENAI_API_KEY?.trim() || undefined;
    const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim() || undefined;
    const forceBackend = process.env.LLM_BACKEND?.trim()?.toLowerCase();

    // 1) Forced backend via LLM_BACKEND.
    if (forceBackend === 'openai' && (baseURL || openaiKey)) {
      this.initOpenAI(baseURL, openaiKey);
      return;
    }
    if (forceBackend === 'anthropic' && anthropicKey) {
      this.initAnthropic(anthropicKey);
      return;
    }

    // 2) Prefer local Ollama when OPENAI_BASE_URL is explicitly set — that's
    // the creator saying "I have a local LLM, use it".
    if (baseURL) {
      this.initOpenAI(baseURL, openaiKey);
      return;
    }

    // 3) Cloud preference: Claude (better for RAG with citations) then OpenAI.
    if (anthropicKey) {
      this.initAnthropic(anthropicKey);
      return;
    }
    if (openaiKey) {
      this.initOpenAI(undefined, openaiKey);
      return;
    }
  }

  private initOpenAI(baseURL: string | undefined, apiKey: string | undefined) {
    // Ollama ignores the key but the SDK still requires a non-empty string.
    this.openai = new OpenAI({ apiKey: apiKey || 'ollama-placeholder', baseURL });
    this.kind = 'openai';
  }

  private initAnthropic(apiKey: string) {
    this.anthropic = new Anthropic({ apiKey });
    this.kind = 'anthropic';
  }

  available(): boolean {
    return this.kind !== 'none';
  }

  describe(): string {
    if (this.kind === 'openai') return `openai:${this.openaiModel}${process.env.OPENAI_BASE_URL ? ' (custom base)' : ''}`;
    if (this.kind === 'anthropic') return `anthropic:${this.anthropicModel}`;
    return 'mock';
  }

  async complete({ system, messages, maxTokens = 512 }: ChatCompleteInput): Promise<string> {
    if (this.kind === 'anthropic' && this.anthropic) {
      const resp = await this.anthropic.messages.create({
        model: this.anthropicModel,
        max_tokens: maxTokens,
        system,
        messages,
      });
      return resp.content
        .filter((c: any) => c.type === 'text')
        .map((c: any) => c.text)
        .join('\n');
    }
    if (this.kind === 'openai' && this.openai) {
      const r = await this.openai.chat.completions.create({
        model: this.openaiModel,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: system },
          ...messages.map(m => ({ role: m.role, content: m.content })),
        ],
      });
      return r.choices[0]?.message?.content || '';
    }
    throw new Error('No chat backend configured');
  }
}
