import { Pinecone } from '@pinecone-database/pinecone';

let client: Pinecone | null = null;

export function pineconeIndex() {
  const key = process.env.PINECONE_API_KEY;
  const name = process.env.PINECONE_INDEX_NAME;
  if (!key || !name) return null;
  if (!client) client = new Pinecone({ apiKey: key });
  return client.index(name);
}
