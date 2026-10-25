/**
 * Verifica que as dependências de runtime usadas no bootstrap da API estão resolvíveis.
 * Executado no container antes de start:dev para falhar em segundos se algo faltar.
 */
const deps = [
  { name: 'class-validator', required: true },
  { name: 'class-transformer', required: true },
  { name: '@nestjs/platform-express', required: true },
  { name: '@nestjs/core', required: true },
  { name: 'reflect-metadata', required: true },
  { name: 'typeorm', required: true },
  { name: 'ioredis', required: true },
  { name: 'bullmq', required: true },
  { name: 'nestjs-pino', required: true },
  { name: '@willsoto/nestjs-prometheus', required: true },
];

let failed = false;
for (const { name, required } of deps) {
  try {
    require.resolve(name);
  } catch (e) {
    console.error(`[check-runtime-deps] Pacote não encontrado: ${name}`);
    if (required) failed = true;
  }
}
if (failed) {
  console.error(
    '[check-runtime-deps] Garanta NODE_PATH e que npm install foi executado na raiz do repo.'
  );
  process.exit(1);
}
