import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { chunkText } from './chunker';
import { embedBatch, embedText } from './embeddings';
import { pineconeIndex } from './pinecone';

function hashBundle(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function stripHtml(s: string) {
  return (s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

/** Each teller gets its own Pinecone namespace so deletes are trivial. */
function nsFor(tellerId: string) {
  return tellerId;
}

@Injectable()
export class KnowledgeBaseService {
  private readonly log = new Logger(KnowledgeBaseService.name);
  constructor(public readonly prisma: PrismaService) {}

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

  async indexTeller(tellerId: string, opts: { force?: boolean } = {}) {
    const bundle = await this.tellerText(tellerId);
    if (!bundle) return { indexed: 0, skipped: true, reason: 'not-found' };

    // Skip the entire indexing pipeline (chunk → embed → upsert) when the
    // content hasn't changed since the last run. Embeddings are expensive
    // — for active editors this saves dozens of Voyage calls per minute.
    const contentHash = hashBundle(bundle.text);
    if (
      !opts.force &&
      bundle.teller.vectorContentHash === contentHash &&
      bundle.teller.vectorStatus &&
      bundle.teller.vectorStatus.startsWith('indexed')
    ) {
      return { indexed: 0, skipped: true, reason: 'unchanged' };
    }

    await this.prisma.teller.update({
      where: { id: tellerId },
      data: { vectorStatus: 'pending' },
    });
    const chunks = chunkText(bundle.text);
    if (!chunks.length) return { indexed: 0, skipped: true, reason: 'empty' };

    const idx = pineconeIndex();
    const embeddings = await embedBatch(chunks);

    if (idx && embeddings) {
      // Per-teller namespace → clean wipe with deleteAll, no metadata filter gymnastics.
      const ns = idx.namespace(nsFor(tellerId));
      try {
        await ns.deleteAll();
      } catch (e: any) {
        // First-time index: namespace doesn't exist yet. Safe to ignore.
        this.log.debug(`deleteAll skipped: ${e?.message}`);
      }
      try {
        await ns.upsert(
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
      } catch (e: any) {
        this.log.error(`Pinecone upsert failed: ${e?.message}`);
        await this.prisma.teller.update({
          where: { id: tellerId },
          data: { vectorStatus: 'error' },
        });
        return { indexed: 0, skipped: true, reason: 'upsert-failed' };
      }
    }
    await this.prisma.teller.update({
      where: { id: tellerId },
      data: {
        vectorStatus: idx ? 'indexed' : 'indexed-local',
        vectorizedAt: new Date(),
        vectorContentHash: contentHash,
      },
    });
    return { indexed: chunks.length, skipped: !idx };
  }

  async deleteTellerVectors(tellerId: string) {
    const idx = pineconeIndex();
    if (idx) {
      try {
        await idx.namespace(nsFor(tellerId)).deleteAll();
      } catch (e: any) {
        this.log.debug(`deleteAll skipped: ${e?.message}`);
      }
    }
    await this.prisma.teller.update({
      where: { id: tellerId },
      data: { vectorStatus: 'deleted' },
    });
  }

  async retrieve(tellerId: string, question: string, topK = 5) {
    const idx = pineconeIndex();
    const emb = await embedText(question).catch(() => null);
    if (idx && emb) {
      try {
        const r = await idx.namespace(nsFor(tellerId)).query({
          vector: emb,
          topK,
          includeMetadata: true,
        });
        return r.matches.map(m => ({
          text: String(m.metadata?.chunkText || ''),
          score: m.score || 0,
          slideIdx: null as number | null,
          label: `[rag] ${String(m.metadata?.chunkText || '').slice(0, 80)}…`,
          ref: `[cite:kb:teller-${tellerId}]`,
        }));
      } catch (e: any) {
        this.log.warn(`Pinecone query failed, falling back to keywords: ${e?.message}`);
      }
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
    if (idx) {
      try {
        const seed = await idx.namespace(nsFor(tellerId)).fetch([`${tellerId}_0`]);
        const vec = seed?.records?.[`${tellerId}_0`]?.values;
        if (vec) {
          // Cross-namespace similar-by-vector isn't free — query the default namespace
          // which should hold copies; production might fan out across namespaces.
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
          if (ids.length) {
            const tellers = await this.prisma.teller.findMany({
              where: { id: { in: ids } },
              select: { id: true, title: true, updatedAt: true },
            });
            return tellers.map(t => ({ ...t, score: uniq.get(t.id) || 0 }));
          }
        }
      } catch (e: any) {
        this.log.warn(`Pinecone similar query failed, falling back: ${e?.message}`);
      }
    }

    // Fallback: other tellers in the same workspace ordered by updatedAt.
    const t = await this.prisma.teller.findUnique({
      where: { id: tellerId },
      select: { workspaceId: true },
    });
    if (!t) return [];
    return this.prisma.teller.findMany({
      where: { workspaceId: t.workspaceId, id: { not: tellerId }, deletedAt: null, isPublished: true },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      select: { id: true, title: true, updatedAt: true },
    });
  }
}
