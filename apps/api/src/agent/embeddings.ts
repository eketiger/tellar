/**
 * Embeddings client.
 *
 * Anthropic does not ship a hosted embeddings endpoint — they recommend
 * Voyage AI as their preferred partner. To keep "all intelligence on
 * Anthropic" sensible without locking the agent out of vector retrieval,
 * Tellar uses Voyage when configured and falls back to keyword-only
 * retrieval otherwise.
 *
 * Configuration:
 *   - `VOYAGE_API_KEY`     enables Voyage embeddings.
 *   - `VOYAGE_EMBED_MODEL` optional; defaults to `voyage-3`.
 *
 * Returning `null` makes the KB retriever fall back to keyword scoring,
 * which is the documented behaviour in CLAUDE.md ("Claude + keyword rerank
 * out of the box; upgrades to … Pinecone when those env vars are set").
 */

const VOYAGE_URL = 'https://api.voyageai.com/v1/embeddings';

function model() {
  return process.env.VOYAGE_EMBED_MODEL?.trim() || 'voyage-3';
}

function apiKey() {
  return process.env.VOYAGE_API_KEY?.trim() || '';
}

async function callVoyage(input: string | string[]): Promise<number[][] | null> {
  const key = apiKey();
  if (!key) return null;
  try {
    const r = await fetch(VOYAGE_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: model(), input }),
    });
    if (!r.ok) return null;
    const body = (await r.json()) as { data?: { embedding: number[] }[] };
    return body.data?.map(d => d.embedding) ?? null;
  } catch {
    return null;
  }
}

export async function embedText(text: string): Promise<number[] | null> {
  const r = await callVoyage(text);
  return r?.[0] ?? null;
}

export async function embedBatch(texts: string[]): Promise<number[][] | null> {
  if (!texts.length) return null;
  return callVoyage(texts);
}
