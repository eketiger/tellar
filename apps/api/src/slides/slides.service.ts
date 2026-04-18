import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SlidesService {
  constructor(private prisma: PrismaService) {}

  async update(id: string, patch: any) {
    const s = await this.prisma.slide.findUnique({ where: { id } });
    if (!s) throw new NotFoundException();
    const data: any = {};
    for (const k of ['eyebrow', 'title', 'subtitle', 'notes', 'layout', 'idx'] as const) {
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
}
