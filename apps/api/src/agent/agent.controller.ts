import { Body, Controller, Post } from '@nestjs/common';
import { AgentService } from './agent.service';
import { ZodValidate } from '../common/zod.pipe';
import { AgentAskDto } from '@tellar/api-types';

@Controller('agent')
export class AgentController {
  constructor(private svc: AgentService) {}

  // Public — gated by share token in prod. For now, open so the viewer + editor can share the same endpoint.
  @Post('ask')
  ask(@Body(new ZodValidate(AgentAskDto)) dto: any) {
    return this.svc.ask(dto);
  }

  @Post('copilot')
  copilot(@Body() body: { kind: 'rewrite' | 'tighten' | 'narration' | 'structure'; slideId: string }) {
    return this.svc.copilot(body.kind, body.slideId);
  }
}
