import { Module } from '@nestjs/common';
import { TellersController } from './tellers.controller';
import { TellersService } from './tellers.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [TellersController],
  providers: [TellersService],
  exports: [TellersService],
})
export class TellersModule {}
