import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { PlatformAdminGuard } from '../auth/platform-admin.guard';
import { AdminService } from './admin.service';
import { GdprService } from '../gdpr/gdpr.service';

@Controller('admin')
@UseGuards(PlatformAdminGuard)
export class AdminController {
  constructor(private svc: AdminService, private gdpr: GdprService) {}

  @Post('gdpr/sweep')
  sweepDeletions() {
    return this.gdpr.sweepDeletions();
  }

  @Get('overview')
  overview() {
    return this.svc.overview();
  }

  @Get('accounts')
  accounts(@Query('q') q?: string, @Query('page') page?: string) {
    return this.svc.listAccounts(q, page ? Number(page) : 1);
  }

  @Patch('accounts/:id/role')
  setRole(@Param('id') id: string, @Body() body: { role: 'USER' | 'ADMIN' }) {
    return this.svc.setRole(id, body.role);
  }

  @Patch('accounts/:id/suspended')
  setSuspended(@Param('id') id: string, @Body() body: { isSuspended: boolean }) {
    return this.svc.setSuspended(id, body.isSuspended);
  }

  @Get('workspaces')
  workspaces() {
    return this.svc.listWorkspaces();
  }

  @Get('workspaces/:id')
  workspaceDetail(@Param('id') id: string) {
    return this.svc.workspaceDetail(id);
  }

  @Get('billing')
  billing() {
    return this.svc.billingOverview();
  }

  @Get('events')
  events(@Query('type') type?: string) {
    return this.svc.recentEvents(type);
  }
}
