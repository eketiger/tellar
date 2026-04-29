import { BadRequestException, Body, Controller, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { WorkspaceGuard } from '../auth/workspace.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { AuthoringService } from './authoring.service';

interface ChatBody {
  message: string;
  history?: { role: 'user' | 'assistant'; content: string }[];
}

@Controller('tellers')
@UseGuards(JwtGuard, WorkspaceGuard)
export class AuthoringController {
  constructor(private svc: AuthoringService, private prisma: PrismaService) {}

  /** Conversational authoring turn. The model orchestrates one or more
   *  tool calls server-side and returns its final reply + the list of
   *  tool calls it actually applied (so the editor can refresh). */
  @Post(':id/authoring/chat')
  async chat(
    @Param('id') id: string,
    @CurrentUser() u: any,
    @Body() body: ChatBody,
  ) {
    if (!body || typeof body.message !== 'string' || !body.message.trim()) {
      throw new BadRequestException('message-required');
    }
    const teller = await this.prisma.teller.findUnique({ where: { id }, select: { id: true, workspaceId: true } });
    if (!teller) throw new NotFoundException();
    return this.svc.chatTurn({
      tellerId: id,
      workspaceId: u.ws,
      message: body.message,
      history: Array.isArray(body.history) ? body.history.slice(-12) : [],
    });
  }
}
