/**
 * Slide layout registry.
 *
 * Every slide has a `layoutId` pointing to one entry here. Each layout defines:
 *   - the slot schema (what fields it exposes)
 *   - the render function (how to draw the slide)
 *
 * Styling is intentionally opinionated: creators fill slots, they don't compose.
 * Themes and backgrounds come from a separate small set; no free-form fonts or
 * colors per slot.
 */

import type { CSSProperties, ReactNode } from 'react';
import { sanitizeSlideHtml } from './sanitize';

export type SlotKind = 'text' | 'text[]' | 'image';
export type BackgroundKind = 'cream' | 'paper' | 'midnight' | 'dark' | 'image';

export interface Background { kind?: BackgroundKind; imageUrl?: string; }
export type Slots = Record<string, any>;

export interface LayoutMeta {
  id: string;
  label: string;
  hint: string;
  slots: Record<string, SlotKind>;
  defaultBg: BackgroundKind;
}

const THEMES: Record<BackgroundKind, { bg: string; ink: string; sub: string; accent: string; eyebrow: string }> = {
  cream:    { bg: '#f6f3ed', ink: '#1a1a1a', sub: '#555',    accent: '#c89a3a', eyebrow: '#888' },
  paper:    { bg: '#ece7db', ink: '#1a1a1a', sub: '#555',    accent: '#a16928', eyebrow: '#7a7569' },
  midnight: { bg: '#0c1220', ink: '#f4efe6', sub: '#a8afbe', accent: '#f4b942', eyebrow: '#5b627a' },
  dark:     { bg: '#1a1a1a', ink: '#f6f3ed', sub: '#a8a69e', accent: '#f4b942', eyebrow: '#6d6a63' },
  image:    { bg: '#0c0d0f', ink: '#f4efe6', sub: '#e8e6e1', accent: '#f4b942', eyebrow: '#e8e6e1' },
};

function themeFor(bg: Background | undefined): { theme: typeof THEMES.cream; wrapperStyle: CSSProperties } {
  const kind = bg?.kind || 'cream';
  const theme = THEMES[kind];
  const wrapperStyle: CSSProperties = {
    background: kind === 'image' && bg?.imageUrl ? `url(${bg.imageUrl}) center/cover` : theme.bg,
    color: theme.ink,
  };
  return { theme, wrapperStyle };
}

// Common render primitives -----------------------------------------------------

function Eyebrow({ children, theme }: { children?: string; theme: typeof THEMES.cream }) {
  if (!children) return null;
  return (
    <div style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.25em', color: theme.eyebrow, textTransform: 'uppercase' }}>
      {children}
    </div>
  );
}
function Title({ html, size = 76, theme }: { html?: string; size?: number; theme: typeof THEMES.cream }) {
  if (!html) return null;
  return (
    <h2
      style={{
        fontFamily: 'var(--serif)',
        fontSize: `clamp(32px, ${size / 12}vw, ${size}px)`,
        fontWeight: 400,
        lineHeight: 1.02,
        letterSpacing: '-.025em',
        color: theme.ink,
      }}
      dangerouslySetInnerHTML={{ __html: applyAccent(sanitizeSlideHtml(html), theme.accent) }}
    />
  );
}
function Sub({ html, theme }: { html?: string; theme: typeof THEMES.cream }) {
  if (!html) return null;
  return (
    <div
      style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 22, color: theme.sub, lineHeight: 1.4, maxWidth: '70%' }}
      dangerouslySetInnerHTML={{ __html: applyAccent(sanitizeSlideHtml(html), theme.accent) }}
    />
  );
}
function applyAccent(html: string, color: string) {
  return html.replace(/<em>/g, `<em style="color:${color};font-style:italic">`);
}

// Layouts ---------------------------------------------------------------------

const CoverLayout = ({ slots, bg }: { slots: Slots; bg?: Background }) => {
  const { theme, wrapperStyle } = themeFor(bg);
  return (
    <div style={{ ...wrapperStyle, width: '100%', height: '100%', padding: '80px 90px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', gap: 28 }}>
      <Eyebrow theme={theme}>{slots.eyebrow || 'tellar'}</Eyebrow>
      <Title html={slots.title} size={110} theme={theme} />
      <Sub html={slots.subtitle} theme={theme} />
    </div>
  );
};

