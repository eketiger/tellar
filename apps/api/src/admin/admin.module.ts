import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuthModule } from '../auth/auth.module';
import { PlatformAdminGuard } from '../auth/platform-admin.guard';

@Module({
  imports: [
    AuthModule,
    // Re-register JwtModule here so PlatformAdminGuard can verify tokens with
    // either secret (user JWT via cookie, or superadmin Bearer). Services call
    // verifyAsync with explicit `secret` overrides.
    JwtModule.register({ secret: process.env.JWT_SECRET || 'dev-secret' }),
  ],
  controllers: [AdminController],
  providers: [AdminService, PlatformAdminGuard],
})
export class AdminModule {}
