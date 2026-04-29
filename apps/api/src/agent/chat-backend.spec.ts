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
    // Anthropic-only — legacy OpenAI/Ollama vars must be ignored.
    expect(b.available()).toBe(false);
    expect(b.describe()).toBe('mock');
  });
});
