import {
  AccountKind,
  AuditActorKind,
  AuditOutcome,
  Prisma,
  type PrismaClient,
} from '@prisma/client';
import type { AuthConfig } from '../../config.js';
import { AppError } from '../../errors/app-error.js';
import { hashPassword, verifyPassword } from '../../security/password.js';
import { normalizeLogin } from '../users/normalize-login.js';
import { createOpaqueSessionToken, hashSessionToken } from './session-token.js';

const dummyPasswordHash = hashPassword(createOpaqueSessionToken());

export interface AuthenticatedPrincipal {
  sessionId: string;
  userId: string;
  login: string;
  accountKind: AccountKind;
  expiresAt: Date;
  teacher: null | {
    id: string;
    displayName: string;
  };
}

export interface LoginResult {
  token: string;
  principal: AuthenticatedPrincipal;
}

const invalidCredentials = () =>
  new AppError(401, 'INVALID_CREDENTIALS', 'Credenciales inválidas');

class AccountDisabledDuringLoginError extends Error {}

export class AuthService {
  constructor(
    private readonly client: PrismaClient,
    private readonly config: AuthConfig,
  ) {}

  async login(login: string, password: string, requestId: string): Promise<LoginResult> {
    const loginNormalized = normalizeLogin(login);
    const user = await this.client.user.findUnique({
      where: { loginNormalized },
      include: { teacher: true },
    });
    const passwordHash = user?.passwordHash ?? (await dummyPasswordHash);
    const passwordMatches = await verifyPassword(password, passwordHash);
    const enabled =
      user !== null && user.isActive && (user.teacher === null || user.teacher.isActive);

    if (!passwordMatches || !enabled || user === null) {
      if (user !== null && !enabled) {
        await this.revokeAllSessions(user.id);
      }
      await this.auditDeniedLogin(requestId, 'Credenciales inválidas o cuenta inactiva');
      throw invalidCredentials();
    }

    const token = createOpaqueSessionToken();
    const tokenHash = hashSessionToken(token);
    const expiresAt = new Date(Date.now() + this.config.sessionTtlMs);

    let session;
    try {
      session = await this.client.$transaction(
        async (transaction) => {
          const eligibility = await transaction.user.findUnique({
            where: { id: user.id },
            select: { isActive: true, teacher: { select: { isActive: true } } },
          });
          if (
            eligibility === null ||
            !eligibility.isActive ||
            (eligibility.teacher !== null && !eligibility.teacher.isActive)
          ) {
            throw new AccountDisabledDuringLoginError();
          }

          const created = await transaction.authSession.create({
            data: { userId: user.id, tokenHash, expiresAt, lastSeenAt: new Date() },
          });
          await transaction.auditLog.create({
            data: {
              actorUserId: user.id,
              actorKind:
                user.accountKind === AccountKind.TECHNICAL
                  ? AuditActorKind.TECHNICAL
                  : AuditActorKind.USER,
              action: 'auth.login',
              entityType: 'AuthSession',
              entityId: created.id,
              outcome: AuditOutcome.SUCCESS,
              requestId,
              reason:
                user.accountKind === AccountKind.TECHNICAL
                  ? 'Inicio de sesión excepcional de cuenta técnica'
                  : undefined,
            },
          });
          return created;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof AccountDisabledDuringLoginError) {
        await this.revokeAllSessions(user.id);
        await this.auditDeniedLogin(requestId, 'Credenciales inválidas o cuenta inactiva');
        throw invalidCredentials();
      }
      throw error;
    }

    return {
      token,
      principal: {
        sessionId: session.id,
        userId: user.id,
        login: user.login,
        accountKind: user.accountKind,
        expiresAt: session.expiresAt,
        teacher:
          user.teacher === null
            ? null
            : { id: user.teacher.id, displayName: user.teacher.displayName },
      },
    };
  }

  async authenticate(token: string): Promise<AuthenticatedPrincipal | null> {
    const now = new Date();
    const session = await this.client.authSession.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      select: {
        id: true,
        expiresAt: true,
        revokedAt: true,
        lastSeenAt: true,
        user: {
          select: {
            id: true,
            login: true,
            accountKind: true,
            isActive: true,
            teacher: { select: { id: true, displayName: true, isActive: true } },
          },
        },
      },
    });

    if (session === null) {
      return null;
    }

    const enabled =
      session.user.isActive &&
      (session.user.teacher === null || session.user.teacher.isActive);
    if (session.revokedAt !== null || session.expiresAt <= now || !enabled) {
      if (session.revokedAt === null) {
        await this.client.authSession.updateMany({
          where: { id: session.id, revokedAt: null },
          data: { revokedAt: now, rowVersion: { increment: 1 } },
        });
      }
      return null;
    }

    const staleBefore = new Date(now.getTime() - this.config.lastSeenIntervalMs);
    await this.client.authSession.updateMany({
      where: {
        id: session.id,
        revokedAt: null,
        expiresAt: { gt: now },
        OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: staleBefore } }],
      },
      data: { lastSeenAt: now, rowVersion: { increment: 1 } },
    });

    return {
      sessionId: session.id,
      userId: session.user.id,
      login: session.user.login,
      accountKind: session.user.accountKind,
      expiresAt: session.expiresAt,
      teacher:
        session.user.teacher === null
          ? null
          : { id: session.user.teacher.id, displayName: session.user.teacher.displayName },
    };
  }

  async logout(principal: AuthenticatedPrincipal, requestId: string): Promise<void> {
    await this.client.$transaction(async (transaction) => {
      await transaction.authSession.updateMany({
        where: { id: principal.sessionId, revokedAt: null },
        data: { revokedAt: new Date(), rowVersion: { increment: 1 } },
      });
      await transaction.auditLog.create({
        data: {
          actorUserId: principal.userId,
          actorKind:
            principal.accountKind === AccountKind.TECHNICAL
              ? AuditActorKind.TECHNICAL
              : AuditActorKind.USER,
          action: 'auth.logout',
          entityType: 'AuthSession',
          entityId: principal.sessionId,
          outcome: AuditOutcome.SUCCESS,
          requestId,
          reason:
            principal.accountKind === AccountKind.TECHNICAL
              ? 'Cierre de sesión de cuenta técnica'
              : undefined,
        },
      });
    });
  }

  async revokeAllSessions(userId: string): Promise<number> {
    const result = await this.client.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), rowVersion: { increment: 1 } },
    });
    return result.count;
  }

  async auditRateLimitedLogin(requestId: string): Promise<void> {
    await this.auditDeniedLogin(requestId, 'Límite de intentos de autenticación excedido');
  }

  private async auditDeniedLogin(requestId: string, reason: string): Promise<void> {
    await this.client.auditLog.create({
      data: {
        actorKind: AuditActorKind.USER,
        action: 'auth.login',
        entityType: 'AuthSession',
        outcome: AuditOutcome.DENIED,
        requestId,
        reason,
      },
    });
  }
}
