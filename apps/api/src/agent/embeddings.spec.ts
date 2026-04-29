import { embedBatch, embedText } from './embeddings';

describe('embeddings (Voyage AI)', () => {
  const orig = { ...process.env };
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    process.env = { ...orig };
    delete process.env.VOYAGE_API_KEY;
    fetchSpy = jest.spyOn(global, 'fetch') as any;
  });
  afterEach(() => { fetchSpy.mockRestore(); });
  afterAll(() => { process.env = orig; });

  it('returns null for embedText when VOYAGE_API_KEY is unset', async () => {
    expect(await embedText('hello')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns null for embedBatch when VOYAGE_API_KEY is unset', async () => {
    expect(await embedBatch(['a', 'b'])).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns null for empty batch even when configured', async () => {
    process.env.VOYAGE_API_KEY = 'vy-test';
    expect(await embedBatch([])).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('calls Voyage when configured and returns the first vector', async () => {
    process.env.VOYAGE_API_KEY = 'vy-test';
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ embedding: [0.1, 0.2, 0.3] }] }),
    } as Response);
    const v = await embedText('hello');
    expect(v).toEqual([0.1, 0.2, 0.3]);
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.voyageai.com/v1/embeddings',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('returns null on Voyage HTTP error (graceful degradation to keyword-only)', async () => {
    process.env.VOYAGE_API_KEY = 'vy-test';
    fetchSpy.mockResolvedValue({ ok: false, json: async () => ({}) } as Response);
    expect(await embedText('hello')).toBeNull();
  });
});
