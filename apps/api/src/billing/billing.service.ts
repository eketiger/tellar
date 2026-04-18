import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { stripe } from './stripe';
import type Stripe from 'stripe';

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
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { owner: { include: { subscriptions: true, invoices: { orderBy: { createdAt: 'desc' }, take: 20 } } } },
    });
    const activeSub = workspace?.owner.subscriptions.find(s => s.status === 'active');
    return {
      ...b,
      price: activeSub ? PRICES[activeSub.plan.toUpperCase()] || 0 : PRICES[b.plan] || 0,
      interval: 'month',
      nextInvoice: activeSub?.currentPeriodEnd || null,
      cancelAtPeriodEnd: activeSub?.cancelAtPeriodEnd ?? false,
      invoices: workspace?.owner.invoices || [],
    };
  }

  async createCheckoutSession(opts: {
    userId: string;
    workspaceId: string;
    plan: 'PRO' | 'SCALE';
    successUrl: string;
    cancelUrl: string;
  }) {
    const s = stripe();
    if (!s) {
      // Fallback: no Stripe → just flip the plan locally
      await this.updatePlan(opts.workspaceId, opts.plan);
      return { url: `${opts.successUrl}?mock=1`, mock: true };
    }
    const user = await this.prisma.user.findUnique({ where: { id: opts.userId } });
    if (!user) throw new BadRequestException();
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const c = await s.customers.create({ email: user.email, name: user.name, metadata: { userId: user.id } });
      customerId = c.id;
      await this.prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } });
    }
    const priceId =
      opts.plan === 'PRO'
        ? process.env.STRIPE_PRICE_PRO
        : process.env.STRIPE_PRICE_SCALE;
    if (!priceId) throw new BadRequestException('Stripe price id not configured');

    const session = await s.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: opts.successUrl,
      cancel_url: opts.cancelUrl,
      metadata: { userId: user.id, workspaceId: opts.workspaceId, plan: opts.plan },
    });
    return { url: session.url!, mock: false };
  }

  async createPortalSession(userId: string, returnUrl: string) {
    const s = stripe();
    if (!s) return { url: returnUrl, mock: true };
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.stripeCustomerId) throw new BadRequestException('No Stripe customer');
    const portal = await s.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: returnUrl,
    });
    return { url: portal.url };
  }

  async cancelAtPeriodEnd(userId: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { userId, status: 'active' },
      orderBy: { createdAt: 'desc' },
    });
    if (!sub) throw new BadRequestException('No active subscription');
    const s = stripe();
    if (s) {
      await s.subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: true });
    }
    return this.prisma.subscription.update({ where: { id: sub.id }, data: { cancelAtPeriodEnd: true } });
  }

  async updatePlan(workspaceId: string, plan: any) {
    return this.prisma.billing.upsert({
      where: { workspaceId },
      update: { plan },
      create: { workspaceId, plan },
    });
  }

  async handleWebhook(event: Stripe.Event) {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session;
        const userId = s.metadata?.userId;
        const workspaceId = s.metadata?.workspaceId;
        const plan = (s.metadata?.plan || 'PRO').toUpperCase();
        if (userId && s.subscription) {
          await this.upsertSubFromStripe(userId, s.subscription as string, plan);
        }
        if (workspaceId) await this.updatePlan(workspaceId, plan);
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const sub = event.data.object as Stripe.Subscription;
        const userId = await this.userIdForCustomer(sub.customer as string);
        if (userId) await this.upsertSubFromStripe(userId, sub.id, undefined, sub);
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await this.prisma.subscription.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: { status: 'canceled', canceledAt: new Date() },
        });
        break;
      }
      case 'invoice.payment_succeeded': {
        const inv = event.data.object as Stripe.Invoice;
        const userId = await this.userIdForCustomer(inv.customer as string);
        if (userId) {
          await this.prisma.invoice.upsert({
            where: { stripeInvoiceId: inv.id },
            update: { status: inv.status || 'paid', amountPaid: inv.amount_paid || 0 },
            create: {
              userId,
              stripeInvoiceId: inv.id,
              amountPaid: inv.amount_paid || 0,
              currency: inv.currency || 'usd',
              status: inv.status || 'paid',
              invoicePdf: inv.invoice_pdf || undefined,
            },
          });
        }
        break;
      }
      case 'invoice.payment_failed': {
        const inv = event.data.object as Stripe.Invoice;
        const userId = await this.userIdForCustomer(inv.customer as string);
        if (userId) {
          await this.prisma.subscription.updateMany({
            where: { userId, status: 'active' },
            data: { status: 'past_due' },
          });
        }
        break;
      }
    }
  }

  private async userIdForCustomer(customerId: string) {
    const u = await this.prisma.user.findUnique({ where: { stripeCustomerId: customerId } });
    return u?.id || null;
  }

  private async upsertSubFromStripe(
    userId: string,
    subId: string,
    planHint?: string,
    sub?: Stripe.Subscription,
  ) {
    const s = stripe();
    const full = sub || (s ? await s.subscriptions.retrieve(subId) : null);
    if (!full) return;
    const priceId = full.items.data[0]?.price.id || '';
    const plan =
      planHint ||
      (priceId === process.env.STRIPE_PRICE_SCALE
        ? 'SCALE'
        : priceId === process.env.STRIPE_PRICE_PRO
          ? 'PRO'
          : 'FREE');
    await this.prisma.subscription.upsert({
      where: { stripeSubscriptionId: subId },
      update: {
        status: full.status,
        plan,
        currentPeriodStart: new Date((full.current_period_start || 0) * 1000),
        currentPeriodEnd: new Date((full.current_period_end || 0) * 1000),
        cancelAtPeriodEnd: full.cancel_at_period_end,
      },
      create: {
        userId,
        stripeSubscriptionId: subId,
        stripePriceId: priceId,
        status: full.status,
        plan,
        currentPeriodStart: new Date((full.current_period_start || 0) * 1000),
        currentPeriodEnd: new Date((full.current_period_end || 0) * 1000),
        cancelAtPeriodEnd: full.cancel_at_period_end,
      },
    });
  }
}
