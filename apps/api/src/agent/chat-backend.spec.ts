import { ChatBackend } from './chat-backend';

describe('ChatBackend', () => {
  const orig = { ...process.env };
  beforeEach(() => { process.env = { ...orig }; });
  afterAll(() => { process.env = orig; });

  it('reports mock when ANTHROPIC_API_KEY is unset', () => {
    delete process.env.ANTHROPIC_API_KEY;
    const b = new ChatBackend();
    expect(b.available()).toBe(false);
    expect(b.describe()).toBe('mock');
  });

  it('reports anthropic + default model when key is set', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    delete process.env.ANTHROPIC_MODEL;
    const b = new ChatBackend();
    expect(b.available()).toBe(true);
    expect(b.describe()).toMatch(/^anthropic:claude-/);
  });

  it('honours ANTHROPIC_MODEL override', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    process.env.ANTHROPIC_MODEL = 'claude-opus-4-20250101';
    const b = new ChatBackend();
    expect(b.describe()).toBe('anthropic:claude-opus-4-20250101');
  });

  it('throws when complete() is called without an API key', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const b = new ChatBackend();
    await expect(
      b.complete({ system: 's', messages: [{ role: 'user', content: 'hi' }] }),
    ).rejects.toThrow(/not configured/i);
  });

  it('does not initialise OpenAI / Ollama paths even when those env vars exist', () => {
    process.env.OPENAI_API_KEY = 'sk-openai';
    process.env.OPENAI_BASE_URL = 'http://localhost:11434/v1';
    process.env.LLM_BACKEND = 'openai';
    delete process.env.ANTHROPIC_API_KEY;
    const b = new ChatBackend();
    expect(b.available()).toBe(false);
    expect(b.describe()).toBe('mock');
  });

  it('wraps a string system prompt as a single ephemeral-cache block and propagates retries', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    const b = new ChatBackend();
    const calls: any[] = [];
    let attempts = 0;
    // Reach into the private SDK client to spy without setting up a real network mock.
    (b as any).anthropic = {
      messages: {
        create: async (req: any) => {
          calls.push(req);
          attempts++;
          if (attempts < 2) {
            const e: any = new Error('overloaded');
            e.status = 529;
            throw e;
          }
          return {
            content: [{ type: 'text', text: 'ok' }],
            stop_reason: 'end_turn',
            usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 7 },
          };
        },
      },
    };
    const out = await b.completeRich({
      system: 'cache me',
      messages: [{ role: 'user', content: 'hi' }],
      retries: 2,
    });
    expect(attempts).toBe(2);
    expect(out.text).toBe('ok');
    // Cache control should ride on the system payload.
    expect(calls[0].system[0]).toMatchObject({ type: 'text', text: 'cache me', cache_control: { type: 'ephemeral' } });
    // Usage statistics surface to the caller.
    expect(out.usage.cacheReadInputTokens).toBe(7);
  });

  it('honours an explicit SystemBlock[] payload', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    const b = new ChatBackend();
    let captured: any;
    (b as any).anthropic = {
      messages: {
        create: async (req: any) => {
          captured = req;
          return { content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } };
        },
      },
    };
    await b.completeRich({
      system: [
        { text: 'persona' },
        { text: 'big stable context', cache: { type: 'ephemeral' } },
      ],
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(captured.system).toEqual([
      { type: 'text', text: 'persona' },
      { type: 'text', text: 'big stable context', cache_control: { type: 'ephemeral' } },
    ]);
  });

  it('does not retry on a non-transient error', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    const b = new ChatBackend();
    let attempts = 0;
    (b as any).anthropic = {
      messages: {
        create: async () => {
          attempts++;
          const e: any = new Error('bad request');
          e.status = 400;
          throw e;
        },
      },
    };
    await expect(
      b.completeRich({ system: 's', messages: [{ role: 'user', content: 'hi' }], retries: 5 }),
    ).rejects.toThrow(/bad request/);
    expect(attempts).toBe(1);
  });
});
