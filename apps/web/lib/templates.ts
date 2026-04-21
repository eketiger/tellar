/**
 * Pitch-deck templates registry.
 *
 * Each template is a ready-to-clone deck modelled on public pitches / YC
 * canon. The marketplace at /templates renders the list + detail pages,
 * and "Use this template" clones the slides[] into a fresh teller via
 * POST /api/tellers/from-template.
 *
 * Adding a template = adding an entry to TEMPLATES below. Slots follow
 * the schemas in @/lib/slide-layouts (title/subtitle/eyebrow/bullets/…).
 */

import type { BackgroundKind } from '@/lib/slide-layouts';

export type TemplateCategory = 'fundraising' | 'sales' | 'internal' | 'recruiting';

export interface TemplateSlideSpec {
  layoutId: string;
  layout?: Record<string, any>;
  background?: { kind?: BackgroundKind; imageUrl?: string; from?: string; to?: string; angle?: number };
  title?: string;
  subtitle?: string | null;
  eyebrow?: string | null;
  notes?: string | null;
}

export interface Template {
  slug: string;
  title: string;
  tagline: string;
  description: string;
  inspiredBy: string;
  category: TemplateCategory;
  seoKeywords: string[];
  slides: TemplateSlideSpec[];
}

export const TEMPLATES: Template[] = [
  // --------------------------------------------------------------
  // 1. YC Seed Pitch — the Airbnb-style canon
  // --------------------------------------------------------------
  {
    slug: 'yc-seed-pitch',
    title: 'YC Seed Pitch',
    tagline: 'The 10-slide deck that raised Airbnb, Dropbox and Stripe.',
    description:
      'A minimalist seed-stage template modelled on the classic Y Combinator pitch structure. Ten slides, one idea per slide, zero walls of text. Replace the placeholders, keep the opinionated shape.',
    inspiredBy: 'Airbnb seed deck (2009), Sequoia Capital "A guide to pitching"',
    category: 'fundraising',
    seoKeywords: [
      'YC seed pitch deck template',
      'Y Combinator pitch template',
      'Airbnb pitch deck',
      'seed round pitch deck template',
    ],
    slides: [
      {
        layoutId: 'cover',
        layout: {
          eyebrow: 'seed round · 2026',
          title: 'Your <em>company</em>.',
          subtitle: 'The one-liner a VC remembers 24 hours later.',
        },
        background: { kind: 'cream' },
      },
      {
        layoutId: 'headline',
        layout: {
          eyebrow: '01 · problem',
          title: 'The <em>status quo</em> is broken.',
          subtitle: 'Name the pain in one sentence. Make the audience nod before slide 3.',
        },
        background: { kind: 'cream' },
        notes: 'Open with the pain. Tell a one-paragraph story of a specific customer if you have it.',
      },
      {
        layoutId: 'headline',
        layout: {
          eyebrow: '02 · solution',
          title: 'We built the <em>obvious fix</em>.',
          subtitle: 'What you do, explained like the audience is 12 years old.',
        },
        background: { kind: 'paper' },
      },
      {
        layoutId: 'bigNumber',
        layout: {
          eyebrow: '03 · traction',
          prefix: '',
          number: '12K',
          unit: 'users',
          caption: '<em>+38%</em> MoM · 74% D7 retention · zero paid marketing.',
        },
        background: { kind: 'cream' },
        notes: 'Lead with the best metric you have. If DAU beats revenue, show DAU.',
      },
      {
        layoutId: 'bigNumber',
        layout: {
          eyebrow: '04 · market',
          prefix: '$',
          number: '86',
          unit: 'B',
          caption: 'TAM by <em>2028</em> · growing 22% YoY · still 94% offline.',
        },
        background: { kind: 'paper' },
      },
      {
        layoutId: 'bullets',
        layout: {
          title: 'Why <em>now</em>.',
          bullets: [
            'A regulatory shift that didn\'t exist 12 months ago.',
            'A tech unlock that drops unit cost by <em>10×</em>.',
            'A behaviour change the pandemic locked in.',
            'A distribution channel nobody is defending yet.',
          ],
        },
        background: { kind: 'cream' },
      },
      {
        layoutId: 'comparison',
        layout: {
          headline: '<em>Before</em> vs. after.',
          leftTitle: 'Incumbent',
          rightTitle: 'Us',
          left: ['Week-long setup.', '$2K / seat / year.', 'Legacy UX from 2008.', 'No mobile.'],
          right: ['Live in 11 minutes.', '$29 / seat / month.', 'Built for 2026.', 'Mobile-first.'],
        },
        background: { kind: 'cream' },
      },
      {
        layoutId: 'grid',
        layout: {
          title: 'The <em>team</em>.',
          items: [
            { title: 'Founder A', body: 'ex-Stripe · second-time founder' },
            { title: 'Founder B', body: 'ex-Airbnb · shipped auth at scale' },
            { title: 'Eng Lead', body: 'ex-Figma · rendering engine' },
            { title: 'Designer', body: 'ex-Linear · product craft' },
          ],
        },
        background: { kind: 'paper' },
      },
      {
        layoutId: 'twoColumn',
        layout: {
          headline: 'The <em>ask</em>.',
          leftTitle: '$3M seed',
          leftBody: 'At a <em>$18M</em> cap. Reserving 15% for strategic angels.',
          rightTitle: '18 months of runway',
          rightBody: 'Hire 6 engineers, reach $1M ARR, set up the Series A.',
        },
        background: { kind: 'cream' },
      },
      {
        layoutId: 'thanks',
        layout: { title: 'Thank <em>you</em>.' },
        background: { kind: 'cream' },
      },
    ],
  },

  // --------------------------------------------------------------
  // 2. YC Series A — Sequoia pillars + growth-stage metrics
  // --------------------------------------------------------------
  {
    slug: 'yc-series-a',
    title: 'YC Series A Deck',
    tagline: 'Traction-first deck for the $5-20M round.',
    description:
      'Series A sits between "we have a prototype" and "we have a business". This template frontloads the traction slide, stacks unit economics in the middle, and closes with a precise ask — the structure every growth VC expects.',
    inspiredBy: 'Sequoia Capital memo format · public Series A decks (Notion, Figma, Retool)',
    category: 'fundraising',
    seoKeywords: [
      'Series A pitch deck template',
      'Series A deck template 2026',
      'YC Series A pitch',
      'SaaS Series A deck',
    ],
    slides: [
      {
        layoutId: 'cover',
        layout: {
          eyebrow: 'series a · q2 2026',
          title: 'Your <em>company</em>.',
          subtitle: 'The opinionated promise in one editorial sentence.',
        },
        background: { kind: 'midnight' },
      },
      {
        layoutId: 'bigNumber',
        layout: {
          eyebrow: 'traction',
          prefix: '$',
          number: '4.2',
          unit: 'M ARR',
          caption: '<em>134%</em> NRR · 61% gross margin · 84-day payback.',
        },
        background: { kind: 'midnight' },
      },
      {
        layoutId: 'chart',
        layout: {
          title: 'Revenue · last <em>6 quarters</em>.',
          chartKind: 'bar',
          data: [
            { label: 'Q1 25', value: 240 },
            { label: 'Q2 25', value: 490 },
            { label: 'Q3 25', value: 880 },
            { label: 'Q4 25', value: 1600 },
            { label: 'Q1 26', value: 2900 },
            { label: 'Q2 26', value: 4200 },
          ],
          caption: 'ARR in $K · 10× in 18 months · no CAC paid marketing.',
        },
        background: { kind: 'cream' },
      },
      {
        layoutId: 'headline',
        layout: {
          eyebrow: 'problem',
          title: 'The problem is <em>bigger</em> than we thought.',
          subtitle: 'Articulate the pain with a fresh insight investors haven\'t heard before.',
        },
        background: { kind: 'cream' },
      },
      {
        layoutId: 'imageRight',
        layout: {
          eyebrow: 'product',
          title: 'The <em>one thing</em> we do.',
          body: 'Drop a screenshot or a 5-second Loom loop. Keep the copy ruthless — no feature lists on the Series A deck.',
        },
        background: { kind: 'paper' },
      },
      {
        layoutId: 'comparison',
        layout: {
          headline: 'Why <em>we</em> win.',
          leftTitle: 'Incumbent',
          rightTitle: 'Us',
          left: ['Built for 2012.', 'Legacy contract-only motion.', '$50K ACV minimum.', '6-month deployment.'],
          right: ['Built for 2026.', 'Self-serve with contract option.', '$1K starter ACV.', '11-minute onboarding.'],
        },
        background: { kind: 'paper' },
      },
      {
        layoutId: 'bigNumber',
        layout: {
          eyebrow: 'market',
          prefix: '$',
          number: '34',
          unit: 'B',
          caption: 'SAM by 2029 · <em>28%</em> YoY · 15% of F1000 already signal intent.',
        },
        background: { kind: 'cream' },
      },
      {
        layoutId: 'quote',
        layout: {
          quote:
            'This replaced three tools, cut our time-to-value from 4 weeks to <em>48 hours</em>, and the team asked to <em>expand</em> the contract on day 10.',
          author: 'VP Eng',
          role: 'Fortune 500 · signed Q1 2026',
        },
        background: { kind: 'midnight' },
      },
      {
        layoutId: 'grid',
        layout: {
          title: 'Team.',
          items: [
            { title: 'CEO · ex-Stripe', body: 'Shipped $1B+ payments infra' },
            { title: 'CTO · ex-Figma', body: '10yr building realtime' },
            { title: 'VP Sales · ex-Notion', body: 'Took ARR 0 → $30M' },
            { title: 'Head of AI · ex-Anthropic', body: 'Core research on RL' },
          ],
        },
        background: { kind: 'paper' },
      },
      {
        layoutId: 'twoColumn',
        layout: {
          headline: 'Raising <em>$12M</em> Series A.',
          leftTitle: 'Use of funds',
          leftBody: '60% engineering · 25% GTM · 15% platform reliability.',
          rightTitle: 'Milestones in 18 mo',
          rightBody: '$15M ARR · 3 new verticals · Series B on <em>our terms</em>.',
        },
        background: { kind: 'midnight' },
      },
      {
        layoutId: 'thanks',
        layout: { title: 'Let\'s <em>build</em>.' },
        background: { kind: 'midnight' },
      },
    ],
  },

  // --------------------------------------------------------------
  // 3. YC Demo Day — 6 slides, 3 minutes, one decision
  // --------------------------------------------------------------
  {
    slug: 'yc-demo-day',
    title: 'YC Demo Day (3 min)',
    tagline: 'The six-slide format that clears a demo-day slot.',
    description:
      'Six slides, three minutes, one takeaway per slide. Engineered around the constraints of YC Demo Day — you have the time it takes for an investor to open a calendar invite. Every word earns its space.',
    inspiredBy: 'Y Combinator Demo Day batch W22 / S23',
    category: 'fundraising',
    seoKeywords: [
      'YC Demo Day pitch template',
      '3 minute pitch deck template',
      'startup demo day slides',
      'accelerator pitch template',
    ],
    slides: [
      {
        layoutId: 'cover',
        layout: {
          eyebrow: 'yc · w26 · demo day',
          title: 'Company is <em>the obvious thing</em> for audience.',
          subtitle: 'One-liner. No second sentence. Practice it 50 times out loud.',
        },
        background: { kind: 'cream' },
      },
      {
        layoutId: 'bigNumber',
        layout: {
          eyebrow: 'traction',
          prefix: '$',
          number: '480',
          unit: 'K ARR',
          caption: 'In <em>8 weeks</em> since launch · 2,100 paying users · 92% WoW retention.',
        },
        background: { kind: 'cream' },
      },
      {
        layoutId: 'headline',
        layout: {
          eyebrow: 'insight',
          title: 'The <em>insight</em> others missed.',
          subtitle: 'One thing you know about this market that your audience doesn\'t. Say it sharply.',
        },
        background: { kind: 'paper' },
      },
      {
        layoutId: 'bigNumber',
        layout: {
          eyebrow: 'market',
          prefix: '$',
          number: '24',
          unit: 'B',
          caption: 'TAM · <em>12%</em> of workflows we can charge for are addressable today.',
        },
        background: { kind: 'paper' },
      },
      {
        layoutId: 'grid',
        layout: {
          title: 'The <em>why-us</em>.',
          items: [
            { title: 'Founder A', body: 'Built this at $LargeCo' },
            { title: 'Founder B', body: 'Shipped infra used by 100M' },
          ],
        },
        background: { kind: 'cream' },
      },
      {
        layoutId: 'thanks',
        layout: { title: 'We\'re <em>raising</em>.' },
        background: { kind: 'cream' },
        notes: 'Verbal ask at the end: "We\'re raising $2M at a $20M cap. Find us at the booth."',
      },
    ],
  },
];

export function getTemplate(slug: string): Template | undefined {
  return TEMPLATES.find(t => t.slug === slug);
}

export function templatesByCategory(): Record<TemplateCategory, Template[]> {
  return TEMPLATES.reduce((acc, t) => {
    (acc[t.category] = acc[t.category] || []).push(t);
    return acc;
  }, {} as Record<TemplateCategory, Template[]>);
}
