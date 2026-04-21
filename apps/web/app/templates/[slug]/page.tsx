import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { RenderSlide } from '@/lib/slide-layouts';
import { TEMPLATES, getTemplate } from '@/lib/templates';
import { UseTemplateClient } from './UseTemplateClient';
import '../templates.css';
import './detail.css';

interface Params { slug: string }

// Static params for every template so every detail page prerenders at
// build time — pure HTML for search engines.
export async function generateStaticParams() {
  return TEMPLATES.map(t => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const t = getTemplate(slug);
  if (!t) return { title: 'Template not found' };
  const stripEm = (s: string) => s.replace(/<[^>]+>/g, '');
  return {
    title: `${t.title} · Pitch deck template`,
    description: `${stripEm(t.tagline)} — ${stripEm(t.description).slice(0, 140)}…`,
    keywords: t.seoKeywords,
    openGraph: {
      title: `${t.title} — ${stripEm(t.tagline)}`,
      description: stripEm(t.description),
      type: 'website',
    },
    alternates: { canonical: `/templates/${t.slug}` },
  };
}

export default async function TemplateDetail({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const template = getTemplate(slug);
  if (!template) notFound();

  const related = TEMPLATES.filter(x => x.category === template.category && x.slug !== template.slug).slice(0, 3);

  return (
    <div className="tmpl-page">
      <header className="tmpl-top">
        <Link href="/" className="tmpl-brand">tellar</Link>
        <nav className="tmpl-nav">
          <Link href="/templates">All templates</Link>
          <Link href="/login">Sign in</Link>
        </nav>
      </header>

      <main>
        <div className="tmpl-detail-breadcrumb">
          <Link href="/templates">Templates</Link>
          <span>/</span>
          <span className="tmpl-detail-crumb-cur">{template.title}</span>
        </div>

        <section className="tmpl-detail-hero">
          <div className="tmpl-detail-hero-copy">
            <div className="tmpl-kicker">{template.category} · {template.slides.length} slides</div>
            <h1>{template.title}</h1>
            <p className="tmpl-detail-tagline" dangerouslySetInnerHTML={{ __html: template.tagline }} />
            <p className="tmpl-detail-desc">{template.description}</p>
            <div className="tmpl-detail-inspired">Inspired by · {template.inspiredBy}</div>
            <UseTemplateClient template={template} />
          </div>
          <div className="tmpl-detail-cover">
            <RenderSlide slide={template.slides[0] as any} />
          </div>
        </section>

        <section className="tmpl-detail-slides">
          <div className="tmpl-group-head">
            <h2>Every slide</h2>
            <span>{template.slides.length} total</span>
          </div>
          <div className="tmpl-detail-grid">
            {template.slides.map((slide, i) => (
              <figure key={i} className="tmpl-detail-slide">
                <div className="tmpl-detail-slide-frame">
                  <RenderSlide slide={slide as any} />
                </div>
                <figcaption>
                  <span className="tmpl-slide-num">{String(i + 1).padStart(2, '0')}</span>
                  <span className="tmpl-slide-layout">{slide.layoutId}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        {related.length > 0 && (
          <section className="tmpl-detail-related">
            <div className="tmpl-group-head">
              <h2>More {template.category} templates</h2>
              <span>{related.length}</span>
            </div>
            <div className="tmpl-grid">
              {related.map(t => (
                <Link key={t.slug} href={`/templates/${t.slug}`} className="tmpl-card">
                  <div className="tmpl-preview">
                    <div className="tmpl-preview-inner">
                      <RenderSlide slide={t.slides[0] as any} />
                    </div>
                  </div>
                  <div className="tmpl-meta">
                    <h3>{t.title}</h3>
                    <p>{t.tagline}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="tmpl-foot">
        © Tellar · <Link href="/privacy">privacy</Link> · <Link href="/docs">docs</Link>
      </footer>
    </div>
  );
}
