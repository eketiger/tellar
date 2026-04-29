import { Module } from '@nestjs/common';
import { AuthoringController } from './authoring.controller';
import { AuthoringService } from './authoring.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [AuthoringController],
  providers: [AuthoringService],
})
export class AuthoringModule {}
