import { config } from 'dotenv';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AccountKind, AuditActorKind, AuditOutcome } from '@prisma/client';
import { z } from 'zod';
import { createPrismaClient } from '../database.js';
import { hashPassword } from '../security/password.js';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(currentDirectory, '../../../../.env'), quiet: true });

const bootstrapEnvironmentSchema = z.object({
  DATABASE_URL: z.string().url(),
  BOOTSTRAP_ROOT_LOGIN: z.string().trim().min(1).max(200),
  BOOTSTRAP_ROOT_PASSWORD: z.string().min(12).max(1_000),
  BOOTSTRAP_ROOT_REASON: z.string().trim().min(1).max(1_000),
});

export const normalizeLogin = (login: string): string => login.trim().toLocaleLowerCase('es-PY');

export const bootstrapRoot = async (source: NodeJS.ProcessEnv = process.env) => {
  const environment = bootstrapEnvironmentSchema.parse(source);
  const client = createPrismaClient(environment.DATABASE_URL);
  const loginNormalized = normalizeLogin(environment.BOOTSTRAP_ROOT_LOGIN);
  const passwordHash = await hashPassword(environment.BOOTSTRAP_ROOT_PASSWORD);
  const requestId = randomUUID();

  try {
    return await client.$transaction(async (transaction) => {
      const existing = await transaction.user.findUnique({ where: { loginNormalized } });
      if (existing !== null) {
        if (existing.accountKind !== AccountKind.TECHNICAL) {
          throw new Error('El login solicitado ya pertenece a una cuenta ordinaria');
        }
        return { created: false, userId: existing.id, login: existing.login };
      }

      const user = await transaction.user.create({
        data: {
          login: environment.BOOTSTRAP_ROOT_LOGIN.trim(),
          loginNormalized,
          passwordHash,
          accountKind: AccountKind.TECHNICAL,
        },
      });

      await transaction.auditLog.create({
        data: {
          actorUserId: user.id,
          actorKind: AuditActorKind.TECHNICAL,
          action: 'technical.root.bootstrap',
          entityType: 'User',
          entityId: user.id,
          outcome: AuditOutcome.SUCCESS,
          requestId,
          reason: environment.BOOTSTRAP_ROOT_REASON,
          details: { accountKind: AccountKind.TECHNICAL },
        },
      });

      return { created: true, userId: user.id, login: user.login };
    });
  } finally {
    await client.$disconnect();
  }
};

const run = async () => {
  const result = await bootstrapRoot();
  process.stdout.write(
    `${result.created ? 'Cuenta técnica creada' : 'Cuenta técnica ya existente'}: ${result.login}\n`,
  );
};

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  void run().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'Error desconocido'}\n`);
    process.exitCode = 1;
  });
}
