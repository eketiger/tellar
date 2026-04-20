import { BadRequestException, Body, Controller, Post, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Controller('superadmin')
export class SuperAdminController {
  constructor(private jwt: JwtService) {}

  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    const email = String(body?.email || '').trim().toLowerCase();
    const pass = String(body?.password || '');
    if (!email || !pass) throw new BadRequestException('missing-credentials');

    const expectedEmail = String(process.env.SUPERADMIN_EMAIL || '').trim().toLowerCase();
    const expectedPass = String(process.env.SUPERADMIN_PASSWORD || '');

    if (!expectedEmail || !expectedPass) {
      throw new UnauthorizedException('backoffice-not-configured');
    }
    if (email !== expectedEmail || pass !== expectedPass) {
      throw new UnauthorizedException('invalid-credentials');
    }
    const token = await this.jwt.signAsync({ sa: true, email });
    return { token, email, ttlSeconds: 8 * 3600 };
  }
}
