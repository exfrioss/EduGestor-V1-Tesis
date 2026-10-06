import { z } from 'zod';

export const uuid = z.string().uuid();
const name = z.string().trim().min(1).max(200);
const nationalId = z.string().max(100).nullable().optional();
export const createStudent = z.strictObject({ givenNames: name, familyNames: name, nationalId, academicYearId: uuid });
export const createEnrollment = z.strictObject({ studentId: uuid, academicYearId: uuid });
export const patchStudent = z.strictObject({
  givenNames: name.optional(), familyNames: name.optional(), nationalId,
  expectedVersion: z.number().int().positive(),
}).refine(({ givenNames, familyNames, nationalId }) => givenNames !== undefined || familyNames !== undefined || nationalId !== undefined);
export const patchActivation = z.strictObject({ isActive: z.boolean(), expectedVersion: z.number().int().positive() });
const pagination = { limit: z.coerce.number().int().min(1).max(100).default(25), cursor: z.string().optional() };
export const pageQuery = z.strictObject(pagination);
export const listQuery = z.strictObject({ q: z.string().trim().max(200).optional(), courseId: uuid.optional(), ...pagination });
export const historyQuery = z.strictObject({ courseId: uuid.optional(), ...pagination });
export const detailQuery = z.strictObject({ courseId: uuid.optional() });
