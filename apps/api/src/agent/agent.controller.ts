import { Body, Controller, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { AgentService } from './agent.service';
import { KnowledgeBaseService } from './knowledge-base';
import { ZodValidate } from '../common/zod.pipe';
import { AgentAskDto } from '@tellar/api-types';
import { JwtGuard } from '../auth/jwt.guard';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller()
export class AgentController {
  constructor(private svc: AgentService, private kb: KnowledgeBaseService) {}

  // Open endpoint — the viewer can use it with just a shareId. Creators get optional JWT scope.
  @Post('agent/ask')
  ask(@Body(new ZodValidate(AgentAskDto)) dto: any, @Headers('authorization') auth?: string) {
    // Note: viewer token decoding happens in real prod here. For now we pass userId only when
    // the sender opts in by sending their JWT as a bearer.
    return this.svc.ask(dto);
  }

  // Creator-scoped endpoint with rate limiting by userId
  @Post('agent/copilot')
  @UseGuards(JwtGuard)
  copilot(
    @CurrentUser() u: any,
    @Body() body: {
      kind: 'rewrite' | 'tighten' | 'narration' | 'structure' | 'improve' | 'expand' | 'summarize' | 'fix_grammar' | 'change_tone';
      slideId?: string;
      selectedText?: string;
      context?: string;
      toneTarget?: string;
    },
  ) {
    return this.svc.copilot(body.kind, { ...body, userId: u.sub });
  }

  @Post('tellers/:tellerId/ask')
  @UseGuards(JwtGuard)
  authedAsk(
    @CurrentUser() u: any,
    @Param('tellerId') tellerId: string,
    @Body() body: { question: string; conversationHistory?: any[] },
  ) {
    return this.svc.ask({
      tellerId,
      question: body.question,
      history: body.conversationHistory || [],
      email: u.email,
      userId: u.sub,
    } as any);
  }

  @Get('tellers/:tellerId/similar')
  similar(@Param('tellerId') tellerId: string) {
    return this.kb.similarTellers(tellerId);
  }

  @Post('admin/reindex')
  @UseGuards(JwtGuard, AdminGuard)
  async reindex() {
    const tellers = await this.kb['prisma'].teller.findMany({
      where: { deletedAt: null, isPublished: true },
      select: { id: true },
      take: 50,
    });
    const errors: string[] = [];
    let processed = 0;
    for (const t of tellers) {
      try {
        await this.kb.indexTeller(t.id);
        processed++;
      } catch (e: any) {
        errors.push(`${t.id}: ${e.message}`);
      }
    }
    return { queued: tellers.length, processed, errors };
  }
}
