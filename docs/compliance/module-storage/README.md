# Compliance — armazenamento (`module-storage`)

## Código de referência

- [`apps/api/src/modules/storage/`](../../../apps/api/src/modules/storage/)
- Tipos de backend: `local` \| `s3` \| `minio` (ver [`storage.config.ts`](../../../apps/api/src/core/config/storage.config.ts)).

## Documentos arquivados

| ID | Título | Fonte (URL) | Obtido em | Canónico | Legível LLM |
|----|--------|-------------|-----------|----------|-------------|
| TP-004-AWS | AWS Service Terms | [aws.amazon.com/service-terms](https://aws.amazon.com/service-terms/) | 2026-04-16 | [`2026-04-16__aws__service-terms.html`](2026-04-16__aws__service-terms.html) | [`../artifacts/llm/2026-04-16__aws__service-terms.md`](../artifacts/llm/2026-04-16__aws__service-terms.md) |
| TP-004-MIN | MinIO Legal Center | [min.io/legal](https://min.io/legal) | 2026-04-16 | [`2026-04-16__minio__legal-center.html`](2026-04-16__minio__legal-center.html) | [`../artifacts/llm/2026-04-16__minio__legal-center.md`](../artifacts/llm/2026-04-16__minio__legal-center.md) |

## Requisitos e notas preliminares

- **AWS / S3:** termos de serviço e região de dados conforme bucket configurado.
- **MinIO:** produto open-source sob **AGPL-3.0** quando auto-alojado; acordos comerciais MinIO listados no Legal Center para subscrições pagas.
- **LGPD:** localização de ficheiros de utilizador, chaves de acesso e políticas de retenção.

## Ver também

- [`../00-meta/INDEX.md`](../00-meta/INDEX.md) · [`../00-meta/MATRIX.md`](../00-meta/MATRIX.md)
- [`../module-attachments/`](../module-attachments/)
