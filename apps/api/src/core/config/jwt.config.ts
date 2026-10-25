import { registerAs } from '@nestjs/config';

export const jwtConfig = registerAs('jwt', () => ({
  issuer: 'wallethub',
  audience: 'wallethub-admins',
  accessTokenTtl: process.env.JWT_ACCESS_TTL ?? '900s',
  refreshTokenTtl: process.env.JWT_REFRESH_TTL ?? '86400s',
  privateKey: process.env.JWT_PRIVATE_KEY?.replace(/\\n/g, '\n') ?? '',
  publicKey: process.env.JWT_PUBLIC_KEY?.replace(/\\n/g, '\n') ?? '',
}));
