import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { json } from 'express';
import { join } from 'node:path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false, // we wire JSON+raw manually so PUT /recordings/:id/blob stays untouched
  });
  app.use(cookieParser());
  // Raw body for:
  //   PUT /api/recordings/:id/blob   — we stream bytes into a file
  //   POST /api/billing/webhook      — Stripe needs the raw buffer for signature verification
  app.use((req: any, res: any, next: any) => {
    if (req.method === 'PUT' && /\/api\/recordings\/[^/]+\/blob$/.test(req.url)) return next();
    if (req.method === 'PUT' && /\/api\/slide-images\/[^/]+\/blob$/.test(req.url)) return next();
    if (req.method === 'POST' && req.url === '/api/billing/webhook') {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        req.rawBody = Buffer.concat(chunks);
        try { req.body = JSON.parse(req.rawBody.toString('utf8')); } catch { req.body = {}; }
        next();
      });
      req.on('error', next);
      return;
    }
    return json({ limit: '10mb' })(req, res, next);
  });
  // CORS allow-list. Hosts are deduped + lower-cased; entries can be
  // comma-separated to support a list of preview/staging hosts per env.
  const origins = Array.from(
    new Set(
      [
        ...(process.env.WEB_ORIGIN || 'http://localhost:3000').split(','),
        ...(process.env.BACKOFFICE_ORIGIN || 'http://localhost:3001').split(','),
        ...(process.env.VIEWER_ORIGIN || '').split(','),
      ]
        .map(s => s.trim())
        .filter(Boolean)
        .map(s => s.toLowerCase()),
    ),
  );
  // The viewer carries a per-share token in `x-share-token`. Without an
  // explicit allow-list entry, browsers strip the header on cross-origin
  // requests, which would silently 401 the gate-authorized fetch.
  app.enableCors({
    origin: origins,
    credentials: true,
    allowedHeaders: ['content-type', 'authorization', 'x-share-token'],
  });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.setGlobalPrefix('api');
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });
  const port = Number(process.env.PORT || 3333);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Tellar API listening on http://localhost:${port}/api`);
}
bootstrap();
