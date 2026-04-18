import { PrismaClient, AccessMode, Role, Plan, EventType } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const DEMO_SLIDES = [
  { idx: 1, eyebrow: 'slide 01 / cover', title: 'Cover — <em>Tellar</em>', subtitle: 'Presentations that know when they lose you.' },
  { idx: 2, eyebrow: 'slide 02 / the problem', title: 'The <em>problem.</em>', subtitle: 'Every deck ships as a dead PDF. Nobody knows who read what.' },
  { idx: 3, eyebrow: 'slide 03 / why now', title: 'Why <em>now</em>', subtitle: 'AI finally makes a document that answers back feasible.' },
  { idx: 4, eyebrow: 'slide 04 / the market', title: 'A <em>$34B</em> market<br/>growing 28% <em>year over year.</em>', subtitle: 'Enterprise software is eating the last 15% of Fortune 1000 workflows.' },
  { idx: 5, eyebrow: 'slide 05 / our wedge', title: 'Our <em>wedge.</em>', subtitle: 'Start where DocSend ends: the moment after the deck is sent.' },
  { idx: 6, eyebrow: 'slide 06 / product', title: 'The <em>product</em> — a short tour.', subtitle: '' },
  { idx: 7, eyebrow: 'slide 07 / traction', title: 'Traction.', subtitle: '$1.4M ARR. 134% NRR. 61% PLG.' },
  { idx: 8, eyebrow: 'slide 08 / model', title: 'Business <em>model.</em>', subtitle: 'Seat-based with a usage tail on agent queries.' },
  { idx: 9, eyebrow: 'slide 09 / the ask', title: 'The ask — <em>$18M.</em>', subtitle: '' },
  { idx: 10, eyebrow: 'slide 10 / use of funds', title: 'Use of <em>funds.</em>', subtitle: '58% GTM · 32% R&D · 10% ops.' },
  { idx: 11, eyebrow: 'slide 11 / unit economics', title: 'Unit <em>economics.</em>', subtitle: 'CAC payback 4.2mo · LTV/CAC 5.8×.' },
  { idx: 12, eyebrow: 'slide 12 / go-to-market', title: 'Go-to-<em>market.</em>', subtitle: 'PLG → hand-raise → enterprise AE.' },
  { idx: 13, eyebrow: 'slide 13 / team', title: 'Team.', subtitle: 'Built at Stripe, Notion, Loom.' },
  { idx: 14, eyebrow: 'slide 14 / plan', title: 'The <em>18-month</em> plan.', subtitle: '$30M ARR by Q4 2026, without raising again.' },
  { idx: 15, eyebrow: 'slide 15 / risks', title: 'Risks &amp; <em>mitigations.</em>', subtitle: '' },
  { idx: 16, eyebrow: 'slide 16 / q&a', title: 'Q&amp;A — common <em>questions.</em>', subtitle: '' },
  { idx: 17, eyebrow: 'slide 17 / thank you', title: 'Thank <em>you.</em>', subtitle: '' },
];

