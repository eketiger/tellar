export default function CookiesPage() {
  return (
    <main className="shell" style={{ maxWidth: 860 }}>
      <h1 style={{ fontFamily: 'var(--serif)', fontWeight: 300, fontSize: 56, letterSpacing: '-.025em', margin: '20px 0' }}>
        Cookie <em style={{ color: 'var(--accent)' }}>policy</em>
      </h1>
      <p className="note" style={{ marginBottom: 30 }}>Version 2026-04-18</p>

      <section style={{ fontFamily: 'var(--serif)', lineHeight: 1.7, fontSize: 16 }}>
        <h2 style={{ marginTop: 30, marginBottom: 10 }}>Essential (always on)</h2>
        <ul style={{ marginLeft: 20 }}>
          <li><code>tellar_jwt</code> — your login session. httpOnly, SameSite=Lax.</li>
        </ul>

        <h2 style={{ marginTop: 30, marginBottom: 10 }}>Analytics (off by default)</h2>
        <ul style={{ marginLeft: 20 }}>
          <li>Mixpanel — product usage aggregates. Only loads after you accept cookies.</li>
        </ul>

        <h2 style={{ marginTop: 30, marginBottom: 10 }}>Third-party</h2>
        <ul style={{ marginLeft: 20 }}>
          <li>Stripe — sets its own cookies during checkout only.</li>
        </ul>
      </section>
    </main>
  );
}
