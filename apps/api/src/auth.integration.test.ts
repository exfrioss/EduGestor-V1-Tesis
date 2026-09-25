import { PassThrough } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { AccountKind, PrismaClient } from '@prisma/client';
import pino from 'pino';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import type { AuthConfig } from './config.js';
import { createDatabaseProbe } from './database.js';
import { createLogger } from './logging/logger.js';
import { hashSessionToken } from './modules/auth/session-token.js';
import { hashPassword } from './security/password.js';

const describeDatabase = process.env.RUN_DATABASE_TESTS === '1' ? describe : describe.skip;
const client = new PrismaClient();
const password = 'Integracion-segura-2026!';
const suffix = randomUUID().slice(0, 8);
const testLogin = (name: string) => `${name}-${suffix}`;
const config: AuthConfig = {
  sessionTtlMs: 8 * 60 * 60 * 1_000,
  lastSeenIntervalMs: 60_000,
  sessionCookieName: 'edugestor_session',
  csrfCookieName: 'edugestor_csrf',
  secureCookies: false,
  loginRateLimitWindowMs: 15 * 60 * 1_000,
  loginRateLimitMaxAttempts: 1_000,
};

const app = createApp(createDatabaseProbe(client), {
  logger: pino({ level: 'silent' }),
  auth: { client, config },
});

const cookieValue = (setCookies: string[] | undefined, name: string): string => {
  const cookie = setCookies?.find((value) => value.startsWith(`${name}=`));
  if (cookie === undefined) throw new Error(`No se emitió la cookie ${name}`);
  return cookie.slice(name.length + 1).split(';')[0] ?? '';
};

const sessionCookie = (response: request.Response): string => {
  const cookies = response.headers['set-cookie'];
  const values = Array.isArray(cookies) ? cookies : cookies === undefined ? undefined : [cookies];
  return `${config.sessionCookieName}=${cookieValue(values, config.sessionCookieName)}`;
};

const createUser = async (login: string, options: { active?: boolean; teacher?: boolean } = {}) => {
  const active = options.active ?? true;
  return client.user.create({
    data: {
      login,
      loginNormalized: login,
      passwordHash: await hashPassword(password),
      accountKind: AccountKind.STANDARD,
      isActive: active,
      disabledAt: active ? null : new Date(),
      teacher: options.teacher
        ? {
            create: {
              displayName: `Docente ${login}`,
              isActive: active,
              disabledAt: active ? null : new Date(),
            },
          }
        : undefined,
    },
  });
};

