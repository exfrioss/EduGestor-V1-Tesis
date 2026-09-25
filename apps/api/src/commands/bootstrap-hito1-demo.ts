import { config } from 'dotenv';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AccountKind,
  AuditActorKind,
  AuditOutcome,
  Prisma,
  ScopeKind,
  type PrismaClient,
} from '@prisma/client';
import { z } from 'zod';
import { createPrismaClient } from '../database.js';
import { normalizeLogin } from '../modules/users/normalize-login.js';
import {
  HITO1_PERMISSION_CODES,
  PERMISSION_CATALOG,
} from '../modules/authorization/permission-catalog.js';
import { normalizeComparableText } from '../modules/academic/normalization.js';
import { hashPassword, verifyPassword } from '../security/password.js';
import { demoPermissionGrantId, HITO1_DEMO_DATA, HITO1_DEMO_IDS } from './hito1-demo.constants.js';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(currentDirectory, '../../../../.env'), quiet: true });

const demoEnvironmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test']),
    DATABASE_URL: z.string().url(),
    HITO1_DEMO_TECHNICAL_LOGIN: z.string().trim().min(1).max(200),
    HITO1_DEMO_ADMIN_LOGIN: z.string().trim().min(1).max(200),
    HITO1_DEMO_ADMIN_PASSWORD: z.string().min(12).max(1_000),
    HITO1_DEMO_TEACHER_ONE_LOGIN: z.string().trim().min(1).max(200),
    HITO1_DEMO_TEACHER_ONE_PASSWORD: z.string().min(12).max(1_000),
    HITO1_DEMO_TEACHER_TWO_LOGIN: z.string().trim().min(1).max(200),
    HITO1_DEMO_TEACHER_TWO_PASSWORD: z.string().min(12).max(1_000),
  })
  .superRefine((value, context) => {
    const logins = [
      value.HITO1_DEMO_TECHNICAL_LOGIN,
      value.HITO1_DEMO_ADMIN_LOGIN,
      value.HITO1_DEMO_TEACHER_ONE_LOGIN,
      value.HITO1_DEMO_TEACHER_TWO_LOGIN,
    ].map(normalizeLogin);
    if (new Set(logins).size !== logins.length) {
      context.addIssue({ code: 'custom', message: 'Los logins técnicos y de demostración deben ser distintos' });
    }
  });

export const parseHito1DemoEnvironment = (source: NodeJS.ProcessEnv) =>
  demoEnvironmentSchema.parse(source);

type DemoEnvironment = z.infer<typeof demoEnvironmentSchema>;
type Transaction = Prisma.TransactionClient;

const userPasswordHash = async (
  client: PrismaClient,
  id: string,
  password: string,
): Promise<string> => {
  const existing = await client.user.findUnique({ where: { id }, select: { passwordHash: true } });
  if (existing !== null && (await verifyPassword(password, existing.passwordHash))) {
    return existing.passwordHash;
  }
  return hashPassword(password);
};

const ensureLoginAvailable = async (
  transaction: Transaction,
  id: string,
  loginNormalized: string,
) => {
  const owner = await transaction.user.findUnique({ where: { loginNormalized }, select: { id: true } });
  if (owner !== null && owner.id !== id) {
    throw new Error(`El login de demostración ya pertenece a otro usuario (${owner.id})`);
  }
};

const synchronizePermissionCatalog = async (client: PrismaClient) => {
  for (const permission of PERMISSION_CATALOG) {
    await client.permission.upsert({
      where: { code: permission.code },
      create: permission,
      update: { description: permission.description },
    });
  }
};

