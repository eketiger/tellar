import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TellersService {
  constructor(private prisma: PrismaService) {}

  list(workspaceId: string) {
    return this.prisma.teller.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { slides: true, shares: true, recordings: true } } },
    });
  }

  async create(workspaceId: string, ownerId: string, title: string, theme?: string) {
    const t = await this.prisma.teller.create({
      data: { workspaceId, ownerId, title, theme: theme || 'editorial-cream' },
    });
    await this.prisma.slide.create({
      data: { tellerId: t.id, idx: 1, title: 'Untitled', eyebrow: 'slide 01' },
    });
    return t;
  }

  async getFull(id: string) {
    const t = await this.prisma.teller.findFirst({
      where: { id, deletedAt: null },
      include: {
        slides: { orderBy: { idx: 'asc' } },
        shares: { include: { invitees: true } },
        kbSources: true,
        recordings: true,
      },
    });
    if (!t) throw new NotFoundException('Teller not found');
    return t;
  }

  async update(id: string, patch: { title?: string; theme?: string }) {
    return this.prisma.teller.update({
      where: { id },
      data: { ...patch, revision: { increment: 1 } },
    });
  }

  softDelete(id: string) {
    return this.prisma.teller.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async addSlide(tellerId: string) {
    const count = await this.prisma.slide.count({ where: { tellerId } });
    const idx = count + 1;
    return this.prisma.slide.create({
      data: {
        tellerId,
        idx,
        eyebrow: `slide ${String(idx).padStart(2, '0')}`,
        title: 'Untitled',
      },
    });
  }
}
