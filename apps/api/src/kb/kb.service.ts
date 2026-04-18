import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class KbService {
  constructor(private prisma: PrismaService) {}

  list(tellerId: string) {
    return this.prisma.kBSource.findMany({ where: { tellerId }, orderBy: { createdAt: 'desc' } });
  }

  async addFile(tellerId: string, meta: { name: string; kind: string; bytes: number }) {
    const src = await this.prisma.kBSource.create({
      data: {
        tellerId,
        name: meta.name,
        kind: meta.kind,
        bytes: meta.bytes,
        s3Key: `${tellerId}/${Date.now()}-${meta.name}`,
        indexed: false,
      },
    });
    // Fire-and-forget indexing stub — in prod this goes to a BullMQ queue
    setTimeout(async () => {
      await this.prisma.kBSource.update({ where: { id: src.id }, data: { indexed: true } });
    }, 1400);
    return src;
  }

  async addUrl(tellerId: string, url: string) {
    const src = await this.prisma.kBSource.create({
      data: {
        tellerId,
        name: url.replace(/^https?:\/\//, ''),
        kind: 'url',
        s3Key: url,
        indexed: false,
      },
    });
    setTimeout(async () => {
      await this.prisma.kBSource.update({ where: { id: src.id }, data: { indexed: true } });
    }, 1600);
    return src;
  }

  remove(id: string) {
    return this.prisma.kBSource.delete({ where: { id } });
  }

  async chunksForTeller(tellerId: string, limit = 50) {
    return this.prisma.kBChunk.findMany({
      where: { source: { tellerId } },
      take: limit,
      include: { source: true },
    });
  }
}
