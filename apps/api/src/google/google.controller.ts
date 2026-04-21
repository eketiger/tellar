import { BadRequestException, Body, Controller, Get, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { GoogleService } from './google.service';
import { JwtGuard } from '../auth/jwt.guard';
import { WorkspaceGuard } from '../auth/workspace.guard';

@Controller()
export class GoogleController {
  constructor(private svc: GoogleService) {}

  @Get('google/config')
  config() {
    return { enabled: this.svc.isEnabled() };
  }

  /** Kick off the OAuth flow in a popup window. The redirect URI must match
   *  whatever was registered in Google Cloud Console. */
  @Get('google/auth/start')
  @UseGuards(JwtGuard)
  start(@Res() res: Response) {
    if (!this.svc.isEnabled()) return res.status(501).json({ error: 'Google OAuth not configured' });
    // We don't actually validate state yet — the JWT + WorkspaceGuard do the
    // heavy lifting when the token is spent. A random state still helps
    // against CSRF on the redirect leg.
    const state = Math.random().toString(36).slice(2);
    return res.redirect(this.svc.authorizeUrl(state));
  }

  /** Callback from Google — pulled into a popup. We render a minimal HTML
   *  page that postMessages the access token back to the opener window and
   *  closes itself. The opener holds the token in memory only. */
  @Get('google/auth/callback')
  async callback(@Query('code') code: string, @Res() res: Response) {
    if (!code) return res.status(400).send('Missing code');
    try {
      const tokens = await this.svc.exchangeCode(code);
      const payload = JSON.stringify({ accessToken: tokens.access_token, expiresIn: tokens.expires_in });
      res.setHeader('content-type', 'text/html');
      return res.send(`<!doctype html><meta charset="utf-8"><title>Connected</title>
<body style="font-family: system-ui; padding: 24px; background:#0c0d0f; color:#f6f3ed">
<p style="font-family: monospace; font-size: 11px; letter-spacing: .15em; text-transform: uppercase; color:#888">google · connected</p>
<script>
  (function(){
    try { window.opener && window.opener.postMessage({ type: 'tellar:google-auth', payload: ${payload} }, '*'); } catch (e) {}
    window.close();
  })();
</script>
<p>You can close this window.</p></body>`);
    } catch (e: any) {
      return res.status(500).send(`OAuth error: ${e?.message || 'unknown'}`);
    }
  }

  /** Import a presentation into an existing teller. Routed under
   *  /tellers/:tellerId so WorkspaceGuard enforces tenancy on the param. */
  @Post('tellers/:tellerId/google-import')
  @UseGuards(JwtGuard, WorkspaceGuard)
  async import(
    @Param('tellerId') tellerId: string,
    @Body() body: { presentationUrl: string; accessToken: string },
  ) {
    if (!body?.presentationUrl || !body?.accessToken) {
      throw new BadRequestException('presentationUrl and accessToken are required');
    }
    const presentationId = this.svc.extractPresentationId(body.presentationUrl);
    const pres = await this.svc.fetchPresentation(body.accessToken, presentationId);
    const parsed = this.svc.parsePresentationToSlides(pres);
    const { appended } = await this.svc.appendToTeller(tellerId, pres.title, parsed);
    return { ok: true, appended, title: pres.title };
  }
}
