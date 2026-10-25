import type { DataSource } from 'typeorm';

let migrationsExecuted = false;

export async function ensureDatabaseMigrations(dataSource: DataSource): Promise<void> {
  if (migrationsExecuted) {
    return;
  }

  // transaction: 'each' — cada migration na sua própria transação, em vez de todas numa só
  // ('all', default). Necessário para as migrations que setam `transaction = false` (ex.:
  // CREATE INDEX CONCURRENTLY), que o TypeORM proíbe sob o modo global 'all'
  // (ForbiddenTransactionModeOverrideError). Mesmo modo do script de produção
  // (apps/api/scripts/run-migrations.js).
  await dataSource.runMigrations({ transaction: 'each' });
  migrationsExecuted = true;
}
