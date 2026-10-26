# Roadmap WalletHub

> Documento vivo de evolução planeada. Itens aqui **não estão implementados** salvo indicação explícita.
> Pendências operacionais imediatas continuam em [`backlog.md`](backlog.md).

---

## IA e RAG

### Estado actual (baseline)

| Camada | Implementação actual |
|--------|----------------------|
| Índice vetorial | PostgreSQL + pgvector (`rag_documents`, `rag_chunks`, HNSW) — **local** |
| Embeddings | **OpenAI** (`OPENAI_API_KEY`, `text-embedding-3-small`, 1536 dims) — único provider |
| Geração (chat/agente) | Providers integrados: **OpenRouter**, OpenAI, Vertex, DeepSeek — seleccionáveis no chat |
| Tool RAG | `search_knowledge` no loop do agente |

---

### [Planeado] Embeddings RAG — Jina AI (free) + fallback local CPU

**Objectivo:** desacoplar embeddings do RAG da dependência exclusiva de OpenAI; priorizar tier free e operação offline em hardware modesto.

#### Provider primário — Jina AI (free tier)

- Integrar **Jina Embeddings API** como provider default de embeddings (`RAG_EMBEDDING_PROVIDER=jina`).
- Modelos candidatos (avaliar na implementação):
  - `jina-embeddings-v5-text-nano` — 768 dims, 8K contexto (menor custo/latência).
  - `jina-embeddings-v5-text-small` — 1024 dims, 32K contexto (melhor qualidade).
- Configuração prevista: `JINA_API_KEY`, `RAG_JINA_MODEL`, rate limits do free tier (≈500 RPM / 2M TPM com API key; 10M tokens free no signup — confirmar termos CC-BY-NC para uso não comercial).
- Referência: [Jina Search Foundation API](https://api.jina.ai/scalar).

#### Fallback — modelo local leve (CPU, 4 núcleos, ≤ 8 GB RAM)

Quando Jina estiver indisponível, quota esgotada ou `RAG_EMBEDDING_PROVIDER=local`:

- Servir embeddings via **Ollama** ou endpoint OpenAI-compatible self-hosted na mesma rede (ex.: sidecar Docker opcional no compose).
- Modelos candidatos (ordem de preferência a validar em bench no target hardware):
  - **Qwen** — variantes de embedding compactas (ex. família Qwen3-Embedding / instruct embedding ≤ 0.6B).
  - **nomic-embed-text** — referência comum para RAG local em CPU.
  - **bge-small** / **multilingual-e5-small** — alternativas leves multilingue (PT-BR).
- Requisito de hardware: **4 cores CPU**, **até 8 GB RAM** (sem GPU obrigatória); documentar latência esperada por chunk na ingestão.
- Env previstas: `RAG_LOCAL_EMBEDDING_URL`, `RAG_LOCAL_EMBEDDING_MODEL`, `RAG_LOCAL_EMBEDDING_DIMENSIONS`.

#### Cadeia de fallback (design)

```
Jina AI (free) → embedding local (Ollama/Qwen ou alternativa) → (opcional) OpenAI legado
```

- Abstracção `EmbeddingProvider` em `RagEmbeddingService` (hoje hardcoded OpenAI).
- Healthcheck em `GET /health/rag` ou extensão de `/health/llm`: provider activo, dimensão, latência de probe.
- **Migração de dimensões:** índice pgvector actual assume 1536 dims (OpenAI). Ao adoptar Jina (768/1024) ou local, planear migração de schema/reindex (`RAG_EMBEDDING_DIMENSIONS` + re-ingestão ou coluna/índice por dimensão).

#### Entregáveis

- [ ] Interface + providers (`jina`, `local`, `openai` legacy).
- [ ] Env schema + exemplos em `config/.env.*.example`.
- [ ] Testes unitários da cadeia de fallback.
- [ ] Documentação em `docs/compliance/module-rag/` (Jina + modelos locais).
- [ ] Nota operacional no deploy (sidecar Ollama opcional, limites de RAM).

---

### [Planeado] Geração de resposta — qualquer provider do chat

**Objectivo:** o RAG (retrieval + contexto) não deve impor o provider de LLM; a resposta usa o **mesmo provider já integrado e seleccionado no chat**.

#### Comportamento desejado

- **Embeddings** e **LLM** são pipelines independentes:
  - Embeddings: Jina → local → OpenAI (conforme secção acima).
  - Geração: **qualquer provider activo no módulo AI** — OpenRouter, OpenAI, Vertex, DeepSeek (e futuros).
- O agente (`runAgent` / `search_knowledge`) injeta chunks RAG no contexto; o **turno final** corre no provider escolhido pelo utilizador, org ou canal (web, WhatsApp, Telegram).
- Remover a necessidade de `OPENAI_API_KEY` **só para chat** quando embeddings não forem OpenAI (hoje a chave OpenAI é obrigatória para RAG mesmo com OpenRouter no chat).

#### Entregáveis

- [ ] Garantir paridade: web AI Chat, WhatsApp e Telegram respeitam o provider configurado sem exigir OpenAI para resposta.
- [ ] Documentar matriz provider × capacidades (tools, streaming, quotas) em `docs/compliance/module-ai/`.
- [ ] Admin: indicar claramente na UI quais providers suportam agente com tools + RAG.

---

## Outros itens (referência)

Itens já mencionados noutros documentos e ainda não fechados:

- **MFA TOTP** — previsto pós-MVP ([`backlog.md`](backlog.md)).
- **Criptografia KMS** de `whatsapp_sessions.auth_state` ([`whatsapp.md`](whatsapp.md)).
- **i18n Fase 2** — `hi`, `ru`, `ko`, `nl` ([`plano.md`](plano.md)).

---

**Última actualização:** 2026-06-06 — secção RAG/embeddings (Jina + local CPU) e desacoplamento LLM/chat.
