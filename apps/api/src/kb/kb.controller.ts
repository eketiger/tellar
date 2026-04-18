import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { WorkspaceGuard } from '../auth/workspace.guard';
import { KbService } from './kb.service';

@Controller()
@UseGuards(JwtGuard)
export class KbController {
  constructor(private svc: KbService) {}

  @Get('tellers/:tellerId/kb')
  @UseGuards(WorkspaceGuard)
  list(@Param('tellerId') tellerId: string) {
    return this.svc.list(tellerId);
  }

  @Post('tellers/:tellerId/kb')
  @UseGuards(WorkspaceGuard)
  add(
    @Param('tellerId') tellerId: string,
    @Body() body: { name: string; kind: string; bytes?: number; url?: string },
  ) {
    if (body.url) return this.svc.addUrl(tellerId, body.url);
    return this.svc.addFile(tellerId, {
      name: body.name,
      kind: body.kind || 'doc',
      bytes: body.bytes || 0,
    });
  }

  @Delete('kb/:id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
