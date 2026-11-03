import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AppError } from '../../errors/app-error.js';

const gradeString = z.string().regex(/^-?(?:0|[1-9][0-9]{0,11})(?:\.[0-9]{1,6})?$/);
const percentString = z.string().regex(/^(?:0|[1-9][0-9]{0,2})(?:\.[0-9]{1,6})?$/);
const canonical = (value: string) => !value.endsWith('0') || !value.includes('.') ? value !== '-0' : false;
const decimal = (value: string | Prisma.Decimal) => new Prisma.Decimal(value);
const band = z.strictObject({ fromPercent: percentString, grade: gradeString });
const conversion = z.strictObject({ schemaVersion: z.literal(1), kind: z.literal('PERCENTAGE_BANDS'), bands: z.array(band).min(1).max(256) });
const rounding = z.union([
  z.strictObject({ schemaVersion: z.literal(1), kind: z.literal('NONE') }),
  z.strictObject({ schemaVersion: z.literal(1), kind: z.literal('DECIMAL_PLACES'), mode: z.enum(['HALF_UP', 'HALF_EVEN', 'TOWARD_ZERO']), places: z.number().int().min(0).max(6) }),
]);
export type Conversion = z.infer<typeof conversion>;
export type Rounding = z.infer<typeof rounding>;
export type Definition = { minimumGrade: string; maximumGrade: string; conversionDefinition: Conversion; roundingDefinition: Rounding };
export const invalidScale = () => new AppError(422, 'INVALID_SCALE_DEFINITION', 'Definición de escala inválida');

export function validateDefinition(value: { minimumGrade: unknown; maximumGrade: unknown; conversionDefinition: unknown; roundingDefinition: unknown }): Definition {
  for (const jsonValue of [value.conversionDefinition, value.roundingDefinition]) {
    const serialized = JSON.stringify(jsonValue);
    if (serialized && Buffer.byteLength(serialized, 'utf8') > 16384) throw invalidScale();
  }
  const minimumGrade = gradeString.safeParse(value.minimumGrade);
  const maximumGrade = gradeString.safeParse(value.maximumGrade);
  const conversionDefinition = conversion.safeParse(value.conversionDefinition);
  const roundingDefinition = rounding.safeParse(value.roundingDefinition);
  if (!minimumGrade.success || !maximumGrade.success || !conversionDefinition.success || !roundingDefinition.success) throw invalidScale();
  const min = minimumGrade.data, max = maximumGrade.data, bands = conversionDefinition.data.bands;
  if (!canonical(min) || !canonical(max) || decimal(min).greaterThan(max)) throw invalidScale();
  if (bands[0]!.fromPercent !== '0') throw invalidScale();
  let previousPercent: Prisma.Decimal | null = null, previousGrade: Prisma.Decimal | null = null;
  for (const item of bands) {
    if (!canonical(item.fromPercent) || !canonical(item.grade)) throw invalidScale();
    const percent = decimal(item.fromPercent), grade = decimal(item.grade);
    if (percent.greaterThan(100) || previousPercent && !percent.greaterThan(previousPercent) || grade.lessThan(min) || grade.greaterThan(max) || previousGrade && grade.lessThan(previousGrade)) throw invalidScale();
    previousPercent = percent; previousGrade = grade;
  }
  return { minimumGrade: min, maximumGrade: max, conversionDefinition: conversionDefinition.data, roundingDefinition: roundingDefinition.data };
}

export function formalGrade(percentage: string, definition: Definition): string {
  const value = decimal(percentage);
  if (value.greaterThan(100)) return definition.maximumGrade;
  let grade = decimal(definition.conversionDefinition.bands[0]!.grade);
  for (const item of definition.conversionDefinition.bands) {
    if (value.lessThan(item.fromPercent)) break;
    grade = decimal(item.grade);
  }
  const round = definition.roundingDefinition;
  if (round.kind === 'DECIMAL_PLACES') grade = grade.toDecimalPlaces(round.places, round.mode === 'HALF_UP' ? Prisma.Decimal.ROUND_HALF_UP : round.mode === 'HALF_EVEN' ? Prisma.Decimal.ROUND_HALF_EVEN : Prisma.Decimal.ROUND_DOWN);
  return Prisma.Decimal.max(definition.minimumGrade, Prisma.Decimal.min(definition.maximumGrade, grade)).toString();
}
