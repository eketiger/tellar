import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SlideImagesController } from './slide-images.controller';

@Module({
  imports: [AuthModule],
  controllers: [SlideImagesController],
})
export class SlideImagesModule {}
