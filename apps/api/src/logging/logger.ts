import pino, { type DestinationStream, type LevelWithSilent } from 'pino';

const secretFields = [
  'password', 'passwordHash', 'token', 'tokenHash', 'sessionToken', 'csrfToken',
  'confirmationToken', 'confirmationKeys', 'confirmationKey', 'confirmationHmacKeys',
  'confirmationHmacKey', 'confirmationSecret', 'hmacKey', 'hmacSecret',
  'CONFIRMATION_HMAC_KEYS', 'CONFIRMATION_HMAC_KEY', 'CONFIRMATION_SECRET',
];
const secretPaths = ['', '*.', '*.*.', '*.*.*.', '*.*.*.*.'].flatMap(prefix => secretFields.map(field => `${prefix}${field}`));

export const createLogger = (level: LevelWithSilent, destination?: DestinationStream) => pino({
  level,
  redact: {
    paths: [
      ...secretPaths,
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers.set-cookie',
    ],
    censor: '[REDACTED]',
  },
}, destination);

export const logger = createLogger(process.env.NODE_ENV === 'test' ? 'silent' : 'info');
