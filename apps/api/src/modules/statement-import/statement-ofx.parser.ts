import type {
  OFXBankInfo,
  OFXLedgerBalance,
  ParsedStatementRow,
} from './statement-import.types.js';

export type OFXParseResult = {
  rows: ParsedStatementRow[];
  bankInfo?: OFXBankInfo;
  ledgerBalance?: OFXLedgerBalance;
};

// Tipos de transação OFX que representam crédito (entrada de dinheiro)
const CREDIT_TRNTYPE = new Set([
  'CREDIT',
  'INT', // interesse/rendimento
  'DIV', // dividendo
  'DEP', // depósito
  'DIRECTDEP', // depósito direto
  'REFUND', // estorno a favor
  'ATMADJUSTMENT',
]);

/**
 * Decodifica o buffer considerando o campo CHARSET do cabeçalho OFX.
 * Bancos como Bradesco, Itaú e BB exportam em ISO-8859-1 / Windows-1252.
 */
function decodeOFXBuffer(buf: Buffer): string {
  // Ler primeiros 512 bytes como latin1 para inspecionar cabeçalho sem perder dados
  const header = buf.toString('latin1', 0, 512).toUpperCase();
  const charsetMatch = /CHARSET:\s*(\S+)/.exec(header);
  const charset = charsetMatch?.[1] ?? '';

  let encoding: string;
  if (/1252|WINDOWS/i.test(charset)) {
    encoding = 'windows-1252';
  } else if (/8859/i.test(charset)) {
    encoding = 'iso-8859-1';
  } else {
    encoding = 'utf-8';
  }

  try {
    return new TextDecoder(encoding).decode(buf);
  } catch {
    // Fallback: latin1 cobre todos os caracteres de bancos brasileiros na faixa 0xA0–0xFF
    return buf.toString('latin1');
  }
}

/**
 * Converte data OFX (YYYYMMDDHHMMSS[offset]) para yyyy-MM-dd.
 * Trunca para 8 dígitos para evitar problemas de fuso horário.
 */
function parseOFXDate(raw: string): string | null {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length < 8) return null;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

/**
 * Extrai o valor de uma tag OFX de um bloco de texto.
 * Funciona para OFX 1.x SGML (<TAG>valor) e OFX 2.x XML (<TAG>valor</TAG>).
 * Usa [^<]* (sem \r\n) para lidar com tags coladas: <NAME>Foo<MEMO>Bar.
 */
function extractTag(block: string, tag: string): string | undefined {
  const m = new RegExp(`<${tag}>([^<]*)`, 'i').exec(block);
  const val = m?.[1]?.trim();
  return val || undefined;
}

/**
 * Extrai blocos <STMTTRN>...</STMTTRN> usando indexOf+slice para evitar ReDoS.
 * Regex greedy sobre o arquivo inteiro é um vetor de ataque clássico com OFX malicioso.
 */
function extractTransactionBlocks(content: string): string[] {
  const blocks: string[] = [];
  let pos = 0;
  const openTag = '<STMTTRN>';
  const closeTag = '</STMTTRN>';

  while (true) {
    const start = content.indexOf(openTag, pos);
    if (start === -1) break;
    const end = content.indexOf(closeTag, start);
    if (end === -1) break;
    blocks.push(content.slice(start, end + closeTag.length));
    pos = end + closeTag.length;
  }

  return blocks;
}

/**
 * Extrai informações do bloco <BANKACCTFROM> (banco e conta).
 */
function extractBankInfo(content: string): OFXBankInfo | undefined {
  const start = content.indexOf('<BANKACCTFROM>');
  if (start === -1) return undefined;

  // Em SGML não há fechamento obrigatório — limitar a 512 chars para segurança
  const closeIdx = content.indexOf('</BANKACCTFROM>', start);
  const block =
    closeIdx !== -1 ? content.slice(start, closeIdx + 15) : content.slice(start, start + 512);

  const bankId = extractTag(block, 'BANKID');
  const branchId = extractTag(block, 'BRANCHID');
  const acctId = extractTag(block, 'ACCTID');

  if (!bankId && !branchId && !acctId) return undefined;
  return { bankId, branchId, acctId };
}

