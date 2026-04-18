import { Body, Controller, Get, Param, Post, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { JwtGuard } from './jwt.guard';
import { CurrentUser } from './current-user.decorator';
import { LoginDto, RegisterDto } from '@tellar/api-types';
import { ZodValidate } from '../common/zod.pipe';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('register')
  async register(@Body(new ZodValidate(RegisterDto)) dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const r = await this.auth.register(dto);
    this.setCookie(res, r.token);
    return r;
  }

  @Post('login')
  async login(@Body(new ZodValidate(LoginDto)) dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const r = await this.auth.login(dto);
    this.setCookie(res, r.token);
    return r;
  }

  @Get('oauth/:provider')
  async oauth(@Param('provider') provider: 'google' | 'github', @Res({ passthrough: true }) res: Response) {
    const r = await this.auth.oauthMock(provider);
    this.setCookie(res, r.token);
    return r;
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('tellar_jwt');
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtGuard)
  me(@CurrentUser() u: { sub: string; ws: string }) {
    return this.auth.me(u.sub, u.ws);
  }

  private setCookie(res: Response, token: string) {
    res.cookie('tellar_jwt', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 3600 * 1000,
      path: '/',
    });
  }
}
