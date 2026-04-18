import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Ensures the resource referenced in the route params (teller / share / slide / recording)
 * belongs to the active workspace of the caller. Relies on JwtGuard running first.
 */
@Injectable()
export class WorkspaceGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const user = req.user as { sub: string; ws: string };
    if (!user) throw new ForbiddenException('No session');
    const params = req.params || {};
    const url: string = req.originalUrl || req.url || '';

    if (params.workspaceId && params.workspaceId !== user.ws) {
      throw new ForbiddenException('Cross-tenant access denied');
    }
    if (params.tellerId || (params.id && /\/tellers\//.test(url))) {
      const id = params.tellerId || params.id;
      const t = await this.prisma.teller.findUnique({ where: { id } });
      if (!t || t.workspaceId !== user.ws) throw new ForbiddenException('Not yours');
    }
    if (params.shareId) {
      const sh = await this.prisma.share.findUnique({
        where: { id: params.shareId },
        include: { teller: true },
      });
      if (!sh || sh.teller.workspaceId !== user.ws) throw new ForbiddenException('Not yours');
    }
    if (params.slideId) {
      const s = await this.prisma.slide.findUnique({
        where: { id: params.slideId },
        include: { teller: true },
      });
      if (!s || s.teller.workspaceId !== user.ws) throw new ForbiddenException('Not yours');
    }
    return true;
  }
}