/**
 * Extrai o saldo de fechamento que o banco gravou no extrato (<LEDGERBAL>).
 * É o valor que o cliente vê no app do banco, e o único jeito de saber que a conta
 * já tinha saldo antes do primeiro extrato importado.
 */
function extractLedgerBalance(content: string): OFXLedgerBalance | undefined {
  const start = content.indexOf('<LEDGERBAL>');
  if (start === -1) return undefined;

  const closeIdx = content.indexOf('</LEDGERBAL>', start);
  const block =
    closeIdx !== -1 ? content.slice(start, closeIdx + 13) : content.slice(start, start + 512);

  const rawAmount = extractTag(block, 'BALAMT');
  if (!rawAmount) return undefined;
  const amount = parseFloat(rawAmount.replace(',', '.'));
  if (!Number.isFinite(amount)) return undefined;

  const rawDtAsOf = extractTag(block, 'DTASOF');
  const dtasof = rawDtAsOf ? (parseOFXDate(rawDtAsOf.slice(0, 8)) ?? undefined) : undefined;

  return { amount, dtasof };
}

/**
 * Chave de deduplicação para linhas OFX:
 * - Usa FITID se disponível (mais confiável: identificador único do banco)
 * - Caso contrário usa data|valor|descrição (mesmo critério do CSV)
 */
function rowKey(row: ParsedStatementRow): string {
  if (row.fitid) return `fitid:${row.fitid}`;
  return `${row.occurredAt}|${row.amount.toFixed(2)}|${row.description.slice(0, 160)}`;
}

/**
 * Parser de extratos OFX (Open Financial Exchange).
 *
 * Suporta:
 * - OFX 1.x SGML: cabeçalho em texto plano, tags sem fechamento nas folhas
 * - OFX 2.x XML: XML bem formado
 * - Encodings: UTF-8 (Inter, Nubank, C6), ISO-8859-1 / Windows-1252 (Bradesco, Itaú, BB)
 *
 * Retorna rows sempre com amount positivo; hint indica income/expense baseado em TRNTYPE.
 */
export function parseStatementOFX(buf: Buffer): OFXParseResult {
  const content = decodeOFXBuffer(buf);
  const blocks = extractTransactionBlocks(content);
  const bankInfo = extractBankInfo(content);

  const seen = new Set<string>();
  const rows: ParsedStatementRow[] = [];

  for (const block of blocks) {
    const dtposted = extractTag(block, 'DTPOSTED');
    const trnamt = extractTag(block, 'TRNAMT');
    const name = extractTag(block, 'NAME');
    const memo = extractTag(block, 'MEMO');
    const fitid = extractTag(block, 'FITID');
    const trntype = extractTag(block, 'TRNTYPE')?.toUpperCase();

    if (!dtposted || !trnamt) continue;

    const occurredAt = parseOFXDate(dtposted);
    if (!occurredAt) continue;

    const raw = parseFloat(trnamt.replace(',', '.'));
    if (!Number.isFinite(raw)) continue;

    const amount = Math.abs(raw);
    if (amount <= 0) continue; // ignora zeros e estornos nulos
    const amountSign: 1 | -1 = raw < 0 ? -1 : 1;

    // Preferir NAME, depois MEMO, depois FITID como fallback mínimo
    const rawDesc = name ?? memo ?? fitid ?? 'Importação OFX';
    // Decodificar entidades HTML básicas (&amp; &lt; etc.)
    const description = rawDesc
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&apos;/gi, "'")
      .slice(0, 240);

    const hint: ParsedStatementRow['hint'] = trntype
      ? CREDIT_TRNTYPE.has(trntype)
        ? 'income'
        : 'expense'
      : undefined;

    const row: ParsedStatementRow = {
      occurredAt,
      amount,
      amountSign,
      description,
      fitid,
      hint,
    };

    const key = rowKey(row);
    if (seen.has(key)) continue;
    seen.add(key);

    rows.push(row);
  }

  return { rows, bankInfo, ledgerBalance: extractLedgerBalance(content) };
}
