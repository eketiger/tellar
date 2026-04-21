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

  // --------------------------------------------------------------
  // 4. B2B SaaS Sales Pitch — Linear / Retool style
  // --------------------------------------------------------------
  {
    slug: 'b2b-saas-sales',
    title: 'B2B SaaS Sales Pitch',
    tagline: 'The 9-slide sales deck that closes in the demo call.',
    description:
      'Built for AEs who send the deck before the meeting. Opens with their pain, not your product; lands the ROI number before slide 6; ends with a calendar CTA. Modeled on the sales motions that took Linear and Retool from $0 to $50M ARR.',
    inspiredBy: 'Linear AE playbook · Retool enterprise pitch · Gong.io call teardowns',
    category: 'sales',
    seoKeywords: [
      'B2B SaaS sales pitch template',
      'SaaS sales deck template',
      'enterprise sales pitch deck',
      'software sales deck template',
    ],
    slides: [
      {
        layoutId: 'cover',
        layout: {
          eyebrow: 'prepared for · <em>acme corp</em>',
          title: 'Ship faster <em>without</em> breaking production.',
          subtitle: 'How <b>Product</b> cuts your release cycle from <em>2 weeks to 2 days</em>.',
        },
        background: { kind: 'paper' },
      },
      {
        layoutId: 'headline',
        layout: {
          eyebrow: '01 · the pain',
          title: 'You\'re losing <em>12 engineer-days</em> per release.',
          subtitle: 'Your team runs 14 manual QA steps across 3 tools. 40% of the work is repeated.',
        },
        background: { kind: 'paper' },
      },
      {
        layoutId: 'comparison',
        layout: {
          headline: '<em>Today</em> vs. with Product.',
          leftTitle: 'Your stack today',
          rightTitle: 'With Product',
          left: ['14 manual QA steps', 'Jira · Notion · email chains', 'Release Fridays only', '12 engineer-days / release'],
          right: ['Zero manual QA steps', 'One surface, one source of truth', 'Ship any day, any hour', '<em>2 engineer-days</em> / release'],
        },
        background: { kind: 'cream' },
      },
      {
        layoutId: 'bullets',
        layout: {
          title: 'How it <em>works</em>.',
          bullets: [
            'Drop a <b>GitHub PR</b> and we auto-generate test paths.',
            'Run in parallel on <em>every</em> commit, not just merge.',
            'Slack + Linear updates when a check fails.',
            'Rollback in one click if prod starts drifting.',
          ],
        },
        background: { kind: 'cream' },
      },
      {
        layoutId: 'quote',
        layout: {
          quote:
            'We were shipping twice a month. After six weeks with Product we\'re shipping <em>four times a week</em> with fewer incidents.',
          author: 'Carolina Méndez',
          role: 'VP Engineering · Mercado Libre',
        },
        background: { kind: 'midnight' },
      },
      {
        layoutId: 'bigNumber',
        layout: {
          eyebrow: 'your ROI',
          prefix: '$',
          number: '840',
          unit: 'K / yr',
          caption: 'Saved at 40 engineers × $220 blended × 12 days / release × 26 releases.',
        },
        background: { kind: 'paper' },
      },
      {
        layoutId: 'twoColumn',
        layout: {
          headline: 'Pricing.',
          leftTitle: 'Team',
          leftBody: '$29 / user / month · 10+ seats · Slack + Linear integrations · 30-day trial.',
          rightTitle: 'Enterprise',
          rightBody: '$59 / user / month · SSO · audit log · dedicated CSM · <em>annual</em> only.',
        },
        background: { kind: 'cream' },
      },
      {
        layoutId: 'bullets',
        layout: {
          title: 'Next <em>steps</em>.',
          bullets: [
            '30-min technical deep-dive with your platform lead.',
            'Two-week pilot on a single team.',
            'Joint ROI readout with your VP Eng + our founder.',
          ],
        },
        background: { kind: 'paper' },
      },
      {
        layoutId: 'thanks',
        layout: { title: 'Let\'s <em>ship</em>.' },
        background: { kind: 'paper' },
      },
    ],
  },

  // --------------------------------------------------------------
  // 5. Consumer Product Launch — Superhuman / Notion style
  // --------------------------------------------------------------
  {
    slug: 'consumer-product-launch',
    title: 'Consumer Product Launch',
    tagline: 'The 7-slide launch deck for a consumer moment.',
    description:
      'For the day you post "Today we\'re launching X." Short, image-forward, with the ask above the fold. Built for the press loop, the crowdfund, and the ProductHunt front page.',
    inspiredBy: 'Superhuman waitlist era · Arc browser launch · Raycast v2',
    category: 'internal',
    seoKeywords: [
      'product launch deck template',
      'consumer product launch slides',
      'ProductHunt launch deck',
      'SaaS launch announcement template',
    ],
    slides: [
      {
        layoutId: 'cover',
        layout: {
          eyebrow: 'launching · march 2026',
          title: 'Today we\'re <em>shipping</em> it.',
          subtitle: 'The thing we\'ve been quietly working on for 14 months.',
        },
        background: { kind: 'midnight' },
      },
      {
        layoutId: 'headline',
        layout: {
          eyebrow: 'why it matters',
          title: 'The <em>everyday thing</em> you do, <em>reimagined</em>.',
          subtitle: 'Everything since the iPhone has made the daily ritual cheaper, not better. This makes it better.',
        },
        background: { kind: 'midnight' },
      },
      {
        layoutId: 'imageFull',
        layout: {
          eyebrow: 'the product',
          title: 'This is what it <em>feels like</em>.',
          caption: 'Swap this for a screenshot · a hero shot · or a 5-second Loom loop.',
        },
        background: { kind: 'image' },
      },
      {
        layoutId: 'grid',
        layout: {
          title: 'Three things it <em>unlocks</em>.',
          items: [
            { title: 'Faster', body: '10× the ritual · zero thinking' },
            { title: 'Quieter', body: 'No notifications · no decisions' },
            { title: 'Yours', body: 'Private by default · export anything' },
          ],
        },
        background: { kind: 'cream' },
      },
      {
        layoutId: 'bigNumber',
        layout: {
          eyebrow: 'early access',
          number: '8,200',
          unit: 'on the waitlist',
          caption: 'Inviting the first <em>500</em> this week · rolling batches after.',
        },
        background: { kind: 'cream' },
      },
      {
        layoutId: 'twoColumn',
        layout: {
          headline: 'Pricing.',
          leftTitle: 'Free',
          leftBody: 'Everything you need. Forever.',
          rightTitle: 'Pro · $8/mo',
          rightBody: 'Unlimited history, priority sync, supporter badge.',
        },
        background: { kind: 'cream' },
      },
      {
        layoutId: 'thanks',
        layout: { title: 'Try it <em>today</em>.' },
        background: { kind: 'midnight' },
      },
    ],
  },

  // --------------------------------------------------------------
  // 6. Monthly Investor Update — Terrence Rohan format
  // --------------------------------------------------------------
  {
    slug: 'investor-update',
    title: 'Monthly Investor Update',
    tagline: 'The 8-slide update format every LP wishes they got.',
    description:
      'The update your investors actually read — numbers on top, asks up front, honest about what didn\'t work. Based on the monthly cadence YC partners and Terrence Rohan publicly recommend.',
    inspiredBy: 'Terrence Rohan "What a great investor update looks like" · Bridge funds',
    category: 'internal',
    seoKeywords: [
      'investor update template',
      'monthly investor update deck',
      'startup investor update template',
      'board-style investor update',
    ],
    slides: [
      {
        layoutId: 'cover',
        layout: {
          eyebrow: 'monthly update · feb 2026',
          title: 'Your <em>company</em>.',
          subtitle: 'Short. Honest. Numbered.',
        },
        background: { kind: 'cream' },
      },
      {
        layoutId: 'bigNumber',
        layout: {
          eyebrow: 'headline metric',
          prefix: '$',
          number: '1.8',
          unit: 'M ARR',
          caption: '<em>+14%</em> MoM · 112% NRR · 38 customers (+7 net).',
        },
        background: { kind: 'cream' },
      },
      {
        layoutId: 'chart',
        layout: {
          title: 'ARR · last <em>12 months</em>.',
          chartKind: 'line',
          data: [
            { label: 'Mar', value: 320 },
            { label: 'Apr', value: 410 },
            { label: 'May', value: 520 },
            { label: 'Jun', value: 640 },
            { label: 'Jul', value: 780 },
            { label: 'Aug', value: 920 },
            { label: 'Sep', value: 1080 },
            { label: 'Oct', value: 1240 },
            { label: 'Nov', value: 1390 },
            { label: 'Dec', value: 1510 },
            { label: 'Jan', value: 1630 },
            { label: 'Feb', value: 1800 },
          ],
          caption: 'ARR in $K · no paid acquisition · inbound-led.',
        },
        background: { kind: 'cream' },
      },
      {
        layoutId: 'bullets',
        layout: {
          title: 'What <em>shipped</em>.',
          bullets: [
            'Mobile app went GA on iOS + Android.',
            'Enterprise SSO + audit log for contracts over $30K.',
            'Partnership with LargeCo — now referenced publicly.',
            'Switched to <em>usage</em>-based pricing for the starter tier.',
          ],
        },
        background: { kind: 'paper' },
      },
      {
        layoutId: 'bullets',
        layout: {
          title: 'What <em>didn\'t work</em>.',
          bullets: [
            'Outbound pilot on SMB — <em>killed it</em> after 4 weeks.',
            'First EMEA hire accepted then declined day 1.',
            'API spec change broke 3 integrations · hotfix shipped.',
          ],
        },
        background: { kind: 'paper' },
        notes: 'The "what did not work" slide is the one LPs actually trust you from. Be specific.',
      },
      {
        layoutId: 'grid',
        layout: {
          title: 'Team · we\'re <em>hiring</em>.',
          items: [
            { title: 'Senior Eng', body: 'Rails · infra' },
            { title: 'Staff Eng', body: 'AI / RAG' },
            { title: 'Founding AE', body: 'NY · SF' },
            { title: 'Head of Ops', body: 'remote · SA/EU' },
          ],
        },
        background: { kind: 'paper' },
      },
      {
        layoutId: 'bullets',
        layout: {
          title: 'Asks.',
          bullets: [
            'Warm intros to <em>VP Eng @ 500-1000 person</em> SaaS companies.',
            'Candidates for the Staff AI role — pinging you in LinkedIn.',
            'Feedback on a new pricing model attached in appendix.',
          ],
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
  // 7. Customer Case Study — the proof deck for sales enablement
  // --------------------------------------------------------------
  {
    slug: 'customer-case-study',
    title: 'Customer Case Study',
    tagline: 'A 6-slide proof deck your sales team can ship tomorrow.',
    description:
      'Turn a successful deployment into a shareable artifact. Problem → solution → before/after → the quote → the ask. Designed for the AE who needs to send a single link to de-risk the next deal.',
    inspiredBy: 'Gong customer stories · Stripe customer pages · Notion at-a-glance',
    category: 'sales',
    seoKeywords: [
      'customer case study template',
      'B2B SaaS case study template',
      'customer success deck template',
      'sales enablement case study',
    ],
    slides: [
      {
        layoutId: 'cover',
        layout: {
          eyebrow: 'case study · feb 2026',
          title: 'How <em>Kova</em> raised a Series A in <em>three weeks</em>.',
          subtitle: 'With one Tellar link · shared with 14 funds · 11 took meetings.',
        },
        background: { kind: 'paper' },
      },
      {
        layoutId: 'headline',
        layout: {
          eyebrow: 'the challenge',
          title: 'A traditional process <em>would have taken 3 months</em>.',
          subtitle: 'Kova had product-market fit but couldn\'t schedule 14 first-meetings fast enough.',
        },
        background: { kind: 'paper' },
      },
      {
        layoutId: 'comparison',
        layout: {
          headline: '<em>Before</em> vs. with Tellar.',
          leftTitle: 'PDF deck + email',
          rightTitle: 'Tellar link',
          left: ['No visibility into opens', 'No idea which slide hit', 'Q&A waited for a call', '3-month cycle'],
          right: ['Every view tracked', 'Slide 7 highlighted as drop-off', 'Agent answered Qs live', '<em>21-day</em> cycle'],
        },
        background: { kind: 'cream' },
      },
      {
        layoutId: 'bigNumber',
        layout: {
          eyebrow: 'the result',
          prefix: '$',
          number: '6',
          unit: 'M raised',
          caption: '21 days from deck sent to term sheet signed · <em>14×</em> faster than their last round.',
        },
        background: { kind: 'cream' },
      },
      {
        layoutId: 'quote',
        layout: {
          quote:
            'Three investor meetings in 48 hours. One of them re-watched slide 4 twice before the call. <em>That slide</em> was the deal.',
          author: 'Nora Álvarez',
          role: 'founder · Kova',
        },
        background: { kind: 'midnight' },
      },
      {
        layoutId: 'thanks',
        layout: { title: 'Your turn <em>next</em>.' },
        background: { kind: 'paper' },
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
