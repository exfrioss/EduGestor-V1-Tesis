import { describe, expect, it } from 'vitest';
import { loadEnvironment } from './config.js';

describe('loadEnvironment', () => {
  it('valida y normaliza los orígenes CORS', () => {
    const result = loadEnvironment({
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/database',
      CORS_ALLOWED_ORIGINS: 'http://localhost:5173, https://edugestor.example',
    });

    expect(result.corsAllowedOrigins).toEqual([
      'http://localhost:5173',
      'https://edugestor.example',
    ]);
  });
});