async function main() {
  console.log('→ Seeding Tellar demo data…');

  const passwordHash = await argon2.hash('demo1234');
  const user = await prisma.user.upsert({
    where: { email: 'martin@tellar.studio' },
    update: {},
    create: {
      email: 'martin@tellar.studio',
      name: 'Martín Echeverría',
      passwordHash,
      provider: 'EMAIL',
    },
  });

  const workspace = await prisma.workspace.upsert({
    where: { slug: 'tellar-studio' },
    update: {},
    create: {
      name: 'Tellar Studio',
      slug: 'tellar-studio',
      ownerId: user.id,
      plan: Plan.PRO,
      seats: 4,
    },
  });

  await prisma.membership.upsert({
    where: { workspaceId_email: { workspaceId: workspace.id, email: user.email } },
    update: { role: Role.OWNER, userId: user.id, status: 'active' },
    create: {
      workspaceId: workspace.id,
      userId: user.id,
      email: user.email,
      role: Role.OWNER,
      status: 'active',
    },
  });
  for (const m of [
    { email: 'ana@tellar.studio', role: Role.EDITOR, status: 'active' },
    { email: 'leo@tellar.studio', role: Role.VIEWER, status: 'pending' },
  ]) {
    await prisma.membership.upsert({
      where: { workspaceId_email: { workspaceId: workspace.id, email: m.email } },
      update: {},
      create: { workspaceId: workspace.id, email: m.email, role: m.role, status: m.status },
    });
  }

  // Idempotent teller — key off (workspaceId, title)
  let teller = await prisma.teller.findFirst({
    where: { workspaceId: workspace.id, title: 'Q2 Series A pitch' },
  });
  if (!teller) {
    teller = await prisma.teller.create({
      data: {
        workspaceId: workspace.id,
        ownerId: user.id,
        title: 'Q2 Series A pitch',
        revision: 14,
      },
    });
    await prisma.slide.createMany({
      data: DEMO_SLIDES.map(s => ({ ...s, tellerId: teller!.id })),
    });
  }

  // Share — single active per teller
  let share = await prisma.share.findFirst({ where: { tellerId: teller.id } });
  if (!share) {
    share = await prisma.share.create({
      data: {
        tellerId: teller.id,
        slug: 'qa09fx2',
        accessMode: AccessMode.EMAIL_GATED,
        allowedDomains: ['sequoiacap.com', 'a16z.com', 'indexventures.com', 'accel.com'],
        perms: {
          agent: true,
          recording: true,
          download: false,
          reshare: false,
          nda: false,
          watermark: true,
          blockScreenRec: true,
        },
        expiresAt: new Date(Date.now() + 14 * 86_400_000),
        maxOpens: 5,
        requireOTC: true,
        invitees: {
          create: [
            { email: 'sofia@sequoiacap.com', name: 'Sofia Wallenberg', status: 'active', opens: 17 },
            { email: 'h.tanaka@a16z.com', name: 'Hiro Tanaka', status: 'active', opens: 4 },
            { email: 'marco@indexventures.com', name: 'Marco Rossi', status: 'active', opens: 2 },
            { email: 'elena.park@accel.com', name: 'Elena Park', status: 'pending', opens: 0 },
          ],
        },
      },
    });
  }

  // KB sources
  const kbExists = await prisma.kBSource.count({ where: { tellerId: teller.id } });
  if (kbExists === 0) {
    await prisma.kBSource.createMany({
      data: [
        { tellerId: teller.id, kind: 'pdf', name: 'Market research — Gartner 2025', bytes: 2_400_000, indexed: true },
        { tellerId: teller.id, kind: 'xlsx', name: 'q2-financials.xlsx', bytes: 180_000, indexed: true },
        { tellerId: teller.id, kind: 'doc', name: 'Investor FAQ — internal notes', bytes: 95_000, indexed: true },
        { tellerId: teller.id, kind: 'url', name: 'company.com/case-studies', indexed: true },
      ],
    });
  }

  // Events — synthesize funnel drop at slide 9
  const eventCount = await prisma.event.count({ where: { tellerId: teller.id } });
  if (eventCount === 0) {
    const seedEmails = ['sofia@sequoiacap.com', 'h.tanaka@a16z.com', 'marco@indexventures.com', 'elena.park@accel.com'];
    const now = Date.now();
    const events: any[] = [];
    for (let v = 0; v < 42; v++) {
      const email = v < 4 ? seedEmails[v] : `viewer${v}@fundx.vc`;
      const sessionId = 'sess_' + v.toString(36) + Math.random().toString(36).slice(2, 6);
      const reach =
        Math.random() < 0.12 ? 17 : Math.random() < 0.3 ? 14 : Math.random() < 0.5 ? 9 : Math.random() < 0.8 ? 5 : 3;
      const baseT = now - Math.floor(Math.random() * 86_400_000 * 5);
      for (let s = 1; s <= Math.min(reach, 17); s++) {
        events.push({
          type: EventType.SLIDE_VIEW,
          tellerId: teller.id,
          shareId: share.id,
          sessionId,
          email,
          slideIdx: s,
          dwellMs: Math.round(8000 + Math.random() * 90000),
          at: new Date(baseT + s * 30_000),
        });
      }
    }
    const questions = ['unit economics?', 'CAC payback?', 'who is on the team?', 'what is the moat?', 'why $18M?', 'competitive landscape'];
    for (let i = 0; i < 128; i++) {
      events.push({
        type: EventType.AGENT_QUERY,
        tellerId: teller.id,
        shareId: share.id,
        sessionId: 'sess_agent_' + i.toString(36),
        email: seedEmails[i % 4],
        meta: { question: questions[i % questions.length] },
        at: new Date(now - Math.floor(Math.random() * 86_400_000 * 7)),
      });
    }
    await prisma.event.createMany({ data: events });
  }

  await prisma.usage.upsert({
    where: { workspaceId: workspace.id },
    update: {},
    create: {
      workspaceId: workspace.id,
      month: new Date().toISOString().slice(0, 7),
      agentQueries: 128,
      recordingMinutes: 47,
      storageMB: 312,
    },
  });

  await prisma.billing.upsert({
    where: { workspaceId: workspace.id },
    update: {},
    create: { workspaceId: workspace.id, plan: Plan.PRO, seatCount: 4 },
  });

  console.log('✓ Seeded. Demo login: martin@tellar.studio / demo1234');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
