import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { WorkspaceGuard } from '../auth/workspace.guard';
import { SharesService } from './shares.service';
import { ZodValidate } from '../common/zod.pipe';
import { CreateShareDto, UpdateShareDto } from '@tellar/api-types';

@Controller()
@UseGuards(JwtGuard)
export class SharesController {
  constructor(private svc: SharesService) {}

  @Post('tellers/:tellerId/shares')
  @UseGuards(WorkspaceGuard)
  create(@Param('tellerId') tellerId: string, @Body(new ZodValidate(CreateShareDto)) dto: any) {
    return this.svc.createOrReturn(tellerId, dto);
  }

  @Get('tellers/:tellerId/share')
  @UseGuards(WorkspaceGuard)
  getActive(@Param('tellerId') tellerId: string) {
    return this.svc.activeFor(tellerId);
  }

  @Patch('shares/:shareId')
  @UseGuards(WorkspaceGuard)
  update(@Param('shareId') shareId: string, @Body(new ZodValidate(UpdateShareDto)) dto: any) {
    return this.svc.update(shareId, dto);
  }

  @Post('shares/:shareId/revoke')
  @UseGuards(WorkspaceGuard)
  revoke(@Param('shareId') shareId: string) {
    return this.svc.revoke(shareId);
  }

  @Post('shares/:shareId/invitees')
  @UseGuards(WorkspaceGuard)
  addInvitee(@Param('shareId') shareId: string, @Body() body: { email: string; name?: string }) {
    return this.svc.addInvitee(shareId, body.email, body.name);
  }
}
