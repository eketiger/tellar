import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';
import { JwtGuard } from '../auth/jwt.guard';
import { WorkspaceGuard } from '../auth/workspace.guard';
import { RecordingsService } from './recordings.service';
import { PrismaService } from '../prisma/prisma.service';

const UPLOAD_DIR = join(process.cwd(), 'uploads');

@Controller()
export class RecordingsController {
  constructor(private svc: RecordingsService, private prisma: PrismaService) {}

  // Local blob receiver — in prod this URL is a presigned S3 PUT.
  @Put('recordings/:id/blob')
  async putBlob(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    const rec = await this.prisma.recording.findUnique({ where: { id } });
    if (!rec) return res.status(404).end();
    const abs = join(UPLOAD_DIR, rec.s3Key);
    await fs.mkdir(dirname(abs), { recursive: true });
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', async () => {
      const buf = Buffer.concat(chunks);
      await fs.writeFile(abs, buf);
      await this.prisma.recording.update({
        where: { id },
        data: { sizeBytes: buf.length, status: 'processing' },
      });
      res.status(204).end();
    });
    req.on('error', () => res.status(500).end());
  }

  @Post('recordings/upload-url')
  @UseGuards(JwtGuard)
  upload(@Body() body: { tellerId: string; slideId?: string; mode: string; contentType?: string }) {
    return this.svc.uploadUrl(body);
  }

  @Post('recordings/:id/confirm')
  @UseGuards(JwtGuard)
  confirm(@Param('id') id: string, @Body() body: { durationMs?: number; sizeBytes?: number }) {
    return this.svc.confirm(id, body);
  }

  @Get('tellers/:tellerId/recordings')
  @UseGuards(JwtGuard, WorkspaceGuard)
  list(@Param('tellerId') tellerId: string) {
    return this.svc.list(tellerId);
  }

  @Get('recordings/:id/stream')
  stream(@Param('id') id: string) {
    return this.svc.stream(id);
  }

  @Delete('recordings/:id')
  @UseGuards(JwtGuard)
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }

  @Post('recordings/:id/split')
  @UseGuards(JwtGuard)
  split(
    @Param('id') id: string,
    @Body() body: { splits: Array<{ slideId: string; startMs: number; endMs: number }> },
  ) {
    return this.svc.split(id, body.splits || []);
  }
}
