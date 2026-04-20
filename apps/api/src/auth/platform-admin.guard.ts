import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Allows EITHER:
 *   a) A main-app user with `role === 'ADMIN'` (existing cookie JWT, signed with JWT_SECRET)
 *   b) A superadmin Bearer token (signed with SUPERADMIN_SECRET, `sa: true`)
 *
 * Used on /api/admin/* so the main web /admin backoffice keeps working AND the
 * separate apps/backoffice app can reach the same endpoints.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private jwt: JwtService, private prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();

    // Path A — superadmin Bearer
    const auth = req.headers?.authorization as string | undefined;
    if (auth?.startsWith('Bearer ')) {
      const token = auth.slice(7);
      try {
        const payload = await this.jwt.verifyAsync(token, {
          secret: process.env.SUPERADMIN_SECRET || 'dev-superadmin-secret',
        });
        if ((payload as any)?.sa === true) {
          (req as any).superAdmin = payload;
          return true;
        }
      } catch { /* fall through */ }
    }

    // Path B — cookie JWT + role=ADMIN in DB
    const cookie = req.cookies?.tellar_jwt;
    if (!cookie) throw new UnauthorizedException('no-auth');
    try {
      const payload = await this.jwt.verifyAsync(cookie, {
        secret: process.env.JWT_SECRET || 'dev-secret',
      });
      const user = await this.prisma.user.findUnique({ where: { id: (payload as any).sub } });
      if (!user || user.role !== 'ADMIN' || user.isSuspended) throw new UnauthorizedException('not-admin');
      (req as any).user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('invalid-auth');
    }
  }
}
