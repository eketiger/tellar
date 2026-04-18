export default function PrivacyPage() {
  return (
    <main className="shell" style={{ maxWidth: 860 }}>
      <h1 style={{ fontFamily: 'var(--serif)', fontWeight: 300, fontSize: 56, letterSpacing: '-.025em', margin: '20px 0' }}>
        Privacy <em style={{ color: 'var(--accent)' }}>policy</em>
      </h1>
      <p className="note" style={{ marginBottom: 30 }}>Version 2026-04-18</p>

      <section style={{ fontFamily: 'var(--serif)', lineHeight: 1.7, fontSize: 16 }}>
        <h2 style={{ fontFamily: 'var(--serif)', marginTop: 30, marginBottom: 10 }}>What we collect</h2>
        <p>Email, name, passwords hashed with argon2, workspace &amp; teller content you create, viewer events you trigger, and billing details only via Stripe (we never see card numbers).</p>

        <h2 style={{ fontFamily: 'var(--serif)', marginTop: 30, marginBottom: 10 }}>Why</h2>
        <p>To run the product (auth, analytics for your own decks, billing) and to improve it. We do <em>not</em> train AI models on your data.</p>

        <h2 style={{ fontFamily: 'var(--serif)', marginTop: 30, marginBottom: 10 }}>Your rights (GDPR)</h2>
        <ul style={{ marginLeft: 20 }}>
          <li>Access &amp; export — Settings → Profile → <a href="/api/user/data-export" style={{ color: 'var(--accent)' }}>download your data</a></li>
          <li>Erasure — Settings → Profile → Delete account</li>
          <li>Portability — the export is JSON, reusable anywhere</li>
          <li>Object to analytics — reject cookies in the banner</li>
        </ul>

        <h2 style={{ fontFamily: 'var(--serif)', marginTop: 30, marginBottom: 10 }}>Retention</h2>
        <p>Accounts inactive for more than 24 months get deleted automatically. Deleted data is removed within 30 days.</p>
      </section>
    </main>
  );
}
