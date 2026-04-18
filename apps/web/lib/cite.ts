// Convert agent [cite:slide:N] markers into styled <span> badges.
export function citeToHtml(text: string): string {
  const escape = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  // Allow <em> through; escape everything else.
  const tokens = text.split(/(\[cite:(?:slide|audio|kb):[^\]]+\]|<\/?em>)/);
  return tokens
    .map(tok => {
      if (!tok) return '';
      if (tok === '<em>' || tok === '</em>') return tok;
      const m = tok.match(/^\[cite:(slide|audio|kb):([^\]]+)\]$/);
      if (m) {
        const [, type, ref] = m;
        const cls = type === 'kb' ? 'cite kb' : type === 'audio' ? 'cite audio' : 'cite';
        const label = type === 'slide' ? `slide · ${ref}` : type === 'audio' ? `audio · ${ref}` : `kb · ${ref}`;
        return `<span class="${cls}" data-type="${type}" data-ref="${escape(ref)}">${label}</span>`;
      }
      return escape(tok).replace(/\n/g, '<br/>');
    })
    .join('');
}
