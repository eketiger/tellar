import { Body, Controller, Delete, Get, Ip, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { GdprService } from './gdpr.service';

@Controller()
export class GdprController {
  constructor(private svc: GdprService) {}

  @Get('user/data-export')
  @UseGuards(JwtGuard)
  async dataExport(@CurrentUser() u: any, @Res() res: Response) {
    const data = await this.svc.dataExport(u.sub);
    res.setHeader('content-type', 'application/json');
    res.setHeader('content-disposition', `attachment; filename="tellar-export-${u.sub}.json"`);
    res.status(200).send(JSON.stringify(data, null, 2));
  }

  @Delete('user/account')
  @UseGuards(JwtGuard)
  deleteAccount(@CurrentUser() u: any, @Res({ passthrough: true }) res: Response) {
    res.clearCookie('tellar_jwt');
    return this.svc.requestDeletion(u.sub);
  }

  @Post('consent/cookies')
  acceptConsent(
    @Body() body: { version: string },
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    const userId = (req as any).user?.sub || null;
    return this.svc.acceptConsent(userId, body.version || '2026-04-18', ip ? this.svc.hashIp(ip) : undefined);
  }
}
