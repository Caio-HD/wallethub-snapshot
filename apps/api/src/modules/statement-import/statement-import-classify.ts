import type { ParsedStatementRow } from './statement-import.types.js';

/**
 * Classe de roteamento de uma linha de extrato no commit do import. Decide se a linha é um
 * gasto/renda normal, uma transferência neutra (pagamento de fatura) ou um movimento de
 * investimento de renda fixa (aplicação/resgate RDB). Ver ADR adr-transfer-type-and-fixed-income.
 *
 * Conservador por design: só reclassifica padrões inequívocos do extrato (Nubank: "Aplicação RDB",
 * "Resgate RDB", "Pagamento de fatura"). Pix/TED a pessoas permanecem 'normal' (gasto/renda real).
 */
export type StatementRowClass =
  { kind: 'normal' } | { kind: 'investment'; movement: 'buy' | 'sell' }; // RDB aplicação/resgate

const RE_RDB_APLICACAO = /aplica[cç][aã]o\s+rdb/i;
const RE_RDB_RESGATE = /resgate\s+rdb/i;
const RE_CARD_PAYMENT = /pagamento\s+de\s+fatura/i;

export function classifyStatementRow(
  row: Pick<ParsedStatementRow, 'description' | 'amountSign'>,
): StatementRowClass {
  const desc = row.description ?? '';

  // Aplicação RDB = dinheiro saindo da conta para o investimento (aporte).
  if (RE_RDB_APLICACAO.test(desc) && row.amountSign < 0) {
    return { kind: 'investment', movement: 'buy' };
  }
  // Resgate RDB = dinheiro voltando do investimento para a conta.
  if (RE_RDB_RESGATE.test(desc) && row.amountSign > 0) {
    return { kind: 'investment', movement: 'sell' };
  }
  // Pagamento de fatura = dinheiro SAINDO da conta corrente para pagar o cartão. Como o cartão
  // não é conta rastreada aqui, é consumo real: como 'transfer' sumiria dos totais e o painel
  // subestimaria o gasto em ~R$ 2.400/mês. Cai no caminho 'normal' (despesa).
  if (RE_CARD_PAYMENT.test(desc) && row.amountSign < 0) {
    return { kind: 'normal' };
  }
  return { kind: 'normal' };
}
