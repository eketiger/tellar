import { BadRequestException, Body, Controller, Get, Headers, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { BillingService } from './billing.service';
import { stripe } from './stripe';

@Controller()
export class BillingController {
  constructor(private svc: BillingService) {}

  @Get('workspaces/:id/billing')
  @UseGuards(JwtGuard)
  get(@Param('id') id: string) {
    return this.svc.get(id);
  }

  @Post('billing/create-checkout-session')
  @UseGuards(JwtGuard)
  checkout(
    @CurrentUser() u: any,
    @Body() body: { plan: 'PRO' | 'SCALE'; workspaceId: string; successUrl: string; cancelUrl: string },
  ) {
    return this.svc.createCheckoutSession({
      userId: u.sub,
      workspaceId: body.workspaceId,
      plan: body.plan,
      successUrl: body.successUrl,
      cancelUrl: body.cancelUrl,
    });
  }

  @Post('billing/create-portal-session')
  @UseGuards(JwtGuard)
  portal(@CurrentUser() u: any, @Body() body: { returnUrl: string }) {
    return this.svc.createPortalSession(u.sub, body.returnUrl);
  }

  @Post('billing/cancel')
  @UseGuards(JwtGuard)
  cancel(@CurrentUser() u: any) {
    return this.svc.cancelAtPeriodEnd(u.sub);
  }

  /**
   * Stripe webhook — receives the raw buffer via an Express-level middleware
   * applied in main.ts, so req.rawBody exists. No auth.
   */
  @Post('billing/webhook')
  async webhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('stripe-signature') sig?: string,
  ) {
    const s = stripe();
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!s || !secret) return { received: true, skipped: 'no-stripe-configured' };
    if (!sig) throw new BadRequestException('missing signature');
    // The raw body is required for HMAC verification. Re-serialising the
    // parsed JSON would silently produce a different byte stream and the
    // HMAC would never match — fail loudly instead.
    if (!req.rawBody) throw new BadRequestException('missing raw body — middleware misconfigured');
    let event;
    try {
      event = s.webhooks.constructEvent(req.rawBody, sig, secret);
    } catch (e: any) {
      throw new BadRequestException(`bad signature: ${e.message}`);
    }
    await this.svc.handleWebhook(event);
    return { received: true };
  }
}
