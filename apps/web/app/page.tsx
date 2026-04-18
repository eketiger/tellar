import Link from 'next/link';

export default function HomePage() {
  return (
    <>
      <style>{`
        .home-nav{position:fixed;top:0;left:0;right:0;z-index:50;display:flex;align-items:center;justify-content:space-between;padding:18px 36px;background:rgba(12,13,15,.6);backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}
        .hn-brand{font-family:var(--serif);font-style:italic;font-weight:500;font-size:22px;letter-spacing:-.02em}
        .hn-brand::first-letter{color:var(--accent)}
        .hn-links{display:flex;gap:30px;font-family:var(--mono);font-size:10px;color:var(--ink-2);letter-spacing:.2em;text-transform:uppercase}
        .hn-links a:hover{color:var(--accent)}
        .home-main{padding-top:100px;position:relative;z-index:3}
        .hero{padding:80px 36px 120px;max-width:1400px;margin:0 auto}
        .hero-kicker{font-family:var(--mono);font-size:11px;color:var(--accent);letter-spacing:.3em;text-transform:uppercase;margin-bottom:24px;display:flex;align-items:center;gap:10px}
        .hero-kicker::before{content:'';width:24px;height:1px;background:var(--accent)}
        .hero h1{font-family:var(--serif);font-size:clamp(48px, 7.2vw, 96px);font-weight:300;line-height:1.02;letter-spacing:-.035em;max-width:1100px}
        .hero h1 em{font-style:italic;color:var(--accent);font-weight:400}
        .hero h1 .gray{color:var(--ink-3)}
        .hero .lede{font-family:var(--serif);font-style:italic;font-size:22px;color:var(--ink-2);margin-top:32px;max-width:640px;line-height:1.45}
        .hero-cta{display:flex;gap:14px;margin-top:44px;align-items:center;flex-wrap:wrap}
        .btn-hero{padding:16px 26px;background:var(--accent);color:#0c0d0f;border:none;font-family:var(--mono);font-size:11px;letter-spacing:.2em;text-transform:uppercase;cursor:pointer;font-weight:500;transition:all .2s;display:inline-flex;align-items:center;gap:10px}
        .btn-hero:hover{background:#e8ad3a}
        .btn-hero-ghost{padding:16px 24px;background:transparent;color:var(--ink);border:1px solid var(--line-2);font-family:var(--mono);font-size:11px;letter-spacing:.2em;text-transform:uppercase;cursor:pointer}
        .btn-hero-ghost:hover{border-color:var(--accent);color:var(--accent)}
        .three{padding:120px 36px;max-width:1400px;margin:0 auto}
        .three-head{text-align:center;margin-bottom:70px}
        .three-head .eyebrow{font-family:var(--mono);font-size:10px;letter-spacing:.3em;color:var(--accent);text-transform:uppercase;margin-bottom:20px}
        .three-head h2{font-family:var(--serif);font-size:72px;font-weight:300;letter-spacing:-.04em;line-height:1}
        .three-head h2 em{font-style:italic;color:var(--accent)}
        .three-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:1px;background:var(--line);border:1px solid var(--line)}
        .three-col{padding:40px 34px;background:var(--bg);min-height:420px;display:flex;flex-direction:column}
        .three-col .cref{font-family:var(--mono);font-size:10px;letter-spacing:.2em;color:var(--ink-3);text-transform:uppercase;margin-bottom:22px}
        .three-col .cref b{color:var(--ink)}
        .three-col h3{font-family:var(--serif);font-size:32px;font-weight:400;letter-spacing:-.02em;margin-bottom:16px;line-height:1.05}
        .three-col h3 em{font-style:italic;color:var(--accent)}
        .three-col .desc{font-family:var(--serif);font-style:italic;font-size:14px;color:var(--ink-2);line-height:1.55;margin-bottom:22px}
        .three-col ul{list-style:none;padding:0;margin:auto 0 0;display:flex;flex-direction:column;gap:8px}
        .three-col li{font-family:var(--serif);font-size:13px;color:var(--ink);padding-left:18px;position:relative;line-height:1.4}
        .three-col li::before{content:'·';position:absolute;left:0;top:-4px;color:var(--accent);font-size:22px}
        .three-col li em{font-style:italic;color:var(--accent)}
        .cta{padding:150px 36px;max-width:1200px;margin:0 auto;text-align:center;position:relative}
        .cta h2{font-family:var(--serif);font-size:clamp(56px,8vw,110px);font-weight:300;letter-spacing:-.04em;line-height:.95}
        .cta h2 em{font-style:italic;color:var(--accent)}
        .cta p{font-family:var(--serif);font-style:italic;font-size:20px;color:var(--ink-2);margin-top:24px}
        .cta .cta-actions{margin-top:40px;display:flex;gap:14px;justify-content:center;flex-wrap:wrap}
        .foot{padding:60px 36px 40px;border-top:1px solid var(--line);margin-top:40px;font-family:var(--mono);font-size:10px;color:var(--ink-3);letter-spacing:.15em;text-transform:uppercase;text-align:center}
        @media (max-width:900px){.home-nav{padding:14px 20px}.hn-links{display:none}.three-grid{grid-template-columns:1fr}}
      `}</style>

      <header className="home-nav">
        <div className="hn-brand">Tellar</div>
        <div className="hn-links">
          <a href="#product">Product</a>
          <a href="#how">How it works</a>
          <a href="#pricing">Pricing</a>
          <a href="/docs">Docs</a>
          <a href="/help">Help</a>
          <a href="/api-reference">API</a>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/login" className="btn btn-ghost">Sign in</Link>
          <Link href="/register" className="btn btn-primary">Start free</Link>
        </div>
      </header>

      <main className="home-main">
        <section className="hero">
          <div className="hero-kicker">Presentations ≥ 1.0</div>
          <h1>
            Presentations <em>that know</em><br />
            <span className="gray">when they lose you.</span>
          </h1>
          <p className="lede">
            Send a deck that records the moment someone bounces, narrates itself in your voice, and answers questions from your knowledge base — while you sleep.
          </p>
          <div className="hero-cta">
            <Link className="btn-hero" href="/register">Start free →</Link>
            <Link className="btn-hero-ghost" href="/v/qa09fx2">See the demo teller</Link>
          </div>
          <p className="note" style={{ marginTop: 30 }}>No credit card · 5 tellers free · 1,000 agent queries/mo</p>
        </section>

        <section id="product" className="three">
          <header className="three-head">
            <div className="eyebrow">Three products, one deck</div>
            <h2>DocSend × Loom × <em>Agents</em></h2>
          </header>
          <div className="three-grid">
            <div className="three-col">
              <div className="cref"><b>01</b> / Analytics</div>
              <h3>Every deck is a <em>funnel.</em></h3>
              <p className="desc">Per-slide dwell time, drop-off, and who asked what. Real-time dashboard. No more guessing who actually read it.</p>
              <ul><li>Per-slide <em>dwell</em></li><li>Drop-off heatmap</li><li>Viewer timeline</li></ul>
            </div>
            <div className="three-col">
              <div className="cref"><b>02</b> / Narration</div>
              <h3>Your voice <em>on autopilot.</em></h3>
              <p className="desc">Record once with MediaRecorder. Viewers hear your story and you track where they pause and rewind.</p>
              <ul><li>Browser-native recording</li><li>Transcript + search</li><li>Watermarked streams</li></ul>
            </div>
            <div className="three-col">
              <div className="cref"><b>03</b> / Agent</div>
              <h3>A deck that <em>answers back.</em></h3>
              <p className="desc">RAG over slides, narration, and your KB. Strict citations. Claude Haiku cost per query under 2¢.</p>
              <ul><li>Cites slides + KB</li><li>Claude + pgvector</li><li>Copilot for creators</li></ul>
            </div>
          </div>
        </section>

        <section className="cta">
          <h2>Ship decks that <em>talk back.</em></h2>
          <p>8 weeks from PDF to a real product. Start a teller in 60 seconds.</p>
          <div className="cta-actions">
            <Link className="btn-hero" href="/register">Start free →</Link>
            <Link className="btn-hero-ghost" href="/login">Sign in</Link>
          </div>
        </section>

        <footer className="foot">© Tellar · Built from the handoff spec</footer>
      </main>
    </>
  );
}
