# ADR: Consolidação de rotas admin e auditoria obrigatória no console de plataforma

**Status:** Proposta (aguarda aprovação humana)
**Data:** 2026-06-14
**Escopo:** `wallethub/platform-super-admin`

## Contexto

O console de plataforma (`/platform`, `super_admin` + MFA via `ElevatedAccessGuard`) evoluiu
de forma orgânica e hoje tem **duas famílias de rotas admin com garantias diferentes**:

- `/admin/platform/*` (`admin-platform.controller.ts`) — chama `PlatformAuditService.record()`
  manualmente em cada mutação. **Auditado.**
- `/admin/users`, `/admin/rag/*`, `/admin/integrations/*` (controllers próprios) — protegidos por
  `super_admin` + MFA, mas **não chamam o audit service**. **Não auditado.**

Consequência concreta verificada no código:

- `admin-users.controller.ts` faz `create`/`patch` de usuários (incl. `role`, `isActive`, PII) e
  **não gera nenhuma linha em `platform_audit_log`**. O comentário do próprio controller assume
  super_admin+MFA, mas o audit nunca foi ligado.
- Writes de RAG, sync Notion e troca de provider WhatsApp idem.

Dois problemas estruturais decorrem disso:

1. **Auditoria é opt-in por handler.** Como cada endpoint precisa lembrar de chamar `.record()`,
   o default silencioso é *não auditar*. Toda feature de escrita futura (memberships, reset de
   senha, settings cross-tenant) **multiplica superfície não-auditada** se nada mudar.
2. **Rotas de usuário duplicadas** (`/admin/users` vs `/admin/platform/users/:id`) com comportamento
   e cobertura de audit divergentes — viola DRY (regra 1) e trava a evolução do console.

Pela precedência do projeto (**Segurança > Privacidade > … **) e pelas regras 8, 9 e 13, fechar isto
é **pré-requisito** de qualquer nova capacidade de escrita no console — não um item paralelo de UX.

### Limite conhecido (não inventar garantia que não existe)

A linha em `platform_audit_log` é **advisory**: o operador `super_admin` tem acesso ao Postgres de
produção e pode alterá-la. O controle anti-tamper real é o **sink off-host PII-free**, que hoje é
apenas o logger do NestJS (sink externo não implementado). Esta ADR **não** finge resolver isso —
apenas garante que *toda* mutação produza o registro; persistir o sink externo é trabalho explícito
e rastreado (ver Consequências).

## Decisão

### 1. Superfície única auditada

`/admin/platform/*` passa a ser **a única** superfície de operação cross-tenant do operador. As rotas
legadas que mutam sem audit são **migradas para baixo desse prefixo e descontinuadas** com janela de
depreciação (semver: deprecação anunciada → remoção em major seguinte, regra 4/18):

| Legado (deprecar) | Substituto auditado |
|---|---|
| `POST/PATCH /admin/users` | `POST/PATCH /admin/platform/users[/:id]` |
| `POST/DELETE /admin/rag/documents` | `…/admin/platform/rag/*` |
| `POST /admin/integrations/notion/sync` | `…/admin/platform/integrations/notion/sync` |
| `PUT /whatsapp/settings/ai-provider` (operador) | `…/admin/platform/integrations/whatsapp/ai-provider` |

Leituras (`GET`) podem permanecer onde estão; o foco da consolidação é **mutação**.

### 2. Auditoria por convenção forçada, não por memória do dev

Trocar o default de *opt-in* para auditoria garantida — em **duas camadas distintas**, sem confundir
os nomes:

- **Cobertura em build-time (guard-rail de CI):** um teste que falha o build se um handler **mutante**
  (`POST`/`PATCH`/`PUT`/`DELETE`) atrás dos guards de operador (`ElevatedAccessGuard` /
  `RolesGuard('super_admin')`) não estiver marcado com `@PlatformAudit` (ou explicitamente isento via
  `@AuditExempt({reason})`). Gatilho pelos **guards**, não pelo prefixo do path — um futuro
  `/admin/billing` atrás do mesmo guard é coberto automaticamente. Impede o buraco de reabrir (regra 11).
- **Detecção em runtime:** o `record()` permanece *best-effort* (uma falha de insert de audit não pode
  dar 500 numa mutação), mas o `catch` passa a incrementar `platform_audit_persist_failures_total` +
  alerta — a perda da linha advisory deixa de ser silenciosa.
- Um helper único (`PlatformAuditService.auditedMutation`) captura `before` (lê a entidade antes),
  aplica a mutação e registra `after` — **um caminho de escrita** reaproveitado por todos os handlers
  (DRY). Interceptor puro não basta porque `before` exige o estado pré-mutação.

> **"Fail-closed" descreve só o guard de build-time** (handler sem marcador ⇒ CI vermelho). O runtime
> é *best-effort com detecção*, **não** rollback transacional. A garantia forense real depende do sink
> durável — ver Consequências.

### 3. `entityType`/`action` padronizados

Catálogo fechado de `entityType` (`user`, `organization`, `membership`, `rag_document`,
`integration`, `setting`, …) e `action` (`create`/`update`/`deactivate`/`impersonate`/`read`) já
existente em `PlatformAuditAction`, estendido conforme necessário, para tornar o log filtrável
(pré-requisito da Audit tab utilizável — ver roadmap).

## Alternativas consideradas

- **Manter dois prefixos e só adicionar `.record()` no `/admin/users`.** Rejeitado: não corrige o
  default opt-in nem a duplicação; o próximo endpoint volta a esquecer.
- **Interceptor 100% automático.** Rejeitado: não captura `before` de forma confiável e esconde a
  semântica de auditoria do handler. Helper explícito + guard de CI é mais simples e verificável (KISS).

## Consequências

- **Breaking change de API** nas rotas legadas → exige bump major e nota de changelog explícita
  (regra 18). Front do console precisa migrar os clients em `api.ts` no mesmo ciclo.
- Toda mutação admin passa a ter trilha `before/after` — habilita a Audit tab navegável e atende
  LGPD/regra 9 (PII só na linha DB; sink off-host PII-free).
- **Garantia forense ≠ M1.** A linha DB é advisory e o mirror off-host é só logger; portanto M1
  entrega *cobertura + detecção*, não durabilidade anti-tamper. O **sink off-host durável + política de
  retenção LGPD** (hoje inexistente para `platform_audit_log`) são o **milestone M1b**, obrigatório
  **antes** de qualquer feature nova de escrita cross-tenant. Decisão do dono (2026-06-14): trilha é
  compliance/forense.
- **Não resolvido por esta ADR (itens separados, rastreados):** (a) sink off-host durável + retenção
  → M1b; (b) IP allowlist Traefik; (c) `must_change_password`.
- Migrations de schema (se `platform_audit_log` ganhar colunas) seguem regra 16 — rollback
  documentado e testado antes de prod.

## Registro no NexusCore

Quando o MCP do NexusCore voltar: `store_knowledge(category='architecture', importance≈0.8,
confidence≈0.8, sensitivity='internal')` com o resumo desta decisão, e `record_event` da falha de MCP
ocorrida nesta sessão (regra 21).
