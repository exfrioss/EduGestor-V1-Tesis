import pino, { type DestinationStream, type LevelWithSilent } from 'pino';

export const createLogger = (level: LevelWithSilent, destination?: DestinationStream) => pino({
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
}, destination);

export const logger = createLogger(process.env.NODE_ENV === 'test' ? 'silent' : 'info');
