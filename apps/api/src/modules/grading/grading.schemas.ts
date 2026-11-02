import { z } from 'zod';
import { points, uuid } from '../activities/activities.schemas.js';

export { uuid };
export const page = z.strictObject({ limit: z.coerce.number().int().min(1).max(100).default(25), cursor: z.string().optional() });
const definition = { minimumGrade: z.unknown(), maximumGrade: z.unknown(), conversionDefinition: z.unknown(), roundingDefinition: z.unknown() };
export const create = z.strictObject({ name: z.string().trim().min(1).max(200), version: z.literal(1), ...definition });
export const version = z.strictObject({ version: z.number().int().positive(), expectedVersion: z.number().int().positive(), ...definition });
export const scaleChange = z.strictObject({ newGradingScaleId: uuid.nullable(), expectedAssignmentVersion: z.number().int().positive() });
export const scaleConfirm = scaleChange.extend({ confirmationToken: z.string().min(1) });
export const maxChange = z.strictObject({ newMaxPoints: points, expectedVersion: z.number().int().positive() });
export const maxConfirm = maxChange.extend({ confirmationToken: z.string().optional() });
