# ADR: Cadastro de dívidas parceladas (WalletHub MVP)

**Status:** Aceite  
**Data:** 2026-06-13

## Contexto

WalletHub não modela passivos. Workaround manual (conta + lançamentos + lembretes) não oferece cronograma nem saldo devedor confiável.

## Decisão

Introduzir módulo `debts` org-scoped, admin-only no web, com:

- Dívidas parceladas (`kind = installment`)
- Cronograma em `debt_installments`
- Pay integral / unpay / skip / pay-remaining
- Saldo **sempre derivado** na leitura
- Monetário: `numeric(12,2)` (igual transações)

## Precisão monetária

- PostgreSQL: `numeric(12, scale: 2)`
- API: number → `.toFixed(2)` antes de persistir
- Nunca float para dinheiro

## Tabela-verdade (v1)

| Acção | Pré-condição | Estado parcela | Transacção | Outstanding |
|-------|--------------|----------------|------------|-------------|
| Pay | `pending` | → `paid` | 1 expense | −amount |
| Pay valor ≠ amount | — | — | — | 400 |
| Unpay | `paid` | → `pending` | soft-delete | +amount |
| Skip | `pending` | → `skipped` | — | −amount |
| Pay-remaining | ≥1 pending | todas → `paid` | **N txs** | → 0 |

**Outstanding** = `SUM(amount) WHERE status = 'pending'`.

## Arredondamento

Parcelas 1..(n−1): `installment_amount` informado ou `floor2(principal / n)`.  
Parcela n: `principal − sum(parcelas 1..n−1)`.

## Pay-remaining

Uma transação por parcela pendente (constraint `UNIQUE(transaction_id)`).

## Fuso (alertas)

`resolveOrgTimezone(orgId)` → `settings.whatsapp_notification_preferences.dailyDigest.timezone` ?? `America/Sao_Paulo`.

## Fora do v1

- Pagamento parcial (v1.2 via split de parcela)
- Recorrente mensal (v1.1)
- `scope_user_id`
- Juros, projeções, IA

## Consequências

- Transações ligadas a parcela: edit/delete bloqueados (409) até `unpay`
- Migrations enum `debt_due_soon`: rollback do valor irreversível (migration separada)
