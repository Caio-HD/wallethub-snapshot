# Compliance — Telegram (`module-telegram`)

## Código de referência

- [`apps/api/src/modules/telegram/`](../../../apps/api/src/modules/telegram/)
- Documentação funcional: [`../../telegram.md`](../../telegram.md)

## Documentos arquivados

| ID | Título | Fonte (URL) | Obtido em | Canónico | Legível LLM |
|----|--------|-------------|-----------|----------|-------------|
| TP-006 | Telegram — Terms of Service (plataforma) | [telegram.org/tos](https://telegram.org/tos) | 2026-04-26 | *fonte viva; sem HTML estático local* | [`../artifacts/llm/2026-04-26__telegram__terms-summary.md`](../artifacts/llm/2026-04-26__telegram__terms-summary.md) |
| TP-006-BOT | Telegram — Bot Developers | [telegram.org/tos/bot-developers](https://telegram.org/tos/bot-developers) | 2026-04-26 | *fonte viva; sem HTML estático local* | *incluído no resumo LLM acima* |

## Requisitos e notas preliminares

- **Telegram:** uso da Bot API sujeito aos termos de utilizadores e desenvolvedores; proibição de spam, scams e conteúdo ilegal; possibilidade de atualização unilateral dos termos.
- **Dados:** IDs Telegram, texto de mensagens e payloads de updates persistidos em `telegram_events`; minimizar PII em logs e em fornecedores de IA (alinhado a [`../module-ai/`](../module-ai/)).
- **LGPD:** base legal, retenção e direitos dos titulares para conversas e metadados; ver transversal [`BR-001`](../01-brasil-lei-e-normas/).

## Ver também

- [`../00-meta/INDEX.md`](../00-meta/INDEX.md) · entradas TP-006* · [`../00-meta/MATRIX.md`](../00-meta/MATRIX.md)
- [`../module-whatsapp/`](../module-whatsapp/) · [`../module-ai/`](../module-ai/)