const ensureStandardUser = async (
  transaction: Transaction,
  input: { id: string; login: string; passwordHash: string },
) => {
  const login = input.login.trim();
  const loginNormalized = normalizeLogin(login);
  await ensureLoginAvailable(transaction, input.id, loginNormalized);
  return transaction.user.upsert({
    where: { id: input.id },
    create: {
      id: input.id,
      login,
      loginNormalized,
      passwordHash: input.passwordHash,
      accountKind: AccountKind.STANDARD,
      isActive: true,
    },
    update: {
      login,
      loginNormalized,
      passwordHash: input.passwordHash,
      accountKind: AccountKind.STANDARD,
      isActive: true,
      disabledAt: null,
      rowVersion: { increment: 1 },
    },
  });
};

const assertTechnicalUser = async (transaction: Transaction, login: string) => {
  const technical = await transaction.user.findUnique({
    where: { loginNormalized: normalizeLogin(login) },
  });
  if (
    technical === null ||
    technical.accountKind !== AccountKind.TECHNICAL ||
    !technical.isActive
  ) {
    throw new Error('HITO1_DEMO_TECHNICAL_LOGIN debe identificar una cuenta técnica activa creada previamente');
  }
  return technical;
};

const provision = async (
  transaction: Transaction,
  environment: DemoEnvironment,
  hashes: { admin: string; teacherOne: string; teacherTwo: string },
) => {
  const technical = await assertTechnicalUser(
    transaction,
    environment.HITO1_DEMO_TECHNICAL_LOGIN,
  );
  const [admin, teacherOneUser, teacherTwoUser] = await Promise.all([
    ensureStandardUser(transaction, {
      id: HITO1_DEMO_IDS.adminUser,
      login: environment.HITO1_DEMO_ADMIN_LOGIN,
      passwordHash: hashes.admin,
    }),
    ensureStandardUser(transaction, {
      id: HITO1_DEMO_IDS.teacherOneUser,
      login: environment.HITO1_DEMO_TEACHER_ONE_LOGIN,
      passwordHash: hashes.teacherOne,
    }),
    ensureStandardUser(transaction, {
      id: HITO1_DEMO_IDS.teacherTwoUser,
      login: environment.HITO1_DEMO_TEACHER_TWO_LOGIN,
      passwordHash: hashes.teacherTwo,
    }),
  ]);

  const institution = await transaction.institution.upsert({
    where: { id: HITO1_DEMO_IDS.institution },
    create: { id: HITO1_DEMO_IDS.institution, name: HITO1_DEMO_DATA.institutionName },
    update: {
      name: HITO1_DEMO_DATA.institutionName,
      isActive: true,
      disabledAt: null,
      disabledById: null,
      rowVersion: { increment: 1 },
    },
  });

  await transaction.academicYear.updateMany({
    where: { institutionId: institution.id, id: { not: HITO1_DEMO_IDS.academicYear }, isCurrent: true },
    data: { isCurrent: false, rowVersion: { increment: 1 } },
  });
  const academicYear = await transaction.academicYear.upsert({
    where: { id: HITO1_DEMO_IDS.academicYear },
    create: {
      id: HITO1_DEMO_IDS.academicYear,
      institutionId: institution.id,
      label: HITO1_DEMO_DATA.academicYearLabel,
      startsOn: HITO1_DEMO_DATA.startsOn,
      endsOn: HITO1_DEMO_DATA.endsOn,
      isCurrent: true,
    },
    update: {
      label: HITO1_DEMO_DATA.academicYearLabel,
      startsOn: HITO1_DEMO_DATA.startsOn,
      endsOn: HITO1_DEMO_DATA.endsOn,
      isCurrent: true,
      rowVersion: { increment: 1 },
    },
  });

  const [teacherOne, teacherTwo] = await Promise.all([
    transaction.teacher.upsert({
      where: { id: HITO1_DEMO_IDS.teacherOne },
      create: { id: HITO1_DEMO_IDS.teacherOne, userId: teacherOneUser.id, displayName: HITO1_DEMO_DATA.teacherOneName },
      update: { displayName: HITO1_DEMO_DATA.teacherOneName, isActive: true, disabledAt: null, disabledById: null, rowVersion: { increment: 1 } },
    }),
    transaction.teacher.upsert({
      where: { id: HITO1_DEMO_IDS.teacherTwo },
      create: { id: HITO1_DEMO_IDS.teacherTwo, userId: teacherTwoUser.id, displayName: HITO1_DEMO_DATA.teacherTwoName },
      update: { displayName: HITO1_DEMO_DATA.teacherTwoName, isActive: true, disabledAt: null, disabledById: null, rowVersion: { increment: 1 } },
    }),
  ]);

  await Promise.all([
    transaction.teacherInstitution.upsert({
      where: { id: HITO1_DEMO_IDS.teacherOneInstitution },
      create: { id: HITO1_DEMO_IDS.teacherOneInstitution, teacherId: teacherOne.id, institutionId: institution.id },
      update: { endedAt: null, rowVersion: { increment: 1 } },
    }),
    transaction.teacherInstitution.upsert({
      where: { id: HITO1_DEMO_IDS.teacherTwoInstitution },
      create: { id: HITO1_DEMO_IDS.teacherTwoInstitution, teacherId: teacherTwo.id, institutionId: institution.id },
      update: { endedAt: null, rowVersion: { increment: 1 } },
    }),
  ]);

  const course = await transaction.course.upsert({
    where: { id: HITO1_DEMO_IDS.course },
    create: {
      id: HITO1_DEMO_IDS.course,
      institutionId: institution.id,
      academicYearId: academicYear.id,
      grade: HITO1_DEMO_DATA.grade,
      section: HITO1_DEMO_DATA.section,
      shift: HITO1_DEMO_DATA.shift,
    },
    update: {
      grade: HITO1_DEMO_DATA.grade,
      section: HITO1_DEMO_DATA.section,
      shift: HITO1_DEMO_DATA.shift,
      isActive: true,
      disabledAt: null,
      disabledById: null,
      rowVersion: { increment: 1 },
    },
  });
  const subject = await transaction.subject.upsert({
    where: { id: HITO1_DEMO_IDS.subject },
    create: {
      id: HITO1_DEMO_IDS.subject,
      institutionId: institution.id,
      name: HITO1_DEMO_DATA.subjectName,
      nameNormalized: normalizeComparableText(HITO1_DEMO_DATA.subjectName),
    },
    update: {
      name: HITO1_DEMO_DATA.subjectName,
      nameNormalized: normalizeComparableText(HITO1_DEMO_DATA.subjectName),
      isActive: true,
      disabledAt: null,
      disabledById: null,
      rowVersion: { increment: 1 },
    },
  });

  const [assignmentOne, assignmentTwo] = await Promise.all([
    transaction.teachingAssignment.upsert({
      where: { id: HITO1_DEMO_IDS.teacherOneAssignment },
      create: { id: HITO1_DEMO_IDS.teacherOneAssignment, teacherId: teacherOne.id, institutionId: institution.id, courseId: course.id, subjectId: subject.id },
      update: { endedAt: null, rowVersion: { increment: 1 } },
    }),
    transaction.teachingAssignment.upsert({
      where: { id: HITO1_DEMO_IDS.teacherTwoAssignment },
      create: { id: HITO1_DEMO_IDS.teacherTwoAssignment, teacherId: teacherTwo.id, institutionId: institution.id, courseId: course.id, subjectId: subject.id },
      update: { endedAt: null, rowVersion: { increment: 1 } },
    }),
  ]);

  const role = await transaction.role.upsert({
    where: { code: 'HITO1_DEMO_INSTITUTION_ADMIN' },
    create: { id: HITO1_DEMO_IDS.administratorRole, code: 'HITO1_DEMO_INSTITUTION_ADMIN', name: 'Administrador institucional de demostración' },
    update: { name: 'Administrador institucional de demostración', rowVersion: { increment: 1 } },
  });
  const scope = await transaction.accessScope.upsert({
    where: { id: HITO1_DEMO_IDS.institutionScope },
    create: { id: HITO1_DEMO_IDS.institutionScope, institutionId: institution.id, kind: ScopeKind.INSTITUTION, createdById: technical.id },
    update: { institutionId: institution.id, kind: ScopeKind.INSTITUTION, rowVersion: { increment: 1 } },
  });
  const roleAssignment = await transaction.roleAssignment.upsert({
    where: { id: HITO1_DEMO_IDS.administratorAssignment },
    create: { id: HITO1_DEMO_IDS.administratorAssignment, userId: admin.id, roleId: role.id, scopeId: scope.id, grantedById: technical.id },
    update: { revokedAt: null, revokedById: null, rowVersion: { increment: 1 } },
  });
  const permissions = await transaction.permission.findMany({
    where: { code: { in: [...HITO1_PERMISSION_CODES] } },
    orderBy: { code: 'asc' },
  });
  for (const [index, permission] of permissions.entries()) {
    await transaction.roleAssignmentPermission.upsert({
      where: { roleAssignmentId_permissionId: { roleAssignmentId: roleAssignment.id, permissionId: permission.id } },
      create: {
        id: demoPermissionGrantId(index),
        roleAssignmentId: roleAssignment.id,
        permissionId: permission.id,
        parentGrantId: null,
        delegatedById: roleAssignment.grantedById,
      },
      update: { revokedAt: null, rowVersion: { increment: 1 } },
    });
  }

  await transaction.auditLog.create({
    data: {
      actorUserId: technical.id,
      actorKind: AuditActorKind.TECHNICAL,
      action: 'demo.hito1.bootstrap',
      entityType: 'Institution',
      entityId: institution.id,
      institutionId: institution.id,
      outcome: AuditOutcome.SUCCESS,
      requestId: randomUUID(),
      reason: 'Provisionamiento explícito de datos ficticios locales del Hito 1',
      details: {
        environment: environment.NODE_ENV,
        users: 3,
        teachers: 2,
        teachingAssignments: 2,
        permissions: permissions.length,
      },
    },
  });

  return {
    institutionId: institution.id,
    adminUserId: admin.id,
    teacherUserIds: [teacherOneUser.id, teacherTwoUser.id],
    teacherIds: [teacherOne.id, teacherTwo.id],
    courseId: course.id,
    subjectId: subject.id,
    teachingAssignmentIds: [assignmentOne.id, assignmentTwo.id],
    permissions: permissions.length,
  };
};

