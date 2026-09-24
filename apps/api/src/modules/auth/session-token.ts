import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const createOpaqueSessionToken = (): string => randomBytes(32).toString('base64url');

export const hashSessionToken = (token: string): string =>
  createHash('sha256').update(token, 'utf8').digest('hex');

export const createCsrfToken = (): string => randomBytes(32).toString('base64url');

export const tokensMatch = (first: string, second: string): boolean => {
  const firstBuffer = Buffer.from(first, 'utf8');
  const secondBuffer = Buffer.from(second, 'utf8');
  return firstBuffer.length === secondBuffer.length && timingSafeEqual(firstBuffer, secondBuffer);
};
