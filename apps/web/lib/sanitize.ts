/**
 * Allowlist sanitizer for creator-authored slide HTML.
 *
 * Slides are written by creators and rendered to viewers via
 * `dangerouslySetInnerHTML`. The prototype relies on <em> (and occasionally <br>)
 * for inline emphasis. Anything else is stripped.
 *
 * This is intentionally small and dependency-free. For richer authoring surfaces
 * (pasted PDF imports, etc.) swap in DOMPurify.
 */

const ALLOWED = new Set(['em', 'br', 'strong', 'i', 'b']);
// Tags whose entire body must be discarded along with the tag.
const STRIP_WITH_BODY = ['script', 'style', 'iframe', 'noscript', 'svg', 'math'];

export function sanitizeSlideHtml(input: string | null | undefined): string {
  if (!input) return '';
  let out = String(input).replace(/<!--[\s\S]*?-->/g, '');
  // Drop dangerous container tags AND their contents.
  for (const tag of STRIP_WITH_BODY) {
    const re = new RegExp(`<\\s*${tag}\\b[^>]*>[\\s\\S]*?<\\s*\\/\\s*${tag}\\s*>`, 'gi');
    out = out.replace(re, '');
    // Also strip any orphan opening tag of the same name (no closing).
    out = out.replace(new RegExp(`<\\s*\\/?\\s*${tag}\\b[^>]*>`, 'gi'), '');
  }
  // Anything else: keep allowed tags bare, drop the rest (text content stays).
  return out.replace(/<\s*\/?\s*([a-zA-Z0-9]+)[^>]*>/g, (match, tag) => {
    const t = String(tag).toLowerCase();
    if (!ALLOWED.has(t)) return '';
    return match.startsWith('</') ? `</${t}>` : `<${t}>`;
  });
}
