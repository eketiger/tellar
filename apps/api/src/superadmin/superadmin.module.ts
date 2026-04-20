import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SuperAdminController } from './superadmin.controller';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.SUPERADMIN_SECRET || 'dev-superadmin-secret',
      signOptions: { expiresIn: '8h' },
    }),
  ],
  controllers: [SuperAdminController],
})
export class SuperAdminModule {}
