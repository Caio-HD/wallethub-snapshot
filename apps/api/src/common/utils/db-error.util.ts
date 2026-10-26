import { QueryFailedError } from 'typeorm';

type PgError = QueryFailedError & {
  code?: string;
  constraint?: string;
  driverError?: { code?: string; constraint?: string };
};

/** Postgres unique-violation (SQLSTATE 23505), agnóstico ao driver. */
export function isUniqueViolation(err: unknown): boolean {
  if (!(err instanceof QueryFailedError)) return false;
  const qe = err as PgError;
  return qe.code === '23505' || qe.driverError?.code === '23505';
}

/**
 * Nome da constraint (índice único) violada, quando disponível — permite
 * ramificar a recuperação por qual unicidade colidiu (identidade vs nome).
 */
export function violatedConstraint(err: unknown): string | undefined {
  if (!(err instanceof QueryFailedError)) return undefined;
  const qe = err as PgError;
  return qe.constraint ?? qe.driverError?.constraint;
}
