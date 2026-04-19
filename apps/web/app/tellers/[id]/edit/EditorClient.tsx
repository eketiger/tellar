'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { sanitizeSlideHtml } from '@/lib/sanitize';
import { NarrationPanel } from './NarrationPanel';
import { KbPanel } from './KbPanel';
import { CopilotPanel } from './CopilotPanel';
import './editor.css';

interface Slide { id: string; idx: number; eyebrow: string | null; title: string; subtitle: string | null; notes: string | null; }
interface Teller { id: string; title: string; slides: Slide[]; kbSources: any[]; recordings: any[]; }

type Tab = 'copilot' | 'knowledge' | 'recording';

export function EditorClient({ teller: initial }: { teller: Teller }) {
  const [teller, setTeller] = useState<Teller>(initial);
  const [activeId, setActiveId] = useState<string | undefined>(initial.slides[0]?.id);
  const [tab, setTab] = useState<Tab>('copilot');
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved');
  const [toast, setToast] = useState<string | null>(null);

  const active = teller.slides.find(s => s.id === activeId);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const subRef = useRef<HTMLDivElement>(null);
  const eyebrowRef = useRef<HTMLDivElement>(null);

  // Write back contentEditable HTML into local state + backend when the active slide changes.
  useEffect(() => {
    if (titleRef.current && active) titleRef.current.innerHTML = sanitizeSlideHtml(active.title);
    if (subRef.current && active) subRef.current.innerText = active.subtitle || '';
    if (eyebrowRef.current && active) eyebrowRef.current.innerText = active.eyebrow || '';
  }, [activeId]);

  function flashToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 1600);
  }

  function save(slideId: string, patch: Partial<Slide>) {
    setTeller(t => ({ ...t, slides: t.slides.map(s => s.id === slideId ? { ...s, ...patch } : s) }));
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveState('saving');
    saveTimerRef.current = setTimeout(async () => {
      try { await api(`/slides/${slideId}`, { method: 'PATCH', json: patch }); }
      finally { setSaveState('saved'); }
    }, 280);
  }

  async function addSlide() {
    const s = await api<Slide>(`/tellers/${teller.id}/slides`, { method: 'POST' });
    setTeller(t => ({ ...t, slides: [...t.slides, s] }));
    setActiveId(s.id);
    flashToast('Slide added');
  }

  async function removeSlide(id: string) {
    if (teller.slides.length <= 1) { flashToast('Can\'t delete the last slide'); return; }
    if (!confirm('Delete this slide?')) return;
    await api(`/slides/${id}`, { method: 'DELETE' });
    setTeller(t => {
      const next = t.slides.filter(s => s.id !== id).map((s, i) => ({ ...s, idx: i + 1 }));
      if (id === activeId) setActiveId(next[0]?.id);
      return { ...t, slides: next };
    });
    flashToast('Slide deleted');
  }

  // Toolbar helpers — use document.execCommand for inline formatting inside contentEditable.
  function exec(cmd: string, value?: string) { document.execCommand(cmd, false, value); }
  function wrapSelectionWithEm() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const em = document.createElement('em');
    const range = sel.getRangeAt(0);
    try { range.surroundContents(em); } catch { /* cross-tag selection */ }
    if (active && titleRef.current) save(active.id, { title: titleRef.current.innerHTML });
  }

  function applyTitleFromCopilot(html: string) {
    if (!active) return;
    const clean = sanitizeSlideHtml(html);
    save(active.id, { title: clean });
    if (titleRef.current) titleRef.current.innerHTML = clean;
    flashToast('Title updated');
  }
  function applySubFromCopilot(text: string) {
    if (!active) return;
    save(active.id, { subtitle: text });
    if (subRef.current) subRef.current.innerText = text;
    flashToast('Subtitle updated');
  }
  function applyNotesFromCopilot(text: string) {
    if (!active) return;
    save(active.id, { notes: text });
    flashToast('Notes updated');
  }

  // Waveform (decorative) — 40 bars, "active" ones show narration length
  const rec = teller.recordings.find((r: any) => r.slideId === active?.id);
  const narrationDur = rec?.durationMs || 0;
  const waveBars = 40;
  const activeBars = Math.round((narrationDur / Math.max(narrationDur, 30_000)) * waveBars);

  return (
    <>
      <div className="editor-layout">
        <aside className="slide-list">
          <div className="sl-head">
            <h3>Slides · {teller.slides.length}</h3>
            <button onClick={addSlide} title="Add slide">+</button>
          </div>
          <div>
            {teller.slides.map(s => {
              const hasRec = teller.recordings.some((r: any) => r.slideId === s.id);
              return (
                <button key={s.id} className={`slide-thumb${s.id === activeId ? ' active' : ''}`} onClick={() => setActiveId(s.id)}>
                  <div className="st-num">{String(s.idx).padStart(2, '0')}</div>
                  <div className="st-card">
                    <div className="st-card-title" dangerouslySetInnerHTML={{ __html: sanitizeSlideHtml((s.title || 'Untitled').slice(0, 90)) }} />
                    {hasRec && <span className="st-rec-badge" />}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <main className="canvas-area">
          <div className="canvas-toolbar">
            <span className="tool-label">slide {String(active?.idx ?? 0).padStart(2, '0')}</span>
            <div className="tool-divider" />
            <select className="font-select" title="Font family" onChange={e => exec('fontName', e.target.value)}>
              <option value="Fraunces">Fraunces</option>
              <option value="Inter Tight">Inter Tight</option>
              <option value="JetBrains Mono">JetBrains Mono</option>
            </select>
            <select className="font-select" title="Font size" defaultValue="5" onChange={e => exec('fontSize', e.target.value)}>
              <option value="2">14</option>
              <option value="3">18</option>
              <option value="4">24</option>
              <option value="5">32</option>
              <option value="6">48</option>
              <option value="7">68</option>
            </select>
            <button className="tool-btn" onClick={() => exec('bold')} title="Bold"><span style={{ fontWeight: 700 }}>B</span></button>
            <button className="tool-btn" onClick={() => exec('italic')} title="Italic"><span style={{ fontStyle: 'italic', fontFamily: 'var(--serif)' }}>I</span></button>
            <button className="tool-btn" onClick={() => exec('underline')} title="Underline"><span style={{ textDecoration: 'underline' }}>U</span></button>
            <div className="tool-divider" />
            <button className="tool-btn" onClick={() => exec('justifyLeft')} title="Align left"><svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M1 3h12M1 7h8M1 11h12" /></svg></button>
            <button className="tool-btn" onClick={() => exec('justifyCenter')} title="Align center"><svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M1 3h12M3 7h8M1 11h12" /></svg></button>
            <button className="tool-btn" onClick={() => exec('justifyRight')} title="Align right"><svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M1 3h12M5 7h8M1 11h12" /></svg></button>
            <div className="tool-divider" />
            <span className="tool-label">color</span>
            <input type="color" defaultValue="#c89a3a" onChange={e => exec('foreColor', e.target.value)} style={{ width: 22, height: 22, background: 'none', border: '1px solid var(--line-2)', borderRadius: 2, cursor: 'pointer', padding: 0 }} />
            <button className="tool-btn" onClick={wrapSelectionWithEm} title="Italic accent (em)"><span style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', color: 'var(--accent)' }}>em</span></button>
            <div className="tool-divider" />
            <span className="tool-label">theme · editorial cream</span>
            <div style={{ flex: 1 }} />
            {active && (
              <button className="tool-btn" onClick={() => removeSlide(active.id)} title="Delete slide" style={{ color: 'var(--bad)' }}>
                <svg width={13} height={13} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M3 3l8 8M11 3l-8 8" /></svg>
              </button>
            )}
          </div>

          <div className="canvas-stage">
            {active ? (
              <div className="slide-canvas">
                <div
                  ref={eyebrowRef}
                  className="sc-eyebrow"
                  contentEditable
                  suppressContentEditableWarning
                  spellCheck={false}
                  onBlur={e => save(active.id, { eyebrow: e.currentTarget.innerText })}
                />
                <div className="sc-main">
                  <div
                    ref={titleRef}
                    className="sc-title"
                    contentEditable
                    suppressContentEditableWarning
                    spellCheck={false}
                    onBlur={e => save(active.id, { title: e.currentTarget.innerHTML })}
                  />
                  <div
                    ref={subRef}
                    className="sc-sub"
                    contentEditable
                    suppressContentEditableWarning
                    spellCheck={false}
                    onBlur={e => save(active.id, { subtitle: e.currentTarget.innerText })}
                  />
                </div>
                <div className="sc-foot">
                  <span>tellar · <span dangerouslySetInnerHTML={{ __html: sanitizeSlideHtml(teller.title) }} /></span>
                  <span>{String(active.idx).padStart(2, '0')} / {teller.slides.length}</span>
                </div>
              </div>
            ) : (
              <div style={{ color: 'var(--ink-3)', fontFamily: 'var(--mono)', fontSize: 12 }}>No slide selected — press + to add one.</div>
            )}
          </div>

          <div className="narration-bar">
            <span className="nb-label">narration · slide {String(active?.idx ?? '—').padStart(2, '0')}</span>
            <div className="waveform">
              {Array.from({ length: waveBars }).map((_, i) => {
                const height = 6 + ((i * 7) % 22); // deterministic variation
                return <div key={i} className={`wave-bar${i < activeBars ? ' active' : ''}`} style={{ height }} />;
              })}
            </div>
            <span className="narration-time">
              {rec ? `${Math.floor(rec.durationMs / 60_000)}:${String(Math.round((rec.durationMs % 60_000) / 1000)).padStart(2, '0')}` : '— / —'}
            </span>
            <button className="narration-play" title="Play narration" onClick={() => setTab('recording')}>
              <svg width={10} height={10} viewBox="0 0 10 10" fill="currentColor"><path d="M2 1l7 4-7 4z" /></svg>
            </button>
            <button className="narration-rec" onClick={() => setTab('recording')}>record</button>
          </div>
        </main>

        <aside className="right-panel">
          <div className="rp-tabs">
            <button className={`rp-tab${tab === 'copilot' ? ' active' : ''}`} onClick={() => setTab('copilot')}>copilot</button>
            <button className={`rp-tab${tab === 'knowledge' ? ' active' : ''}`} onClick={() => setTab('knowledge')}>
              knowledge<span className="badge">{teller.kbSources.length}</span>
            </button>
            <button className={`rp-tab${tab === 'recording' ? ' active' : ''}`} onClick={() => setTab('recording')}>
              recording<span className="badge">{teller.recordings.length}</span>
            </button>
          </div>

          <div className="rp-content">
            {tab === 'copilot' && (
              <CopilotPanel
                slideId={active?.id}
                slideIdx={active?.idx}
                totalSlides={teller.slides.length}
                slideTitle={active?.title || ''}
                slideSubtitle={active?.subtitle || null}
                onApplyTitle={applyTitleFromCopilot}
                onApplySubtitle={applySubFromCopilot}
                onApplyNotes={applyNotesFromCopilot}
              />
            )}
            {tab === 'knowledge' && <KbPanel tellerId={teller.id} initial={teller.kbSources as any} />}
            {tab === 'recording' && (
              <NarrationPanel
                tellerId={teller.id}
                slides={teller.slides.map(s => ({ id: s.id, idx: s.idx, title: s.title, notes: s.notes }))}
                active={active}
                initialRecordings={teller.recordings as any}
                onNotesChange={n => active && save(active.id, { notes: n })}
              />
            )}
          </div>
        </aside>
      </div>

      <div style={{ position: 'fixed', top: 14, right: 180, fontFamily: 'var(--mono)', fontSize: 10, color: saveState === 'saved' ? 'var(--good)' : 'var(--accent)', letterSpacing: '.1em', zIndex: 60 }}>
        {saveState === 'saved' ? '● saved' : '● saving…'}
      </div>

      <div className={`toast${toast ? ' show' : ''}`}>{toast}</div>
    </>
  );
}
