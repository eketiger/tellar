import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SharesService } from '../shares/shares.service';
import { ZodValidate } from '../common/zod.pipe';
import { AuthorizeViewerDto } from '@tellar/api-types';

interface ShareTokenPayload {
  shareId: string;
  slug: string;
  email?: string;
  perms: Record<string, boolean>;
}

@Controller('v')
export class ViewerController {
  constructor(private shares: SharesService, private jwt: JwtService) {}

  @Post(':slug/authorize')
  async authorize(
    @Param('slug') slug: string,
    @Body(new ZodValidate(AuthorizeViewerDto)) dto: any,
  ) {
    const share = await this.shares.bySlug(slug);
    if (share.expiresAt && share.expiresAt.getTime() < Date.now())
      throw new ForbiddenException({ reason: 'expired' });

    const mode = share.accessMode;
    if (mode === 'PUBLIC') {
      return this.mintToken(share, dto.email);
    }
    if (mode === 'EMAIL_GATED') {
      if (!dto.email) throw new BadRequestException({ reason: 'email-required' });
      const domain = dto.email.split('@')[1];
      if (
        share.allowedDomains?.length &&
        !share.allowedDomains.some((d: string) => domain.endsWith(d.replace('@', '')))
      ) {
        throw new ForbiddenException({ reason: 'domain-blocked' });
      }
      await this.shares.touchInvitee(share.id, dto.email);
      return this.mintToken(share, dto.email);
    }
    if (mode === 'INVITE_ONLY') {
      if (!dto.email) throw new BadRequestException({ reason: 'email-required' });
      if (!share.invitees.some(i => i.email === dto.email))
        throw new ForbiddenException({ reason: 'not-invited' });
      await this.shares.touchInvitee(share.id, dto.email);
      return this.mintToken(share, dto.email);
    }
    if (mode === 'PASSPHRASE') {
      if (!dto.passphrase) throw new BadRequestException({ reason: 'passphrase-required' });
      const ok = await this.shares.verifyPassphrase(share.id, dto.passphrase);
      if (!ok) throw new ForbiddenException({ reason: 'bad-passphrase' });
      return this.mintToken(share, dto.email);
    }
    throw new ForbiddenException({ reason: 'unknown-mode' });
  }

  @Get(':slug')
  async data(@Param('slug') slug: string, @Headers('x-share-token') token?: string) {
    const share = await this.shares.bySlug(slug);
    // For PUBLIC mode, token not required
    if (share.accessMode !== 'PUBLIC') {
      if (!token) throw new UnauthorizedException({ reason: 'no-token' });
      try {
        const payload = await this.jwt.verifyAsync<ShareTokenPayload>(token);
        if (payload.shareId !== share.id) throw new UnauthorizedException();
      } catch {
        throw new UnauthorizedException({ reason: 'invalid-token' });
      }
    }
    return {
      share: {
        id: share.id,
        slug: share.slug,
        accessMode: share.accessMode,
        perms: share.perms,
        expiresAt: share.expiresAt,
      },
      teller: {
        id: share.teller.id,
        title: share.teller.title,
        theme: share.teller.theme,
        slides: share.teller.slides,
        recordings: share.teller.recordings.map(r => ({
          id: r.id,
          slideId: r.slideId,
          durationMs: r.durationMs,
          mode: r.mode,
          status: r.status,
        })),
        kbSources: share.teller.kbSources.map(k => ({
          id: k.id,
          name: k.name,
          kind: k.kind,
          indexed: k.indexed,
        })),
      },
    };
  }

  private async mintToken(share: any, email?: string) {
    const token = await this.jwt.signAsync({
      shareId: share.id,
      slug: share.slug,
      email,
      perms: share.perms,
    } satisfies ShareTokenPayload);
    return { token, ttlSeconds: 15 * 60, email };
  }
}
