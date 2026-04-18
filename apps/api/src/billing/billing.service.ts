import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const PRICES: Record<string, number> = { FREE: 0, PRO: 49, SCALE: 149, ENTERPRISE: 0 };

@Injectable()
export class BillingService {
  constructor(private prisma: PrismaService) {}

  async get(workspaceId: string) {
    const b = await this.prisma.billing.upsert({
      where: { workspaceId },
      update: {},
      create: { workspaceId },
    });
    return {
      ...b,
      price: PRICES[b.plan] || 0,
      interval: 'month',
      nextInvoice: new Date(Date.now() + 18 * 86_400_000),
      card: { brand: 'visa', last4: '4242', exp: '09/28' },
      invoices: [
        { id: 'inv_1', date: new Date(Date.now() - 30 * 86_400_000), amount: PRICES[b.plan] || 0, status: 'paid' },
        { id: 'inv_2', date: new Date(Date.now() - 60 * 86_400_000), amount: PRICES[b.plan] || 0, status: 'paid' },
      ],
    };
  }

  async updatePlan(workspaceId: string, plan: any) {
    return this.prisma.billing.upsert({
      where: { workspaceId },
      update: { plan },
      create: { workspaceId, plan },
    });
  }

  async checkoutUrl(workspaceId: string, plan: any) {
    // Stub — in prod, create Stripe Checkout Session
    await this.updatePlan(workspaceId, plan);
    return { url: `${process.env.WEB_ORIGIN || ''}/settings?tab=billing&upgraded=${plan}` };
  }
}
