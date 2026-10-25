# Biblioteca de compliance

Artefactos de compliance (Brasil, terceiros e políticas internas) organizados por módulo do WalletHub.

## Como navegar

| Pasta | Conteúdo |
|-------|------------|
| [`00-meta/`](00-meta/) | Convenções, [`INDEX.md`](00-meta/INDEX.md) mestre, [`MATRIX.md`](00-meta/MATRIX.md) |
| [`01-brasil-lei-e-normas/`](01-brasil-lei-e-normas/) | LGPD, CDC, ANPD e correlatos |
| [`artifacts/llm/`](artifacts/llm/) | Versões **Markdown** legíveis por LLMs (pares dos HTML/PDF nas outras pastas) |
| [`scripts/`](scripts/) | [`html_source_to_llm_md.py`](scripts/html_source_to_llm_md.py) — extração HTML → `.md` |
| [`module-*/`](module-auth/) | Uma pasta por módulo da API (`apps/api/src/modules/`) |
| [`app-web/`](app-web/) | Frontend (`apps/web`) |

Cada pasta inclui um `README.md` com tabela de documentos, requisitos preliminares e ligação ao código.

## Referências do repositório

- [`../arquitetura.md`](../arquitetura.md)
- [`../whatsapp.md`](../whatsapp.md)
- [`../telegram.md`](../telegram.md)
