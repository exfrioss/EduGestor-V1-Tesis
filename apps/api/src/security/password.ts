import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;
const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

const scrypt = (password: string, salt: Buffer): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      KEY_LENGTH,
      { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P },
      (error, derivedKey) => (error === null ? resolve(derivedKey) : reject(error)),
    );
  });

export const hashPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(16);
  const derivedKey = await scrypt(password, salt);
  return `scrypt$N=${SCRYPT_N},r=${SCRYPT_R},p=${SCRYPT_P}$${salt.toString('base64')}$${derivedKey.toString('base64')}`;
};

export const verifyPassword = async (password: string, encodedHash: string): Promise<boolean> => {
  const [algorithm, parameters, saltEncoded, hashEncoded] = encodedHash.split('$');
  if (
    algorithm !== 'scrypt' ||
    parameters !== `N=${SCRYPT_N},r=${SCRYPT_R},p=${SCRYPT_P}` ||
    saltEncoded === undefined ||
    hashEncoded === undefined
  ) {
    return false;
  }

  const expected = Buffer.from(hashEncoded, 'base64');
  const actual = await scrypt(password, Buffer.from(saltEncoded, 'base64'));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
};
