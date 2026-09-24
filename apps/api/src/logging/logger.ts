import pino, { type LevelWithSilent } from 'pino';

export const createLogger = (level: LevelWithSilent) => pino({
  level,
  redact: {
    paths: [
      'password',
      '*.password',
      'passwordHash',
      '*.passwordHash',
      'token',
      '*.token',
      'tokenHash',
      '*.tokenHash',
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers.set-cookie',
    ],
    censor: '[REDACTED]',
  },
});

export const logger = createLogger(process.env.NODE_ENV === 'test' ? 'silent' : 'info');
