import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { EventsService } from './events.service';
import { ZodValidate } from '../common/zod.pipe';
import { TrackEventDto } from '@tellar/api-types';
import { JwtGuard } from '../auth/jwt.guard';
import { WorkspaceGuard } from '../auth/workspace.guard';

@Controller()
export class EventsController {
  constructor(private svc: EventsService) {}

  // Beacon endpoint — no auth required, shareId+slug acts as the capability
  @Post('events')
  track(@Body(new ZodValidate(TrackEventDto)) dto: any) {
    return this.svc.track(dto);
  }

  @Get('tellers/:tellerId/analytics')
  @UseGuards(JwtGuard, WorkspaceGuard)
  analytics(@Param('tellerId') tellerId: string) {
    return this.svc.funnel(tellerId);
  }
}
