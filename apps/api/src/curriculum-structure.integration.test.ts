import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const describeDatabase = process.env.RUN_DATABASE_TESTS === '1' ? describe : describe.skip;
const client = new PrismaClient();
const suffix = randomUUID().slice(0, 8);

let actorId: string;
let institutionId: string;
let subjectWithoutMappingId: string;
let algorithmicsSubjectId: string;
let mathematicsSubjectId: string;
let graphicDesignSubjectId: string;
let generalPlanId: string;
let optionalPlanId: string;
let generalAreaId: string;
let algorithmicsDisciplineId: string;
let appliedMathematicsDisciplineId: string;
let graphicDesignDisciplineId: string;

describeDatabase('refinamiento estructural curricular con PostgreSQL', () => {
  beforeAll(async () => {
    const actor = await client.user.create({
      data: {
        login: `curriculum-actor-${suffix}`,
        loginNormalized: `curriculum-actor-${suffix}`,
        passwordHash: 'integration-only',
      },
    });
    actorId = actor.id;

    const institution = await client.institution.create({
      data: { name: `Institución Curricular ${suffix}` },
    });
    institutionId = institution.id;

    const subjects = await Promise.all(
      [
        ['Materia sin correspondencia', `sin-correspondencia-${suffix}`],
        ['Algorítmica', `algoritmica-${suffix}`],
        ['Matemática Aplicada', `matematica-aplicada-${suffix}`],
        ['Diseño Gráfico', `diseno-grafico-${suffix}`],
      ].map(([name, nameNormalized]) =>
        client.subject.create({ data: { institutionId, name, nameNormalized } }),
      ),
    );
    [
      subjectWithoutMappingId,
      algorithmicsSubjectId,
      mathematicsSubjectId,
      graphicDesignSubjectId,
    ] = subjects.map(({ id }) => id);

    const generalPlan = await client.planType.create({
      data: { code: `GENERAL-${suffix}`, name: 'Plan General' },
    });
    const optionalPlan = await client.planType.create({
      data: { code: `OPTIONAL-${suffix}`, name: 'Plan Optativo' },
    });
    generalPlanId = generalPlan.id;
    optionalPlanId = optionalPlan.id;

    const generalArea = await client.academicArea.create({
      data: {
        planTypeId: generalPlanId,
        code: `TECH-${suffix}`,
        name: 'Área técnica',
      },
    });
    generalAreaId = generalArea.id;

    const [algorithmics, appliedMathematics, graphicDesign] = await Promise.all([
      client.curriculumDiscipline.create({
        data: {
          planTypeId: generalPlanId,
          academicAreaId: generalAreaId,
          code: `ALG-${suffix}`,
          officialName: 'Algorítmica',
        },
      }),
      client.curriculumDiscipline.create({
        data: {
          planTypeId: generalPlanId,
          academicAreaId: generalAreaId,
          code: `MAI-${suffix}`,
          officialName: 'Matemática Aplicada a la Informática',
        },
      }),
      client.curriculumDiscipline.create({
        data: {
          planTypeId: optionalPlanId,
          academicAreaId: null,
          code: `DG-${suffix}`,
          officialName: 'Diseño Gráfico',
        },
      }),
    ]);
    algorithmicsDisciplineId = algorithmics.id;
    appliedMathematicsDisciplineId = appliedMathematics.id;
    graphicDesignDisciplineId = graphicDesign.id;
  });

  afterAll(async () => {
    await client.$disconnect();
  });

  it('permite una materia institucional sin correspondencia curricular ni dependencia en TeachingAssignment', async () => {
    expect(
      await client.subjectCurriculumMapping.count({
        where: { subjectId: subjectWithoutMappingId },
      }),
    ).toBe(0);

    const year = await client.academicYear.create({
      data: {
        institutionId,
        label: `2026-${suffix}`,
        startsOn: new Date('2026-02-01'),
        endsOn: new Date('2026-11-30'),
      },
    });
    const course = await client.course.create({
      data: {
        institutionId,
        academicYearId: year.id,
        grade: '1.o bti',
        section: `a-${suffix}`,
        shift: 'manana',
        btiYear: 1,
      },
    });
    const teacherUser = await client.user.create({
      data: {
        login: `curriculum-teacher-${suffix}`,
        loginNormalized: `curriculum-teacher-${suffix}`,
        passwordHash: 'integration-only',
      },
    });
    const teacher = await client.teacher.create({
      data: { userId: teacherUser.id, displayName: 'Docente curricular' },
    });
    await client.teacherInstitution.create({
      data: { teacherId: teacher.id, institutionId },
    });

    await expect(
      client.teachingAssignment.create({
        data: {
          teacherId: teacher.id,
          institutionId,
          courseId: course.id,
          subjectId: subjectWithoutMappingId,
        },
      }),
    ).resolves.toMatchObject({ subjectId: subjectWithoutMappingId });
  });

  it('admite correspondencias vigentes de Algorítmica para varios años BTI', async () => {
    await client.subjectCurriculumMapping.createMany({
      data: [1, 2, 3].map((btiYear) => ({
        subjectId: algorithmicsSubjectId,
        btiYear,
        curriculumDisciplineId: algorithmicsDisciplineId,
        createdById: actorId,
        updatedById: actorId,
      })),
    });

    const mappings = await client.subjectCurriculumMapping.findMany({
      where: { subjectId: algorithmicsSubjectId, retiredAt: null },
      orderBy: { btiYear: 'asc' },
    });
    expect(mappings.map(({ btiYear }) => btiYear)).toEqual([1, 2, 3]);
  });

  it('relaciona Matemática Aplicada con el nombre curricular oficial aprobado', async () => {
    const mapping = await client.subjectCurriculumMapping.create({
      data: {
        subjectId: mathematicsSubjectId,
        btiYear: 2,
        curriculumDisciplineId: appliedMathematicsDisciplineId,
        createdById: actorId,
        updatedById: actorId,
      },
      include: { curriculumDiscipline: true },
    });

    expect(mapping.curriculumDiscipline.officialName).toBe(
      'Matemática Aplicada a la Informática',
    );
  });

  it('admite Diseño Gráfico de 3.º BTI en Plan Optativo sin área ficticia', async () => {
    const mapping = await client.subjectCurriculumMapping.create({
      data: {
        subjectId: graphicDesignSubjectId,
        btiYear: 3,
        curriculumDisciplineId: graphicDesignDisciplineId,
        createdById: actorId,
        updatedById: actorId,
      },
      include: { curriculumDiscipline: { include: { planType: true } } },
    });

    expect(mapping.curriculumDiscipline).toMatchObject({
      academicAreaId: null,
      planTypeId: optionalPlanId,
      planType: { name: 'Plan Optativo' },
    });
  });

  it('rechaza asociar a una disciplina un área perteneciente a otro plan', async () => {
    await expect(
      client.curriculumDiscipline.create({
        data: {
          planTypeId: optionalPlanId,
          academicAreaId: generalAreaId,
          code: `CROSS-${suffix}`,
          officialName: 'Clasificación inválida',
        },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  it('rechaza dos correspondencias vigentes para la misma materia y año', async () => {
    await expect(
      client.subjectCurriculumMapping.create({
        data: {
          subjectId: algorithmicsSubjectId,
          btiYear: 1,
          curriculumDisciplineId: appliedMathematicsDisciplineId,
          createdById: actorId,
          updatedById: actorId,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('permite retirar y reemplazar una correspondencia conservando la historia', async () => {
    const current = await client.subjectCurriculumMapping.findFirstOrThrow({
      where: { subjectId: algorithmicsSubjectId, btiYear: 2, retiredAt: null },
    });
    const retiredAt = new Date();
    await client.subjectCurriculumMapping.update({
      where: { id: current.id },
      data: { retiredAt, updatedById: actorId, rowVersion: { increment: 1 } },
    });
    const replacement = await client.subjectCurriculumMapping.create({
      data: {
        subjectId: algorithmicsSubjectId,
        btiYear: 2,
        curriculumDisciplineId: appliedMathematicsDisciplineId,
        createdById: actorId,
        updatedById: actorId,
      },
    });

    const history = await client.subjectCurriculumMapping.findMany({
      where: { subjectId: algorithmicsSubjectId, btiYear: 2 },
      orderBy: { createdAt: 'asc' },
    });
    expect(history).toHaveLength(2);
    expect(history.find(({ id }) => id === current.id)?.retiredAt).toEqual(retiredAt);
    expect(history.find(({ id }) => id === replacement.id)?.retiredAt).toBeNull();
  });

  it('aplica el rango aprobado al año BTI del curso y de la correspondencia', async () => {
    const year = await client.academicYear.findFirstOrThrow({ where: { institutionId } });
    await expect(
      client.course.create({
        data: {
          institutionId,
          academicYearId: year.id,
          grade: '4.o bti',
          section: `invalid-${suffix}`,
          shift: 'manana',
          btiYear: 4,
        },
      }),
    ).rejects.toThrow();

    await expect(
      client.subjectCurriculumMapping.create({
        data: {
          subjectId: subjectWithoutMappingId,
          btiYear: 0,
          curriculumDisciplineId: algorithmicsDisciplineId,
          createdById: actorId,
          updatedById: actorId,
        },
      }),
    ).rejects.toThrow();
  });
});
