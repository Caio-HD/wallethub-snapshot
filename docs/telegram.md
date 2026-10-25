# Documentação Telegram

Documentação técnica da integração **Telegram Bot API** do WalletHub: webhook, filas BullMQ, emparelhamento de utilizadores, partilha de lógica com WhatsApp, IA, observabilidade e persistência.

## Índice

- [Visão e início rápido](#visão-e-início-rápido)
- [Arquitetura](#arquitetura)
- [Configuração e segredos](#configuração-e-segredos)
- [Webhook e segurança](#webhook-e-segurança)
- [Emparelhamento (`/start`)](#emparelhamento-start)
- [Filas e processamento](#filas-e-processamento)
- [IA e quotas](#ia-e-quotas)
- [Persistência](#persistência)
- [Observabilidade e alertas](#observabilidade-e-alertas)
- [Compliance](#compliance)

---

## Visão e início rápido

**Para desenvolvedores:** Bot API oficial (`TELEGRAM_BOT_TOKEN`), webhook com segmento secreto no path (`TELEGRAM_WEBHOOK_PATH_TOKEN`), opcional `TELEGRAM_WEBHOOK_SECRET` (cabeçalho `X-Telegram-Bot-Api-Secret-Token`), `TELEGRAM_BOT_USERNAME` para deep links de ligação.

**Para DevOps:** Registar webhook no Telegram (`setWebhook`) apontando para `https://<host>/api/telegram/webhook/<TELEGRAM_WEBHOOK_PATH_TOKEN>`; alinhar TLS e secret token com a documentação do Telegram.

**Para produto:** Apenas **mensagens privadas (DM)** são processadas; o utilizador liga a conta via link gerado na app (JWT) e `/start <nonce>` no bot.

---

## Arquitetura

- **`TelegramModule`** (`apps/api/src/modules/telegram/`): controlador, serviço, worker inbound, dispatcher outbound, cliente HTTP para `sendMessage`, serviço de nonce de ligação, observabilidade.
- **`TelegramController`**: `POST /telegram/webhook/:pathToken` (público, validação de path e secret); `GET /telegram/health` e `GET /telegram/config` (**`super_admin`**); `POST /telegram/link-code` (JWT) devolve `nonce`, `expiresAt`, `deepLink`.
- **`TelegramService`**: validação de cabeçalhos, deduplicação por `providerMessageId` (`update_id:message_id`), persistência em `telegram_events`, enfileiramento `telegram-inbound`; fluxo `/start` e respostas de sistema via envio HTTP directo.
- **`WalletInboundMessagingModule`**: lógica partilhada de comandos e IA entre WhatsApp e Telegram (`WalletInboundMessagingService`, `MessagingAiSettingsService`); definições de IA na mesma chave de `settings` que o WhatsApp (org-scope).

**Dependências:** `@nestjs/bullmq`, `axios` (envio para `api.telegram.org`), Redis para filas.

---

## Configuração e segredos

Definidas em `telegram.config.ts` e validadas em `env.schema.ts`:

| Variável | Descrição |
|----------|-----------|
| `TELEGRAM_BOT_TOKEN` | Token do bot (@BotFather) |
| `TELEGRAM_WEBHOOK_PATH_TOKEN` | Segmento opaco no URL do webhook (não commitar valores reais) |
| `TELEGRAM_WEBHOOK_SECRET` | Opcional; se definido, o Telegram deve enviar o mesmo valor no cabeçalho secreto |
| `TELEGRAM_BOT_USERNAME` | Utilizador do bot (sem `@`) para `https://t.me/<user>?start=<nonce>` |

---

## Webhook e segurança

1. **Path token:** `assertPathToken` compara `:pathToken` com `TELEGRAM_WEBHOOK_PATH_TOKEN`; falha → `401`.
2. **Secret:** Se `TELEGRAM_WEBHOOK_SECRET` estiver definido, o cabeçalho `x-telegram-bot-api-secret-token` deve coincidir; caso contrário `401`.
3. **Payload:** Updates sem `message`, grupos, bots e chats não-privados são ignorados (sem erro).

---

## Emparelhamento (`/start`)

1. Utilizador autenticado chama `POST /telegram/link-code` → grava nonce em `telegram_link_nonces` com expiração.
2. Abre `deepLink` no Telegram e envia `/start <nonce>`.
3. **`TelegramLinkService.tryLinkUserByNonce`** associa `users.telegram_user_id` ao utilizador dono do nonce.

---

## Filas e processamento

| Fila | Papel |
|------|--------|
| `telegram-inbound` | Jobs `inbound-message` processados por `TelegramWorkerService` (comandos alinhados ao fluxo WhatsApp via serviço partilhado) |
| `telegram-outbound` | Jobs `send-message` → `TelegramDispatcherProcessor` → `TelegramHttpSenderService` |

Health (`GET /telegram/health`): contagens `waiting` / `active` por fila.

---

## IA e quotas

- Canal de agente/traces: **`telegram`** (ver `AiService`, `AiTracingService`, ferramentas).
- Quotas de assistente de mensagens (WhatsApp + Telegram): `EntitlementsService` (`assertAiMessagingAssistantAllowed`, `incrementAiMessagingAssistantCount`) e contador em `organization_usage_counters` (`ai_messaging_assistant_messages`).
- Provedor e modelo: mesma configuração org-scoped que WhatsApp (`MessagingAiSettingsService` / `whatsapp_ai_provider`).

---

## Persistência

- **`telegram_events`**: eventos inbound (payload JSON, `providerMessage_id`, estado, org).
- **`telegram_link_nonces`**: nonces de ligação com expiração.
- **`users.telegram_user_id`**: ID Telegram após emparelhamento.
- **`transactions`:** `source` inclui `telegram` onde aplicável; referência opcional `telegram_event_id`.
- **Migração:** `1770000000007-TelegramIntegration.ts` (enum `transaction_source`, `ai_channel`, rename coluna de uso IA, etc.).

---

## Observabilidade e alertas

- **`TelegramObservabilityService`**: métricas de mensagens inbound (Prometheus).
- **`ops/monitoring/alert-rules.yml`**: regra **TelegramQueueBacklog** na fila `telegram-inbound` (análogo ao WhatsApp).

---

## Compliance

Termos e políticas do Telegram (plataforma e bot developers) estão referenciados em [`docs/compliance/module-telegram/README.md`](compliance/module-telegram/README.md). Tratamento de dados pessoais e mensagens: alinhar com LGPD e com [`docs/compliance/00-meta/INDEX.md`](compliance/00-meta/INDEX.md).

---

## Ver também

- [`whatsapp.md`](whatsapp.md) — integração WhatsApp e padrões comuns de mensagens
- [`arquitetura.md`](arquitetura.md) — visão global
- [`deploy-operacoes.md`](deploy-operacoes.md) — variáveis em produção
