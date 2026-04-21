import { Body, Controller, Get, HttpException, HttpStatus, Ip, Param, Post, UseGuards } from '@nestjs/common';
import { EventsService } from './events.service';
import { ZodValidate } from '../common/zod.pipe';
import { TrackEventDto } from '@tellar/api-types';
import { JwtGuard } from '../auth/jwt.guard';
import { WorkspaceGuard } from '../auth/workspace.guard';
import { RateLimiter } from '../common/rate-limiter';

// 10 events/sec sustained, burst up to 40 — matches the prototype's 3s-batch flush.
const beaconLimiter = new RateLimiter(40, 10);

@Controller()
export class EventsController {
  constructor(private svc: EventsService) {}

  // Beacon endpoint — no auth required, shareId+slug acts as the capability.
  // Per-session bucket first, per-IP fallback when sessionId is spoofed-empty.
  @Post('events')
  track(@Body(new ZodValidate(TrackEventDto)) dto: any, @Ip() ip: string) {
    const key = `evt:${dto.sessionId || ip}`;
    if (!beaconLimiter.tryConsume(key)) {
      throw new HttpException('Too many events', HttpStatus.TOO_MANY_REQUESTS);
    }
    return this.svc.track(dto);
  }

  @Get('tellers/:tellerId/analytics')
  @UseGuards(JwtGuard, WorkspaceGuard)
  analytics(@Param('tellerId') tellerId: string) {
    return this.svc.funnel(tellerId);
  }

  @Get('tellers/:tellerId/sessions')
  @UseGuards(JwtGuard, WorkspaceGuard)
  sessions(@Param('tellerId') tellerId: string) {
    return this.svc.sessions(tellerId);
  }

  @Get('tellers/:tellerId/sessions/:sessionId')
  @UseGuards(JwtGuard, WorkspaceGuard)
  sessionReplay(@Param('tellerId') tellerId: string, @Param('sessionId') sessionId: string) {
    return this.svc.sessionTimeline(tellerId, sessionId);
  }
}
