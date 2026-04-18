import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { EventsModule } from '../events/events.module';
import { AuthModule } from '../auth/auth.module';
import { KnowledgeBaseService } from './knowledge-base';

@Module({
  imports: [EventsModule, AuthModule],
  controllers: [AgentController],
  providers: [AgentService, KnowledgeBaseService],
  exports: [AgentService, KnowledgeBaseService],
})
export class AgentModule {}
