import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { parseHito1DemoEnvironment } from './bootstrap-hito1-demo.js';

const generatedPassword = `test-${randomUUID()}`;
const validEnvironment = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://user:password@localhost:5432/database',
  HITO1_DEMO_TECHNICAL_LOGIN: 'technical.demo',
  HITO1_DEMO_ADMIN_LOGIN: 'admin.demo',
  HITO1_DEMO_ADMIN_PASSWORD: generatedPassword,
  HITO1_DEMO_TEACHER_ONE_LOGIN: 'teacher.one.demo',
  HITO1_DEMO_TEACHER_ONE_PASSWORD: generatedPassword,
  HITO1_DEMO_TEACHER_TWO_LOGIN: 'teacher.two.demo',
  HITO1_DEMO_TEACHER_TWO_PASSWORD: generatedPassword,
};

describe('configuración del bootstrap de demostración', () => {
  it('rechaza de forma explícita el entorno productivo', () => {
    expect(() => parseHito1DemoEnvironment({ ...validEnvironment, NODE_ENV: 'production' })).toThrow();
  });

  it('exige credenciales distintas y contraseñas suministradas por entorno', () => {
    expect(() => parseHito1DemoEnvironment({ ...validEnvironment, HITO1_DEMO_ADMIN_PASSWORD: '' })).toThrow();
    expect(() => parseHito1DemoEnvironment({ ...validEnvironment, HITO1_DEMO_ADMIN_LOGIN: 'technical.demo' })).toThrow(/distintos/);
  });
});
