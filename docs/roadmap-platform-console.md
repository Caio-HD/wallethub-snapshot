# Roadmap — Redesign do Console de Plataforma

**Status:** Vivo (atualizar conforme evolui — regra 17)
**Data inicial:** 2026-06-14
**Escopo:** `wallethub/platform-super-admin`
**ADR base:** [adr-platform-route-audit-consolidation.md](./decisions/adr-platform-route-audit-consolidation.md)

## Objetivo

Transformar o console `/platform` (hoje 7 abas planas) num painel org-agnóstico com escrita
auditada cross-tenant, **sem** ampliar superfície não-auditada no caminho. Princípio de ordenação:
**risco-redução e pré-requisitos primeiro; UX e novas capacidades depois.**

## Princípio de sequenciamento

A análise anterior (do Cursor) agrupava "navegação + audit" numa única Fase A. Isto **separa** os dois
por perfil de risco:

- Consolidação de rotas + auditoria = correção de **segurança/compliance backend** → vem primeiro,
  independente de qualquer UI.
- Redesign de navegação = **UX** → não pode bloquear nem ser bloqueado por uma correção de segurança.

Regra dura: **nenhuma nova capacidade de escrita cross-tenant (M2+) antes de M1 fechar.** Cada
mutação adicionada antes do audit fail-closed multiplica o buraco.

---

## Milestones

### M0 — Decisão (este ciclo, sem código de feature)
- [x] Roadmap reordenado por risco (este doc)
- [x] ADR de consolidação de rotas + audit (proposta)
- [ ] **Aprovação humana da ADR** (regra 13 — agente não faz merge sozinho)
- [ ] Registrar decisão no NexusCore quando o MCP voltar (regra 21)

**Saída:** contrato acordado. Destrava M1. *Nada de UI ainda.*

### M1 — Fundação: rota única auditada (backend, risco-redução) — ✅ implementado 2026-06-14 (uncommitted)
Depende de: M0 aprovado.
- [x] Helper único de mutação admin (`auditedMutation`: `before`→mutação→`after`→`PlatformAuditService`)
- [x] Ligar audit em `admin-users` (create/patch) + RAG (upsert/delete) + Notion sync
- [x] Detecção em runtime: `platform_audit_persist_failures_total` no `catch` do `record()`
- [x] Consolidar `GET/POST /admin/users` → `/admin/platform/users`; shim depreciado (Sunset 2026-10-01) + migrar `api.ts`
- [x] Guard-rail de CI por reflexão (gatilho = guard de operador) + fixture anti-regressão + step `test:audit-guard`
- [x] Testes: unit (helper + call-sites + guard, 20+) + e2e (mutação real → linha em `platform_audit_log`, 3/3)
- ~~provider WhatsApp~~ → adiado (vive no módulo whatsapp; fora de M1)

**Saída:** toda mutação de operador auditada por construção, com detecção de falha. **Sem UI.** Maior risco-redução do roadmap.
**Pendências:** commit/PRs (PR0–PR4b) + deploy ordenado (backend antes do front); registro no NexusCore.

### M1b — Sink durável + retenção (garantia forense) — **antes de M4+**
Depende de: M1. Decisão do dono (2026-06-14): trilha é compliance/forense — M1 entrega cobertura+detecção, não durabilidade.
- [ ] Sink off-host anti-tamper para o mirror PII-free (hoje só logger NestJS)
- [ ] Política de retenção LGPD para `platform_audit_log` (hoje **inexistente**: migration só cria tabela)
- [ ] Alerta Grafana sobre `platform_audit_persist_failures_total > 0`

**Saída:** converte "detecção" em garantia forense real. Bloqueante para novas features de escrita cross-tenant.

### M2 — Operador org-agnóstico (bug em produção, barato) — ✅ implementado 2026-06-17
Depende de: nada de M1 (pode ir em paralelo; é isolado).
- [x] Corrigir filtros que assumem org ativa para o operador `platform` sem org
      (`PlatformAiHistoryTab` → `fetchPlatformUsers`; `useActiveUsers` permanece org-scoped)
