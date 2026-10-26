# Documentação WhatsApp

Documentação técnica da integração WhatsApp do WalletHub: arquitetura Baileys, compliance, IA, observabilidade, persistência e gestão de segredos.

## Índice

- [Visão e início rápido](#visão-e-início-rápido)
- [Arquitetura WhatsApp com Baileys](#arquitetura-whatsapp-com-baileys)
- [Riscos de Segurança e Compliance](#riscos-de-segurança-e-compliance)
- [Orquestração de IA](#orquestração-de-ia)
- [Observabilidade](#observabilidade)
- [Persistência de Mensagens e Contexto IA](#persistência-de-mensagens-e-contexto-ia)
- [Estratégia PostgreSQL](#estratégia-postgresql)
- [Gestão de Segredos](#gestão-de-segredos)

---

## Visão e início rápido

**Para desenvolvedores:** Baileys (arquitetura), PostgreSQL (configuração), Secrets (credenciais).  
**Para DevOps/Operações:** Compliance (riscos e mitigações), Observabilidade (monitoramento), Persistência (retenção).  
**Para IA/ML:** Configurar IA (OpenAI/Vertex) conforme seção Orquestração de IA.

---

## Arquitetura WhatsApp com Baileys

O módulo `WhatsAppModule` utiliza o Baileys como cliente de mensageria, eliminando dependências da API Meta Graph. A integração mantém processamento via BullMQ e persistência em `whatsapp_events`.

**Componentes:**
- **BaileysClientService** (`apps/api/src/modules/whatsapp/baileys-client.service.ts`): inicializa `makeWASocket`, reconexões, eventos (`messages.upsert`, `connection.update`, `creds.update`), `sendMessage` e hooks; usa `useMultiFileAuthState` com Postgres (`WhatsAppSessionEntity`).
- **WhatsAppBaileysGateway**: subscrito aos eventos do BaileysClientService, converte mensagens em jobs BullMQ (`QUEUE_WHATSAPP_INBOUND`), atualiza métricas e estado da sessão em `/whatsapp/health`.
- **WhatsAppService**: persistência e filas, consome BaileysClientService para envio outbound.
- **Fila:** `WhatsAppWorkerService` processa comandos; `WhatsAppDispatcherProcessor` usa `BaileysClientService.sendMessage`.

**Persistência:** Entidade `WhatsAppSessionEntity` com `id` (pk UUID), `registration_id`, `key_data`, `account`, `me`, `signal_identity` em JSONB, datas e status.

**Configuração:** `whatsapp.config.ts` com `WHATSAPP_DEVICE_NAME`, `WHATSAPP_QR_TERMINAL`, `WHATSAPP_RECONNECT_INTERVAL`, `WHATSAPP_CREDENTIAL_NAMESPACE`.

**Compatibilidade:** Rotas `/whatsapp/webhook` (GET/POST) podem retornar 410. `/whatsapp/health` reporta estado da sessão (`connected`, `qr`, `connecting`, `disconnected`) e métricas de fila. Dependências: `@whiskeysockets/baileys`, `pino`, `qrcode-terminal`. Bootstrap do cliente Baileys antes das filas (`OnModuleInit`).

**Fluxo:** (1) BaileysClientService conecta e persiste credenciais (2) ao receber mensagem emite evento (3) Gateway persiste em `whatsapp_events` e enfileira (4) Worker executa lógica e enfileira respostas (5) Dispatcher envia via Baileys.

---

## Riscos de Segurança e Compliance

**Riscos:** Violação dos Termos do WhatsApp (Baileys não suportado pela Meta, risco de banimento); LGPD/GDPR (consentimento e retenção); superfície de ataque (sessão em Postgres, QR em ambientes controlados); dependência de IA (evitar PII em logs OpenAI/Google).

**Mitigações:** Número dedicado com monitoramento; feature flag para desativar Baileys; consentimento e opt-out; criptografar `whatsapp_sessions.auth_state` (KMS no roadmap); sanitizar mensagens antes de enviar à IA; revisar trimestralmente atualizações do Baileys.

**Procedimentos:** Checklist de Go-Live (validação legal, stress de reconexão/fila, plano de rollback); documentar incidentes e trilha em `whatsapp_ai_contexts`.

---

## Orquestração de IA

Permitir respostas inteligentes (OpenAI/Vertex) para mensagens processadas pelo Baileys.

**Implementação:** Módulo `apps/api/src/modules/ai`; config `ai.config.ts`; **AiService** com `generateReply(context, preferred?)` e fallback entre provedores; **OpenAiProvider** (`openai`, `responses.create`); **VertexProvider** (`@google-cloud/vertexai`, `gemini-1.5-flash`).

**Variáveis:** `AI_DEFAULT_PROVIDER` (openai, vertex, none), `OPENAI_API_KEY`, `OPENAI_MODEL`, `VERTEX_PROJECT_ID`, `VERTEX_LOCATION`, `VERTEX_MODEL`, `AI_REQUEST_TIMEOUT_MS`.

**Próximos passos:** Integrar AiService ao pipeline Baileys; testes unitários com mocks; métricas Prometheus para tokens (ver Observabilidade).

---

## Observabilidade

**Logging:** `nestjs-pino` com contexto `WhatsApp`; `logger.debug` apenas em development; redact de `phone`, `session`.

**Métricas Prometheus:** `whatsapp_inbound_messages_total`, `whatsapp_outbound_messages_total`, `whatsapp_connection_status` (0=down, 1=qr, 2=connecting, 3=connected), `whatsapp_ai_tokens_histogram`, `whatsapp_message_latency_seconds`.

**Alertas** (`ops/monitoring/alert-rules.yml`): `whatsapp_down` (status == 0 > 5 min), `whatsapp_queue_growth` (fila outbound > 50 por 10 min), `whatsapp_ai_token_spike` (tokens > 500 em 15 min).

**Próximas ações:** Integrar WhatsAppObservabilityService ao BaileysClientService; instrumentar filas; dashboards Grafana.

---

## Persistência de Mensagens e Contexto IA

**Tabelas:** `whatsapp_sessions` (estado Baileys e status); `whatsapp_events` (inbound/outbound, índices `from_number`, `created_at`); `whatsapp_ai_contexts` (prompts, respostas, metadados IA).

**Migrations:** tabelas WhatsApp fazem parte da migration única `1770000000000-InitialWalletHubSchema` na API. Após `npm run build -w @wallethub/api`, executar `npm run migration:run -w @wallethub/api` (ou arrancar a API com `TYPEORM_MIGRATIONS_RUN=true`, como no `ops/dev/docker-compose.yml`).

**Retenção:** `whatsapp_events` 180 dias, `whatsapp_ai_contexts` 90 dias. Scheduler (a implementar) limpa por `expires_at`/`created_at`. Backups via `npm exec -- wallethub db backup` antes de limpezas.

---

## Estratégia PostgreSQL

**Containerização** (`ops/dev/docker-compose.db.yml`): imagem `pgvector/pgvector:pg15` (Postgres 15 + extensão `vector` para RAG); `POSTGRES_EXTRA_OPTS=--wal-level=logical` quando necessário; porta `55432` documentada; validar backup com `npm exec -- wallethub db backup` antes de migrations críticas.

**Schema:** uma migration inicial consolida o esquema (incl. WhatsApp). Alterações futuras: novas migrations incrementais. Execução via `npm run migration:run` em `apps/api` após build, ou `TYPEORM_MIGRATIONS_RUN=true` no arranque.

**Seeds:** Atualizar `ops/dev/seeds/base.sql` quando necessário; nunca incluir credenciais WhatsApp ou tokens de IA. O seed de desenvolvimento cria organizações por utilizador (`Rick workspace`, `Nya workspace`); dados WhatsApp e quotas seguem o `organization_id` da org activa quando aplicável.

**Operacional:** Monitorar crescimento de `whatsapp_events` e política de retenção; `pg_stat_statements` apenas em staging/prod se necessário.

---

## Gestão de Segredos

**Variáveis sensíveis:** `OPENAI_API_KEY`; `VERTEX_PROJECT_ID` + `GOOGLE_APPLICATION_CREDENTIALS`; `WHATSAPP_SESSION_NAME`, `WHATSAPP_DEVICE_NAME`; `WHATSAPP_CREDENTIAL_NAMESPACE`; `WHATSAPP_RECONNECT_INTERVAL_MS`, `WHATSAPP_RETRY_DELAY_MS`; `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY`.

**Estratégia:** (1) Local: `.env.local` ignorado pelo Git; `GOOGLE_APPLICATION_CREDENTIALS` para arquivo local. (2) Staging/Produção: cofre (Azure Key Vault, AWS Secrets Manager), rotação semestral; CI injeta no deploy. (3) Logs: redact em `nestjs-pino` para `authorization`, `OPENAI_API_KEY`, `WHATSAPP_*`. (4) Backups: não persistir chaves IA/tokens Baileys nos dumps; criptografia em repouso recomendada.

**Ações:** `.env.example` sem valores sensíveis; `wallethub setup` solicita chaves quando disponíveis; validar que migrations e seeds não dependem de segredos.
