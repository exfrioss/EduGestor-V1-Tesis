import { z } from 'zod';

export const uuid = z.uuid();
const text = z.string().trim().min(1).max(500);
const description = z.string().trim().max(10000);
const content = z.string().trim().max(100000).nullable();
export const points = z.string().regex(/^(?:0|[1-9]\d{0,7})(?:\.\d{1,4})?$/);
const scoringKind = z.enum(['ORDINARIA', 'FUERA_DE_ESCALA']);
export const page = z.strictObject({ limit: z.coerce.number().int().min(1).max(100).default(25), cursor: z.string().optional() });
export const bankPage = page.extend({ kind: z.enum(['TASK', 'INSTRUMENT']).optional(), q: z.string().trim().max(200).optional() });
export const assessmentPage = page.extend({ taskId: uuid.optional() });
export const bankCreate = z.strictObject({ kind: z.enum(['TASK', 'INSTRUMENT']), title: text, description, scoringKind, suggestedMaxPoints: points.nullable().optional(), instrumentContent: content.optional() });
export const bankPatch = bankCreate.partial().extend({ expectedVersion: z.number().int().positive() });
export const taskCreate = z.strictObject({ title: text, description, maxPoints: points, scoringKind, sourceBankItemId: uuid.optional() });
export const taskPatch = z.strictObject({ title: text.optional(), description: description.optional(), expectedVersion: z.number().int().positive() });
export const taskReuse = z.strictObject({ targetAssignmentId: uuid, title: text.optional(), description: description.optional(), maxPoints: points.optional(), scoringKind: scoringKind.optional() });
export const assessmentCreate = z.strictObject({ title: text, description: description.nullable().optional(), taskId: uuid.optional(), standaloneMaxPoints: points.nullable().optional(), standaloneScoringKind: scoringKind.nullable().optional(), instrumentContent: content.optional(), sourceBankItemId: uuid.optional() }).superRefine((value, ctx) => {
  if (value.taskId ? value.standaloneMaxPoints != null || value.standaloneScoringKind != null : value.standaloneMaxPoints == null || value.standaloneScoringKind == null) ctx.addIssue({ code: 'custom', message: 'Máximo/tipo incompatibles con la tarea' });
});
export const assessmentPatch = z.strictObject({ title: text.optional(), description: description.nullable().optional(), instrumentContent: content.optional(), expectedVersion: z.number().int().positive() });
export const assessmentReuse = z.strictObject({ targetAssignmentId: uuid, title: text.optional(), description: description.nullable().optional(), standaloneMaxPoints: points.optional(), standaloneScoringKind: scoringKind.optional() });
export const linkTask = z.strictObject({ taskId: uuid, expectedVersion: z.number().int().positive() });
export const resultPut = z.strictObject({ status: z.enum(['PENDIENTE', 'EVALUADO']), earnedPoints: points.nullable().optional(), expectedVersion: z.number().int().positive().nullable(), expectedTaskVersion: z.number().int().positive().optional() }).superRefine((value, ctx) => {
  if (value.status === 'PENDIENTE' && value.earnedPoints != null || value.status === 'EVALUADO' && value.earnedPoints == null) ctx.addIssue({ code: 'custom', message: 'Puntaje incompatible con estado' });
});
