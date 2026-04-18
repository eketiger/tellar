import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
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

  async oauthMock(provider: 'google' | 'github') {
    const email = `${provider}@tellar.studio`;
    const name = provider === 'google' ? 'Google User' : 'GitHub User';
    let user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await this.prisma.user.create({
        data: { email, name, provider: provider.toUpperCase() as any },
      });
      await this.prisma.workspace.create({
        data: {
          ownerId: user.id,
          name: `${name}'s workspace`,
          slug: provider + '-ws-' + user.id.slice(-4),
          members: { create: { email, userId: user.id, role: 'OWNER', status: 'active' } },
        },
      });
    }
    const ws = await this.prisma.workspace.findFirst({ where: { ownerId: user.id } });
    const token = await this.signFor(user.id, ws!.id);
    return { user: this.publicUser(user), workspace: ws, token };
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
    return {
      user: this.publicUser(user),
      workspace,
      session: {
        userId,
        workspaceId,
        email: user.email,
        name: user.name,
        initials: user.name.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase(),
      },
    };
  }

  private publicUser(u: any) {
    return { id: u.id, email: u.email, name: u.name, createdAt: u.createdAt, provider: u.provider };
  }
}
