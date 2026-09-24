import { describe, expect, it } from 'vitest';
import { healthResponseSchema } from './index.js';

describe('healthResponseSchema', () => {
  it('acepta el contrato de salud de infraestructura', () => {
    expect(healthResponseSchema.parse({ status: 'ok', database: 'available' })).toEqual({
      status: 'ok',
      database: 'available',
    });
  });
});
