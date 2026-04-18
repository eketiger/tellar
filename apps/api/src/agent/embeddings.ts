import OpenAI from 'openai';

let client: OpenAI | null = null;

function openai() {
  if (client) return client;
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  client = new OpenAI({ apiKey: key });
  return client;
}

export async function embedText(text: string): Promise<number[] | null> {
  const o = openai();
  if (!o) return null;
  const r = await o.embeddings.create({ model: 'text-embedding-3-small', input: text });
  return r.data[0].embedding;
}

export async function embedBatch(texts: string[]): Promise<number[][] | null> {
  const o = openai();
  if (!o || !texts.length) return null;
  const r = await o.embeddings.create({ model: 'text-embedding-3-small', input: texts });
  return r.data.map(d => d.embedding);
}
