import { DataSource } from 'typeorm';
import { resolve } from 'path';

// Variáveis de ambiente devem ser configuradas antes de executar este arquivo
// (via CLI ou sistema de ambiente)

// Obtém valores das variáveis de ambiente com fallbacks
const getDatabaseConfig = () => {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (databaseUrl) {
    return {
      url: databaseUrl,
      type: 'postgres' as const,
    };
  }

  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432;
  const username = process.env.DB_USER || 'wallethub';
  const password = process.env.DB_PASSWORD || 'wallethub';
  const database = process.env.DB_NAME || 'wallethub';
  const ssl = process.env.DB_SSL === 'true';

  return {
    type: 'postgres' as const,
    host,
    port,
    username,
    password,
    database,
    ssl: ssl
      ? {
          rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
        }
      : false,
  };
};

export default new DataSource({
  ...getDatabaseConfig(),
  synchronize: false,
  logging: process.env.TYPEORM_LOGGING === 'true',
  entities: [resolve(__dirname, 'src', 'database', 'entities', '*.entity.{js,ts}')],
  migrations: [resolve(__dirname, 'src', 'database', 'migrations', '*.{js,ts}')],
  migrationsTableName: 'migrations',
});

