/** Separadores de milhares (pt-BR) na parte inteira. */
function addThousandDots(digits: string): string {
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Converte texto monetário pt-BR (milhares com `.`, decimais com `,`) em número.
 * Ex.: "1.234,56" → 1234.56; "10,5" → 10.5
 */
export function parseBrlMoneyInput(s: string): number {
  const t = s.trim();
  if (!t) return Number.NaN;
  const noThousands = t.replace(/\./g, '');
  const normalized = noThousands.replace(',', '.');
  const n = Number(normalized);
  return n;
}

/** Valor inicial no campo a partir de um número (ex.: vindo da API). */
export function formatNumberToBrlInput(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0,00';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Formata enquanto o utilizador digita ou cola (pt-BR).
 * Mantém no máximo uma vírgula decimal e 2 casas após ela.
 */
export function formatBrlMoneyTyping(raw: string): string {
  const cleaned = raw.replace(/[^\d.,]/g, '');
  const lastComma = cleaned.lastIndexOf(',');
  let intRaw: string;
  let decRaw: string;
  if (lastComma >= 0) {
    intRaw = cleaned.slice(0, lastComma).replace(/\D/g, '');
    decRaw = cleaned.slice(lastComma + 1).replace(/\D/g, '').slice(0, 2);
  } else {
    intRaw = cleaned.replace(/\D/g, '');
    decRaw = '';
  }

  let intDigits = intRaw;
  if (intDigits.length > 1) {
    intDigits = intDigits.replace(/^0+/, '') || '0';
  }

  const intFormatted = intDigits ? addThousandDots(intDigits) : '';

  if (lastComma >= 0) {
    return intFormatted + ',' + decRaw;
  }
  return intFormatted;
}