const HeadlineLayout = ({ slots, bg }: { slots: Slots; bg?: Background }) => {
  const { theme, wrapperStyle } = themeFor(bg);
  return (
    <div style={{ ...wrapperStyle, width: '100%', height: '100%', padding: '70px 80px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <Eyebrow theme={theme}>{slots.eyebrow}</Eyebrow>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Title html={slots.title} size={76} theme={theme} />
        <Sub html={slots.subtitle} theme={theme} />
      </div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: theme.eyebrow, display: 'flex', justifyContent: 'space-between' }}>
        <span>tellar</span>
      </div>
    </div>
  );
};

const BigNumberLayout = ({ slots, bg }: { slots: Slots; bg?: Background }) => {
  const { theme, wrapperStyle } = themeFor(bg);
  return (
    <div style={{ ...wrapperStyle, width: '100%', height: '100%', padding: '70px 80px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 28 }}>
      <Eyebrow theme={theme}>{slots.eyebrow}</Eyebrow>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 18 }}>
        {slots.prefix && <span style={{ fontFamily: 'var(--serif)', fontSize: 64, color: theme.sub, fontStyle: 'italic' }}>{slots.prefix}</span>}
        <span style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(80px, 14vw, 220px)', fontWeight: 400, lineHeight: 1, letterSpacing: '-.04em', color: theme.ink }}>
          {slots.number || '—'}
        </span>
        {slots.unit && <span style={{ fontFamily: 'var(--serif)', fontSize: 56, color: theme.accent, fontStyle: 'italic' }}>{slots.unit}</span>}
      </div>
      <Sub html={slots.caption} theme={theme} />
    </div>
  );
};

