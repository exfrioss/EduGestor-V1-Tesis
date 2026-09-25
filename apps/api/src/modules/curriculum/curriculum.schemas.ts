import { z } from 'zod';

export const uuid = z.string().uuid();
const text = z.string().trim().min(1).max(200);
const technicalReason = z.string().trim().min(1).max(1_000);
const expectedVersion = z.number().int().positive();
export const btiYear = z.coerce.number().int().min(1).max(3);

const page = {
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().min(1).max(2_000).optional(),
};

export const catalogContextQuery = z.object({ institutionId: uuid, ...page }).strict();
export const disciplineQuery = z
  .object({
    institutionId: uuid,
    planTypeId: uuid.optional(),
    academicAreaId: uuid.optional(),
    areaStatus: z.enum(['known', 'unknown']).optional(),
    ...page,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.academicAreaId !== undefined && value.areaStatus === 'unknown') {
      context.addIssue({ code: 'custom', message: 'Filtros de área contradictorios' });
    }
  });

export const mappingQuery = z
  .object({
    btiYear: btiYear.optional(),
    status: z.enum(['current', 'retired', 'all']).default('current'),
    courseId: uuid.optional(),
    ...page,
  })
  .strict();

export const createPlanType = z.object({ code: text, name: text, technicalReason }).strict();
export const updatePlanType = z.object({ name: text, expectedVersion, technicalReason }).strict();
export const createAcademicArea = z
  .object({ planTypeId: uuid, code: text, name: text, technicalReason })
  .strict();
export const updateAcademicArea = z.object({ name: text, expectedVersion, technicalReason }).strict();
export const createDiscipline = z
  .object({ planTypeId: uuid, academicAreaId: uuid.nullable(), code: text, officialName: text, technicalReason })
  .strict();
export const updateDiscipline = z
  .object({
    officialName: text.optional(),
    academicAreaId: uuid.nullable().optional(),
    expectedVersion,
    technicalReason,
  })
  .strict()
  .refine((value) => value.officialName !== undefined || value.academicAreaId !== undefined, {
    message: 'Debe indicarse al menos un cambio',
  });
export const createMapping = z.object({ btiYear, curriculumDisciplineId: uuid }).strict();
export const retireMapping = z.object({ expectedVersion }).strict();
export const replaceMapping = z.object({ curriculumDisciplineId: uuid, expectedVersion }).strict();
