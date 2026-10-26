import type { ParsedStatementRow } from './statement-import.types.js';

export type { ParsedStatementRow };

function parseAmount(raw: string): { amount: number; amountSign: 1 | -1 } | null {
  const t = raw.trim();
  if (!t) return null;
  let normalized = t;
  if (t.includes(',')) {
    normalized = t.replace(/\./g, '').replace(',', '.');
  } else {
    normalized = t.replace(/_/g, '');
  }
  const n = Number(normalized);
  if (!Number.isFinite(n) || n === 0) return null;
  if (n > 0 && t.startsWith('+')) {
    return { amount: n, amountSign: 1 };
  }
  // Sinal canônico: negativo = saída (débito), positivo = entrada (crédito).
  return { amount: Math.abs(n), amountSign: n < 0 ? -1 : 1 };
}

function parseDateIso(raw: string): string | null {
  const s = raw.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (iso) {
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (br) {
    return `${br[3]}-${br[2]}-${br[1]}`;
  }
  return null;
}

function rowKey(row: ParsedStatementRow): string {
  return `${row.occurredAt}|${row.amount.toFixed(2)}|${row.description.slice(0, 160)}`;
}

/**
 * CSV simples: uma linha por lançamento.
 * Formatos aceites: `yyyy-MM-dd,valor,descrição` ou `dd/MM/yyyy;valor;descrição` (valor com vírgula decimal).
 * Linhas começadas por `#` ou vazias são ignoradas. Cabeçalho opcional na primeira linha (contém "data" e "valor").
 */
export function parseStatementCsv(buffer: Buffer): ParsedStatementRow[] {
  const text = buffer.toString('utf-8').replace(/^\ufeff/, '');
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  if (lines.length === 0) {
    return [];
  }

  let start = 0;
  const first = lines[0].toLowerCase();
  if (first.includes('data') && (first.includes('valor') || first.includes('amount'))) {
    start = 1;
  }

  const out: ParsedStatementRow[] = [];
  const seen = new Set<string>();

  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    const sep = line.includes(';') && !line.match(/^\d{4}-\d{2}-\d{2},/) ? ';' : ',';
    const parts = line.split(sep).map((p) => p.trim());
    if (parts.length < 2) continue;

    const dateRaw = parts[0];
    const amountRaw = parts[1];
    const description =
      parts
        .slice(2)
        .join(sep === ';' ? ';' : ',')
        .trim() || 'Importação';

    const occurredAt = parseDateIso(dateRaw);
    const parsedAmount = parseAmount(amountRaw);
    if (!occurredAt || parsedAmount === null) continue;

    const row: ParsedStatementRow = {
      occurredAt,
      amount: parsedAmount.amount,
      amountSign: parsedAmount.amountSign,
      description,
    };
    const key = rowKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }

  return out;
}
