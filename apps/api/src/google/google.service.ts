import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const OAUTH_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const SLIDES_API_URL = 'https://slides.googleapis.com/v1/presentations';
const SCOPE = 'https://www.googleapis.com/auth/presentations.readonly';

interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
}

interface GSlide {
  objectId: string;
  pageElements?: GPageElement[];
  pageProperties?: { pageBackgroundFill?: any };
}

interface GPageElement {
  objectId?: string;
  shape?: {
    shapeType?: string;
    text?: { textElements?: Array<{ textRun?: { content?: string }; paragraphMarker?: { bullet?: any } }> };
  };
  image?: { contentUrl?: string };
  size?: { width?: { magnitude?: number }; height?: { magnitude?: number } };
  transform?: any;
}

interface GPresentation {
  title?: string;
  slides?: GSlide[];
}

/**
 * Thin wrapper around Google's OAuth + Slides v1 REST API.
 * Enabled only when GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are set —
 * matches the "all third-party integrations optional" convention.
 */
@Injectable()
export class GoogleService {
  constructor(private prisma: PrismaService) {}

  isEnabled(): boolean {
    return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  }

  redirectUri(): string {
    return (
      process.env.GOOGLE_REDIRECT_URI ||
      `http://localhost:${process.env.PORT || 3333}/api/google/auth/callback`
    );
  }

  authorizeUrl(state: string): string {
    if (!this.isEnabled()) throw new BadRequestException('Google OAuth not configured');
    const u = new URL(OAUTH_AUTHORIZE_URL);
    u.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID!);
    u.searchParams.set('redirect_uri', this.redirectUri());
    u.searchParams.set('response_type', 'code');
    u.searchParams.set('scope', SCOPE);
    u.searchParams.set('access_type', 'online');
    u.searchParams.set('prompt', 'consent');
    u.searchParams.set('state', state);
    return u.toString();
  }

  async exchangeCode(code: string): Promise<GoogleTokens> {
    if (!this.isEnabled()) throw new BadRequestException('Google OAuth not configured');
    const res = await fetch(OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: this.redirectUri(),
        grant_type: 'authorization_code',
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new UnauthorizedException(`Google token exchange failed: ${t}`);
    }
    return (await res.json()) as GoogleTokens;
  }

  /** Accepts either a full Slides URL (https://docs.google.com/presentation/d/<id>/edit)
   *  or a raw presentation id. */
  extractPresentationId(input: string): string {
    const m = input.match(/presentation\/d\/([a-zA-Z0-9_-]+)/);
    if (m) return m[1];
    if (/^[a-zA-Z0-9_-]{20,}$/.test(input)) return input;
    throw new BadRequestException('Could not find a presentation id in the URL');
  }

  async fetchPresentation(accessToken: string, presentationId: string): Promise<GPresentation> {
    const res = await fetch(`${SLIDES_API_URL}/${presentationId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.status === 401) throw new UnauthorizedException('Google access token expired — reauthorise');
    if (!res.ok) {
      const t = await res.text();
      throw new BadRequestException(`Google Slides fetch failed: ${t}`);
    }
    return (await res.json()) as GPresentation;
  }

  /**
   * Heuristic mapper: for each Google slide pick a Tellar layout and fill
   * the slot bag from the page elements. Opinionated on purpose — creators
   * clean up after a one-shot import, they don't tune a thousand knobs.
   */
  parsePresentationToSlides(pres: GPresentation): Array<{ layoutId: string; slots: Record<string, any>; titlePlain: string }> {
    const out: Array<{ layoutId: string; slots: Record<string, any>; titlePlain: string }> = [];
    const gslides = pres.slides || [];
    for (const g of gslides) {
      const elements = g.pageElements || [];
      const texts: Array<{ text: string; isBullet: boolean; area: number }> = [];
      let hasImage = false;
      for (const el of elements) {
        if (el.image?.contentUrl) hasImage = true;
        const runs = el.shape?.text?.textElements || [];
        let combined = '';
        let anyBullet = false;
        for (const r of runs) {
          if (r.textRun?.content) combined += r.textRun.content;
          if (r.paragraphMarker?.bullet) anyBullet = true;
        }
        const clean = combined.replace(/\r\n|\r|\n/g, ' ').replace(/\s+/g, ' ').trim();
        if (!clean) continue;
        const w = el.size?.width?.magnitude || 0;
        const h = el.size?.height?.magnitude || 0;
        texts.push({ text: clean, isBullet: anyBullet, area: w * h });
      }
      texts.sort((a, b) => b.area - a.area);
      const title = texts[0]?.text || 'Untitled slide';
      const subtitle = texts[1]?.text || '';
      const bulletBlock = elements
        .flatMap(el => {
          const runs = el.shape?.text?.textElements || [];
          const lines: string[] = [];
          let cur = '';
          let isBullet = false;
          for (const r of runs) {
            if (r.paragraphMarker?.bullet) isBullet = true;
            if (r.textRun?.content) {
              cur += r.textRun.content;
              if (cur.includes('\n')) {
                const parts = cur.split(/\r?\n/);
                for (const p of parts.slice(0, -1)) {
                  const t = p.trim();
                  if (t && isBullet) lines.push(t);
                }
                cur = parts[parts.length - 1];
                isBullet = !!r.paragraphMarker?.bullet;
              }
            }
          }
          const tail = cur.trim();
          if (tail && isBullet) lines.push(tail);
          return lines;
        })
        .slice(0, 6);

      let layoutId: string;
      let slots: Record<string, any>;
      if (bulletBlock.length >= 2) {
        layoutId = 'bullets';
        slots = { title, bullets: bulletBlock };
      } else if (hasImage && subtitle) {
        layoutId = 'imageRight';
        slots = { title, body: subtitle };
      } else if (hasImage) {
        layoutId = 'imageFull';
        slots = { title, caption: subtitle };
      } else if (!subtitle && texts.length === 1) {
        layoutId = 'headline';
        slots = { title };
      } else {
        layoutId = 'headline';
        slots = { title, subtitle };
      }
      out.push({ layoutId, slots, titlePlain: title });
    }
    return out;
  }

  async appendToTeller(
    tellerId: string,
    presentationTitle: string | undefined,
    parsed: Array<{ layoutId: string; slots: Record<string, any>; titlePlain: string }>,
  ) {
    if (parsed.length === 0) return { appended: 0 };
    const baseIdx = await this.prisma.slide.count({ where: { tellerId } });
    for (let i = 0; i < parsed.length; i++) {
      const p = parsed[i];
      await this.prisma.slide.create({
        data: {
          tellerId,
          idx: baseIdx + i + 1,
          layoutId: p.layoutId,
          layout: p.slots as any,
          background: { kind: 'cream' } as any,
          title: p.titlePlain,
          subtitle: (p.slots.subtitle as string) || null,
          eyebrow: null,
          notes: null,
        },
      });
    }
    if (presentationTitle) {
      const t = await this.prisma.teller.findUnique({ where: { id: tellerId } });
      if (t && t.title === 'Untitled') {
        await this.prisma.teller.update({ where: { id: tellerId }, data: { title: presentationTitle } });
      }
    }
    await this.prisma.teller.update({
      where: { id: tellerId },
      data: { revision: { increment: 1 } },
    });
    return { appended: parsed.length };
  }
}
