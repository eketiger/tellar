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
 *
 * The same registry powers both the viewer and the editor. When the editor
 * passes `edit`, text slots become contentEditable (focus draws a dashed
 * bounding box), list slots gain inline add/remove, and image slots get a
 * "change image" overlay.
 */

'use client';

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
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

export interface EditCtx {
  onSlotChange: (name: string, value: any) => void;
  onPickImage: (name: string) => void;
}

const THEMES: Record<BackgroundKind, { bg: string; ink: string; sub: string; accent: string; eyebrow: string; isDark: boolean }> = {
  cream:    { bg: '#f6f3ed', ink: '#1a1a1a', sub: '#555',    accent: '#c89a3a', eyebrow: '#888',    isDark: false },
  paper:    { bg: '#ece7db', ink: '#1a1a1a', sub: '#555',    accent: '#a16928', eyebrow: '#7a7569', isDark: false },
  midnight: { bg: '#0c1220', ink: '#f4efe6', sub: '#a8afbe', accent: '#f4b942', eyebrow: '#5b627a', isDark: true  },
  dark:     { bg: '#1a1a1a', ink: '#f6f3ed', sub: '#a8a69e', accent: '#f4b942', eyebrow: '#6d6a63', isDark: true  },
  image:    { bg: '#0c0d0f', ink: '#f4efe6', sub: '#e8e6e1', accent: '#f4b942', eyebrow: '#e8e6e1', isDark: true  },
};

type Theme = typeof THEMES.cream;

function themeFor(bg: Background | undefined): { theme: Theme; wrapperStyle: CSSProperties } {
  const kind = bg?.kind || 'cream';
  const theme = THEMES[kind];
  const wrapperStyle: CSSProperties = {
    background: kind === 'image' && bg?.imageUrl ? `url(${bg.imageUrl}) center/cover` : theme.bg,
    color: theme.ink,
  };
  return { theme, wrapperStyle };
}

function applyAccent(html: string, color: string) {
  return html.replace(/<em>/g, `<em style="color:${color};font-style:italic">`);
}

// ---------------------------------------------------------------------------
// EditableText — a contentEditable island. React renders it once; after the
// first paint, we never re-write innerHTML while it's focused, to avoid
// clobbering the user's caret. External updates only flow in when the element
// is blurred.
// ---------------------------------------------------------------------------
function EditableText({
  html,
  placeholder,
  multiline,
  className,
  style,
  onChange,
}: {
  html: string;
  placeholder?: string;
  multiline?: boolean;
  className?: string;
  style?: CSSProperties;
  onChange: (value: string) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const lastPropRef = useRef<string>(html);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (document.activeElement === node) return;
    if (lastPropRef.current === html && node.innerHTML === html) return;
    lastPropRef.current = html;
    node.innerHTML = html || '';
  }, [html]);

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      className={`slot-edit${className ? ' ' + className : ''}`}
      data-placeholder={placeholder || ''}
      style={style}
      onKeyDown={(e) => {
        if (!multiline && e.key === 'Enter') { e.preventDefault(); (e.currentTarget as HTMLDivElement).blur(); }
      }}
      onPaste={(e) => {
        // Strip formatting on paste — slides stay clean.
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        document.execCommand('insertText', false, text);
      }}
      onBlur={(e) => {
        const raw = sanitizeSlideHtml(e.currentTarget.innerHTML);
        lastPropRef.current = raw;
        onChange(raw);
      }}
      dangerouslySetInnerHTML={{ __html: html || '' }}
    />
  );
}

// Small helper: render either a decorated view-only block or an editable one.
function TextSlot({
  value,
  name,
  theme,
  edit,
  style,
  placeholder,
  multiline,
  className,
}: {
  value?: string;
  name: string;
  theme: Theme;
  edit?: EditCtx;
  style: CSSProperties;
  placeholder?: string;
  multiline?: boolean;
  className?: string;
}) {
  if (edit) {
    return (
      <EditableText
        html={value || ''}
        placeholder={placeholder}
        multiline={multiline}
        className={className}
        style={style}
        onChange={v => edit.onSlotChange(name, v)}
      />
    );
  }
  if (!value) return null;
  return (
    <div
      className={className}
      style={style}
      dangerouslySetInnerHTML={{ __html: applyAccent(sanitizeSlideHtml(value), theme.accent) }}
    />
  );
}

