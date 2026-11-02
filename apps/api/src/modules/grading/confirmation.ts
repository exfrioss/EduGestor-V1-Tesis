import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { AuthConfig } from '../../config.js';
import { AppError } from '../../errors/app-error.js';

export type Purpose = 'TASK_MAX_CHANGE' | 'ASSESSMENT_MAX_CHANGE' | 'ASSIGNMENT_SCALE_CHANGE';
export interface ConfirmationPayload {
  contractVersion: 1;
  kid: string;
  purpose: Purpose;
  actorUserId: string;
  authSessionId: string;
  institutionId: string;
  assignmentId: string;
  resourceId: string;
  expectedAssignmentVersion: number;
  expectedResourceVersion: number;
  oldValue: string | null;
  newValue: string | null;
  contextDigest: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
}
const error = (code = 'INVALID_CONFIRMATION', status = 400) => new AppError(status, code, 'Confirmación inválida');
export const stableJson = (value: unknown): string => JSON.stringify(value, (_key, current: unknown) => current && typeof current === 'object' && !Array.isArray(current) ? Object.fromEntries(Object.entries(current).sort(([a], [b]) => a.localeCompare(b))) : current);
export const digest = (value: unknown) => createHash('sha256').update(stableJson(value)).digest('hex');

export function issueConfirmation(config: AuthConfig, input: Omit<ConfirmationPayload, 'contractVersion' | 'kid' | 'issuedAt' | 'expiresAt' | 'nonce'>) {
  const kid = config.confirmationActiveKid;
  const key = kid && config.confirmationKeys?.[kid];
  if (!kid || !key) throw new AppError(503, 'CONFIRMATION_UNAVAILABLE', 'Confirmación no configurada');
  const issuedAt = Date.now();
  const payload: ConfirmationPayload = { contractVersion: 1, kid, ...input, issuedAt, expiresAt: issuedAt + 300_000, nonce: randomBytes(16).toString('hex') };
  const body = Buffer.from(stableJson(payload)).toString('base64url');
  const signature = createHmac('sha256', key).update(stableJson(payload)).digest('base64url');
  return { confirmationToken: `${body}.${signature}`, expiresAt: new Date(payload.expiresAt).toISOString() };
}

export function verifyConfirmation(config: AuthConfig, token: string, expected: Omit<ConfirmationPayload, 'contractVersion' | 'kid' | 'issuedAt' | 'expiresAt' | 'nonce'>) {
  if (!/^[A-Za-z0-9_-]{1,8192}\.[A-Za-z0-9_-]{43}$/.test(token)) throw error();
  const [body, signature] = token.split('.');
  let payload: ConfirmationPayload;
  try { payload = JSON.parse(Buffer.from(body!, 'base64url').toString('utf8')) as ConfirmationPayload; } catch { throw error(); }
  if (!payload || typeof payload !== 'object' || payload.contractVersion !== 1 || typeof payload.kid !== 'string' || !/^[A-Za-z0-9_-]{1,32}$/.test(payload.kid)) throw error();
  const key = config.confirmationKeys?.[payload.kid];
  if (!key) throw error();
  const actual = Buffer.from(signature!, 'base64url');
  const signed = createHmac('sha256', key).update(Buffer.from(body!, 'base64url')).digest();
  if (actual.length !== signed.length || actual.toString('base64url') !== signature || !timingSafeEqual(actual, signed) || Buffer.from(stableJson(payload)).toString('base64url') !== body) throw error();
  if (typeof payload.expiresAt !== 'number' || typeof payload.issuedAt !== 'number' || payload.expiresAt - payload.issuedAt !== 300_000 || payload.issuedAt > Date.now() + 1000) throw error();
  if (payload.expiresAt < Date.now()) throw error('CONFIRMATION_EXPIRED', 409);
  const { contextDigest: _digest, ...rest } = expected;
  const { contextDigest: _signedDigest, contractVersion: _version, kid: _kid, issuedAt: _issued, expiresAt: _expires, nonce: _nonce, ...signedRest } = payload;
  if (stableJson(rest) !== stableJson(signedRest)) throw error();
  if (payload.contextDigest !== expected.contextDigest) throw error('STALE_PREVIEW', 409);
  return payload;
}
