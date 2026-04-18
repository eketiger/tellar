import { Body, Controller, Delete, Get, Param, Patch, Post, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthService } from '../auth/auth.service';
import { WorkspacesService } from './workspaces.service';

@Controller()
@UseGuards(JwtGuard)
export class WorkspacesController {
  constructor(private svc: WorkspacesService, private auth: AuthService) {}

  @Get('workspaces')
  list(@CurrentUser() u: any) {
    return this.svc.listForUser(u.sub);
  }

  @Post('workspaces')
  create(@CurrentUser() u: any, @Body() body: { name: string }) {
    return this.svc.create(u.sub, body.name || 'Untitled workspace');
  }

  @Patch('workspaces/:id')
  async rename(@Param('id') id: string, @Body() body: { name: string }) {
    return this.svc.rename(id, body.name);
  }

  @Post('workspaces/:id/switch')
  async switch(@Param('id') id: string, @CurrentUser() u: any, @Res({ passthrough: true }) res: Response) {
    const token = await this.auth.signFor(u.sub, id);
    res.cookie('tellar_jwt', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 7 * 24 * 3600 * 1000,
    });
    return { ok: true, workspaceId: id, token };
  }

  @Get('workspaces/:id/members')
  members(@Param('id') id: string) {
    return this.svc.members(id);
  }

  @Post('workspaces/:id/invites')
  invite(@Param('id') id: string, @Body() body: { email: string; role: string }) {
    return this.svc.invite(id, body.email, body.role || 'EDITOR');
  }

  @Delete('memberships/:id')
  remove(@Param('id') id: string) {
    return this.svc.removeMembership(id);
  }

  @Get('workspaces/:id/usage')
  usage(@Param('id') id: string) {
    return this.svc.getUsage(id);
  }
}
