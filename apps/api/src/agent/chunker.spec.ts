import { chunkText } from './chunker';

describe('chunkText', () => {
  it('returns empty for empty input', () => {
    expect(chunkText('')).toEqual([]);
  });

  it('fits a short text into a single chunk', () => {
    const out = chunkText('Hello world. This is a short deck.');
    expect(out.length).toBe(1);
    expect(out[0]).toContain('Hello world');
  });

  it('respects sentence boundaries when splitting', () => {
    const sentences = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} has a few useful words.`).join(' ');
    const out = chunkText(sentences, 30, 3);
    expect(out.length).toBeGreaterThan(1);
    // every chunk ends at a sentence boundary
    out.forEach(c => expect(c.endsWith('.')).toBe(true));
  });

  it('overlaps consecutive chunks', () => {
    const sentences = Array.from({ length: 20 }, (_, i) => `Word ${i}a word ${i}b word ${i}c.`).join(' ');
    const out = chunkText(sentences, 10, 3);
    expect(out.length).toBeGreaterThan(1);
    // The tail of chunk[i-1] should share words with the head of chunk[i]
    for (let i = 1; i < out.length; i++) {
      const prevTail = out[i - 1].split(' ').slice(-3).join(' ');
      expect(out[i].startsWith(prevTail)).toBe(true);
    }
  });
});
