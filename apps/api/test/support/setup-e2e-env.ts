import './setup-env';

/** Postgres/Redis do `ops/ci/docker-compose.ci.yml` após `wallethub dev up` (portas no host). */
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgres://wallethub:wallethub@127.0.0.1:55432/wallethub';
}
if (!process.env.REDIS_URL) {
  process.env.REDIS_URL = 'redis://127.0.0.1:56379';
}

// Throttler desligado por padrão nos e2e (muitos logins/requests do mesmo IP em runInBand fariam
// 429). O teste de rate limiting reativa pontualmente via THROTTLER_DISABLED='false'.
if (!process.env.THROTTLER_DISABLED) {
  process.env.THROTTLER_DISABLED = 'true';
}
