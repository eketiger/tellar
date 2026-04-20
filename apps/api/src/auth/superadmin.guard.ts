import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

/**
 * Accepts a Bearer token signed with SUPERADMIN_SECRET and carrying `sa: true`.
 * This is the ONLY guard on /api/admin/* routes that lets in someone who is
 * not a workspace user — the backoffice app uses it.
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private jwt: JwtService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const auth = req.headers?.authorization as string | undefined;
    if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException('no-bearer');
    const token = auth.slice(7);
    try {
      const payload = await this.jwt.verifyAsync(token, {
        secret: process.env.SUPERADMIN_SECRET || 'dev-superadmin-secret',
      });
      if (!payload || (payload as any).sa !== true) throw new UnauthorizedException('not-sa');
      (req as any).superAdmin = payload;
      return true;
    } catch {
      throw new UnauthorizedException('invalid-sa-token');
    }
  }
}
