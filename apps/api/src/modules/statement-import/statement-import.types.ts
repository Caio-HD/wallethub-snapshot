/** Linha normalizada produzida por qualquer parser de extrato (CSV ou OFX). */
export type ParsedStatementRow = {
  occurredAt: string; // ISO date yyyy-MM-dd
  amount: number; // magnitude positiva (Math.abs no parser)
  amountSign: 1 | -1; // sinal canônico para conciliação (TRNAMT ou coluna CSV)
  description: string;
  fitid?: string; // OFX: Financial Institution Transaction ID (deduplicação)
  hint?: 'income' | 'expense'; // OFX: derivado de <TRNTYPE>; undefined para CSV
};

/** Metadados da conta bancária extraídos do bloco <BANKACCTFROM> do OFX. */
export type OFXBankInfo = {
  bankId?: string; // código COMPE do banco (ex: '237' = Bradesco, '341' = Itaú)
  branchId?: string; // agência (OFX BRANCHID)
  acctId?: string; // número da conta
};

/** Saldo de fechamento que o banco gravou no extrato (<LEDGERBAL>). */
export type OFXLedgerBalance = {
  amount: number; // saldo do banco na data do extrato
  dtasof?: string; // data do saldo (ISO yyyy-MM-dd)
};
