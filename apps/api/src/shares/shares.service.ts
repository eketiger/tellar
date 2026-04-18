import { Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { CreateShareDto, UpdateShareDto } from '@tellar/api-types';

const DEFAULT_PERMS = {
  agent: true,
  recording: true,
  download: false,
  reshare: false,
  nda: false,
  watermark: true,
  blockScreenRec: false,
};

function randSlug() {
  return Math.random().toString(36).slice(2, 10);
}

@Injectable()
export class SharesService {
  constructor(private prisma: PrismaService) {}

  async createOrReturn(tellerId: string, dto: CreateShareDto) {
    const existing = await this.prisma.share.findFirst({ where: { tellerId, revokedAt: null } });
    if (existing) return existing;
    const data: any = {
      tellerId,
      slug: randSlug(),
      accessMode: dto.accessMode ?? 'EMAIL_GATED',
      allowedDomains: dto.allowedDomains ?? [],
      perms: { ...DEFAULT_PERMS, ...(dto.perms || {}) },
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      maxOpens: dto.maxOpens ?? null,
      requireOTC: dto.requireOTC ?? false,
    };
    if (dto.passphrase) data.passphraseHash = await argon2.hash(dto.passphrase);
    return this.prisma.share.create({ data });
  }

  activeFor(tellerId: string) {
    return this.prisma.share.findFirst({
      where: { tellerId, revokedAt: null },
      include: { invitees: true },
    });
  }

  async update(id: string, dto: UpdateShareDto) {
    const data: any = { ...dto };
    if (dto.passphrase) data.passphraseHash = await argon2.hash(dto.passphrase);
    delete data.passphrase;
    if (data.expiresAt) data.expiresAt = new Date(data.expiresAt);
    if (data.perms) {
      const cur = await this.prisma.share.findUnique({ where: { id } });
      data.perms = { ...(cur?.perms as object), ...data.perms };
    }
    return this.prisma.share.update({ where: { id }, data, include: { invitees: true } });
  }

  revoke(id: string) {
    return this.prisma.share.update({ where: { id }, data: { revokedAt: new Date(), expiresAt: new Date() } });
  }

  async addInvitee(shareId: string, email: string, name?: string) {
    return this.prisma.invitee.upsert({
      where: { shareId_email: { shareId, email } },
      update: { name, status: 'active' },
      create: { shareId, email, name, status: 'active' },
    });
  }

  async bySlug(slug: string) {
    const s = await this.prisma.share.findUnique({
      where: { slug },
      include: {
        invitees: true,
        teller: { include: { slides: { orderBy: { idx: 'asc' } }, recordings: true, kbSources: true } },
      },
    });
    if (!s || s.revokedAt) throw new NotFoundException('Share not found');
    return s;
  }

  async verifyPassphrase(shareId: string, pass: string) {
    const s = await this.prisma.share.findUnique({ where: { id: shareId } });
    if (!s?.passphraseHash) return false;
    return argon2.verify(s.passphraseHash, pass);
  }

  async touchInvitee(shareId: string, email: string) {
    await this.prisma.invitee.updateMany({
      where: { shareId, email },
      data: { opens: { increment: 1 }, lastSeen: new Date() },
    });
  }
}
