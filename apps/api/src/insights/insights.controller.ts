import { Controller, Get, NotFoundException, Param, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { WorkspaceGuard } from '../auth/workspace.guard';
import { PrismaService } from '../prisma/prisma.service';
import { InsightsService } from './insights.service';

@Controller('tellers')
@UseGuards(JwtGuard, WorkspaceGuard)
export class InsightsController {
  constructor(private svc: InsightsService, private prisma: PrismaService) {}

  /** Tellar-scoped insights. Same auth shape as the dashboard endpoint
   *  so the existing JwtGuard + WorkspaceGuard pair gates it. */
  @Get(':id/insights')
  async forTeller(@Param('id') id: string) {
    const t = await this.prisma.teller.findUnique({ where: { id }, select: { id: true } });
    if (!t) throw new NotFoundException();
    return this.svc.forTeller(id);
  }
}
