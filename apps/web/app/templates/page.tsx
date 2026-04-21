import Link from 'next/link';
import type { Metadata } from 'next';
import { RenderSlide } from '@/lib/slide-layouts';
import { TEMPLATES, type TemplateCategory } from '@/lib/templates';
import './templates.css';

export const metadata: Metadata = {
  title: 'Pitch deck templates · Tellar',
  description:
    'Free pitch deck templates inspired by the best YC startups. Series A, seed, B2B SaaS sales, product launch and more — clone any one into a live Tellar deck with one click.',
  keywords: [
    'pitch deck templates',
    'YC pitch deck template',
    'Series A pitch deck template',
    'seed pitch deck',
    'SaaS sales deck template',
    'investor update template',
  ],
  openGraph: {
    title: 'Pitch deck templates · Tellar',
    description:
      '10 free, opinionated pitch deck templates — clone into a live deck in one click. Modeled on YC canon: Airbnb, Stripe, Figma, Linear.',
    type: 'website',
  },
};

const CATEGORY_LABEL: Record<TemplateCategory, string> = {
  fundraising: 'Fundraising',
  sales: 'Sales',
  internal: 'Internal',
  recruiting: 'Recruiting',
};

const CATEGORY_ORDER: TemplateCategory[] = ['fundraising', 'sales', 'internal', 'recruiting'];

export default function TemplatesIndex() {
  const byCategory = CATEGORY_ORDER.map(cat => ({
    cat,
    items: TEMPLATES.filter(t => t.category === cat),
  })).filter(g => g.items.length > 0);

  return (
    <div className="tmpl-page">
      <header className="tmpl-top">
        <Link href="/" className="tmpl-brand">tellar</Link>
        <nav className="tmpl-nav">
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/login">Sign in</Link>
        </nav>
      </header>

      <main>
        <section className="tmpl-hero">
          <div className="tmpl-kicker">pitch deck templates · free · open</div>
          <h1>
            The <em>deck</em> the best YC startups actually used.
          </h1>
          <p>
            Ten opinionated templates — Series A, seed, demo day, SaaS sales, board updates,
            case studies, culture docs. Clone any one into a live Tellar deck in a single click
            and start editing the content, not the structure.
          </p>
        </section>

        {byCategory.map(({ cat, items }) => (
          <section key={cat} className="tmpl-group">
            <div className="tmpl-group-head">
              <h2>{CATEGORY_LABEL[cat]}</h2>
              <span>{items.length} template{items.length === 1 ? '' : 's'}</span>
            </div>
            <div className="tmpl-grid">
              {items.map(t => (
                <Link key={t.slug} href={`/templates/${t.slug}`} className="tmpl-card">
                  <div className="tmpl-preview">
                    <div className="tmpl-preview-inner">
                      <RenderSlide slide={t.slides[0] as any} />
                    </div>
                    <div className="tmpl-stack">
                      <span>{t.slides.length} slides</span>
                      <span>{t.category}</span>
                    </div>
                  </div>
                  <div className="tmpl-meta">
                    <h3>{t.title}</h3>
                    <p>{t.tagline}</p>
                    <span className="tmpl-inspired">{t.inspiredBy}</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}

        <section className="tmpl-cta">
          <h2>
            Paste a <em>markdown outline</em> or a Google Slides URL and get the same result.
          </h2>
          <p>
            Tellar\'s editor imports from markdown, Google Slides and the templates below.
            Then every slide becomes a video, a doc, and a conversation — for the viewer too.
          </p>
          <Link href="/register" className="tmpl-cta-btn">Start free →</Link>
        </section>
      </main>

      <footer className="tmpl-foot">
        © Tellar · <Link href="/privacy">privacy</Link> · <Link href="/docs">docs</Link>
      </footer>
    </div>
  );
}
