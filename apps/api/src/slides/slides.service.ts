import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SlidesService {
  constructor(private prisma: PrismaService) {}

  async update(id: string, patch: any) {
    const s = await this.prisma.slide.findUnique({ where: { id } });
    if (!s) throw new NotFoundException();
    const data: any = {};
    for (const k of ['eyebrow', 'title', 'subtitle', 'notes', 'layout', 'layoutId', 'background', 'idx'] as const) {
      if (patch[k] !== undefined) data[k] = patch[k];
    }
    const updated = await this.prisma.slide.update({ where: { id }, data });
    await this.prisma.teller.update({
      where: { id: s.tellerId },
      data: { revision: { increment: 1 } },
    });
    return updated;
  }

  async remove(id: string) {
    const s = await this.prisma.slide.findUnique({ where: { id } });
    if (!s) throw new NotFoundException();
    await this.prisma.slide.delete({ where: { id } });
    // reindex
    const rest = await this.prisma.slide.findMany({
      where: { tellerId: s.tellerId },
      orderBy: { idx: 'asc' },
    });
    for (let i = 0; i < rest.length; i++) {
      if (rest[i].idx !== i + 1) {
        await this.prisma.slide.update({ where: { id: rest[i].id }, data: { idx: i + 1 } });
      }
    }
    return { ok: true };
  }

  async duplicate(id: string) {
    const s = await this.prisma.slide.findUnique({ where: { id } });
    if (!s) throw new NotFoundException();
    const newIdx = s.idx + 1;
    // Shift everything at or past newIdx by +1. Walk in descending idx so we
    // never transiently collide with the @@unique([tellerId, idx]) index.
    const later = await this.prisma.slide.findMany({
      where: { tellerId: s.tellerId, idx: { gte: newIdx } },
      orderBy: { idx: 'desc' },
      select: { id: true, idx: true },
    });
    for (const sl of later) {
      await this.prisma.slide.update({ where: { id: sl.id }, data: { idx: sl.idx + 1 } });
    }
    const copy = await this.prisma.slide.create({
      data: {
        tellerId: s.tellerId,
        idx: newIdx,
        layoutId: s.layoutId,
        layout: s.layout as any,
        background: s.background as any,
        eyebrow: s.eyebrow,
        title: s.title,
        subtitle: s.subtitle,
        notes: s.notes,
      },
    });
    await this.prisma.teller.update({
      where: { id: s.tellerId },
      data: { revision: { increment: 1 } },
    });
    return copy;
  }

  async reorder(tellerId: string, ids: string[]) {
    // Two-pass rewrite with a large offset so we never collide with the
    // unique(tellerId, idx) index.
    const existing = await this.prisma.slide.findMany({
      where: { tellerId },
      select: { id: true },
    });
    const known = new Set(existing.map(s => s.id));
    if (ids.length !== existing.length || ids.some(id => !known.has(id))) {
      throw new NotFoundException('Reorder payload does not match this teller');
    }
    const OFFSET = 10_000;
    for (let i = 0; i < ids.length; i++) {
      await this.prisma.slide.update({ where: { id: ids[i] }, data: { idx: OFFSET + i + 1 } });
    }
    for (let i = 0; i < ids.length; i++) {
      await this.prisma.slide.update({ where: { id: ids[i] }, data: { idx: i + 1 } });
    }
    await this.prisma.teller.update({
      where: { id: tellerId },
      data: { revision: { increment: 1 } },
    });
    return { ok: true };
  }
}
