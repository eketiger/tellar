import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { json } from 'express';
import { join } from 'node:path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false, // we wire JSON+raw manually so PUT /recordings/:id/blob stays untouched
  });
  app.use(cookieParser());
  // Raw body for PUT /api/recordings/:id/blob (do NOT parse)
  app.use((req: any, res: any, next: any) => {
    if (req.method === 'PUT' && /\/api\/recordings\/[^/]+\/blob$/.test(req.url)) return next();
    return json({ limit: '10mb' })(req, res, next);
  });
  app.enableCors({
    origin: (process.env.WEB_ORIGIN || 'http://localhost:3000').split(','),
    credentials: true,
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
