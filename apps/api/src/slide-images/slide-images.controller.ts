import {
  Body, Controller, Delete, Get, HttpException, HttpStatus, Param, Post, Put, Req, Res, UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';
import { JwtGuard } from '../auth/jwt.guard';
import { WorkspaceGuard } from '../auth/workspace.guard';
import { PrismaService } from '../prisma/prisma.service';

const UPLOAD_DIR = join(process.cwd(), 'uploads');
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ORIGIN = process.env.API_ORIGIN || `http://localhost:${process.env.PORT || 3333}`;

@Controller()
export class SlideImagesController {
  constructor(private prisma: PrismaService) {}

  // List every image attached to a teller (shown in the editor picker).
  @Get('tellers/:tellerId/images')
  @UseGuards(JwtGuard, WorkspaceGuard)
  async list(@Param('tellerId') tellerId: string) {
    const items = await this.prisma.slideImage.findMany({
      where: { tellerId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return items.map(i => ({ ...i, url: `${ORIGIN}/uploads/${i.s3Key}` }));
  }

  // Two-step upload: (1) reserve a row + get a signed URL; (2) PUT bytes.
  @Post('tellers/:tellerId/images/upload-url')
  @UseGuards(JwtGuard, WorkspaceGuard)
  async reserve(
    @Param('tellerId') tellerId: string,
    @Body() body: { name: string; mime?: string; bytes?: number },
  ) {
    if ((body?.bytes ?? 0) > MAX_BYTES) {
      throw new HttpException('Image too large (max 10 MB)', HttpStatus.PAYLOAD_TOO_LARGE);
    }
    const safeName = String(body?.name || 'image').replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `${tellerId}/images/${Date.now()}-${safeName}`;
    const image = await this.prisma.slideImage.create({
      data: { tellerId, name: safeName, s3Key: key, mime: body?.mime || null, bytes: body?.bytes || null },
    });
    return {
      id: image.id,
      uploadUrl: `${ORIGIN}/api/slide-images/${image.id}/blob`,
      method: 'PUT',
      headers: { 'content-type': body?.mime || 'image/jpeg' },
      url: `${ORIGIN}/uploads/${key}`,
    };
  }

  // Raw blob receiver — in prod this is a presigned S3 PUT.
  @Put('slide-images/:id/blob')
  async putBlob(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    const image = await this.prisma.slideImage.findUnique({ where: { id } });
    if (!image) return res.status(404).end();
    const abs = join(UPLOAD_DIR, image.s3Key);
    await fs.mkdir(dirname(abs), { recursive: true });
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', async () => {
      const buf = Buffer.concat(chunks);
      if (buf.length > MAX_BYTES) { res.status(413).end(); return; }
      await fs.writeFile(abs, buf);
      await this.prisma.slideImage.update({ where: { id }, data: { bytes: buf.length } });
      res.status(204).end();
    });
    req.on('error', () => res.status(500).end());
  }

  @Delete('slide-images/:id')
  @UseGuards(JwtGuard)
  async remove(@Param('id') id: string) {
    const image = await this.prisma.slideImage.findUnique({ where: { id } });
    if (!image) return { ok: true };
    await this.prisma.slideImage.delete({ where: { id } });
    try { await fs.unlink(join(UPLOAD_DIR, image.s3Key)); } catch { /* already gone */ }
    return { ok: true };
  }
}
