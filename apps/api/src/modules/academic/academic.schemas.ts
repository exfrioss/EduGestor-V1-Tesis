import { z } from 'zod';

export const uuidSchema = z.string().uuid();
const nonEmptyText = z.string().trim().min(1).max(200);

export const createInstitutionSchema = z.object({
  name: nonEmptyText,
  technicalReason: z.string().trim().min(1).max(1_000).optional(),
});

export const updateInstitutionSchema = z.object({ name: nonEmptyText });

const newTeacherAccountSchema = z.object({
  kind: z.literal('NEW'),
  login: nonEmptyText,
  password: z.string().min(12).max(1_000),
});

const existingTeacherAccountSchema = z.object({
  kind: z.literal('EXISTING'),
  userId: uuidSchema,
});

export const createTeacherSchema = z.object({
  displayName: nonEmptyText,
  account: z.discriminatedUnion('kind', [newTeacherAccountSchema, existingTeacherAccountSchema]),
});

export const updateTeacherSchema = z.object({ displayName: nonEmptyText });

export const createAcademicYearSchema = z.object({
  label: nonEmptyText,
  startsOn: z.coerce.date(),
  endsOn: z.coerce.date(),
  isCurrent: z.boolean().default(false),
});

export const updateAcademicYearSchema = z
  .object({
    label: nonEmptyText.optional(),
    startsOn: z.coerce.date().optional(),
    endsOn: z.coerce.date().optional(),
    isCurrent: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0);

export const createCourseSchema = z.object({
  institutionId: uuidSchema,
  academicYearId: uuidSchema,
  grade: nonEmptyText,
  section: nonEmptyText,
  shift: nonEmptyText,
  btiYear: z.number().int().min(1).max(3).nullable().optional(),
});

export const updateCourseSchema = z
  .object({
    academicYearId: uuidSchema.optional(),
    grade: nonEmptyText.optional(),
    section: nonEmptyText.optional(),
    shift: nonEmptyText.optional(),
    btiYear: z.number().int().min(1).max(3).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0);

export const createSubjectSchema = z.object({
  institutionId: uuidSchema,
  name: nonEmptyText,
});

export const updateSubjectSchema = z
  .object({
    name: nonEmptyText.optional(),
  })
  .refine((value) => Object.keys(value).length > 0);

export const createTeachingAssignmentSchema = z.object({
  institutionId: uuidSchema,
  teacherId: uuidSchema,
  courseId: uuidSchema,
  subjectId: uuidSchema,
});

export const assignmentListSchema = z.object({
  institutionId: uuidSchema,
  courseId: uuidSchema.optional(),
  teacherId: uuidSchema.optional(),
  includeEnded: z.enum(['true', 'false']).optional().transform((value) => value === 'true'),
});
