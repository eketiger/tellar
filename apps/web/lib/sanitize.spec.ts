import { sanitizeSlideHtml } from './sanitize';

describe('sanitizeSlideHtml', () => {
  it('returns empty for nullish input', () => {
    expect(sanitizeSlideHtml(null)).toBe('');
    expect(sanitizeSlideHtml(undefined)).toBe('');
    expect(sanitizeSlideHtml('')).toBe('');
  });

  it('keeps <em> / <strong> / <br> verbatim', () => {
    expect(sanitizeSlideHtml('Hello <em>world</em>!')).toBe('Hello <em>world</em>!');
    expect(sanitizeSlideHtml('Line 1<br/>Line 2')).toBe('Line 1<br>Line 2');
    expect(sanitizeSlideHtml('<strong>Bold</strong>')).toBe('<strong>Bold</strong>');
  });

  it('strips <script>, <img onerror>, <a href>', () => {
    expect(sanitizeSlideHtml('<script>alert(1)</script>hello')).toBe('hello');
    expect(sanitizeSlideHtml('<img src=x onerror="alert(1)">')).toBe('');
    expect(sanitizeSlideHtml('<a href="javascript:alert(1)">click</a>')).toBe('click');
  });

  it('strips attributes from allowed tags (no onclick, no onerror)', () => {
    expect(sanitizeSlideHtml('<em onclick="alert(1)">x</em>')).toBe('<em>x</em>');
    expect(sanitizeSlideHtml('<em class="foo" id="bar">x</em>')).toBe('<em>x</em>');
  });

  it('strips HTML comments', () => {
    expect(sanitizeSlideHtml('a <!-- nasty --> b')).toBe('a  b');
  });
});
