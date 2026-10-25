# Pendências Atuais

> Documentação principal encontra-se em [`docs/README.md`](README.md). Atualize esta lista sempre que novos itens surgirem.
> Evolução planeada (não implementada) — ver [`roadmap.md`](roadmap.md).

## Build e Testes
- ✅ `npm run build` executado com sucesso nos serviços `api` e `web`.
- ✅ Suites unitárias implementadas:
  - `apps/api`: autenticação, transações, projeções e utilitários (`jest --runInBand`).
  - `apps/web`: `AuthProvider`, `DashboardPage`, `TransactionForm` (`npm run test`).
- ✅ Testes E2E implementados:
  - `apps/api`: `auth.e2e-spec.ts`, `transactions.e2e-spec.ts`, `whatsapp-webhook.e2e-spec.ts`, `health.e2e-spec.ts`.
  - `apps/web`: `auth-transactions.spec.ts` (com mocks), `real-api.spec.ts` (com API real, opcional).
- ⚠️ Pendente: remoção do uso de `--passWithNoTests` para `npm run test:e2e` quando aplicável.

## Segurança e Dependências
- ✅ Vulnerabilidades moderadas do frontend resolvidas (Vite/Vitest atualizados). `npm audit` retorna 0 issues.
- ✅ Secrets do GitHub Actions configurados no workflow CI (publish condicional de imagens Docker).

## Operações
- ✅ Script de backup diário (`ops/backup/run-backup.sh`) gera dump custom e sincroniza opcionalmente via `rclone`.
- ✅ Script de backup atualizado para atualizar métricas Prometheus via endpoint `/backup/success`.
- ✅ Métrica `wallethub_backup_last_success_seconds` implementada e exposta via Prometheus.
- ✅ Scripts e arquivos systemd para cron de backup (`ops/backup/backup-cron.sh`, `backup-cron.service`, `backup-cron.timer`).
- ✅ Scripts de instalação e validação de cron (`ops/backup/install-cron.sh`, `ops/backup/validate-cron.sh`, `ops/backup/backup.env.example`).
- ✅ Ferramenta de validação de variáveis de ambiente (`wallethub secrets validate` e `ops/scripts/validate-env.sh`).
- ✅ Regras de alerta Prometheus em `ops/monitoring/alert-rules.yml` (API, filas, backups, webhook).
- ⚠️ Pendente: Provisionar cron/scheduler no ambiente de produção (configuração manual necessária no servidor - usar `ops/backup/install-cron.sh`).
- ⚠️ Pendente: Revisar variáveis sensíveis/segredos e pipeline de deploy com valores reais em ambiente de staging antes do primeiro deploy (usar `wallethub secrets validate`).

## CI/CD
- ✅ Workflow GitHub Actions (`.github/workflows/ci.yml`) com cache de Docker layers e node_modules.
- ✅ Job de publish condicional para imagens Docker (requer secrets `DOCKERHUB_USERNAME` e `DOCKERHUB_TOKEN`).
- ✅ Cache otimizado usando `actions/cache@v4` e `docker/build-push-action@v5`.

## Infraestrutura
- ✅ Todos os componentes principais implementados conforme arquitetura:
  - Traefik (proxy reverso com TLS automático)
  - API NestJS com todos os módulos
  - Worker WhatsApp (Baileys)
  - Frontend React
  - PostgreSQL com volumes persistentes
  - Redis para filas BullMQ
  - Backup automático com métricas
  - Métricas Prometheus
  - **Sistema de Attachments**: ✅ Implementado com suporte a storage local, S3 e MinIO
    - Módulo de storage abstrato (`StorageModule`) com interface e implementações
    - Módulo de attachments completo (`AttachmentsModule`) com upload/download/delete
    - Endpoints: `POST /attachments`, `GET /attachments/:id`, `DELETE /attachments/:id`, `POST /attachments/:id/associate/:transactionId`
    - Validação de tipos MIME e tamanho máximo
    - Limpeza automática de attachments órfãos
    - Volume Docker `storage_data` configurado para storage local
- ⚠️ Pendente (não crítico para MVP):
  - **MFA TOTP**: Previsto para futuros releases.

## Documentação
- ✅ Checklist de validação pré-deploy em `docs/deploy-operacoes.md`.
- ✅ Documentação de deploy atualizada com informações sobre backup automático e métricas.
- ✅ Documentação de secrets do GitHub Actions adicionada.
- ✅ Documentação de configuração de cron de backup adicionada (`docs/deploy-operacoes.md`).
- ✅ Documentação de validação de variáveis de ambiente adicionada.
- ✅ Documentação de sistema de attachments e storage adicionada (`docs/deploy-operacoes.md`, `docs/arquitetura.md`).
- ✅ `docs/desenvolvimento.md` atualizado (removida referência a `--passWithNoTests`).
- ✅ `docs/arquitetura.md` atualizado (endpoints de attachments adicionados, status atualizado).
- ✅ Documentação alinhada ao modelo **multi-tenant** (`README.md`, `arquitetura.md`, `desenvolvimento.md`, `deploy-operacoes.md`): organizações, `X-Organization-Id`, papéis JWT `admin`/`super_admin`, seed por utilizador, Vitest `forks` no Windows, lint API só `src/`.
