/**
 * Split a body of text into ~500-token chunks (~400 words) with a 50-word overlap,
 * respecting sentence boundaries.
 */
export function chunkText(input: string, targetWords = 400, overlapWords = 50): string[] {
  const clean = input.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const sentences = clean.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let cur: string[] = [];
  let curWords = 0;
  for (const s of sentences) {
    const w = s.split(' ').filter(Boolean);
    if (curWords + w.length > targetWords && cur.length) {
      chunks.push(cur.join(' '));
      // carry overlap: take last ~overlapWords words of the previous chunk
      const flat = cur.join(' ').split(' ');
      const carry = flat.slice(Math.max(0, flat.length - overlapWords));
      cur = [carry.join(' ')];
      curWords = carry.length;
    }
    cur.push(s);
    curWords += w.length;
  }
  if (cur.length) chunks.push(cur.join(' '));
  return chunks.filter(c => c.trim().length > 0);
}
