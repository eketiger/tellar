import { JwtService } from '@nestjs/jwt';
import { HttpException, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { SuperAdminController } from './superadmin.controller';

const jwt = { signAsync: jest.fn(async () => 'tok') } as unknown as JwtService;

describe('SuperAdminController.login', () => {
  const orig = { ...process.env };
  let ctl: SuperAdminController;

  beforeEach(() => {
    process.env = { ...orig };
    ctl = new SuperAdminController(jwt);
  });
  afterAll(() => { process.env = orig; });

  it('rejects when neither hash nor plaintext is configured', async () => {
    process.env.SUPERADMIN_EMAIL = 'ops@x.com';
    delete process.env.SUPERADMIN_PASSWORD_HASH;
    delete process.env.SUPERADMIN_PASSWORD;
    await expect(
      ctl.login('1.1.1.1', { email: 'ops@x.com', password: 'whatever' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('verifies an argon2id hash when SUPERADMIN_PASSWORD_HASH is set', async () => {
    process.env.SUPERADMIN_EMAIL = 'ops@x.com';
    process.env.SUPERADMIN_PASSWORD_HASH = await argon2.hash('s3cret');
    delete process.env.SUPERADMIN_PASSWORD;
    const r = await ctl.login('1.1.1.1', { email: 'ops@x.com', password: 's3cret' });
    expect(r.token).toBe('tok');
  });

  it('rejects bad password against an argon2 hash', async () => {
    process.env.SUPERADMIN_EMAIL = 'ops@x.com';
    process.env.SUPERADMIN_PASSWORD_HASH = await argon2.hash('correct');
    await expect(
      ctl.login('1.1.1.1', { email: 'ops@x.com', password: 'wrong' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('falls back to constant-time plaintext compare when only SUPERADMIN_PASSWORD is set', async () => {
    process.env.SUPERADMIN_EMAIL = 'ops@x.com';
    process.env.SUPERADMIN_PASSWORD = 'plain';
    delete process.env.SUPERADMIN_PASSWORD_HASH;
    const r = await ctl.login('1.1.1.1', { email: 'ops@x.com', password: 'plain' });
    expect(r.token).toBe('tok');
  });

  it('rate-limits after 5 attempts from the same IP', async () => {
    process.env.SUPERADMIN_EMAIL = 'ops@x.com';
    process.env.SUPERADMIN_PASSWORD = 'plain';
    let last: any;
    for (let i = 0; i < 6; i++) {
      try { await ctl.login('1.2.3.4', { email: 'ops@x.com', password: 'wrong' }); } catch (e) { last = e; }
    }
    expect(last).toBeInstanceOf(HttpException);
    expect(last.getStatus()).toBe(429);
  });
});
