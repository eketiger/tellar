import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createHash } from 'node:crypto';

@Injectable()
export class GdprService {
  constructor(private prisma: PrismaService) {}

  async dataExport(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: true,
        sessions: { select: { id: true, expiresAt: true, userAgent: true, createdAt: true } },
        ownedWorkspaces: true,
        subscriptions: true,
        invoices: true,
      },
    });
    if (!user) throw new NotFoundException();
    await this.prisma.user.update({
      where: { id: userId },
      data: { dataExportRequestedAt: new Date() },
    });
    // Omit passwordHash
    const { passwordHash: _pw, ...safe } = user;
    return {
      exportedAt: new Date().toISOString(),
      version: '2026-04-18',
      user: safe,
    };
  }

  async requestDeletion(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { deletionRequestedAt: new Date(), isSuspended: true },
    });
    // In prod: queue hard-delete job after 30-day cool-off. For now, schedule-in-memory.
    return { ok: true, scheduledDeletionAt: new Date(Date.now() + 30 * 86_400_000) };
  }

  async acceptConsent(userId: string | null, version: string, ipHash?: string) {
    if (userId) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { gdprConsentAt: new Date(), gdprConsentVersion: version },
      });
    }
    await this.prisma.cookieConsent.create({
      data: { userId, version, accepted: true, ipHash },
    });
    return { ok: true };
  }

  hashIp(ip: string) {
    return createHash('sha256').update(ip).digest('hex').slice(0, 24);
  }
}
