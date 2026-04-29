import Anthropic from '@anthropic-ai/sdk';

/**
 * Chat backend — Anthropic-only.
 *
 * Tellar's agent (Ask) and copilot now route exclusively through Claude.
 * OpenAI/Ollama support was intentionally removed: the product depends on
 * citation-aware long-context responses, and supporting two providers in
 * production added prompt drift and silent quality regressions.
 *
 * Configuration:
 *   - `ANTHROPIC_API_KEY`  required to enable real responses.
 *   - `ANTHROPIC_MODEL`    optional; defaults to the latest Sonnet.
 *
 * When `ANTHROPIC_API_KEY` is unset every caller falls back to the
 * deterministic mock responder. The app must boot with zero external keys.
 */
export type ChatKind = 'anthropic' | 'none';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatCompleteInput {
  system: string;
  messages: ChatMessage[];
  maxTokens?: number;
}

const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';

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

  async complete({ system, messages, maxTokens = 512 }: ChatCompleteInput): Promise<string> {
    if (!this.anthropic) throw new Error('Anthropic chat backend not configured');
    const resp = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: maxTokens,
      system,
      messages,
    });
    return resp.content
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text)
      .join('\n');
  }
}
