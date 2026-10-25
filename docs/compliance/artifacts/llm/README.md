# Artefactos legíveis por LLMs (`artifacts/llm/`)

Ficheiros **`.md`** derivados de fontes oficiais (extração HTML/PDF ou texto reproduzido quando a captura binária falha). Cada entrada deve ter cabeçalho YAML com `id`, `source_url`, `obtained_date`, `kind` (`extracted` \| `excerpt` \| `summary`) e `canonical_path` (ou `n/a` com `canonical_note`).

- **Pares canónicos** (PDF/HTML) quando existem ficam nas pastas temáticas (`../01-brasil-lei-e-normas/`, `../module-*/`), não necessariamente aqui.
- Ficheiros com sufixo **`LACUNA`** documentam limitações de extração automática (SPA, Cloudflare) e o próximo passo para auditoria completa.

Gerador opcional: [`../scripts/html_source_to_llm_md.py`](../scripts/html_source_to_llm_md.py).
