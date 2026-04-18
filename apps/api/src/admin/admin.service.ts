import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async overview() {
    const [
      usersTotal,
      usersActive,
      workspacesTotal,
      tellersTotal,
      sharesTotal,
      activeSubs,
      agentQueries,
      last30DaysSignups,
      latestUsers,
      latestEvents,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isSuspended: false, deletionRequestedAt: null } }),
      this.prisma.workspace.count(),
      this.prisma.teller.count({ where: { deletedAt: null } }),
      this.prisma.share.count({ where: { revokedAt: null } }),
      this.prisma.subscription.count({ where: { status: 'active' } }),
      this.prisma.event.count({ where: { type: 'AGENT_QUERY' } }),
      this.prisma.user.count({ where: { createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } } }),
      this.prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, email: true, name: true, createdAt: true, role: true, provider: true, isSuspended: true },
      }),
      this.prisma.event.findMany({
        orderBy: { at: 'desc' },
        take: 20,
        select: { id: true, type: true, at: true, tellerId: true, email: true, meta: true },
      }),
    ]);

    // Approx MRR from active subs
    const subs = await this.prisma.subscription.findMany({ where: { status: 'active' } });
    const planPrice: Record<string, number> = { free: 0, pro: 49, scale: 149, enterprise: 0 };
    const mrr = subs.reduce((acc, s) => acc + (planPrice[s.plan] || 0), 0);

    return {
      usersTotal,
      usersActive,
      workspacesTotal,
      tellersTotal,
      sharesTotal,
      activeSubs,
      agentQueries,
      last30DaysSignups,
      mrr,
      latestUsers,
      latestEvents,
    };
  }

  async listAccounts(q?: string, page = 1) {
    const where = q
      ? {
          OR: [
            { email: { contains: q, mode: 'insensitive' as const } },
            { name: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {};
    const take = 25;
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * take,
        take,
        select: {
          id: true, email: true, name: true, role: true, provider: true,
          createdAt: true, lastLoginAt: true, isSuspended: true,
          deletionRequestedAt: true, stripeCustomerId: true,
          _count: { select: { ownedWorkspaces: true, subscriptions: true, invoices: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, page, pageSize: take };
  }

  async setRole(userId: string, role: 'USER' | 'ADMIN') {
    return this.prisma.user.update({ where: { id: userId }, data: { role } });
  }

  async setSuspended(userId: string, isSuspended: boolean) {
    return this.prisma.user.update({ where: { id: userId }, data: { isSuspended } });
  }

  async listWorkspaces() {
    return this.prisma.workspace.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        owner: { select: { id: true, email: true, name: true } },
        _count: { select: { members: true, tellers: true } },
        usage: true,
      },
      take: 100,
    });
  }

  async billingOverview() {
    const [subs, invoices] = await Promise.all([
      this.prisma.subscription.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { user: { select: { email: true, name: true } } },
      }),
      this.prisma.invoice.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { user: { select: { email: true, name: true } } },
      }),
    ]);
    const revenueCents = invoices
      .filter(i => i.status === 'paid')
      .reduce((acc, i) => acc + i.amountPaid, 0);
    return { subs, invoices, revenueCents };
  }

  async recentEvents(type?: string) {
    return this.prisma.event.findMany({
      where: type ? { type: type as any } : {},
      orderBy: { at: 'desc' },
      take: 200,
      select: { id: true, type: true, at: true, tellerId: true, email: true, slideIdx: true, meta: true },
    });
  }
}
