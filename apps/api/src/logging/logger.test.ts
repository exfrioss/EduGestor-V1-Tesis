import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { createLogger } from './logger.js';

describe('redacción de logs estructurados', () => {
  it('oculta confirmationToken, HMAC y tokens de sesión/CSRF', () => {
    let output = '';
    const destination = new Writable({ write(chunk, _encoding, callback) { output += String(chunk); callback(); } });
    const logger = createLogger('info', destination);
    const secrets = {
      confirmationToken: 'fixture-confirmation-token-123',
      hmac: 'fixture-hmac-secret-456',
      session: 'fixture-session-token-789',
      csrf: 'fixture-csrf-token-012',
    };
    logger.info({
      confirmationToken: secrets.confirmationToken,
      config: { CONFIRMATION_HMAC_KEYS: `{"test":"${secrets.hmac}"}`, confirmationKeys: { test: secrets.hmac } },
      request: { body: { confirmationToken: secrets.confirmationToken, sessionToken: secrets.session, csrfToken: secrets.csrf } },
      req: { headers: { cookie: secrets.session, authorization: secrets.csrf } },
    }, 'redaction fixture');
    for (const secret of Object.values(secrets)) expect(output).not.toContain(secret);
    expect(output).toContain('[REDACTED]');
  });
});
