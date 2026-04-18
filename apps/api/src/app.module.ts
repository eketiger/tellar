import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { TellersModule } from './tellers/tellers.module';
import { SlidesModule } from './slides/slides.module';
import { SharesModule } from './shares/shares.module';
import { RecordingsModule } from './recordings/recordings.module';
import { KbModule } from './kb/kb.module';
import { AgentModule } from './agent/agent.module';
import { EventsModule } from './events/events.module';
import { RealtimeModule } from './realtime/realtime.module';
import { BillingModule } from './billing/billing.module';
import { ViewerModule } from './viewer/viewer.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    WorkspacesModule,
    TellersModule,
    SlidesModule,
    SharesModule,
    RecordingsModule,
    KbModule,
    EventsModule,
    AgentModule,
    RealtimeModule,
    BillingModule,
    ViewerModule,
  ],
})
export class AppModule {}
