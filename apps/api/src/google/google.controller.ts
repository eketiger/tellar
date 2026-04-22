import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { GoogleService } from './google.service';
import { JwtGuard } from '../auth/jwt.guard';
import { WorkspaceGuard } from '../auth/workspace.guard';
import { CurrentUser } from '../auth/current-user.decorator';

const WEB_ORIGIN = (process.env.WEB_ORIGIN || 'http://localhost:3000').split(',')[0];

@Controller()
export class GoogleController {
  constructor(private svc: GoogleService) {}

  @Get('google/config')
  config() {
    return { enabled: this.svc.isEnabled() };
  }

  /** Current user's Google connection status — powers the settings UI + the
   *  editor import modal (which skips the connect step when connected). */
  @Get('google/status')
  @UseGuards(JwtGuard)
  async status(@CurrentUser() u: any) {
    if (!this.svc.isEnabled()) return { enabled: false, connected: false };
    const conn = await this.svc.getConnection(u.sub);
    return { enabled: true, connected: !!conn, connection: conn };
  }

  @Delete('google/disconnect')
  @UseGuards(JwtGuard)
  disconnect(@CurrentUser() u: any) {
    return this.svc.disconnect(u.sub);
  }

  /** Kick off OAuth via a full-page redirect. The authenticated userId is
   *  encoded in `state` so the callback knows whose connection to upsert. */
  @Get('google/auth/start')
  @UseGuards(JwtGuard)
  start(@CurrentUser() u: any, @Res() res: Response) {
    if (!this.svc.isEnabled()) {
      return res.status(501).send('Google OAuth not configured');
    }
    // state = base64({ userId, nonce, redirect }). The callback verifies the
    // userId is still on the active JWT session before saving tokens.
    const state = Buffer.from(JSON.stringify({
      userId: u.sub,
      nonce: Math.random().toString(36).slice(2, 10),
      redirect: '/settings#integrations',
    })).toString('base64url');
    return res.redirect(this.svc.authorizeUrl(state));
  }

  /** Callback: exchange the code, identify the Google account, upsert the
   *  connection row, and bounce back to the web app's settings page. */
  @Get('google/auth/callback')
  async callback(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
    if (!code) return res.status(400).send('Missing code');
    let parsed: { userId?: string; redirect?: string } = {};
    try {
      parsed = JSON.parse(Buffer.from(state || '', 'base64url').toString('utf8'));
    } catch { /* ignore bad state */ }
    if (!parsed.userId) return res.status(400).send('Missing or invalid state');
    try {
      const tokens = await this.svc.exchangeCode(code);
      const profile = await this.svc.fetchUserInfo(tokens.access_token);
      await this.svc.saveConnection(parsed.userId, tokens, profile);
      const target = `${WEB_ORIGIN}${parsed.redirect || '/settings'}?google=connected`;
      return res.redirect(target);
    } catch (e: any) {
      const target = `${WEB_ORIGIN}${parsed.redirect || '/settings'}?google=error&msg=${encodeURIComponent(e?.message || 'unknown')}`;
      return res.redirect(target);
    }
  }

  /** Import a presentation into an existing teller using the stored
   *  connection. No accessToken in the body — we mint one on demand. */
  @Post('tellers/:tellerId/google-import')
  @UseGuards(JwtGuard, WorkspaceGuard)
  async import(
    @CurrentUser() u: any,
    @Param('tellerId') tellerId: string,
    @Body() body: { presentationUrl: string },
  ) {
    if (!body?.presentationUrl) {
      throw new BadRequestException('presentationUrl is required');
    }
    const accessToken = await this.svc.getAccessTokenForUser(u.sub);
    const presentationId = this.svc.extractPresentationId(body.presentationUrl);
    const pres = await this.svc.fetchPresentation(accessToken, presentationId);
    const parsed = this.svc.parsePresentationToSlides(pres);
    const { appended } = await this.svc.appendToTeller(tellerId, pres.title, parsed);
    return { ok: true, appended, title: pres.title };
  }
}
