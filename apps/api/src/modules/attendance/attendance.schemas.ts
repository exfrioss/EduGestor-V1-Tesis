import { z } from 'zod';

export const uuid = z.uuid();
export const classDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
});
export const sessionCreate = z.strictObject({ classDate });
const filters = z.strictObject({
  date: classDate.optional(), from: classDate.optional(), to: classDate.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25), cursor: z.string().optional(),
}).superRefine((value, ctx) => {
  if ((value.date && (value.from || value.to)) || (value.from && value.to && value.from > value.to))
    ctx.addIssue({ code: 'custom', message: 'Rango de fechas inválido' });
});
export const sessionQuery = filters;
export const courseQuery = filters.safeExtend({ subjectId: uuid.optional() });
export const historyQuery = z.strictObject({
  assignmentId: uuid.optional(), from: classDate.optional(), to: classDate.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25), cursor: z.string().optional(),
}).superRefine((value, ctx) => {
  if (value.from && value.to && value.from > value.to)
    ctx.addIssue({ code: 'custom', message: 'Rango de fechas inválido' });
});

export const recordPut = z.strictObject({
  status: z.enum(['PRESENTE', 'AUSENTE', 'LLEGADA_TARDIA', 'SALIDA_ANTICIPADA']),
  isJustified: z.boolean(),
  justificationObservation: z.string().trim().max(2000).nullable().optional(),
  observation: z.string().trim().max(2000).nullable().optional(),
  expectedVersion: z.number().int().positive().nullable(),
}).superRefine((value, ctx) => {
  if (!value.isJustified && value.justificationObservation != null)
    ctx.addIssue({ code: 'custom', message: 'Observación justificativa incompatible' });
});
export const batchPut = z.strictObject({
  records: z.array(recordPut.safeExtend({ enrollmentId: uuid })).min(1).max(100),
}).superRefine((value, ctx) => {
  if (new Set(value.records.map(row => row.enrollmentId)).size !== value.records.length)
    ctx.addIssue({ code: 'custom', message: 'Matrícula repetida' });
});
