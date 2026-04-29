import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createHash } from 'node:crypto';

const DELETION_GRACE_DAYS = 30;

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
    return { ok: true, scheduledDeletionAt: new Date(Date.now() + DELETION_GRACE_DAYS * 86_400_000) };
  }

  /**
   * Sweeper for the 30-day delete cool-off window. Idempotent: runs every
   * call, hard-deletes users whose request is older than the grace period.
   *
   * Hooked from:
   *   - The platform-admin endpoint `POST /api/admin/gdpr/sweep` (manual).
   *   - The CDK monitoring stack — an EventBridge daily rule that calls
   *     the same endpoint with a service token. See AUDIT.md.
   */
  async sweepDeletions(now: Date = new Date()) {
    const cutoff = new Date(now.getTime() - DELETION_GRACE_DAYS * 86_400_000);
    const stale = await this.prisma.user.findMany({
      where: { deletionRequestedAt: { not: null, lte: cutoff } },
      select: { id: true },
    });
    let deleted = 0;
    for (const u of stale) {
      // Cascading deletes are encoded at the application layer because we
      // run PlanetScale in `relationMode = "prisma"` (no FK constraints).
      // Order matters: drop dependent rows before the user row itself.
      await this.prisma.cookieConsent.deleteMany({ where: { userId: u.id } });
      await this.prisma.event.deleteMany({ where: { userId: u.id } });
      await this.prisma.tellerAsk.deleteMany({ where: { userId: u.id } });
      await this.prisma.copilotUsage.deleteMany({ where: { userId: u.id } });
      await this.prisma.askUsage.deleteMany({ where: { userId: u.id } });
      await this.prisma.session.deleteMany({ where: { userId: u.id } });
      await this.prisma.membership.deleteMany({ where: { userId: u.id } });
      await this.prisma.user.delete({ where: { id: u.id } });
      deleted++;
    }
    return { deleted, cutoff: cutoff.toISOString() };
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
