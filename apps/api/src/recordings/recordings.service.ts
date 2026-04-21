import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const LOCAL_BUCKET = process.env.S3_BUCKET || 'local-uploads';
const API_ORIGIN = process.env.API_ORIGIN || `http://localhost:${process.env.PORT || 3333}`;

/**
 * In production: presigned S3 PUT + GET URLs.
 * Locally: we return a POST-to-/api/recordings/blob endpoint that accepts raw bytes.
 */
@Injectable()
export class RecordingsService {
  constructor(private prisma: PrismaService) {}

  async uploadUrl({ tellerId, slideId, mode, contentType }: any) {
    const rec = await this.prisma.recording.create({
      data: {
        tellerId,
        slideId: slideId || null,
        mode,
        durationMs: 0,
        sizeBytes: 0,
        s3Key: `${tellerId}/${slideId || 'teller'}/${Date.now()}.webm`,
        status: 'uploading',
      },
    });
    const uploadUrl = `${API_ORIGIN}/api/recordings/${rec.id}/blob`;
    return { id: rec.id, uploadUrl, method: 'PUT', headers: { 'content-type': contentType || 'video/webm' } };
  }

  async confirm(id: string, meta: { durationMs?: number; sizeBytes?: number }) {
    const rec = await this.prisma.recording.update({
      where: { id },
      data: {
        durationMs: meta.durationMs || 0,
        sizeBytes: meta.sizeBytes || 0,
        status: 'ready', // in prod: queue transcode + whisper and set to 'processing'
      },
    });
    return rec;
  }

  async list(tellerId: string) {
    return this.prisma.recording.findMany({
      where: { tellerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async stream(id: string) {
    const r = await this.prisma.recording.findUnique({ where: { id } });
    if (!r) throw new NotFoundException();
    // For a child of a whole-deck take, stream the parent file and pass the
    // child's offsets back so the viewer seeks + stops at the right marks.
    if (r.parentRecordingId) {
      const parent = await this.prisma.recording.findUnique({ where: { id: r.parentRecordingId } });
      if (!parent) throw new NotFoundException('Parent recording missing');
      return {
        url: `${API_ORIGIN}/uploads/${parent.s3Key}`,
        startOffsetMs: r.startOffsetMs,
        endOffsetMs: r.endOffsetMs,
      };
    }
    return { url: `${API_ORIGIN}/uploads/${r.s3Key}`, startOffsetMs: 0, endOffsetMs: null };
  }

  async remove(id: string) {
    // Deleting a parent also deletes its children (analytics + player rely on
    // the parent file). Deleting a child only removes that per-slide segment.
    const r = await this.prisma.recording.findUnique({ where: { id } });
    if (!r) throw new NotFoundException();
    if (!r.parentRecordingId) {
      await this.prisma.recording.deleteMany({ where: { parentRecordingId: id } });
    }
    await this.prisma.recording.delete({ where: { id } });
    return { ok: true };
  }

  /**
   * Split a freshly-uploaded whole-deck take into one child row per slide.
   * The caller sends the slide-advance timestamps captured while recording.
   * We replace any existing per-slide recordings on those slides so the
   * viewer plays the new narration.
   */
  async split(
    parentId: string,
    splits: Array<{ slideId: string; startMs: number; endMs: number }>,
  ) {
    const parent = await this.prisma.recording.findUnique({ where: { id: parentId } });
    if (!parent) throw new NotFoundException();
    // Remove any previous child rows so re-splitting works cleanly.
    await this.prisma.recording.deleteMany({ where: { parentRecordingId: parentId } });
    // Wipe per-slide recordings for the slides this take covers, so the
    // new narration takes precedence.
    const slideIds = splits.map(s => s.slideId).filter(Boolean);
    if (slideIds.length > 0) {
      await this.prisma.recording.deleteMany({
        where: {
          tellerId: parent.tellerId,
          slideId: { in: slideIds },
          parentRecordingId: null,
          id: { not: parentId },
        },
      });
    }
    const created: Awaited<ReturnType<PrismaService['recording']['create']>>[] = [];
    for (const s of splits) {
      if (s.endMs <= s.startMs) continue;
      const child = await this.prisma.recording.create({
        data: {
          tellerId: parent.tellerId,
          slideId: s.slideId,
          mode: parent.mode,
          durationMs: s.endMs - s.startMs,
          sizeBytes: 0,
          s3Key: parent.s3Key,
          status: 'ready',
          parentRecordingId: parent.id,
          startOffsetMs: s.startMs,
          endOffsetMs: s.endMs,
        },
      });
      created.push(child);
    }
    // Mark the parent as headless (no slide) so the clip list doesn't show it.
    await this.prisma.recording.update({
      where: { id: parentId },
      data: { slideId: null, status: 'ready' },
    });
    return { ok: true, count: created.length, children: created };
  }
}
