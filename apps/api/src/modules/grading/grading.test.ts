import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuthConfig } from '../../config.js';
import { digest, issueConfirmation, verifyConfirmation } from './confirmation.js';
import { formalGrade, validateDefinition } from './grading.definition.js';

const conversion = (bands: { fromPercent: string; grade: string }[]) => ({ schemaVersion: 1, kind: 'PERCENTAGE_BANDS', bands });
const def = (bands = [{ fromPercent: '0', grade: '1' }, { fromPercent: '60', grade: '3' }, { fromPercent: '90', grade: '5' }], roundingDefinition: unknown = { schemaVersion: 1, kind: 'NONE' }) => ({ minimumGrade: '1', maximumGrade: '5', conversionDefinition: conversion(bands), roundingDefinition });

describe('Hito 2B-2: escalas versionadas', () => {
  it('convierte bordes, trunca el porcentaje superior a 100 y respeta otra escala institucional', () => {
    const scale = validateDefinition(def());
    expect(formalGrade('59.999999', scale)).toBe('1');
    expect(formalGrade('60', scale)).toBe('3');
    expect(formalGrade('90', scale)).toBe('5');
    expect(formalGrade('115', scale)).toBe('5');
    const another = validateDefinition({ minimumGrade: '0', maximumGrade: '10', conversionDefinition: conversion([{ fromPercent: '0', grade: '0' }, { fromPercent: '75', grade: '8' }]), roundingDefinition: { schemaVersion: 1, kind: 'NONE' } });
    expect(formalGrade('80', another)).toBe('8');
    expect(formalGrade('101', another)).toBe('10');
  });
  it('valida contrato, orden, límites y representación decimal', () => {
    for (const bad of [
      def([{ fromPercent: '1', grade: '1' }]),
      def([{ fromPercent: '0', grade: '1' }, { fromPercent: '0', grade: '2' }]),
      def([{ fromPercent: '0', grade: '3' }, { fromPercent: '60', grade: '2' }]),
      def([{ fromPercent: '0.0', grade: '1' }]),
      def([{ fromPercent: '0', grade: '1.0' }]),
      def([{ fromPercent: '0', grade: '6' }]),
      def([{ fromPercent: '0', grade: '1' }, { fromPercent: '100.000001', grade: '2' }]),
      { ...def(), roundingDefinition: { schemaVersion: 1, kind: 'DECIMAL_PLACES', mode: 'HALF_UP', places: 7 } },
      { ...def(), conversionDefinition: { ...conversion([{ fromPercent: '0', grade: '1' }]), extra: true } },
      { ...def(), conversionDefinition: conversion(Array.from({ length: 257 }, (_, index) => ({ fromPercent: String(index), grade: '1' }))) },
    ]) expect(() => validateDefinition(bad)).toThrow();
  });
  it('redondea la nota de la banda con aritmética decimal', () => {
    for (const [mode, expected] of [['HALF_UP', '1.3'], ['HALF_EVEN', '1.2'], ['TOWARD_ZERO', '1.2']] as const) {
      const scale = validateDefinition(def([{ fromPercent: '0', grade: '1.25' }], { schemaVersion: 1, kind: 'DECIMAL_PLACES', mode, places: 1 }));
      expect(formalGrade('50', scale)).toBe(expected);
    }
  });
});

const config: AuthConfig = { sessionTtlMs: 1000, lastSeenIntervalMs: 1000, sessionCookieName: 'session', csrfCookieName: 'csrf', secureCookies: false, loginRateLimitWindowMs: 1000, loginRateLimitMaxAttempts: 1, confirmationActiveKid: 'k2', confirmationKeys: { k1: 'previous-secret-that-is-long-enough-0001', k2: 'current-secret-that-is-long-enough-00002' } };
const input = { purpose: 'TASK_MAX_CHANGE' as const, actorUserId: 'actor', authSessionId: 'session', institutionId: 'institution', assignmentId: 'assignment', resourceId: 'task', expectedAssignmentVersion: 1, expectedResourceVersion: 2, oldValue: '20', newValue: '15', contextDigest: digest({ results: [1, 2] }) };
describe('Hito 2B-2: confirmación HMAC', () => {
  afterEach(() => vi.useRealTimers());
  it('vincula actor, sesión, propósito, cambio y snapshot; detecta firma y vencimiento', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-01T00:00:00Z'));
    const { confirmationToken } = issueConfirmation(config, input);
    expect(verifyConfirmation(config, confirmationToken, input).nonce).toHaveLength(32);
    expect(() => verifyConfirmation(config, confirmationToken, { ...input, authSessionId: 'other' })).toThrow();
    expect(() => verifyConfirmation(config, confirmationToken, { ...input, contextDigest: digest({ results: [3] }) })).toThrow();
    expect(() => verifyConfirmation(config, confirmationToken, { ...input, expectedResourceVersion: 3 })).toThrow();
    expect(() => verifyConfirmation(config, `${confirmationToken.slice(0, -1)}x`, input)).toThrow();
    vi.advanceTimersByTime(300_001);
    expect(() => verifyConfirmation(config, confirmationToken, input)).toThrow();
  });
  it('permite rotar kid reteniendo la clave anterior durante el TTL', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-01T00:00:00Z'));
    const old = issueConfirmation({ ...config, confirmationActiveKid: 'k1' }, input);
    expect(verifyConfirmation(config, old.confirmationToken, input).kid).toBe('k1');
    expect(() => verifyConfirmation({ ...config, confirmationKeys: { k2: config.confirmationKeys!.k2! } }, old.confirmationToken, input)).toThrow();
  });
});
