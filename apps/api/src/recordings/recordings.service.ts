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
    // In prod: sign CloudFront URL and 302. Here, we serve from local /uploads.
    return { url: `${API_ORIGIN}/uploads/${r.s3Key}` };
  }

  async remove(id: string) {
    await this.prisma.recording.delete({ where: { id } });
    return { ok: true };
  }
}
