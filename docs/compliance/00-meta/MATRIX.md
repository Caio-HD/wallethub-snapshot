# Matriz requisito → módulo → evidência → código

Mapa de alto nível para auditorias (humano ou LLM usando [`artifacts/llm/`](../artifacts/llm/)). **Evidência** aponta para ficheiros em `docs/compliance/`; **código/config** para o repositório.

| Requisito (âmbito) | Módulo / área | Evidência (docs) | Código / config |
|--------------------|---------------|------------------|-----------------|
| Tratamento de dados pessoais (LGPD) — bases, minimização | Transversal | [`BR-001`](../01-brasil-lei-e-normas/) · [`INDEX.md`](INDEX.md) | Políticas de produto em evolução; dados em entidades TypeORM sob `apps/api/src/database/entities/` |
| Relação de consumo / serviços digitais (CDC) | Transversal | [`BR-002`](../01-brasil-lei-e-normas/) | — |
| Orientações ANPD | Transversal | [`BR-003`](../01-brasil-lei-e-normas/) | — |
| Mensagens e números (WhatsApp) | `module-whatsapp` | [`TP-001`](../module-whatsapp/) | [`apps/api/src/modules/whatsapp/`](../../../apps/api/src/modules/whatsapp/) |
| Mensagens (Telegram Bot API) | `module-telegram` | [`TP-006`](../module-telegram/) | [`apps/api/src/modules/telegram/`](../../../apps/api/src/modules/telegram/) |
| Sincronização Notion / API | `module-notion` | [`TP-002`](../module-notion/) | [`apps/api/src/modules/notion/`](../../../apps/api/src/modules/notion/) |
| Provedores IA: OpenAI, Vertex (GCP), DeepSeek | `module-ai` | [`TP-003-OAI/GCP/DSK`](../module-ai/) | [`apps/api/src/modules/ai/`](../../../apps/api/src/modules/ai/) · [`openai.provider.ts`](../../../apps/api/src/modules/ai/providers/openai.provider.ts) · [`vertex.provider.ts`](../../../apps/api/src/modules/ai/providers/vertex.provider.ts) · [`deepseek.provider.ts`](../../../apps/api/src/modules/ai/providers/deepseek.provider.ts) · env [`ai.config`](../../../apps/api/src/core/config/) |
| Armazenamento S3 / MinIO / local | `module-storage` | [`TP-004`](../module-storage/) | [`storage.config.ts`](../../../apps/api/src/core/config/storage.config.ts) · [`apps/api/src/modules/storage/`](../../../apps/api/src/modules/storage/) |
| Cotações de mercado (Brapi) | `module-investments` | [`TP-005`](../module-investments/) | [`brapi-quote.client.ts`](../../../apps/api/src/modules/investments/market-data/brapi-quote.client.ts) |
| Conectividade / Tunnel (Cloudflare) | Transversal (Dev) | [`INF-001`](../01-brasil-lei-e-normas/) | [`.cloudflared/`](../../../.cloudflared/) |
| Filas e Projeções (Redis) | Transversal | [`INF-002`](../00-meta/INDEX.md) | [`redis.config.ts`](../../../apps/api/src/core/config/redis.config.ts) |
| Ferramentas Externas (MCP) | `module-mcp` | [`MCP-001`](../module-mcp/) | [`mcp-client.service.ts`](../../../apps/api/src/modules/mcp/mcp-client.service.ts) |
| Cookies / transparência / UI | `app-web` | [`app-web/README.md`](../app-web/) | [`apps/web/src/`](../../../apps/web/src/) |

## Notas

- Quando **Evidência** for SPA ou Cloudflare, utilizamos extração via browser ou fontes arquivadas (ex: Wayback Machine) para garantir a integridade documental em [`artifacts/llm/`](../artifacts/llm/).
- Renovar snapshots após alterações materiais de fornecedores ou do produto.
