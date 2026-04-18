import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WorkspacesService {
  constructor(private prisma: PrismaService) {}

  async listForUser(userId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      include: { workspace: true },
    });
    const owned = await this.prisma.workspace.findMany({ where: { ownerId: userId } });
    const seen = new Set<string>();
    const all = [...memberships.map(m => m.workspace), ...owned].filter(w => {
      if (!w || seen.has(w.id)) return false;
      seen.add(w.id);
      return true;
    });
    return all;
  }

  async create(userId: string, name: string) {
    const slug =
      name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) +
      '-' +
      Math.random().toString(36).slice(2, 6);
    return this.prisma.workspace.create({
      data: {
        ownerId: userId,
        name,
        slug,
        members: { create: { email: (await this.prisma.user.findUnique({ where: { id: userId } }))!.email, userId, role: 'OWNER', status: 'active' } },
      },
    });
  }

  async rename(id: string, name: string) {
    return this.prisma.workspace.update({ where: { id }, data: { name } });
  }

  async members(workspaceId: string) {
    return this.prisma.membership.findMany({ where: { workspaceId }, orderBy: { joinedAt: 'asc' } });
  }

  async invite(workspaceId: string, email: string, role: any) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    return this.prisma.membership.upsert({
      where: { workspaceId_email: { workspaceId, email } },
      update: { role },
      create: { workspaceId, email, role, userId: user?.id, status: user ? 'active' : 'pending' },
    });
  }

  async removeMembership(id: string) {
    return this.prisma.membership.delete({ where: { id } });
  }

  async getUsage(workspaceId: string) {
    const u = await this.prisma.usage.findUnique({ where: { workspaceId } });
    if (!u) throw new NotFoundException();
    return {
      ...u,
      agentQueriesLimit: 1000,
      recordingMinutesLimit: 300,
      storageMBLimit: 5000,
      seatsLimit: 5,
    };
  }
}
