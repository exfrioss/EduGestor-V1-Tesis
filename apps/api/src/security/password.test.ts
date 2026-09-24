import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

describe('password hashing', () => {
  it('usa salt aleatoria y verifica sin almacenar texto plano', async () => {
    const password = 'Una clave de prueba 2026!';
    const first = await hashPassword(password);
    const second = await hashPassword(password);

    expect(first).not.toBe(second);
    expect(first).not.toContain(password);
    await expect(verifyPassword(password, first)).resolves.toBe(true);
    await expect(verifyPassword('incorrecta', first)).resolves.toBe(false);
  });
});
