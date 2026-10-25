import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const databaseConfig = registerAs('database', (): TypeOrmModuleOptions => {
  const isTest = process.env.NODE_ENV === 'test';

  return {
    type: 'postgres',
    url: process.env.DATABASE_URL,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : undefined,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    logging: process.env.TYPEORM_LOGGING === 'true',
    ssl:
      process.env.DB_SSL === 'true'
        ? {
            rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
          }
        : false,
    synchronize: process.env.TYPEORM_SYNCHRONIZE === 'true',
    autoLoadEntities: !isTest,
    migrationsRun: process.env.TYPEORM_MIGRATIONS_RUN === 'true',
    entities: isTest ? ['src/**/*.entity.ts'] : ['dist/**/*.entity{.ts,.js}'],
    migrations: isTest ? ['src/database/migrations/*.ts'] : ['dist/src/database/migrations/*.js'],
    subscribers: isTest ? ['src/**/*.subscriber.ts'] : ['dist/**/*.subscriber{.ts,.js}'],
  };
});
