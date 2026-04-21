import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TellersService {
  constructor(private prisma: PrismaService) {}

  async list(workspaceId: string, opts: { take?: number; skip?: number } = {}) {
    const take = Math.min(Math.max(opts.take ?? 50, 1), 200);
    const skip = Math.max(opts.skip ?? 0, 0);
    const [items, total] = await Promise.all([
      this.prisma.teller.findMany({
        where: { workspaceId, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
        take,
        skip,
        select: {
          id: true, title: true, theme: true, revision: true,
          createdAt: true, updatedAt: true,
          _count: { select: { slides: true, shares: true, recordings: true } },
        },
      }),
      this.prisma.teller.count({ where: { workspaceId, deletedAt: null } }),
    ]);
    return { items, total, take, skip };
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

  /**
   * Clone a pre-designed deck into a fresh teller. The client sends the full
   * slide list from the templates registry in apps/web/lib/templates.ts; we
   * trust it the same way we trust POST /slides (the user could already
   * hand-craft these via the editor). Returns the new teller id so the
   * client can redirect into the editor.
   */
  async createFromTemplate(
    workspaceId: string,
    ownerId: string,
    input: {
      title: string;
      theme?: string;
      slides: Array<{
        layoutId: string;
        layout?: Record<string, any>;
        background?: Record<string, any>;
        title?: string;
        subtitle?: string | null;
        eyebrow?: string | null;
        notes?: string | null;
      }>;
    },
  ) {
    const t = await this.prisma.teller.create({
      data: { workspaceId, ownerId, title: input.title, theme: input.theme || 'editorial-cream' },
    });
    for (let i = 0; i < input.slides.length; i++) {
      const s = input.slides[i];
      await this.prisma.slide.create({
        data: {
          tellerId: t.id,
          idx: i + 1,
          layoutId: s.layoutId || 'headline',
          layout: (s.layout || {}) as any,
          background: (s.background || { kind: 'cream' }) as any,
          title: s.title ?? (s.layout?.title as string) ?? 'Untitled',
          subtitle: s.subtitle ?? ((s.layout?.subtitle as string) || null),
          eyebrow: s.eyebrow ?? ((s.layout?.eyebrow as string) || null),
          notes: s.notes ?? null,
        },
      });
    }
    return t;
  }
}
