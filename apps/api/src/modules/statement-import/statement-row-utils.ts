import { createHash } from 'crypto';
import type { ParsedStatementRow } from './statement-import.types.js';

/**
 * Normalized description key for the persistent description→category mapping.
 * Lowercase, strips accents, drops digits/punctuation runs, collapses spaces and
 * caps at 200 chars — so "PIX ENVIADO 12/05 JOAO" and "Pix enviado 99/99 joao"
 * map to the same merchant key. Returns '' when nothing meaningful remains.
 */
export function normalizeDescriptionKey(description: string | undefined): string {
  if (!description) return '';
  return description
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[0-9]+/g, ' ')
    .replace(/[^a-z\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

/** Signed amount key in integer cents — used for reconciliation matching. */
export function amountKeyFromRow(row: ParsedStatementRow): number {
  return Math.round(row.amount * 100) * row.amountSign;
}

/** Normalize FITID for storage (truncate or sha1-prefix when >255 or non-ASCII). */
export function normalizeExternalId(fitid: string | undefined): string | undefined {
  if (!fitid) return undefined;
  const trimmed = fitid.trim();
  if (!trimmed) return undefined;
  if (trimmed.length <= 255 && /^[\x20-\x7E]+$/.test(trimmed)) {
    return trimmed;
  }
  const hash = createHash('sha1').update(trimmed).digest('hex');
  return `sha1:${hash}`.slice(0, 255);
}

/**
 * Synthetic external_id for rows without a FITID (CSV). Deterministic over
 * (date, signed amount, description) so reimporting the same file reproduces the
 * same ids and the unique partial index (account_id, external_id) blocks dupes.
 * `occurrence` distinguishes genuinely-identical lines within the same file
 * (k-th occurrence), preserving them while keeping reimport idempotent.
 */
export function syntheticExternalId(row: ParsedStatementRow, occurrence: number): string {
  const signedAmount = (row.amount * row.amountSign).toFixed(2);
  const desc = row.description.slice(0, 160);
  const hash = createHash('sha1').update(`${row.occurredAt}|${signedAmount}|${desc}`).digest('hex');
  return `csv:${hash}#${occurrence}`;
}

/** Stable row key for skipKeys — survives independent re-parses of the same file. */
export function buildStableRowKey(row: ParsedStatementRow): string {
  const signedAmount = (row.amount * row.amountSign).toFixed(2);
  const desc = row.description.slice(0, 160);
  if (row.fitid) {
    const ext = normalizeExternalId(row.fitid) ?? row.fitid.slice(0, 64);
    return `${ext}|${row.occurredAt}|${signedAmount}|${desc}`;
  }
  return `${row.occurredAt}|${signedAmount}|${desc}`;
}
