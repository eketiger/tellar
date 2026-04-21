'use client';

import { useMemo, useState } from 'react';
import { LAYOUT_LIST, LAYOUTS, RenderSlide } from '@/lib/slide-layouts';

export function LayoutPicker({
  current,
  onPick,
  onCancel,
}: {
  current?: string;
  onPick: (layoutId: string) => void;
  onCancel: () => void;
}) {
  const [hover, setHover] = useState<string | null>(null);

  // Tiny preview for each layout uses placeholder slot content.
  const previews = useMemo(() =>
    LAYOUT_LIST.map(meta => ({
      meta,
      stub: stubFor(meta.id),
    })),
  []);

  return (
    <div
      onClick={onCancel}
      style={{ position: 'fixed', inset: 0, background: 'rgba(12,13,15,.9)', backdropFilter: 'blur(8px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 1100, width: '100%', background: 'var(--panel)', border: '1px solid var(--line-2)', padding: 30 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.2em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 6 }}>layout picker</div>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 500 }}>
              Pick a <em style={{ color: 'var(--accent)' }}>layout</em>
            </h2>
          </div>
          <button className="btn btn-ghost" onClick={onCancel}>Close</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
          {previews.map(({ meta, stub }) => {
            const isCurrent = meta.id === current;
            return (
              <button
                key={meta.id}
                onClick={() => onPick(meta.id)}
                onMouseEnter={() => setHover(meta.id)}
                onMouseLeave={() => setHover(null)}
                style={{
                  padding: 0,
                  background: 'var(--panel-2)',
                  border: '1px solid ' + (isCurrent ? 'var(--accent)' : hover === meta.id ? 'var(--line-3)' : 'var(--line)'),
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'all .15s',
                  textAlign: 'left',
                  color: 'inherit',
                }}
              >
                <div style={{ aspectRatio: '16/10', overflow: 'hidden', borderBottom: '1px solid var(--line)', position: 'relative' }}>
                  <div style={{ transform: 'scale(0.22)', transformOrigin: 'top left', width: '454%', height: '454%' }}>
                    <RenderSlide slide={{ layoutId: meta.id, layout: stub, background: { kind: meta.defaultBg } }} />
                  </div>
                </div>
                <div style={{ padding: '10px 14px' }}>
                  <div style={{ fontFamily: 'var(--serif)', fontSize: 14, fontWeight: 500 }}>
                    {meta.label}{isCurrent && <span style={{ color: 'var(--accent)', fontSize: 10, marginLeft: 8, fontFamily: 'var(--mono)', letterSpacing: '.15em', textTransform: 'uppercase' }}>current</span>}
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '.05em', marginTop: 2 }}>{meta.hint}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function stubFor(id: string): Record<string, any> {
  switch (id) {
    case 'cover':      return { eyebrow: 'series a · q2', title: 'Tellar <em>— the deck that answers back.</em>', subtitle: 'Presentations that know when they lose you.' };
    case 'headline':   return { eyebrow: 'slide 04 / the market', title: 'A <em>$34B</em> market<br/>growing 28% <em>year over year</em>.', subtitle: 'Enterprise is eating the last 15% of Fortune 1000 workflows.' };
    case 'bigNumber':  return { eyebrow: 'traction', prefix: '$', number: '1.4', unit: 'M ARR', caption: '134% <em>net revenue retention</em> · 61% PLG.' };
    case 'twoColumn':  return { headline: 'The <em>wedge</em>.', leftTitle: 'DocSend', leftBody: 'Tells you they opened page 7. Stops there.', rightTitle: 'Tellar', rightBody: 'Every slide is a video, a doc, and a <em>conversation</em>.' };
    case 'quote':      return { quote: 'Three investor meetings in <em>48 hours</em>. One of them re-watched slide 4 twice. That slide was the deal.', author: 'Nora Álvarez', role: 'founder, Kova' };
    case 'imageFull':  return { eyebrow: 'case study', title: 'Kova raised <em>$6M</em>.', caption: 'Closed their round in three weeks using a single Tellar link.' };
    case 'imageRight': return { eyebrow: 'the product', title: 'Record <em>once</em>. Share <em>everywhere</em>.', body: 'Browser-native MediaRecorder with slide-synced narration.' };
    case 'bullets':    return { title: 'Why <em>now</em>.', bullets: ['AI finally makes a deck that answers back feasible.', 'Viewer attention is the scarcest resource.', 'Buyers re-read, they don\'t ask.', 'The PDF is dead weight.'] };
    case 'grid':       return { title: 'The <em>team</em>.', items: [{ title: 'Martín', body: 'Stripe · Notion' }, { title: 'Ana', body: 'Loom · Gamma' }, { title: 'Leo', body: 'Retool · Vercel' }, { title: 'Sofía', body: 'Tellar · founder' }] };
    case 'comparison': return { headline: '<em>Before</em> vs. after.', leftTitle: 'PDFs into the void', rightTitle: 'Tellar links', left: ['Nobody knows who opened.', 'Q&A never arrives.', 'Three tabs: DocSend · Loom · ChatGPT.'], right: ['Real-time funnel per slide.', 'Agent fields Qs with citations.', 'One link. One surface. One stack.'] };
    case 'thanks':     return { title: 'Thank <em>you</em>.' };
    default:           return { title: 'Preview' };
  }
}
