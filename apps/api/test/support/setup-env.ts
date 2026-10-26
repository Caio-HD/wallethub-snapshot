import { generateKeyPairSync } from 'node:crypto';

// Throwaway key pair generated per test run, so no key material lives in the repository.
const { privateKey: TEST_PRIVATE_KEY, publicKey: TEST_PUBLIC_KEY } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
});

export const ensureTestJwtKeys = (): void => {
  process.env.JWT_PRIVATE_KEY = TEST_PRIVATE_KEY;
  process.env.JWT_PUBLIC_KEY = TEST_PUBLIC_KEY;
};

ensureTestJwtKeys();

if (!process.env.JWT_ACCESS_TTL) {
  process.env.JWT_ACCESS_TTL = '900s';
}

if (!process.env.JWT_REFRESH_TTL) {
  process.env.JWT_REFRESH_TTL = '86400s';
}

if (!process.env.API_PREFIX) {
  process.env.API_PREFIX = 'api';
}

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test';
}

export { TEST_PRIVATE_KEY, TEST_PUBLIC_KEY };
