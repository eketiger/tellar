import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtGuard } from './jwt.guard';
import { WorkspaceGuard } from './workspace.guard';
import { AdminGuard } from './admin.guard';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  providers: [AuthService, JwtGuard, WorkspaceGuard, AdminGuard],
  controllers: [AuthController],
  exports: [AuthService, JwtGuard, WorkspaceGuard, AdminGuard, JwtModule],
})
export class AuthModule {}
