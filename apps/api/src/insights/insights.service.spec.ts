import { __test } from './insights.service';
const { parseInsightsJson } = __test;

describe('parseInsightsJson', () => {
  it('parses a clean JSON object', () => {
    const r = parseInsightsJson(JSON.stringify({
      summary: 'ok',
      insights: [{ kind: 'win', title: 'Hook lands', detail: 'Slide 1 retains 92%.', slideIdx: 1, confidence: 'high' }],
    }));
    expect(r?.summary).toBe('ok');
    expect(r?.insights).toHaveLength(1);
    expect(r?.insights[0].slideIdx).toBe(1);
  });

  it('strips markdown fences', () => {
    const r = parseInsightsJson('```json\n{"summary":"ok","insights":[]}\n```');
    expect(r?.summary).toBe('ok');
  });

  it('extracts JSON from a noisy preamble', () => {
    const r = parseInsightsJson('Sure! Here you go:\n{"summary":"ok","insights":[]}\nThat\'s it.');
    expect(r?.summary).toBe('ok');
  });

  it('coerces unknown kind to "observation"', () => {
    const r = parseInsightsJson(JSON.stringify({
      summary: 'x',
      insights: [{ kind: 'banana', title: 't', detail: 'd' }],
    }));
    expect(r?.insights[0].kind).toBe('observation');
  });

  it('drops items missing required fields', () => {
    const r = parseInsightsJson(JSON.stringify({
      summary: 'x',
      insights: [{ kind: 'win', title: 't' }, { kind: 'win', title: 't', detail: 'd' }],
    }));
    expect(r?.insights).toHaveLength(1);
  });

  it('returns null when summary is missing', () => {
    expect(parseInsightsJson('{"insights":[]}')).toBeNull();
  });

  it('returns null on malformed JSON', () => {
    expect(parseInsightsJson('not json')).toBeNull();
    expect(parseInsightsJson('')).toBeNull();
    expect(parseInsightsJson('{ broken')).toBeNull();
  });
});
