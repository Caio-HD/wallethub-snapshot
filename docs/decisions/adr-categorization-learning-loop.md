# ADR — Modelo de categorização e loop de aprendizado (Fase 1)

- **Status:** Accepted
- **Data:** 2026-06-21
- **Contexto:** Ao importar OFX, o usuário precisava escolher uma categoria padrão para o
  extrato inteiro. Como a direção (entrada/saída) era derivada de `category.type`, isso
  empurrava o usuário a criar categorias com nome de **banco** ("Nubank+/Nubank-") — o que
  não informa nada e quebra a auto-categorização: toda importação exigiria revisar
  transação por transação.

## Decisão

### 1. Separação de conceitos (princípio)
- **Conta = banco.** Já modelado (`accounts.bank_id/branch_number/account_number`, auto-match OFX).
- **Categoria = semântica** (Alimentação, Salário, Aluguel…). **Não** é o nome do banco.
- A categorização é dirigida pela **descrição** da transação (merchant/memo do OFX), não pela conta.

### 2. Categorias de sistema "Sem categoria" (destino neutro)
- Migration `1770000000024`: coluna `categories.is_system` + backfill de
  **"Sem categoria (entradas)"** (income) e **"(saídas)"** (expense) por organização.
- Criadas também no provisionamento de novas orgs e via `CategoriesService.ensureSystemCategories`
  (find-or-create idempotente, self-heal). Fonte única dos nomes em `SYSTEM_UNCATEGORIZED_NAME`.
- O import passa a usar como fallback direcional **"Sem categoria" do tipo da linha** — nunca
  uma categoria de banco. Precedência por linha:
  `override explícito > mapeamento aprendido (mesmo tipo) > padrão direcional escolhido > "Sem categoria" do tipo`.

### 3. Loop de aprendizado (`statement_category_mappings`)
- O mapa `descrição-normalizada → categoria` (criado no #61) é o motor de auto-categorização.
- **Aprende ao categorizar manualmente**: `TransactionsService.update` faz `upsert` no mapa
  quando a categoria muda, a transação tem descrição **e a categoria de destino não é de sistema**
  (não poluir o mapa com o destino neutro).
- **Não aprende no `create`**: o import usa `create` em massa; aprender ali ensinaria
  "merchant → Sem categoria". O aprendizado vem só da ação humana de classificar.
- Resultado: importou → desconhecidos caem em "Sem categoria" → usuário classifica **uma vez**
  (na tela de Lançamentos) → próxima importação já vem classificada.

### 4. Refactor — `StatementCategoryMappingModule`
- Entidade + serviço de mapeamento extraídos para módulo próprio, compartilhado por
  `StatementImportModule` (aplica o mapa) e `TransactionsModule` (aprende) sem dependência circular.

## Consequências
- Auto-categorização melhora com o uso; o trabalho 1-a-1 acontece **uma vez por merchant novo**.
- Migration aditiva; backfill idempotente (`ON CONFLICT (organization_id, name)`).
- Categorias de sistema marcadas com `is_system` (base para protegê-las de edição/exclusão na Fase 2).

## Fora de escopo (Fase 2+)
- UX de **categorização em lote agrupada por descrição** no preview/auditoria.
- Classificador melhor (embeddings/LLM) e **subcategorias** (hierarquia) — ortogonais; sem retrabalho.
- Proteção de UI para impedir editar/excluir as categorias de sistema.

## Alternativas descartadas
- **Categoria = nome do banco:** anti-padrão (é papel da Conta); inviabiliza auto-categorização.
- **Não categorizar no import:** pior que cair em "Sem categoria" + aprender; perde o sinal do tipo.
- **Subcategorias agora:** resolve outro problema (hierarquia), não o de auto-categorização.
