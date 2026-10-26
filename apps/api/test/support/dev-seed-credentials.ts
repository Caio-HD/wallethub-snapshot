/**
 * Credenciais e hashes bcrypt alinhados a `ops/dev/seeds/base.sql`.
 * Fonte única para testes e2e e verificação de consistência da seed.
 */
export const DEV_SEED_LOGIN_USERS = [
  {
    username: 'rick',
    password: 'rickadmin',
    passwordHash: '$2b$10$Q8ptUBolbMytBdOyQycgxuvKvzOgEivKChVr1/o7jvyysSY.3Zzhu',
    email: 'rick@wallethub.local',
    name: 'Rick',
    phoneNumber: '+5511988887777',
  },
  {
    username: 'nya',
    password: 'nyadmin',
    passwordHash: '$2b$10$1lcP1rRIM8Fh0GotjOaAsu28djcSN.K9mRGaigB1NmwDvaK853Rby',
    email: 'nya@wallethub.local',
    name: 'Nya',
    phoneNumber: '+5511977776666',
  },
] as const;
