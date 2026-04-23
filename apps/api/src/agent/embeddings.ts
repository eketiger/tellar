import OpenAI from 'openai';

/**
 * Embeddings client. Uses the same env-var layout as ChatBackend so a single
 * `OPENAI_BASE_URL=http://localhost:11434/v1` flips Tellar over to local
 * Ollama embeddings (e.g. `nomic-embed-text`). If nothing is configured we
 * return null and the KB retriever falls back to keyword scoring.
 *
 *   - OPENAI_BASE_URL   → any OpenAI-compatible endpoint (Ollama, vLLM…)
 *   - OPENAI_API_KEY    → OpenAI cloud or a placeholder for Ollama
 *   - OPENAI_EMBED_MODEL → model name; defaults to text-embedding-3-small.
 *     For Ollama set it to e.g. `nomic-embed-text` or `mxbai-embed-large`.
 */

let client: OpenAI | null = null;

function openai() {
  if (client) return client;
  const baseURL = process.env.OPENAI_BASE_URL?.trim() || undefined;
  const key = process.env.OPENAI_API_KEY?.trim() || undefined;
  // Either a cloud key OR a base URL (local server) is enough. Local servers
  // ignore the key but the SDK still wants a string.
  if (!baseURL && !key) return null;
  client = new OpenAI({ apiKey: key || 'ollama-placeholder', baseURL });
  return client;
}

function model() {
  return process.env.OPENAI_EMBED_MODEL?.trim() || 'text-embedding-3-small';
}

export async function embedText(text: string): Promise<number[] | null> {
  const o = openai();
  if (!o) return null;
  try {
    const r = await o.embeddings.create({ model: model(), input: text });
    return r.data[0].embedding;
  } catch {
    return null;
  }
}

export async function embedBatch(texts: string[]): Promise<number[][] | null> {
  const o = openai();
  if (!o || !texts.length) return null;
  try {
    const r = await o.embeddings.create({ model: model(), input: texts });
    return r.data.map(d => d.embedding);
  } catch {
    return null;
  }
}