const TwoColumnLayout = ({ slots, bg }: { slots: Slots; bg?: Background }) => {
  const { theme, wrapperStyle } = themeFor(bg);
  return (
    <div style={{ ...wrapperStyle, width: '100%', height: '100%', padding: '70px 80px', display: 'flex', flexDirection: 'column', gap: 36 }}>
      <Title html={slots.headline} size={56} theme={theme} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 50, marginTop: 'auto', flex: 1 }}>
        {[0, 1].map(i => {
          const t = i === 0 ? slots.leftTitle : slots.rightTitle;
          const b = i === 0 ? slots.leftBody : slots.rightBody;
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.25em', color: theme.eyebrow, textTransform: 'uppercase' }}>
                {i === 0 ? '0 1' : '0 2'}
              </div>
              {t && <div style={{ fontFamily: 'var(--serif)', fontSize: 28, color: theme.ink, fontWeight: 500 }} dangerouslySetInnerHTML={{ __html: applyAccent(sanitizeSlideHtml(t), theme.accent) }} />}
              {b && <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 17, color: theme.sub, lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: applyAccent(sanitizeSlideHtml(b), theme.accent) }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const QuoteLayout = ({ slots, bg }: { slots: Slots; bg?: Background }) => {
  const { theme, wrapperStyle } = themeFor(bg);
  return (
    <div style={{ ...wrapperStyle, width: '100%', height: '100%', padding: '70px 100px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 32 }}>
      <div style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(40px, 5.5vw, 72px)', fontWeight: 300, lineHeight: 1.1, letterSpacing: '-.02em', color: theme.ink }}
           dangerouslySetInnerHTML={{ __html: `"${applyAccent(sanitizeSlideHtml(slots.quote || ''), theme.accent)}"` }} />
      {(slots.author || slots.role) && (
        <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: theme.sub, letterSpacing: '.1em' }}>
          — {slots.author}{slots.role ? <span style={{ color: theme.accent }}> · {slots.role}</span> : null}
        </div>
      )}
    </div>
  );
};

const ImageFullLayout = ({ slots, bg }: { slots: Slots; bg?: Background }) => {
  const { theme, wrapperStyle } = themeFor(bg);
  return (
    <div style={{ ...wrapperStyle, width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {slots.image?.url && (
        <img src={slots.image.url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      )}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 40%, rgba(0,0,0,.7) 100%)' }} />
      <div style={{ position: 'absolute', inset: 0, padding: '70px 80px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', color: '#f6f3ed' }}>
        <Eyebrow theme={{ ...theme, eyebrow: '#f6f3ed' }}>{slots.eyebrow}</Eyebrow>
        <Title html={slots.title} size={72} theme={{ ...theme, ink: '#f6f3ed' }} />
        <Sub html={slots.caption} theme={{ ...theme, sub: '#e8e6e1' }} />
      </div>
    </div>
  );
};

const ImageRightLayout = ({ slots, bg }: { slots: Slots; bg?: Background }) => {
  const { theme, wrapperStyle } = themeFor(bg);
  return (
    <div style={{ ...wrapperStyle, width: '100%', height: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
      <div style={{ padding: '70px 60px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 20 }}>
        <Eyebrow theme={theme}>{slots.eyebrow}</Eyebrow>
        <Title html={slots.title} size={56} theme={theme} />
        <Sub html={slots.body} theme={theme} />
      </div>
      <div style={{ position: 'relative', background: '#0c0d0f', overflow: 'hidden' }}>
        {slots.image?.url
          ? <img src={slots.image.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#6d6a63', fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase' }}>no image</div>
        }
      </div>
    </div>
  );
};

const BulletsLayout = ({ slots, bg }: { slots: Slots; bg?: Background }) => {
  const { theme, wrapperStyle } = themeFor(bg);
  const bullets: string[] = Array.isArray(slots.bullets) ? slots.bullets : [];
  return (
    <div style={{ ...wrapperStyle, width: '100%', height: '100%', padding: '70px 90px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 30 }}>
      <Title html={slots.title} size={56} theme={theme} />
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {bullets.slice(0, 6).map((b, i) => (
          <li key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: theme.accent, letterSpacing: '.15em', paddingTop: 6, flexShrink: 0 }}>
              {String(i + 1).padStart(2, '0')}
            </span>
            <span style={{ fontFamily: 'var(--serif)', fontSize: 22, color: theme.ink, lineHeight: 1.45 }}
                  dangerouslySetInnerHTML={{ __html: applyAccent(sanitizeSlideHtml(b), theme.accent) }} />
          </li>
        ))}
      </ul>
    </div>
  );
};

const GridLayout = ({ slots, bg }: { slots: Slots; bg?: Background }) => {
  const { theme, wrapperStyle } = themeFor(bg);
  const items: Array<{ title?: string; body?: string; image?: { url?: string } }> = Array.isArray(slots.items) ? slots.items : [];
  return (
    <div style={{ ...wrapperStyle, width: '100%', height: '100%', padding: '60px 70px', display: 'flex', flexDirection: 'column', gap: 30 }}>
      <Title html={slots.title} size={44} theme={theme} />
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18 }}>
        {items.slice(0, 6).map((it, i) => (
          <div key={i} style={{ border: `1px solid ${theme.eyebrow}22`, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {it.image?.url && <div style={{ aspectRatio: '4/3', backgroundImage: `url(${it.image.url})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />}
            {it.title && <div style={{ fontFamily: 'var(--serif)', fontSize: 18, color: theme.ink, fontWeight: 500 }}>{it.title}</div>}
            {it.body && <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: theme.sub, letterSpacing: '.1em', textTransform: 'uppercase' }}>{it.body}</div>}
          </div>
        ))}
      </div>
    </div>
  );
};

const ComparisonLayout = ({ slots, bg }: { slots: Slots; bg?: Background }) => {
  const { theme, wrapperStyle } = themeFor(bg);
  const left: string[] = Array.isArray(slots.left) ? slots.left : [];
  const right: string[] = Array.isArray(slots.right) ? slots.right : [];
  return (
    <div style={{ ...wrapperStyle, width: '100%', height: '100%', padding: '60px 70px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Title html={slots.headline} size={40} theme={theme} />
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}>
        {[
          { title: slots.leftTitle || 'Before', items: left, icon: '✕', color: theme.sub },
          { title: slots.rightTitle || 'Tellar', items: right, icon: '✓', color: theme.accent },
        ].map((col, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.25em', color: col.color, textTransform: 'uppercase' }}>
              {col.title}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {col.items.slice(0, 5).map((line, j) => (
                <div key={j} style={{ display: 'flex', gap: 10, fontFamily: 'var(--serif)', fontSize: 17, color: theme.ink, lineHeight: 1.45 }}>
                  <span style={{ color: col.color, flexShrink: 0 }}>{col.icon}</span>
                  <span>{line}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ThanksLayout = ({ slots, bg }: { slots: Slots; bg?: Background }) => {
  const { theme, wrapperStyle } = themeFor(bg);
  return (
    <div style={{ ...wrapperStyle, width: '100%', height: '100%', display: 'grid', placeItems: 'center', padding: 60 }}>
      <Title html={slots.title || 'Thank <em>you.</em>'} size={140} theme={theme} />
    </div>
  );
};

// Registry --------------------------------------------------------------------

export const LAYOUTS: Record<string, LayoutMeta & { render: React.FC<{ slots: Slots; bg?: Background }> }> = {
  cover:      { id: 'cover',      label: 'Cover',      hint: 'Opening slide — brand + tagline',           slots: { eyebrow: 'text', title: 'text', subtitle: 'text' }, defaultBg: 'cream', render: CoverLayout },
  headline:   { id: 'headline',   label: 'Headline',   hint: 'Eyebrow · bold title · italic subtitle',    slots: { eyebrow: 'text', title: 'text', subtitle: 'text' }, defaultBg: 'cream', render: HeadlineLayout },
  bigNumber:  { id: 'bigNumber',  label: 'Big number', hint: 'One huge stat with prefix, unit, caption',  slots: { eyebrow: 'text', prefix: 'text', number: 'text', unit: 'text', caption: 'text' }, defaultBg: 'cream', render: BigNumberLayout },
  twoColumn:  { id: 'twoColumn',  label: 'Two column', hint: 'Headline + two parallel points',            slots: { headline: 'text', leftTitle: 'text', leftBody: 'text', rightTitle: 'text', rightBody: 'text' }, defaultBg: 'cream', render: TwoColumnLayout },
  quote:      { id: 'quote',      label: 'Quote',      hint: 'Pull quote with author',                    slots: { quote: 'text', author: 'text', role: 'text' }, defaultBg: 'cream', render: QuoteLayout },
  imageFull:  { id: 'imageFull',  label: 'Image full', hint: 'Edge-to-edge photo with caption overlay',   slots: { image: 'image', eyebrow: 'text', title: 'text', caption: 'text' }, defaultBg: 'image', render: ImageFullLayout },
  imageRight: { id: 'imageRight', label: 'Image right',hint: 'Copy on the left, image on the right',     slots: { eyebrow: 'text', title: 'text', body: 'text', image: 'image' }, defaultBg: 'cream', render: ImageRightLayout },
  bullets:    { id: 'bullets',    label: 'Bullets',    hint: 'Title + up to 6 numbered bullets',          slots: { title: 'text', bullets: 'text[]' }, defaultBg: 'cream', render: BulletsLayout },
  grid:       { id: 'grid',       label: 'Grid',       hint: '2×3 card grid — perfect for team or logos', slots: { title: 'text', items: 'text[]' }, defaultBg: 'cream', render: GridLayout },
  comparison: { id: 'comparison', label: 'Comparison', hint: 'Two columns: before vs. after',             slots: { headline: 'text', leftTitle: 'text', rightTitle: 'text', left: 'text[]', right: 'text[]' }, defaultBg: 'cream', render: ComparisonLayout },
  thanks:     { id: 'thanks',     label: 'Thanks',     hint: 'Closing slide',                             slots: { title: 'text' }, defaultBg: 'cream', render: ThanksLayout },
};

export const LAYOUT_LIST: LayoutMeta[] = Object.values(LAYOUTS).map(({ render, ...m }) => m);

// Legacy bridge ---------------------------------------------------------------

/**
 * Convert a Slide row (any shape, old or new) into { layoutId, slots, bg }.
 * Guarantees backwards compatibility for the thousands of rows that were
 * created before this refactor: they all fall into "headline" with their
 * legacy eyebrow/title/subtitle mapped into the slot bag.
 */
export function resolveSlide(slide: any): { layoutId: string; slots: Slots; bg: Background } {
  const layoutId = slide.layoutId || 'headline';
  const rawSlots = (slide.layout && typeof slide.layout === 'object' && !Array.isArray(slide.layout)) ? slide.layout : {};
  const bg = (slide.background && typeof slide.background === 'object' && !Array.isArray(slide.background)) ? slide.background as Background : {};

  const slots: Slots = { ...rawSlots };
  if (slots.eyebrow == null && slide.eyebrow != null) slots.eyebrow = slide.eyebrow;
  if (slots.title == null && slide.title != null) slots.title = slide.title;
  if (slots.subtitle == null && slide.subtitle != null) slots.subtitle = slide.subtitle;

  return { layoutId, slots, bg };
}

export function RenderSlide({ slide, style }: { slide: any; style?: CSSProperties }): ReactNode {
  const { layoutId, slots, bg } = resolveSlide(slide);
  const layout = LAYOUTS[layoutId] || LAYOUTS.headline;
  const Render = layout.render;
  return (
    <div style={{ width: '100%', height: '100%', ...style }}>
      <Render slots={slots} bg={bg} />
    </div>
  );
}
