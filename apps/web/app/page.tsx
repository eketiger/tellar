import Link from 'next/link';
import './home.css';

export default function HomePage() {
  return (
    <>
      <nav className="home-nav">
        <Link href="/" className="hn-brand">tellar</Link>
        <div className="hn-links">
          <a href="#how">How it works</a>
          <a href="#product">Product</a>
          <a href="#pricing">Pricing</a>
          <a href="#faq">FAQ</a>
        </div>
        <div className="hn-cta">
          <Link href="/login" className="btn btn-ghost">Sign in</Link>
          <Link href="/register" className="btn btn-primary">Start free</Link>
        </div>
      </nav>

      <main className="home-main">
        <section className="hero">
          <div className="hero-kicker">tellar · doc + demo + agent</div>
          <h1>Your deck <em>answers back.</em><br /><span className="gray">Watch where it</span> <em>loses them.</em></h1>
          <p className="lede">One surface for the <b>pitch</b>, the <b>recorded walkthrough</b>, and the <b>agent</b> that fields questions when you're not in the room. Every slide a signal. Every viewer a story.</p>
          <div className="hero-cta">
            <Link href="/register" className="btn-hero">
              Start building — free
              <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M1 6h10M7 2l4 4-4 4" /></svg>
            </Link>
            <Link href="/v/qa09fx2" className="btn-hero-ghost">
              Watch a live tellar
              <svg width={11} height={11} viewBox="0 0 11 11" fill="currentColor"><path d="M2 1l8 4.5-8 4.5z" /></svg>
            </Link>
          </div>
          <div className="hero-stat">◦ <b>no credit card</b> · 14-day pro trial · cancel from the dashboard</div>

          <div className="hero-ornament">
            <div className="ho-logos">
              <span className="ho-logo">Linear</span>
              <span className="ho-logo">Ramp</span>
              <span className="ho-logo">Stripe Atlas</span>
              <span className="ho-logo">Notion</span>
              <span className="ho-logo">Retool</span>
              <span className="ho-logo">Vercel</span>
            </div>
            <div className="ho-label">trusted by founders raising</div>
            <div className="ho-label" style={{ textAlign: 'right' }}>$2.4B+ combined</div>
          </div>
        </section>

        <section className="problem">
          <div className="problem-grid">
            <div className="prob-copy">
              <div className="eyebrow">the thing nobody fixed</div>
              <h2>You send the deck <em>and disappear.</em></h2>
              <p>Attach a PDF. Hit send. Wait. <em>Did they open it? Which slide killed the deal? Were their questions ever answered?</em> You'll never know — and they'll never ask.</p>
              <p>DocSend tells you they opened slide 7. Loom plays you a walkthrough. ChatGPT fields the follow-ups. Three tabs. Three tools. Three dead ends.</p>
            </div>
            <div className="prob-visual">
              <div className="prob-doc d1">
                <h3>Series A <em>pitch.</em></h3>
                <div className="pdoc-lines"><span /><span /><span /><span /></div>
                <div className="pdoc-meta">page 1 / 17 · pdf</div>
              </div>
              <div className="prob-doc d2" />
              <div className="prob-doc d3" />
              <div className="prob-doc d4" />
              <div className="prob-questions">
                <div className="prob-q">what's the CAC payback again?</div>
                <div className="prob-q">wait — did they raise already?</div>
                <div className="prob-q">who is on the founding team?</div>
                <div className="prob-q">moat? I didn't see a moat slide…</div>
              </div>
            </div>
          </div>
        </section>

        <section className="how" id="how">
          <div className="how-head">
            <div>
              <div className="eyebrow">how it works</div>
              <h2>Build it once. <em>Ship it everywhere.</em></h2>
            </div>
            <p>A tellar is three surfaces in one file: the slides, the narration, the agent. You build it in an editor that feels like Keynote. You ship a link that feels like Loom. Your viewers ask questions and get cited answers — without you in the room.</p>
          </div>
          <div className="how-steps">
            <div className="how-step">
              <div className="num">01</div>
              <h3>Import your <em>deck.</em></h3>
              <p>Drop a PDF, a Keynote, a Gamma. Tellar turns every slide into an editable frame. Keep the story — we keep the pixels.</p>
              <span className="chip">editor · 45 sec</span>
            </div>
            <div className="how-step">
              <div className="num">02</div>
              <h3>Record your <em>narration.</em></h3>
              <p>Slide by slide, on your own time. Cam + mic, screen + mic, or just voice. Your webcam floats on every slide — no more flat decks.</p>
              <span className="chip">loom-style · slide-synced</span>
            </div>
            <div className="how-step">
              <div className="num">03</div>
              <h3>Attach your <em>knowledge.</em></h3>
              <p>Drop in the 40-page appendix, the market research, the FAQ, the financial model. Your agent cites every answer back to the slide or source.</p>
              <span className="chip">pdfs · urls · spreadsheets</span>
            </div>
          </div>
        </section>

        <section className="three" id="product">
          <div className="three-head">
            <div className="eyebrow">one surface. three products.</div>
            <h2>We didn't <em>pick a lane.</em></h2>
            <p>DocSend, Loom, and an AI agent — stitched together so tightly you'll forget they were ever three tabs. Every slide is a video, a document, and a conversation at the same time.</p>
          </div>
          <div className="three-grid">
            <div className="three-col">
              <div className="cref">like <b>docsend</b> — but</div>
              <h3>Every <em>slide</em> logged. Every <em>viewer</em> tracked.</h3>
              <p className="desc">See who opened, which slide they lingered on, where they bailed. Email gating, watermarks, revoke-at-any-time links. Enterprise-grade from day one.</p>
              <ul>
                <li>Per-slide <em>dwell time</em> heatmaps</li>
                <li>Real-time <em>funnel</em> and drop-off</li>
                <li>Email gate, passphrase, domain allow-list</li>
                <li>Live <em>notifications</em> when your deck opens</li>
              </ul>
            </div>
            <div className="three-col">
              <div className="cref">like <b>loom</b> — but</div>
              <h3>Your <em>voice</em>. Your <em>face</em>. Slide-synced.</h3>
              <p className="desc">Record narration per slide from your browser. Your webcam floats in the corner. Viewers can play, skip, or ask — and you see every re-watch.</p>
              <ul>
                <li>Cam + mic, screen + mic, <em>voice-only</em></li>
                <li>Re-record a single slide, not the whole thing</li>
                <li>Auto-generated <em>transcript</em> for the agent</li>
                <li>Plays on mobile · under 2MB per slide</li>
              </ul>
            </div>
            <div className="three-col">
              <div className="cref">like <b>agents</b> — but</div>
              <h3>A <em>colleague</em> at the viewer's side, 24/7.</h3>
              <p className="desc">Trained on your slides, your narration, and your attached knowledge. Cites every answer. Doesn't hallucinate — refuses politely when it doesn't know.</p>
              <ul>
                <li>Grounded in <em>your</em> docs, nothing else</li>
                <li>Cites slide numbers and source pages</li>
                <li>Logs every question — you see what's unclear</li>
                <li>Hand-off to you by <em>one click</em></li>
              </ul>
            </div>
          </div>
        </section>

        <section className="matrix">
          <div className="matrix-head">
            <div>
              <div className="eyebrow">what's in the box</div>
              <h2>A studio, <em>not a template.</em></h2>
            </div>
            <p>Tellar is opinionated where it matters — recording flow, agent citations, viewer security — and boring everywhere else. You shouldn't have to learn a new tool to send a better deck.</p>
          </div>
          <div className="feat-grid">
            {[
              { fi: '◦ editor', title: <>A deck editor that <em>doesn't fight you.</em></>, desc: 'Import from PDF, Keynote, Gamma, Pitch, Figma. Inline edit text. Swap images. Keep the fonts you already love.' },
              { fi: '◦ capture', title: <>Record in your browser. <em>Zero install.</em></>, desc: 'Per-slide cam + mic recording with a teleprompter. Re-take a single slide without redoing the whole deck.' },
              { fi: '◦ agent', title: <>An agent that <em>actually says "I don't know."</em></>, desc: 'Grounded on your slides and KB only. Cites every answer. Refuses off-topic. Escalates to you in one click.' },
              { fi: '◦ analytics', title: <>Funnel + heatmap + <em>per-viewer replay.</em></>, desc: 'See the session like a screen recording. Know which investor spent 4 minutes on slide 11 and skipped the ask.' },
              { fi: '◦ sharing', title: <>Links that you control <em>after you send.</em></>, desc: 'Email gate, domain allow-list, passphrase, NDA, screen-rec block, expiry, one-time code. Revoke any time.' },
              { fi: '◦ integrations', title: <>Fits in your <em>existing stack.</em></>, desc: 'Slack alerts. HubSpot/Salesforce activity. Segment event pipe. REST API + webhooks on Scale and up.' },
            ].map((f, i) => (
              <div key={i} className="feat">
                <div className="fi">{f.fi}</div>
                <h4>{f.title}</h4>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="quote-row">
          <blockquote>"The first deck I sent over Tellar got <em>three investor meetings</em> within 48 hours. I watched one of them re-watch slide 4 twice. That slide <em>was</em> the deal."</blockquote>
          <div className="cite">— Nora Álvarez · founder, Kova · <span style={{ color: 'var(--accent)' }}>raised $6M seed, Q1 2026</span></div>
        </section>

        <section className="pricing" id="pricing">
          <div className="pricing-head">
            <div className="eyebrow">pricing</div>
            <h2>Pay for <em>answers.</em> Not seats.</h2>
            <p>Free forever for solo founders. Pro when you're shipping weekly. Scale when your sales team is.</p>
          </div>
          <div className="tiers">
            <div className="tier">
              <div className="tn">Hobby</div>
              <div className="tp"><em>$</em>0</div>
              <div className="tpm">forever · 1 seat</div>
              <div className="td">For founders building their first deck. Every feature — smaller quotas.</div>
              <ul>
                <li>Up to <em>3</em> tellars</li>
                <li>30 min of recording</li>
                <li>100 agent queries / month</li>
                <li>Email-gated sharing</li>
                <li>Basic analytics</li>
              </ul>
              <Link className="cta" href="/register?plan=hobby">Get started free</Link>
            </div>
            <div className="tier feat-tier">
              <span className="tier-badge">most popular</span>
              <div className="tn">Pro</div>
              <div className="tp"><em>$</em>49</div>
              <div className="tpm">per user · per month</div>
              <div className="td">For founders and small teams actively raising, selling, or onboarding.</div>
              <ul>
                <li><em>Unlimited</em> tellars</li>
                <li>300 min of recording</li>
                <li>1,000 agent queries / month</li>
                <li>All sharing controls + NDA + watermark</li>
                <li>Per-viewer replay &amp; full analytics</li>
                <li>Priority support</li>
              </ul>
              <Link className="cta" href="/register?plan=pro">Start 14-day trial</Link>
            </div>
            <div className="tier">
              <div className="tn">Scale</div>
              <div className="tp"><em>$</em>199</div>
              <div className="tpm">per user · per month</div>
              <div className="td">For sales-led orgs. SSO, audit, and API access included from seat one.</div>
              <ul>
                <li>Everything in Pro</li>
                <li><em>Unlimited</em> recording &amp; queries</li>
                <li>SSO (Okta, Azure AD) &amp; SCIM</li>
                <li>Custom domain + NDA templates</li>
                <li>REST API + webhooks</li>
                <li>Dedicated CSM</li>
              </ul>
              <Link className="cta" href="/register?plan=scale">Talk to sales</Link>
            </div>
          </div>
        </section>

        <section className="faq" id="faq">
          <div className="faq-head">
            <div className="eyebrow">f.a.q.</div>
            <h2>Questions before <em>you send the deck.</em></h2>
          </div>
          {[
            { q: 'How is Tellar different from DocSend + Loom + ChatGPT?', a: <>Those are three tools that don't know about each other. <em>DocSend</em> logs views but can't talk. <em>Loom</em> has narration but no analytics. <em>ChatGPT</em> can answer but doesn't know your deck. Tellar is the three, <em>on the same object</em>: every slide is a document, a video, and a conversation — and every event flows into the same analytics.</> },
            { q: 'Can my agent hallucinate or leak data it shouldn\'t?', a: <>No — and we take that seriously. The agent is <em>grounded</em> on your slides, your narration transcripts, and the KB you attach. If the answer isn't there, it refuses politely and offers to ping you. Every answer shows the exact slide or page it came from.</> },
            { q: 'What happens to a shared link if I realize I made a mistake?', a: <>Revoke it. From the dashboard or <em>viewer settings</em>, any link can be expired, passphrase-protected, or replaced — retroactively. Viewers who had it open mid-session get bumped on the next slide.</> },
            { q: 'Do you support SSO, SCIM, and compliance docs?', a: <>Yes — on the Scale plan. SOC 2 Type II in progress (Q3 2026). Okta, Azure AD, Google Workspace OIDC. DPA and custom MSA on request.</> },
            { q: 'Can viewers download the deck as a PDF?', a: <>Only if you turn it on. By default, no: shared tellars play in the browser with the watermark stamped across every slide. You can enable PDF export per share.</> },
            { q: 'Is there a free trial for Pro?', a: <>14 days, no card. If you love it, we ask for payment on day 15. If you don't, your tellars stay — they just drop to Hobby limits.</> },
          ].map((f, i) => (
            <details key={i} className="faq-item">
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </section>

        <section className="cta-section">
          <h2>Send a deck that <em>knows</em> where it loses them.</h2>
          <p>Or keep firing PDFs into the void. Your call.</p>
          <div className="cta-actions">
            <Link href="/register" className="btn-hero">
              Start free — 2 minutes
              <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M1 6h10M7 2l4 4-4 4" /></svg>
            </Link>
            <Link href="/v/qa09fx2" className="btn-hero-ghost">Watch a live tellar</Link>
          </div>
        </section>

        <footer className="foot">
          <div className="foot-grid">
            <div>
              <div className="foot-brand">tellar</div>
              <div className="foot-motto">The deck that answers back. Built for founders, sales-led teams, and anyone who's tired of sending PDFs into the void.</div>
            </div>
            <div className="foot-col">
              <h5>Product</h5>
              <a href="#how">How it works</a>
              <a href="#product">Features</a>
              <a href="#pricing">Pricing</a>
              <Link href="/api-reference">API</Link>
            </div>
            <div className="foot-col">
              <h5>Company</h5>
              <a href="#">About</a>
              <a href="#">Blog</a>
              <a href="#">Careers</a>
              <a href="#">Contact</a>
            </div>
            <div className="foot-col">
              <h5>Legal</h5>
              <Link href="/privacy">Privacy</Link>
              <Link href="/cookies">Cookies</Link>
              <a href="#">Terms</a>
              <a href="#">Security</a>
            </div>
          </div>
          <div className="foot-bot">
            <span>© Tellar · 2026</span>
            <span>Built in Buenos Aires · Berlin · San Francisco</span>
          </div>
        </footer>
      </main>
    </>
  );
}
