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
    let scrubbed = 0;
    for (const u of stale) {
      // PII-scrub instead of full row delete: a user's tellers/workspaces may
      // be shared with other members, so dropping ownerId-linked rows would
      // cascade well beyond what GDPR requires. The contract is to remove
      // identifiable data — id is kept as a tombstone so dangling references
      // (Workspace.ownerId, Membership.userId) remain valid.
      //
      // Cascades are at the application layer because PlanetScale is
      // `relationMode = "prisma"` (no FK constraints).
      await this.prisma.session.deleteMany({ where: { userId: u.id } });
      await this.prisma.cookieConsent.deleteMany({ where: { userId: u.id } });
      await this.prisma.tellerAsk.deleteMany({ where: { userId: u.id } });
      await this.prisma.copilotUsage.deleteMany({ where: { userId: u.id } });
      await this.prisma.askUsage.deleteMany({ where: { userId: u.id } });
      const tomb = `deleted-${u.id}@deleted.local`;
      await this.prisma.user.update({
        where: { id: u.id },
        data: {
          email: tomb,
          name: 'Deleted User',
          passwordHash: null,
          providerId: null,
          avatarUrl: null,
          stripeCustomerId: null,
          isSuspended: true,
        },
      });
      scrubbed++;
    }
    return { scrubbed, cutoff: cutoff.toISOString() };
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
