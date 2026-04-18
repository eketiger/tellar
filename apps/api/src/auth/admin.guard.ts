import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const user = req.user as { sub: string };
    if (!user) throw new ForbiddenException('No session');
    const u = await this.prisma.user.findUnique({ where: { id: user.sub } });
    if (!u || u.role !== 'ADMIN') throw new ForbiddenException('Admin only');
    if (u.isSuspended) throw new ForbiddenException('Account suspended');
    return true;
  }
}
