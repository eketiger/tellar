import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
// Node 20+ has global `fetch`; add the declaration just in case.
declare const fetch: any;
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from '@tellar/api-types';
import { Role } from '@prisma/client';

export interface JwtPayload {
  sub: string; // userId
  email: string;
  ws: string; // active workspace id
  role: Role;
}

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new BadRequestException('Email already registered');
    const passwordHash = await argon2.hash(dto.password);
    const user = await this.prisma.user.create({
      data: { email: dto.email, name: dto.name, passwordHash, provider: 'EMAIL' },
    });
    const slug = dto.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + user.id.slice(-4);
    const workspace = await this.prisma.workspace.create({
      data: {
        ownerId: user.id,
        name: `${dto.name}'s workspace`,
        slug,
        plan: 'FREE',
        members: { create: { email: dto.email, userId: user.id, role: 'OWNER', status: 'active' } },
      },
    });
    const token = await this.signFor(user.id, workspace.id);
    return { user: this.publicUser(user), workspace, token };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.passwordHash) throw new UnauthorizedException('Invalid credentials');
    const ok = await argon2.verify(user.passwordHash, dto.password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    const membership = await this.prisma.membership.findFirst({
      where: { userId: user.id },
      orderBy: { joinedAt: 'asc' },
    });
    const ownedWs = await this.prisma.workspace.findFirst({ where: { ownerId: user.id } });
    const wsId = membership?.workspaceId || ownedWs?.id;
    if (!wsId) throw new UnauthorizedException('No workspace found');
    const token = await this.signFor(user.id, wsId);
    const workspace = await this.prisma.workspace.findUnique({ where: { id: wsId } });
    return { user: this.publicUser(user), workspace, token };
  }

  /** Real OAuth with Google/GitHub when env vars are set, else a dev-only mock. */
  async oauthExchange(provider: 'google' | 'github', code?: string, redirectUri?: string) {
    if (!code || !this.hasOauthEnv(provider)) return this.oauthMock(provider);
    const profile =
      provider === 'google'
        ? await this.googleProfile(code, redirectUri)
        : await this.githubProfile(code, redirectUri);
    return this.loginOrRegisterFromProfile(provider, profile);
  }

  private async oauthMock(provider: 'google' | 'github') {
    const email = `${provider}@tellar.studio`;
    const name = provider === 'google' ? 'Google User' : 'GitHub User';
    return this.loginOrRegisterFromProfile(provider, { email, name, providerId: provider + '-mock' });
  }

  private async loginOrRegisterFromProfile(
    provider: 'google' | 'github',
    profile: { email: string; name: string; providerId: string; avatarUrl?: string },
  ) {
    let user = await this.prisma.user.findUnique({ where: { email: profile.email } });
    if (user && user.provider !== provider.toUpperCase()) {
      throw new BadRequestException(
        `An account with this email already exists. Please log in with ${user.provider.toLowerCase()}.`,
      );
    }
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: profile.email,
          name: profile.name,
          avatarUrl: profile.avatarUrl,
          provider: provider.toUpperCase() as any,
          providerId: profile.providerId,
          gdprConsentAt: new Date(),
          gdprConsentVersion: '2026-04-18',
        },
      });
      await this.prisma.workspace.create({
        data: {
          ownerId: user.id,
          name: `${profile.name}'s workspace`,
          slug: provider + '-' + user.id.slice(-6),
          members: { create: { email: profile.email, userId: user.id, role: 'OWNER', status: 'active' } },
        },
      });
    }
    const ws = await this.prisma.workspace.findFirst({ where: { ownerId: user.id } });
    const token = await this.signFor(user.id, ws!.id);
    return { user: this.publicUser(user), workspace: ws, token };
  }

  private hasOauthEnv(provider: 'google' | 'github') {
    if (provider === 'google') return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
    return !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
  }

  private async googleProfile(code: string, redirectUri?: string) {
    const tokRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri || process.env.GOOGLE_REDIRECT_URI || '',
        grant_type: 'authorization_code',
      }),
    });
    const tok = (await tokRes.json()) as { access_token?: string; id_token?: string };
    if (!tok.access_token) throw new UnauthorizedException('Google token exchange failed');
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { authorization: `Bearer ${tok.access_token}` },
    });
    const p = (await profileRes.json()) as { sub: string; email: string; name: string; picture?: string };
    if (!p.email) throw new UnauthorizedException('No email from Google');
    return { email: p.email, name: p.name || p.email, providerId: p.sub, avatarUrl: p.picture };
  }

  private async githubProfile(code: string, redirectUri?: string) {
    const tokRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        code,
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        redirect_uri: redirectUri,
      }),
    });
    const tok = (await tokRes.json()) as { access_token?: string };
    if (!tok.access_token) throw new UnauthorizedException('GitHub token exchange failed');
    const h = { authorization: `Bearer ${tok.access_token}`, accept: 'application/vnd.github+json' };
    const userRes = await fetch('https://api.github.com/user', { headers: h });
    const u = (await userRes.json()) as { id: number; login: string; name?: string; email?: string; avatar_url?: string };
    let email = u.email;
    if (!email) {
      const emailRes = await fetch('https://api.github.com/user/emails', { headers: h });
      const emails = (await emailRes.json()) as Array<{ email: string; primary: boolean; verified: boolean }>;
      email = emails.find(e => e.primary && e.verified)?.email || emails.find(e => e.verified)?.email;
    }
    if (!email) throw new UnauthorizedException('No verified email from GitHub');
    return { email, name: u.name || u.login, providerId: String(u.id), avatarUrl: u.avatar_url };
  }

  async signFor(userId: string, workspaceId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const membership = await this.prisma.membership.findFirst({
      where: { workspaceId, userId },
    });
    const payload: JwtPayload = {
      sub: userId,
      email: user!.email,
      ws: workspaceId,
      role: membership?.role || 'OWNER',
    };
    return this.jwt.signAsync(payload);
  }

  async me(userId: string, workspaceId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const workspace = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!user || !workspace) throw new UnauthorizedException();
    await this.prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } }).catch(() => {});
    return {
      user: this.publicUser(user),
      workspace,
      session: {
        userId,
        workspaceId,
        email: user.email,
        name: user.name,
        role: user.role,
        isAdmin: user.role === 'ADMIN',
        initials: user.name.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase(),
      },
    };
  }

  private publicUser(u: any) {
    return { id: u.id, email: u.email, name: u.name, createdAt: u.createdAt, provider: u.provider, role: u.role, avatarUrl: u.avatarUrl };
  }
}