describeDatabase('autenticación y sesiones con PostgreSQL', () => {
  beforeAll(async () => {
    await createUser(testLogin('auth-correct'));
    await createUser(testLogin('auth-inactive'), { active: false });
  });

  afterAll(async () => {
    await client.$disconnect();
  });

  it('realiza login, emite cookie segura y nunca persiste el token en claro', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ login: testLogin('auth-correct'), password });

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({ login: testLogin('auth-correct'), accountKind: 'STANDARD' });
    expect(response.body.session.expiresAt).toBeTypeOf('string');
    const setCookies = response.headers['set-cookie'] as unknown as string[];
    const cookie = setCookies.find((value) => value.startsWith(`${config.sessionCookieName}=`));
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    const rawToken = cookieValue(setCookies, config.sessionCookieName);
    const stored = await client.authSession.findUniqueOrThrow({
      where: { tokenHash: hashSessionToken(rawToken) },
    });
    expect(stored.tokenHash).not.toBe(rawToken);
    expect(JSON.stringify(response.body)).not.toContain(password);
    expect(JSON.stringify(response.body)).not.toContain(stored.tokenHash);
    expect(JSON.stringify(response.body)).not.toContain(rawToken);
  });

  it('responde igual ante contraseña incorrecta, usuario inexistente y usuario desactivado', async () => {
    const wrong = await request(app)
      .post('/api/v1/auth/login')
      .send({ login: testLogin('auth-correct'), password: 'incorrecta' });
    const missing = await request(app)
      .post('/api/v1/auth/login')
      .send({ login: testLogin('auth-does-not-exist'), password: 'incorrecta' });
    const inactive = await request(app)
      .post('/api/v1/auth/login')
      .send({ login: testLogin('auth-inactive'), password });

    expect(wrong.status).toBe(401);
    expect(missing.status).toBe(401);
    expect(inactive.status).toBe(401);
    expect(missing.body.error).toMatchObject({
      code: 'INVALID_CREDENTIALS',
      message: 'Credenciales inválidas',
    });
    expect(wrong.body.error.code).toBe(missing.body.error.code);
    expect(inactive.body.error.code).toBe(missing.body.error.code);
  });

  it('acepta una sesión válida, actualiza lastSeenAt sin extender su expiración', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ login: testLogin('auth-correct'), password });
    const token = cookieValue(login.headers['set-cookie'] as unknown as string[], config.sessionCookieName);
    const tokenHash = hashSessionToken(token);
    const original = await client.authSession.update({
      where: { tokenHash },
      data: { lastSeenAt: new Date(0) },
    });

    const response = await request(app)
      .get('/api/v1/auth/session')
      .set('Cookie', `${config.sessionCookieName}=${token}`);
    const updated = await client.authSession.findUniqueOrThrow({ where: { tokenHash } });

    expect(response.status).toBe(200);
    expect(response.body.user.login).toBe(testLogin('auth-correct'));
    expect(updated.lastSeenAt?.getTime()).toBeGreaterThan(0);
    expect(updated.expiresAt.toISOString()).toBe(original.expiresAt.toISOString());
  });

  it('rechaza sesiones expiradas y sesiones revocadas', async () => {
    await createUser(testLogin('auth-expired'));
    await createUser(testLogin('auth-revoked'));
    const expiredLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ login: testLogin('auth-expired'), password });
    const expiredToken = cookieValue(
      expiredLogin.headers['set-cookie'] as unknown as string[],
      config.sessionCookieName,
    );
    await client.authSession.update({
      where: { tokenHash: hashSessionToken(expiredToken) },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    const expired = await request(app)
      .get('/api/v1/auth/session')
      .set('Cookie', `${config.sessionCookieName}=${expiredToken}`);

    const revokedLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ login: testLogin('auth-revoked'), password });
    const revokedToken = cookieValue(
      revokedLogin.headers['set-cookie'] as unknown as string[],
      config.sessionCookieName,
    );
    await client.authSession.update({
      where: { tokenHash: hashSessionToken(revokedToken) },
      data: { revokedAt: new Date() },
    });
    const revoked = await request(app)
      .get('/api/v1/auth/session')
      .set('Cookie', `${config.sessionCookieName}=${revokedToken}`);

    expect(expired.status).toBe(401);
    expect(revoked.status).toBe(401);
    expect(expired.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    expect(revoked.body.error.code).toBe('AUTHENTICATION_REQUIRED');
  });

  it('rechaza recursos privados sin sesión y logout sin CSRF', async () => {
    const noSession = await request(app).get('/api/v1/auth/session');
    expect(noSession.status).toBe(401);

    await createUser(testLogin('auth-no-csrf'));
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ login: testLogin('auth-no-csrf'), password });
    const response = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', sessionCookie(login));
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('CSRF_TOKEN_INVALID');
  });

  it('entrega CSRF a una sesión y logout revoca la sesión y limpia cookies', async () => {
    await createUser(testLogin('auth-logout'));
    const agent = request.agent(app);
    const login = await agent
      .post('/api/v1/auth/login')
      .send({ login: testLogin('auth-logout'), password });
    const token = cookieValue(login.headers['set-cookie'] as unknown as string[], config.sessionCookieName);
    const csrf = await agent.get('/api/v1/auth/csrf');
    const logout = await agent
      .post('/api/v1/auth/logout')
      .set('x-csrf-token', csrf.body.csrfToken as string);

    expect(csrf.status).toBe(200);
    expect(logout.status).toBe(204);
    expect(logout.headers['set-cookie'].join(';')).toContain(`${config.sessionCookieName}=;`);
    const stored = await client.authSession.findUniqueOrThrow({
      where: { tokenHash: hashSessionToken(token) },
    });
    expect(stored.revokedAt).not.toBeNull();
    expect((await agent.get('/api/v1/auth/session')).status).toBe(401);
  });

  it('revoca todas las sesiones al desactivar User o Teacher', async () => {
    const plainUser = await createUser(testLogin('auth-disable-user'));
    const teacherUser = await createUser(testLogin('auth-disable-teacher'), { teacher: true });
    for (const login of [testLogin('auth-disable-user'), testLogin('auth-disable-user'), testLogin('auth-disable-teacher')]) {
      expect(
        (await request(app).post('/api/v1/auth/login').send({ login, password })).status,
      ).toBe(200);
    }

    await client.user.update({
      where: { id: plainUser.id },
      data: { isActive: false, disabledAt: new Date() },
    });
    await client.teacher.update({
      where: { userId: teacherUser.id },
      data: { isActive: false, disabledAt: new Date() },
    });

    expect(
      await client.authSession.count({ where: { userId: plainUser.id, revokedAt: null } }),
    ).toBe(0);
    expect(
      await client.authSession.count({ where: { userId: teacherUser.id, revokedAt: null } }),
    ).toBe(0);
    const disabledTeacherLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ login: testLogin('auth-disable-teacher'), password });
    expect(disabledTeacherLogin.status).toBe(401);
    expect(disabledTeacherLogin.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('no expone contraseña, hash ni token de sesión en respuestas, auditoría o logs', async () => {
    await createUser(testLogin('auth-secrecy'));
    const stream = new PassThrough();
    let logs = '';
    stream.on('data', (chunk: Buffer) => {
      logs += chunk.toString('utf8');
    });
    const loggedApp = createApp(createDatabaseProbe(client), {
      logger: createLogger('info', stream),
      auth: { client, config },
    });
    const response = await request(loggedApp)
      .post('/api/v1/auth/login')
      .send({ login: testLogin('auth-secrecy'), password });
    const rawToken = cookieValue(
      response.headers['set-cookie'] as unknown as string[],
      config.sessionCookieName,
    );
    const user = await client.user.findUniqueOrThrow({ where: { loginNormalized: testLogin('auth-secrecy') } });
    await new Promise((resolve) => setImmediate(resolve));
    const audits = await client.auditLog.findMany({ where: { action: 'auth.login' } });
    const serialized = `${JSON.stringify(response.body)}${JSON.stringify(audits)}${logs}`;

    expect(serialized).not.toContain(password);
    expect(serialized).not.toContain(user.passwordHash);
    expect(serialized).not.toContain(rawToken);
  });

  it('limita intentos fallidos de login y registra el rechazo controlado', async () => {
    const limitedConfig = { ...config, loginRateLimitMaxAttempts: 2 };
    const limitedApp = createApp(createDatabaseProbe(client), {
      logger: pino({ level: 'silent' }),
      auth: { client, config: limitedConfig },
    });
    const statuses = [];
    for (let attempt = 0; attempt < 3; attempt += 1) {
      statuses.push(
        (
          await request(limitedApp)
            .post('/api/v1/auth/login')
            .send({ login: testLogin('rate-limited-missing'), password: 'incorrecta' })
        ).status,
      );
    }
    expect(statuses).toEqual([401, 401, 429]);
  });
});