export const bootstrapHito1Demo = async (source: NodeJS.ProcessEnv = process.env) => {
  const environment = parseHito1DemoEnvironment(source);
  const client = createPrismaClient(environment.DATABASE_URL);
  try {
    await synchronizePermissionCatalog(client);
    const hashes = {
      admin: await userPasswordHash(client, HITO1_DEMO_IDS.adminUser, environment.HITO1_DEMO_ADMIN_PASSWORD),
      teacherOne: await userPasswordHash(client, HITO1_DEMO_IDS.teacherOneUser, environment.HITO1_DEMO_TEACHER_ONE_PASSWORD),
      teacherTwo: await userPasswordHash(client, HITO1_DEMO_IDS.teacherTwoUser, environment.HITO1_DEMO_TEACHER_TWO_PASSWORD),
    };
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await client.$transaction(
          (transaction) => provision(transaction, environment, hashes),
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== 'P2034' ||
          attempt === 3
        ) {
          throw error;
        }
      }
    }
    throw new Error('No se pudo completar el bootstrap serializable');
  } finally {
    await client.$disconnect();
  }
};

const run = async () => {
  const result = await bootstrapHito1Demo();
  process.stdout.write(`Datos ficticios del Hito 1 disponibles en la institución ${result.institutionId}\n`);
};

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  void run().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'Error desconocido'}\n`);
    process.exitCode = 1;
  });
}
