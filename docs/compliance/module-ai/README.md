# Compliance — IA (`module-ai`)

## Código de referência

- [`apps/api/src/modules/ai/`](../../../apps/api/src/modules/ai/)
- Provedores configurados no código: **OpenAI**, **Google Vertex** (família Gemini / GCP), **DeepSeek** (`baseURL` https://api.deepseek.com/v1).

## Documentos arquivados

| ID | Fornecedor | Fonte (URL) | Obtido em | Canónico | Legível LLM |
|----|------------|-------------|-----------|----------|-------------|
| TP-003-OAI | OpenAI | [Terms of Use ROW](https://openai.com/policies/row-terms-of-use/) | 2026-04-16 | *HTML bloqueado por Cloudflare em captura curl* | [`../artifacts/llm/2026-04-16__openai__row-terms-of-use.md`](../artifacts/llm/2026-04-16__openai__row-terms-of-use.md) |
| TP-003-GCP | Google Cloud (Vertex AI) | [Terms of Service](https://cloud.google.com/terms/service-terms) | 2026-04-16 | [`2026-04-16__google__cloud-service-terms.html`](2026-04-16__google__cloud-service-terms.html) | [`../artifacts/llm/2026-04-16__google__cloud-service-terms.md`](../artifacts/llm/2026-04-16__google__cloud-service-terms.md) |
| TP-003-DSK | DeepSeek | [Privacy](https://www.deepseek.com/privacy_policy) · [API docs](https://api-docs.deepseek.com/) | 2026-04-16 | [`2026-04-16__deepseek__privacy-policy.html`](2026-04-16__deepseek__privacy-policy.html) | [`../artifacts/llm/2026-04-16__deepseek__privacy-policy.md`](../artifacts/llm/2026-04-16__deepseek__privacy-policy.md) · [`../artifacts/llm/2026-04-16__deepseek__api-docs-overview.md`](../artifacts/llm/2026-04-16__deepseek__api-docs-overview.md) |

## Requisitos e notas preliminares

- **Provedores:** Terms, Privacy, tratamento de dados de entrada (prompts), localização de processamento, sub-processadores.
- **LGPD / ANPD:** orientações sobre IA e dados pessoais quando aplicável; minimização e anonimização de contextos.
- **Retenção:** políticas para `ai` tracing / contextos persistidos.

## Ver também

- [`../00-meta/INDEX.md`](../00-meta/INDEX.md) · entradas TP-003-* · [`../00-meta/MATRIX.md`](../00-meta/MATRIX.md)
- [`../module-whatsapp/`](../module-whatsapp/) · [`../module-rag/`](../module-rag/)
