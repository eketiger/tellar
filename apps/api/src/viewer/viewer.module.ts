import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ViewerController } from './viewer.controller';
import { SharesModule } from '../shares/shares.module';

@Module({
  imports: [
    SharesModule,
    JwtModule.register({
      secret: process.env.SHARE_TOKEN_SECRET || process.env.JWT_SECRET || 'dev-secret',
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [ViewerController],
})
export class ViewerModule {}
