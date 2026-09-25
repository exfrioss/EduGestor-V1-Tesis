import {
  AccountKind,
  AuditActorKind,
  AuditOutcome,
  PrismaClient,
  ScopeKind,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';

const describeDatabase = process.env.RUN_DATABASE_TESTS === '1' ? describe : describe.skip;
const client = new PrismaClient();
const suffix = randomUUID().slice(0, 8);

describeDatabase('persistencia Hito 1', () => {
  afterAll(async () => {
    await client.$disconnect();
  });

  it('persiste el contexto aprobado y rechaza cruces entre instituciones', async () => {
    const actor = await client.user.create({
      data: {
        login: `integration-actor-${suffix}`,
        loginNormalized: `integration-actor-${suffix}`,
        passwordHash: 'test-only-not-a-real-password-hash',
        accountKind: AccountKind.TECHNICAL,
      },
    });
    const institutionA = await client.institution.create({ data: { name: `Institución A ${suffix}` } });
    const institutionB = await client.institution.create({ data: { name: `Institución B ${suffix}` } });
    const yearA = await client.academicYear.create({
      data: {
        institutionId: institutionA.id,
        label: '2026',
        startsOn: new Date('2026-02-01'),
        endsOn: new Date('2026-11-30'),
        isCurrent: true,
      },
    });
    const yearB = await client.academicYear.create({
      data: {
        institutionId: institutionB.id,
        label: '2026',
        startsOn: new Date('2026-02-01'),
        endsOn: new Date('2026-11-30'),
      },
    });
    const courseA = await client.course.create({
      data: {
        institutionId: institutionA.id,
        academicYearId: yearA.id,
        grade: '1',
        section: 'A',
        shift: 'MAÑANA',
      },
    });
    const courseB = await client.course.create({
      data: {
        institutionId: institutionB.id,
        academicYearId: yearB.id,
        grade: '1',
        section: 'A',
        shift: 'MAÑANA',
      },
    });
    const subjectA = await client.subject.create({
      data: { institutionId: institutionA.id, name: 'Matemática', nameNormalized: 'matematica' },
    });
    const subjectB = await client.subject.create({
      data: { institutionId: institutionB.id, name: 'Física', nameNormalized: 'fisica' },
    });
    const teacher = await client.teacher.create({
      data: { userId: actor.id, displayName: 'Docente de integración' },
    });
    await client.teacherInstitution.create({
      data: { teacherId: teacher.id, institutionId: institutionA.id },
    });

    await expect(
      client.teachingAssignment.create({
        data: {
          teacherId: teacher.id,
          institutionId: institutionA.id,
          courseId: courseA.id,
          subjectId: subjectA.id,
        },
      }),
    ).resolves.toMatchObject({ teacherId: teacher.id, courseId: courseA.id });

    await expect(
      client.teachingAssignment.create({
        data: {
          teacherId: teacher.id,
          institutionId: institutionA.id,
          courseId: courseA.id,
          subjectId: subjectB.id,
        },
      }),
    ).rejects.toThrow();

    const scope = await client.accessScope.create({
      data: { institutionId: institutionA.id, createdById: actor.id, kind: ScopeKind.COURSE_SET },
    });
    await expect(
      client.scopeCourse.create({ data: { scopeId: scope.id, courseId: courseB.id } }),
    ).rejects.toThrow();
    await client.scopeCourse.create({ data: { scopeId: scope.id, courseId: courseA.id } });

    const role = await client.role.create({ data: { code: `integration.role.${suffix}`, name: 'Integración' } });
    await client.roleAssignment.create({
      data: {
        userId: actor.id,
        roleId: role.id,
        scopeId: scope.id,
        grantedById: actor.id,
      },
    });
    await expect(
      client.roleAssignment.create({
        data: {
          userId: actor.id,
          roleId: role.id,
          scopeId: scope.id,
          grantedById: actor.id,
        },
      }),
    ).rejects.toThrow();
  });

  it('aplica CHECK, unicidad parcial, diferimiento e inmutabilidad de auditoría', async () => {
    const actor = await client.user.findUniqueOrThrow({
      where: { loginNormalized: `integration-actor-${suffix}` },
    });
    const institution = await client.institution.findFirstOrThrow({
      where: { name: `Institución A ${suffix}` },
    });

    await expect(
      client.academicYear.create({
        data: {
          institutionId: institution.id,
          label: 'inválido',
          startsOn: new Date('2026-12-01'),
          endsOn: new Date('2026-02-01'),
        },
      }),
    ).rejects.toThrow();

    await expect(
      client.academicYear.create({
        data: {
          institutionId: institution.id,
          label: '2027',
          startsOn: new Date('2027-02-01'),
          endsOn: new Date('2027-11-30'),
          isCurrent: true,
        },
      }),
    ).rejects.toThrow();

    await expect(
      client.accessScope.create({
        data: {
          institutionId: institution.id,
          createdById: actor.id,
          kind: ScopeKind.RESOURCE_SET,
        },
      }),
    ).rejects.toThrow();

    const audit = await client.auditLog.create({
      data: {
        actorUserId: actor.id,
        actorKind: AuditActorKind.TECHNICAL,
        action: 'integration.persistence',
        entityType: 'Institution',
        entityId: institution.id,
        institutionId: institution.id,
        outcome: AuditOutcome.SUCCESS,
        requestId: '95104477-4fe5-4660-aef5-6aa16378e38d',
        reason: 'Prueba de integración de persistencia',
      },
    });

    await expect(
      client.auditLog.update({ where: { id: audit.id }, data: { action: 'mutated' } }),
    ).rejects.toThrow();
  });
});
