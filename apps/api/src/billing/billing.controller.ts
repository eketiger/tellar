import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { BillingService } from './billing.service';

@Controller()
@UseGuards(JwtGuard)
export class BillingController {
  constructor(private svc: BillingService) {}

  @Get('workspaces/:id/billing')
  get(@Param('id') id: string) {
    return this.svc.get(id);
  }

  @Post('billing/checkout')
  checkout(@Body() body: { workspaceId: string; plan: string }) {
    return this.svc.checkoutUrl(body.workspaceId, body.plan);
  }

  @Post('billing/webhook')
  webhook(@Body() body: any) {
    // Stub — real impl verifies Stripe signature
    return { received: true };
  }
}
