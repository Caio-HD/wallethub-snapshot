# ADR: Tipo `transfer` (movimento neutro) + integração de renda fixa com o caixa

- **Status:** Accepted (foundation) — implementação faseada em PRs.
- **Data:** 2026-06-27
- **Contexto NexusCore:** `wallethub/transaction-totals` (knowledge `344ad627`).

## Contexto

A importação de extrato de conta-corrente (Nubank OFX, 1234 transações jan/2025–jun/2026)
ficou *correta no banco* (direção entrada/saída por sinal), mas os **totais do dashboard
ficaram distorcidos** e o **saldo não bate** com o banco. Investigação (sem bug de cálculo —
dashboard e saldo replicam o DB exatamente) revelou duas causas de **modelagem**, não de código:

1. **Saldo divergente:** a conta não tem saldo de abertura. O WalletHub calcula o saldo só
   pela movimentação importada (−R$ 10.741,07), enquanto o banco mostra `saldo_inicial +
   movimentação` (LEDGERBAL real em 23/06/2026 = R$ 602,40). Falta uma abertura de +R$ 11.343,47.

2. **Despesa ≈ dobro das receitas:** movimentações que **não são gasto/renda** entram como
   `expense`/`income` porque o modelo só tem `income | expense`. No extrato Nubank:
   - **Aplicação RDB** R$ 60.893 (saída) / **Resgate RDB** R$ 52.048 (entrada) → investimento (renda fixa).
   - **Pagamento de fatura** R$ 34.647 → transferência para quitar o cartão.
   - **Pix/TED entre contas próprias** → transferência.

   Tirando só os investimentos, receita e despesa se equilibram (~R$ 182k cada).

## Decisão

### 1. Tipo `transfer` (movimento neutro) para transações

- Adicionar o valor `transfer` ao enum `transaction_direction_enum`.
- Uma transferência é gravada como **pernas (legs)** com `transfer_group_id` (uuid) comum e
  `transfer_leg` (`out` | `in`) para o saldo manter o sinal correto.
- **Dois sub-casos:**
  - **Entre duas contas próprias rastreadas:** 2 legs — `out` na origem (saldo −), `in` no
    destino (saldo +). Soma zero entre contas; fora de receita/despesa.
  - **Para destino não rastreado** (ex.: pagamento de fatura quando o cartão não é conta no
    WalletHub; abertura de saldo): **leg único** `direction='transfer'`, afeta o saldo da
    conta mas **sai dos totais**.
- **Invariante:** legs `transfer` afetam **saldo de conta**, nunca **totais de receita/despesa**.
  Toda agregação que soma por direção deve **excluir `transfer`** explicitamente.

### 2. Saldo de abertura como lançamento neutro

O ajuste de saldo de abertura passa a ser um `transfer` leg único (neutro), e **não** uma
receita/despesa — senão re-infla o dashboard. Substitui o comportamento atual de
`AccountsService` (que cria ajuste income/expense por sinal).

### 3. Renda fixa integrada ao caixa (investimentos = "a mesma coisa")

O módulo de investimentos atual é de renda variável (ticker/cotação: stock/fii/etf) e **não**
se liga a conta de caixa. Decisão: **estender** o módulo, não criar conceito paralelo.

- Novo `kind = fixed_income` em `investment_instrument_kind_enum` (sem ticker/cotação; saldo
  por aporte/resgate + rendimento lançado).
- Vínculo **investimento ↔ caixa**: `investment_movements.account_id` (conta de origem/destino
  do dinheiro). Um **aporte** (`buy`) debita a conta de caixa via um `transfer` leg `out`;
  um **resgate** (`sell`) credita via `transfer` leg `in`. Rendimento (`dividend`/juros) é
  receita real (não neutro).
- Aplicação/Resgate RDB do extrato passam a alimentar este caminho, não viram transfer genérico.

## Consequências

- Migrations de enum (`ADD VALUE`) são **irreversíveis** em Postgres (`down` no-op documentado),
  e rodam **fora de transação** (`public transaction = false`) quando o valor é usado na mesma
  migration.
- Todas as agregações por direção precisam de `direction <> 'transfer'`: `DashboardService`
  (getSummary, getCategoriesReport, getEvolutionReport, getExportCsv), `AccountsService`
  (saldo, com sinal por leg), `ProjectionsProcessor`, `MonthlyCashflowForecastService`,
  `BudgetsService` (já filtra `expense` — verificar).
- `TransactionsService.create/update/remove` precisam tratar legs pareados de forma consistente
  (criar/editar/remover ambos juntos) e o loop de aprendizado desc→categoria deve **pular** transfers.

## Roadmap (PRs atômicos, sem merge direto, CI verde, testes cobrindo, changelog por PR)

- **PR 1 (este):** fundação de schema/model do `transfer` (enum + colunas `transfer_group_id`/
  `transfer_leg` + entity + ADR/roadmap). Sem comportamento novo.
- **PR 2:** API de transferências — `createTransfer` pareado/único, update/delete consistentes,
  DTO/controller, **exclusão de `transfer` em todas as agregações**, saldo por sinal do leg. Testes.
- **PR 3:** investimentos renda fixa + vínculo caixa — `fixed_income`, `investment_movements.account_id`,
  aporte/resgate ligando movimento ↔ `transfer` leg de caixa, rendimento. Testes.
- **PR 4:** Web UI — modo "Transferência" no `TransactionForm`, renda fixa na tela de
  investimentos, visuais de transfer na tabela.
- **PR 5:** detecção no import (RDB → investimento; fatura/Pix interno → transfer) + script
  idempotente de reclassificação do import Nubank existente + saldo de abertura neutro +
  fidelidade dos movimentos (~R$ 536 de drift vs ledger). Testes.

## Alternativas descartadas

- **Flag `is_excluded_from_totals` na categoria:** mais simples, mas não concilia origem/destino
  nem integra investimentos; o usuário pediu integração real com a tela de investimentos.
- **RDB como transfer genérico de leg único:** perde o rastreio de patrimônio investido que o
  módulo de investimentos já oferece.
