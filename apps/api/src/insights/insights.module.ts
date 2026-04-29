import { Module } from '@nestjs/common';
import { InsightsController } from './insights.controller';
import { InsightsService } from './insights.service';
import { AuthModule } from '../auth/auth.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [AuthModule, EventsModule],
  controllers: [InsightsController],
  providers: [InsightsService],
})
export class InsightsModule {}
