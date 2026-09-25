import { createHash } from 'node:crypto';
import { AppError } from '../../errors/app-error.js';

const digest = (context: unknown) =>
  createHash('sha256').update(JSON.stringify(context)).digest('base64url');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const encodeCursor = (lastId: string, context: unknown): string =>
  Buffer.from(JSON.stringify({ v: 1, lastId, context: digest(context) })).toString('base64url');

export const decodeCursor = (cursor: string | undefined, context: unknown): string | undefined => {
  if (cursor === undefined) return undefined;
  try {
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as unknown;
    if (
      typeof value !== 'object' ||
      value === null ||
      !('v' in value) || value.v !== 1 ||
      !('lastId' in value) || typeof value.lastId !== 'string' || !uuid.test(value.lastId) ||
      !('context' in value) || value.context !== digest(context)
    ) throw new Error('invalid');
    return value.lastId;
  } catch {
    throw new AppError(400, 'VALIDATION_ERROR', 'Cursor inválido para esta consulta');
  }
};
