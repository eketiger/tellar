import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { chunkText } from './chunker';
import { embedBatch, embedText } from './embeddings';
import { pineconeIndex } from './pinecone';

function stripHtml(s: string) {
  return (s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

@Injectable()
export class KnowledgeBaseService {
  constructor(private prisma: PrismaService) {}

  async tellerText(tellerId: string) {
    const t = await this.prisma.teller.findUnique({
      where: { id: tellerId },
      include: { slides: { orderBy: { idx: 'asc' } }, kbSources: true, recordings: true },
    });
    if (!t) return null;
    const slideText = t.slides
      .map(s =>
        [stripHtml(s.title), stripHtml(s.subtitle || ''), stripHtml(s.notes || '')].filter(Boolean).join(' '),
      )
      .join('\n');
    const transcripts = t.recordings.map(r => r.transcript).filter(Boolean).join('\n');
    return { teller: t, text: [slideText, transcripts].filter(Boolean).join('\n') };
  }

  async indexTeller(tellerId: string) {
    await this.prisma.teller.update({
      where: { id: tellerId },
      data: { vectorStatus: 'pending' },
    });

    const bundle = await this.tellerText(tellerId);
    if (!bundle) return { indexed: 0, skipped: true, reason: 'not-found' };
    const chunks = chunkText(bundle.text);
    if (!chunks.length) return { indexed: 0, skipped: true, reason: 'empty' };

    const idx = pineconeIndex();
    const embeddings = await embedBatch(chunks);

    if (idx && embeddings) {
      // Clear previous vectors for this teller first.
      await idx.deleteMany({ tellerId } as any).catch(() => undefined);
      await idx.upsert(
        chunks.map((text, i) => ({
          id: `${tellerId}_${i}`,
          values: embeddings[i],
          metadata: {
            tellerId,
            chunkIndex: i,
            chunkText: text.slice(0, 1000),
            authorId: bundle.teller.ownerId,
            isPublished: bundle.teller.isPublished,
            createdAt: bundle.teller.createdAt.toISOString(),
            updatedAt: bundle.teller.updatedAt.toISOString(),
          },
        })),
      );
    }
    await this.prisma.teller.update({
      where: { id: tellerId },
      data: { vectorStatus: idx ? 'indexed' : 'indexed-local', vectorizedAt: new Date() },
    });
    return { indexed: chunks.length, skipped: !idx };
  }

  async deleteTellerVectors(tellerId: string) {
    const idx = pineconeIndex();
    if (idx) await idx.deleteMany({ tellerId } as any).catch(() => undefined);
    await this.prisma.teller.update({
      where: { id: tellerId },
      data: { vectorStatus: 'deleted' },
    });
  }

  async retrieve(tellerId: string, question: string, topK = 5) {
    const idx = pineconeIndex();
    const emb = await embedText(question);
    if (idx && emb) {
      const r = await idx.query({
        vector: emb,
        topK,
        filter: { tellerId } as any,
        includeMetadata: true,
      });
      return r.matches.map(m => ({
        text: String(m.metadata?.chunkText || ''),
        score: m.score || 0,
        slideIdx: null as number | null,
        label: `[rag] ${String(m.metadata?.chunkText || '').slice(0, 80)}…`,
        ref: `[cite:kb:teller-${tellerId}]`,
      }));
    }
    // Fallback: naive keyword scoring over slide+notes text
    const bundle = await this.tellerText(tellerId);
    if (!bundle) return [];
    const q = question.toLowerCase().split(/\W+/).filter(Boolean);
    const chunks = chunkText(bundle.text);
    return chunks
      .map((text, i) => {
        const tl = text.toLowerCase();
        const score = q.reduce((acc, w) => acc + (tl.includes(w) ? 1 : 0), 0);
        return { text, score, slideIdx: null, label: `[chunk ${i}]`, ref: `[cite:kb:teller-${tellerId}]` };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  async similarTellers(tellerId: string, limit = 5) {
    const idx = pineconeIndex();
    if (!idx) {
      // Simple fallback: other tellers in the same workspace ordered by updatedAt
      const t = await this.prisma.teller.findUnique({ where: { id: tellerId } });
      if (!t) return [];
      return this.prisma.teller.findMany({
        where: { workspaceId: t.workspaceId, id: { not: tellerId }, deletedAt: null, isPublished: true },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        select: { id: true, title: true, updatedAt: true },
      });
    }
    const seed = await idx.fetch([`${tellerId}_0`]).catch(() => null);
    const vec = seed?.records?.[`${tellerId}_0`]?.values;
    if (!vec) return [];
    const r = await idx.query({
      vector: vec,
      topK: limit + 5,
      filter: { isPublished: true } as any,
      includeMetadata: true,
    });
    const uniq = new Map<string, number>();
    for (const m of r.matches || []) {
      const id = String(m.metadata?.tellerId || '');
      if (!id || id === tellerId) continue;
      if (!uniq.has(id)) uniq.set(id, m.score || 0);
    }
    const ids = Array.from(uniq.keys()).slice(0, limit);
    const tellers = await this.prisma.teller.findMany({
      where: { id: { in: ids } },
      select: { id: true, title: true, updatedAt: true },
    });
    return tellers.map(t => ({ ...t, score: uniq.get(t.id) || 0 }));
  }
}
