# ADR — Auditoria de Importação OFX/CSV (lotes, dedup blindado, exclusão em bloco)

- **Status:** Accepted
- **Data:** 2026-06-21
- **Contexto de produto:** a tela de Contas não oferecia caminho descoberto para importar
  extrato (o gatilho era um ícone que só aparecia no hover da linha no desktop — "não tem como
  importar"). Além de tornar a ação visível, o usuário pediu uma **tela de auditoria** por conta:
  listar importações, **excluir uma importação junto com as transações que ela criou**, configurar
  vínculo banco↔conta e mapeamento de categorias — e **garantia anti-duplicidade** mesmo após
  remoção e reimportação repetida do mesmo arquivo.

## Decisão

### 1. Entidade de lote (`statement_import_batches`)
Antes não havia como saber quais transações vieram de qual importação (transações OFX/CSV eram
transações normais com `source='web'`). Criamos um **lote por commit de importação** agrupando as
transações criadas. `transactions.statement_import_batch_id` referencia o lote com
**`ON DELETE SET NULL`** (não cascade): a exclusão do lote **não** apaga transações em cascata no
banco — o serviço faz `softRemove` explícito de cada transação para honrar as regras de domínio
(bloqueio de transações ligadas a dívidas, auditoria, recálculo de projeção).

### 2. Anti-duplicidade em duas camadas ("blindado")
- **Nível arquivo:** `statement_import_batches.file_hash` (sha256 do buffer) + índice único parcial
  `(organization_id, account_id, file_hash) WHERE deleted_at IS NULL`. Reimportar o **mesmo arquivo**
  na mesma conta enquanto o lote está vivo → `409 Conflict`. Após excluir o lote (soft delete), o
  slot é liberado e a reimportação volta a ser permitida — comportamento desejado.
- **Nível transação:** mantém o índice único parcial por FITID
  (`UQ_tx_account_external_id`). Para **CSV sem FITID**, passamos a gerar um `external_id` sintético
  determinístico — `csv:sha1(data|valor_sinalizado|descrição)#k` (k = k-ésima ocorrência idêntica no
  arquivo) — de modo que o mesmo índice único também deduplica CSV. Reimportar o mesmo arquivo
  reproduz os mesmos ids ⇒ o banco bloqueia duplicatas; linhas genuinamente idênticas no mesmo
  arquivo são preservadas via o sufixo de ocorrência.

### 3. Exclusão em bloco com regra de dívida (decisão de produto: **pular**)
`DELETE /imports/statement/batches/:id` percorre as transações vivas do lote e faz `softRemove` de
cada uma. Transações ligadas a uma dívida disparam `ConflictException` no domínio — elas são
**puladas** (não quebram a dívida) e reportadas (`skipped[]` com motivo). O lote só é removido (soft)
quando **todas** saíram; se sobraram vinculadas a dívidas, o lote é mantido para retentativa após o
usuário desfazer o pagamento na dívida.

### 4. Memória de categorias (`statement_category_mappings`)
Mapeamento persistente `descrição-normalizada → categoria` por organização. A normalização
(`normalizeDescriptionKey`: lower, sem acentos, sem dígitos/pontuação, colapsada) agrupa variações do
mesmo lançamento. No commit, a precedência de categoria por linha é:
`categoryOverride explícito > mapeamento salvo > categoria padrão`. Overrides explícitos do usuário
**alimentam** o mapeamento automaticamente (upsert).

### 5. Histórico anterior: **só dali pra frente**
Importações antigas não têm como ser agrupadas retroativamente (sem registro de origem). A auditoria
passa a registrar lotes a partir de agora; sem backfill heurístico (evita agrupamentos errados).

## Migration `1770000000023-StatementImportAudit`
Aditiva, `transaction = false` (índices `CONCURRENTLY`), idempotente (`IF NOT EXISTS` + self-heal de
`indisvalid`), guard `postgres`. `up()` sem statements destrutivos (passa no gate de deploy);
`down()` documentado (drop de FK/índices/colunas/tabelas/enum). Validada contra PostgreSQL 15 real:
24/24 migrations aplicam; FK `SET NULL`, índice único parcial e rejeição de reimport ativo
confirmados; `down()` deixa o schema limpo.

## Consequências
- A exclusão de importação é **soft** e respeita dívidas — auditável e reversível por dados.
- O slot único de `file_hash` é por conta e por lote ativo; mover um arquivo entre contas é permitido.
- CSV agora tem rede de dedup no banco (antes só heurística in-memory).
- Endpoints de auditoria são `@Roles('admin')` + org ativa, como os demais de import.

## Alternativas descartadas
- **`ON DELETE CASCADE`** no FK: apagaria transações ignorando o bloqueio de dívidas e a auditoria.
- **Backfill heurístico** de importações antigas: risco de agrupar transações não relacionadas.
- **Bloquear o lote inteiro** quando há transação ligada a dívida: pior UX que pular e reportar.