function ImageOverlay({ name, edit }: { name: string; edit?: EditCtx }) {
  if (!edit) return null;
  return (
    <button
      type="button"
      className="slot-image-overlay"
      onClick={(e) => { e.stopPropagation(); edit.onPickImage(name); }}
    >
      change image
    </button>
  );
}

function ListSlot({
  values,
  name,
  max,
  edit,
  theme,
  renderItem,
  itemPlaceholder,
}: {
  values: string[];
  name: string;
  max: number;
  edit?: EditCtx;
  theme: Theme;
  renderItem: (html: string, i: number, editable: boolean, onChange: (v: string) => void) => ReactNode;
  itemPlaceholder?: string;
}) {
  if (!edit) {
    return <>{values.slice(0, max).map((v, i) => renderItem(v, i, false, () => {}))}</>;
  }
  const update = (next: string[]) => edit.onSlotChange(name, next);
  return (
    <>
      {values.map((v, i) => (
        <div key={i} className="slot-list-row">
          <div style={{ flex: 1 }}>
            {renderItem(v, i, true, (nv) => {
              const next = values.slice();
              if (!nv) next.splice(i, 1); else next[i] = nv;
              update(next);
            })}
          </div>
          <button
            type="button"
            className="slot-list-remove"
            title="Remove"
            onClick={() => update(values.filter((_, j) => j !== i))}
          >
            ✕
          </button>
        </div>
      ))}
      {values.length < max && (
        <button
          type="button"
          className="slot-list-add"
          onClick={() => update([...values, itemPlaceholder ? '' : ''])}
        >
          + add line
        </button>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Layouts
// ---------------------------------------------------------------------------

const CoverLayout = ({ slots, bg, edit }: { slots: Slots; bg?: Background; edit?: EditCtx }) => {
  const { theme, wrapperStyle } = themeFor(bg);
  return (
    <div style={{ ...wrapperStyle, width: '100%', height: '100%', padding: '80px 90px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', gap: 28 }}>
      <TextSlot name="eyebrow" value={slots.eyebrow} theme={theme} edit={edit} placeholder="eyebrow" style={eyebrowStyle(theme)} />
      <TextSlot name="title" value={slots.title} theme={theme} edit={edit} placeholder="Main title" style={titleStyle(theme, 110)} />
      <TextSlot name="subtitle" value={slots.subtitle} theme={theme} edit={edit} placeholder="Subtitle" style={subStyle(theme)} />
    </div>
  );
};

const HeadlineLayout = ({ slots, bg, edit }: { slots: Slots; bg?: Background; edit?: EditCtx }) => {
  const { theme, wrapperStyle } = themeFor(bg);
  return (
    <div style={{ ...wrapperStyle, width: '100%', height: '100%', padding: '70px 80px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <TextSlot name="eyebrow" value={slots.eyebrow} theme={theme} edit={edit} placeholder="eyebrow" style={eyebrowStyle(theme)} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <TextSlot name="title" value={slots.title} theme={theme} edit={edit} placeholder="Headline" style={titleStyle(theme, 76)} />
        <TextSlot name="subtitle" value={slots.subtitle} theme={theme} edit={edit} placeholder="Subtitle" style={subStyle(theme)} />
      </div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: theme.eyebrow, display: 'flex', justifyContent: 'space-between' }}>
        <span>tellar</span>
      </div>
    </div>
  );
};

const BigNumberLayout = ({ slots, bg, edit }: { slots: Slots; bg?: Background; edit?: EditCtx }) => {
  const { theme, wrapperStyle } = themeFor(bg);
  return (
    <div style={{ ...wrapperStyle, width: '100%', height: '100%', padding: '70px 80px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 28 }}>
      <TextSlot name="eyebrow" value={slots.eyebrow} theme={theme} edit={edit} placeholder="eyebrow" style={eyebrowStyle(theme)} />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, flexWrap: 'wrap' }}>
        <TextSlot name="prefix" value={slots.prefix} theme={theme} edit={edit} placeholder="$" style={{ fontFamily: 'var(--serif)', fontSize: 64, color: theme.sub, fontStyle: 'italic', minWidth: 24 }} />
        <TextSlot name="number" value={slots.number || (edit ? '' : '—')} theme={theme} edit={edit} placeholder="1.4" style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(80px, 14vw, 220px)', fontWeight: 400, lineHeight: 1, letterSpacing: '-.04em', color: theme.ink, minWidth: 80 }} />
        <TextSlot name="unit" value={slots.unit} theme={theme} edit={edit} placeholder="M ARR" style={{ fontFamily: 'var(--serif)', fontSize: 56, color: theme.accent, fontStyle: 'italic', minWidth: 40 }} />
      </div>
      <TextSlot name="caption" value={slots.caption} theme={theme} edit={edit} placeholder="Caption" style={subStyle(theme)} />
    </div>
  );
};

const TwoColumnLayout = ({ slots, bg, edit }: { slots: Slots; bg?: Background; edit?: EditCtx }) => {
  const { theme, wrapperStyle } = themeFor(bg);
  return (
    <div style={{ ...wrapperStyle, width: '100%', height: '100%', padding: '70px 80px', display: 'flex', flexDirection: 'column', gap: 36 }}>
      <TextSlot name="headline" value={slots.headline} theme={theme} edit={edit} placeholder="The wedge." style={titleStyle(theme, 56)} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 50, marginTop: 'auto', flex: 1 }}>
        {[0, 1].map(i => {
          const titleKey = i === 0 ? 'leftTitle' : 'rightTitle';
          const bodyKey = i === 0 ? 'leftBody' : 'rightBody';
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.25em', color: theme.eyebrow, textTransform: 'uppercase' }}>
                {i === 0 ? '0 1' : '0 2'}
              </div>
              <TextSlot name={titleKey} value={slots[titleKey]} theme={theme} edit={edit} placeholder="Column title" style={{ fontFamily: 'var(--serif)', fontSize: 28, color: theme.ink, fontWeight: 500 }} />
              <TextSlot name={bodyKey} value={slots[bodyKey]} theme={theme} edit={edit} placeholder="Column body" multiline style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 17, color: theme.sub, lineHeight: 1.5 }} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

const QuoteLayout = ({ slots, bg, edit }: { slots: Slots; bg?: Background; edit?: EditCtx }) => {
  const { theme, wrapperStyle } = themeFor(bg);
  const quoteStyle: CSSProperties = { fontFamily: 'var(--serif)', fontSize: 'clamp(40px, 5.5vw, 72px)', fontWeight: 300, lineHeight: 1.1, letterSpacing: '-.02em', color: theme.ink };
  return (
    <div style={{ ...wrapperStyle, width: '100%', height: '100%', padding: '70px 100px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 32 }}>
      {edit ? (
        <TextSlot name="quote" value={slots.quote} theme={theme} edit={edit} placeholder="Pull quote…" multiline style={quoteStyle} />
      ) : (
        <div style={quoteStyle} dangerouslySetInnerHTML={{ __html: `"${applyAccent(sanitizeSlideHtml(slots.quote || ''), theme.accent)}"` }} />
      )}
      <div style={{ display: 'flex', gap: 10, fontFamily: 'var(--mono)', fontSize: 13, color: theme.sub, letterSpacing: '.1em', alignItems: 'baseline' }}>
        <span>—</span>
        <TextSlot name="author" value={slots.author} theme={theme} edit={edit} placeholder="Author" style={{ color: theme.sub }} />
        {(slots.role || edit) && <span style={{ color: theme.accent }}>·</span>}
        <TextSlot name="role" value={slots.role} theme={theme} edit={edit} placeholder="role, company" style={{ color: theme.accent }} />
      </div>
    </div>
  );
};

const ImageFullLayout = ({ slots, bg, edit }: { slots: Slots; bg?: Background; edit?: EditCtx }) => {
  const { theme, wrapperStyle } = themeFor(bg);
  const overlayTheme = { ...theme, eyebrow: '#f6f3ed', ink: '#f6f3ed', sub: '#e8e6e1' };
  return (
    <div style={{ ...wrapperStyle, width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {slots.image?.url
        ? <img src={slots.image.url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        : <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#6d6a63', fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', background: '#0c0d0f' }}>no image</div>}
      <ImageOverlay name="image" edit={edit} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 40%, rgba(0,0,0,.7) 100%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 0, padding: '70px 80px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 12, color: '#f6f3ed' }}>
        <TextSlot name="eyebrow" value={slots.eyebrow} theme={overlayTheme} edit={edit} placeholder="eyebrow" style={eyebrowStyle(overlayTheme)} />
        <TextSlot name="title" value={slots.title} theme={overlayTheme} edit={edit} placeholder="Title" style={titleStyle(overlayTheme, 72)} />
        <TextSlot name="caption" value={slots.caption} theme={overlayTheme} edit={edit} placeholder="Caption" style={subStyle(overlayTheme)} />
      </div>
    </div>
  );
};

const ImageRightLayout = ({ slots, bg, edit }: { slots: Slots; bg?: Background; edit?: EditCtx }) => {
  const { theme, wrapperStyle } = themeFor(bg);
  return (
    <div style={{ ...wrapperStyle, width: '100%', height: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
      <div style={{ padding: '70px 60px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 20 }}>
        <TextSlot name="eyebrow" value={slots.eyebrow} theme={theme} edit={edit} placeholder="eyebrow" style={eyebrowStyle(theme)} />
        <TextSlot name="title" value={slots.title} theme={theme} edit={edit} placeholder="Title" style={titleStyle(theme, 56)} />
        <TextSlot name="body" value={slots.body} theme={theme} edit={edit} placeholder="Body" multiline style={subStyle(theme)} />
      </div>
      <div style={{ position: 'relative', background: '#0c0d0f', overflow: 'hidden' }}>
        {slots.image?.url
          ? <img src={slots.image.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#6d6a63', fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase' }}>no image</div>}
        <ImageOverlay name="image" edit={edit} />
      </div>
    </div>
  );
};

const BulletsLayout = ({ slots, bg, edit }: { slots: Slots; bg?: Background; edit?: EditCtx }) => {
  const { theme, wrapperStyle } = themeFor(bg);
  const bullets: string[] = Array.isArray(slots.bullets) ? slots.bullets : [];
  const lineStyle: CSSProperties = { fontFamily: 'var(--serif)', fontSize: 22, color: theme.ink, lineHeight: 1.45, flex: 1 };
  return (
    <div style={{ ...wrapperStyle, width: '100%', height: '100%', padding: '70px 90px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 30 }}>
      <TextSlot name="title" value={slots.title} theme={theme} edit={edit} placeholder="Title" style={titleStyle(theme, 56)} />
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <ListSlot
          values={bullets}
          name="bullets"
          max={6}
          edit={edit}
          theme={theme}
          itemPlaceholder="Bullet…"
          renderItem={(html, i, editable, onChange) => (
            <li key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: theme.accent, letterSpacing: '.15em', paddingTop: 6, flexShrink: 0 }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              {editable
                ? <EditableText html={html} placeholder="Bullet…" style={lineStyle} onChange={onChange} />
                : <span style={lineStyle} dangerouslySetInnerHTML={{ __html: applyAccent(sanitizeSlideHtml(html), theme.accent) }} />}
            </li>
          )}
        />
      </ul>
    </div>
  );
};

const GridLayout = ({ slots, bg, edit }: { slots: Slots; bg?: Background; edit?: EditCtx }) => {
  const { theme, wrapperStyle } = themeFor(bg);
  const items: Array<{ title?: string; body?: string; image?: { url?: string } }> = Array.isArray(slots.items) ? slots.items : [];
  const update = (next: typeof items) => edit?.onSlotChange('items', next);
  return (
    <div style={{ ...wrapperStyle, width: '100%', height: '100%', padding: '60px 70px', display: 'flex', flexDirection: 'column', gap: 30 }}>
      <TextSlot name="title" value={slots.title} theme={theme} edit={edit} placeholder="Title" style={titleStyle(theme, 44)} />
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18 }}>
        {items.slice(0, 6).map((it, i) => (
          <div key={i} style={{ border: `1px solid ${theme.eyebrow}22`, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, position: 'relative' }}>
            {it.image?.url && <div style={{ aspectRatio: '4/3', backgroundImage: `url(${it.image.url})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />}
            {edit ? (
              <>
                <EditableText
                  html={it.title || ''}
                  placeholder="Name"
                  style={{ fontFamily: 'var(--serif)', fontSize: 18, color: theme.ink, fontWeight: 500 }}
                  onChange={v => update(items.map((x, j) => j === i ? { ...x, title: v } : x))}
                />
                <EditableText
                  html={it.body || ''}
                  placeholder="role"
                  style={{ fontFamily: 'var(--mono)', fontSize: 10, color: theme.sub, letterSpacing: '.1em', textTransform: 'uppercase' }}
                  onChange={v => update(items.map((x, j) => j === i ? { ...x, body: v } : x))}
                />
                <button
                  type="button"
                  className="slot-list-remove"
                  title="Remove"
                  style={{ position: 'absolute', top: 4, right: 4 }}
                  onClick={() => update(items.filter((_, j) => j !== i))}
                >
                  ✕
                </button>
              </>
            ) : (
              <>
                {it.title && <div style={{ fontFamily: 'var(--serif)', fontSize: 18, color: theme.ink, fontWeight: 500 }}>{it.title}</div>}
                {it.body && <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: theme.sub, letterSpacing: '.1em', textTransform: 'uppercase' }}>{it.body}</div>}
              </>
            )}
          </div>
        ))}
        {edit && items.length < 6 && (
          <button
            type="button"
            className="slot-list-add"
            style={{ minHeight: 90 }}
            onClick={() => update([...items, { title: '', body: '' }])}
          >
            + add card
          </button>
        )}
      </div>
    </div>
  );
};

const ComparisonLayout = ({ slots, bg, edit }: { slots: Slots; bg?: Background; edit?: EditCtx }) => {
  const { theme, wrapperStyle } = themeFor(bg);
  const left: string[] = Array.isArray(slots.left) ? slots.left : [];
  const right: string[] = Array.isArray(slots.right) ? slots.right : [];
  const lineStyle: CSSProperties = { fontFamily: 'var(--serif)', fontSize: 17, color: theme.ink, lineHeight: 1.45, flex: 1 };
  return (
    <div style={{ ...wrapperStyle, width: '100%', height: '100%', padding: '60px 70px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <TextSlot name="headline" value={slots.headline} theme={theme} edit={edit} placeholder="Before vs. after." style={titleStyle(theme, 40)} />
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}>
        {[
          { titleKey: 'leftTitle',  listKey: 'left',  items: left,  icon: '✕', color: theme.sub,    defaultTitle: 'Before' },
          { titleKey: 'rightTitle', listKey: 'right', items: right, icon: '✓', color: theme.accent, defaultTitle: 'Tellar' },
        ].map((col, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <TextSlot
              name={col.titleKey}
              value={slots[col.titleKey] || (edit ? '' : col.defaultTitle)}
              theme={theme}
              edit={edit}
              placeholder={col.defaultTitle}
              style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.25em', color: col.color, textTransform: 'uppercase' }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <ListSlot
                values={col.items}
                name={col.listKey}
                max={5}
                edit={edit}
                theme={theme}
                renderItem={(html, j, editable, onChange) => (
                  <div key={j} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ color: col.color, flexShrink: 0, fontFamily: 'var(--serif)', fontSize: 17 }}>{col.icon}</span>
                    {editable
                      ? <EditableText html={html} placeholder="Point…" style={lineStyle} onChange={onChange} />
                      : <span style={lineStyle}>{html}</span>}
                  </div>
                )}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ThanksLayout = ({ slots, bg, edit }: { slots: Slots; bg?: Background; edit?: EditCtx }) => {
  const { theme, wrapperStyle } = themeFor(bg);
  return (
    <div style={{ ...wrapperStyle, width: '100%', height: '100%', display: 'grid', placeItems: 'center', padding: 60 }}>
      <TextSlot
        name="title"
        value={slots.title || (edit ? '' : 'Thank <em>you.</em>')}
        theme={theme}
        edit={edit}
        placeholder="Thank you."
        style={titleStyle(theme, 140)}
      />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Style helpers
// ---------------------------------------------------------------------------

function eyebrowStyle(theme: Theme): CSSProperties {
  return { fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.25em', color: theme.eyebrow, textTransform: 'uppercase' };
}
function titleStyle(theme: Theme, size: number): CSSProperties {
  return {
    fontFamily: 'var(--serif)',
    fontSize: `clamp(32px, ${size / 12}vw, ${size}px)`,
    fontWeight: 400,
    lineHeight: 1.02,
    letterSpacing: '-.025em',
    color: theme.ink,
  };
}
function subStyle(theme: Theme): CSSProperties {
  return { fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 22, color: theme.sub, lineHeight: 1.4, maxWidth: '70%' };
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

type LayoutRender = React.FC<{ slots: Slots; bg?: Background; edit?: EditCtx }>;

export const LAYOUTS: Record<string, LayoutMeta & { render: LayoutRender }> = {
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

// ---------------------------------------------------------------------------
// Legacy bridge
// ---------------------------------------------------------------------------

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

export function RenderSlide({ slide, style, edit }: { slide: any; style?: CSSProperties; edit?: EditCtx }): ReactNode {
  const { layoutId, slots, bg } = resolveSlide(slide);
  const layout = LAYOUTS[layoutId] || LAYOUTS.headline;
  const Render = layout.render;
  const theme = THEMES[bg?.kind || 'cream'];
  return (
    <div className={theme.isDark ? 'slot-dark' : undefined} style={{ width: '100%', height: '100%', ...style }}>
      <Render slots={slots} bg={bg} edit={edit} />
    </div>
  );
}
