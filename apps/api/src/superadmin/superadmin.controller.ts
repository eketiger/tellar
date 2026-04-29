import {
  BadRequestException,
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Ip,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { timingSafeEqual } from 'node:crypto';
import * as argon2 from 'argon2';
import { RateLimiter } from '../common/rate-limiter';

/**
 * Backoffice login. Credentials live in env vars (no DB row), so the
 * platform admin can rotate them via the deploy pipeline without any
 * write to PlanetScale.
 *
 * The expected password may be supplied as either:
 *   - `SUPERADMIN_PASSWORD_HASH` — an argon2id hash (preferred). Generate
 *     with `node -e "import('argon2').then(a=>a.hash(process.argv[1]).then(console.log))" '<plaintext>'`.
 *   - `SUPERADMIN_PASSWORD` — plaintext fallback for local dev only.
 *     Compared in constant time.
 */
@Controller('superadmin')
export class SuperAdminController {
  // Five attempts per minute per IP. Backoffice is a tiny audience so this
  // is conservative; legitimate ops users won't hit it.
  private readonly attempts = new RateLimiter(5, 5 / 60);

  constructor(private jwt: JwtService) {}

  @Post('login')
  async login(@Ip() ip: string, @Body() body: { email: string; password: string }) {
    if (!this.attempts.tryConsume(`sa:${ip || 'unknown'}`)) {
      throw new HttpException(
        { reason: 'rate-limited', retryAfterSec: 60 },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const email = String(body?.email || '').trim().toLowerCase();
    const pass = String(body?.password || '');
    if (!email || !pass) throw new BadRequestException('missing-credentials');

    const expectedEmail = String(process.env.SUPERADMIN_EMAIL || '').trim().toLowerCase();
    const expectedHash = String(process.env.SUPERADMIN_PASSWORD_HASH || '').trim();
    const expectedPass = String(process.env.SUPERADMIN_PASSWORD || '');

    if (!expectedEmail || (!expectedHash && !expectedPass)) {
      throw new UnauthorizedException('backoffice-not-configured');
    }

    const emailOk = constantTimeStringEqual(email, expectedEmail);
    const passOk = expectedHash
      ? await argon2.verify(expectedHash, pass).catch(() => false)
      : constantTimeStringEqual(pass, expectedPass);

    if (!emailOk || !passOk) {
      throw new UnauthorizedException('invalid-credentials');
    }
    const token = await this.jwt.signAsync({ sa: true, email });
    return { token, email, ttlSeconds: 8 * 3600 };
  }
}

/**
 * Length-padded constant-time string compare. Always touches the same
 * number of bytes regardless of input length, so an attacker can't infer
 * the secret length from response time.
 */
function constantTimeStringEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length, 32);
  const bufA = Buffer.alloc(len);
  const bufB = Buffer.alloc(len);
  bufA.write(a);
  bufB.write(b);
  return timingSafeEqual(bufA, bufB) && a.length === b.length;
}