- [x] Selectors explícitos de org/user onde features assumiam membership
      (`OrganizationSelector` com modo auditoria; `AuditModeBanner`; sidebar)

**Saída:** console usável pelo operador sem org. Bom primeiro PR pequeno, paralelizável com M1.
**Nota prod (2026-06-17):** 0 orgs na BD — operador deve criar org em Console → Organizações antes
de impersonation; coluna Orgs vazia em utilizadores sem membership é esperado.

### M3 — Audit tab navegável
Depende de: M1 (catálogo `entityType`/`action` padronizado + cobertura completa).
- [x] Filtros (entityType, actor, org, datas) + paginação + busca
- [x] Diff legível (não `<pre>` de JSON cru)
- [x] Resolver nomes (actor/org/entidade) + links cruzados
- [x] Export CSV/JSON — `GET /admin/platform/audit/export` + botões na aba Auditoria

**Saída:** a trilha de M1 vira utilizável de fato.

### M4 — Relações org ↔ user — ✅ implementado 2026-06-17
Depende de: M1 (toda mutação nova nasce auditada).
- [x] Membership CRUD cross-tenant (API `POST/PATCH/DELETE .../members`) + papéis owner/admin/member
- [x] `POST /admin/platform/organizations` (criar org + owner opcional)
- [x] Web: criar org + adicionar/editar/remover membros no detalhe
- [x] Detalhe org completo (plano, QA, razão social, tipo/NIF fiscal)
- [x] Detalhe user completo + **reset de senha admin auditado** + MFA admin (disable TOTP)
- [x] `messaging_ai_enabled` por membro cross-org (UI toggle para role `member`)

**Saída:** o "user por org / org por user" que foi pedido, com escrita auditada.

### M5 — Integrações e filas por escopo
Depende de: M1, M4.
- [ ] WhatsApp/Telegram por org e por user (hoje só global, fora do console)
- [x] Métricas read-only BullMQ na aba Integrações (`GET /admin/integrations/queues`) — 2026-06-18
- [ ] Acções de fila (retry/purge/pause) + UI de gestão
- [ ] Sync Notion real (hoje stub `queued:0`); settings JSONB admin cross-tenant

### M6 — Navegação org·user·sistema (UX) + ops
Depende de: M1, M3, M4. **Aqui** entra o redesign de IA / wireframe.
- [x] M6-lite (2026-06-17): sidebar condensada em `/platform`, abas Tenants|Sistema + `?tab=`,
      empty states, onboarding 0 orgs, rótulos pt-PT
- [x] M6 hub parcial (2026-06-18): breadcrumbs Console→Organizações/Utilizadores→detalhe;
      deep-links `?tab=orgs&orgId=` e `?tab=users&userId=` sincronizados com URL
- [ ] Hub Org | User | Sistema, painéis dedicados (substitui as 7 abas planas — breadcrumbs feitos)
- [x] **Impersonation UI auditada** ("abrir como esta org") — preferir a editar dados financeiros direto
- [ ] Sink de auditoria off-host real, IP allowlist Traefik, backup/QA visíveis ao operador

### Fora de escopo até decisão explícita
- **Editor financeiro god-mode** (transações/contas/dívidas de tenants editáveis pelo operador):
  risco LGPD alto (regra 9). O caminho preferido é **impersonation auditada** (M6), não um editor
  cross-tenant. Reavaliar só com necessidade comprovada.

---

## Mapa risco × esforço (resumo)

| Milestone | Tipo | Risco se não fizer | Bloqueia |
|---|---|---|---|
| M1 | Segurança backend | Mutações admin sem trilha (LGPD/8/9) | M3, M4, M5 |
| M2 | Bugfix | Console quebrado p/ operador sem org | — |
| M3 | UX/compliance | Audit ilegível na prática | — |
| M4 | Feature | — | M5 |
| M5 | Feature | — | — |
| M6 | UX | — | — |

## Dependências externas / pré-reqs já conhecidos
- Migrations seguem regra 16 (rollback testado antes de prod).
- Changelog atualizado a cada PR (regra 18); breaking change de rota = bump major.
- Toda decisão arquitetural relevante → `store_knowledge` no NexusCore (regra 21).
