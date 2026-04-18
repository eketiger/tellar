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

export function sanitizeSlideHtml(input: string | null | undefined): string {
  if (!input) return '';
  // Strip any tag that's not in the allowlist. Tags are preserved as literal text
  // so a careless edit doesn't silently lose content.
  return String(input)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\s*\/?\s*([a-zA-Z0-9]+)[^>]*>/g, (match, tag) => {
      const t = String(tag).toLowerCase();
      if (!ALLOWED.has(t)) return '';
      // For allowed tags, collapse to the bare tag (no attributes → no onerror, href, etc.)
      return match.startsWith('</') ? `</${t}>` : `<${t}>`;
    });
}
