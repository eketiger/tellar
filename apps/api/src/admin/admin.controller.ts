import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { AdminGuard } from '../auth/admin.guard';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtGuard, AdminGuard)
export class AdminController {
  constructor(private svc: AdminService) {}

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

  @Get('billing')
  billing() {
    return this.svc.billingOverview();
  }

  @Get('events')
  events(@Query('type') type?: string) {
    return this.svc.recentEvents(type);
  }
}
