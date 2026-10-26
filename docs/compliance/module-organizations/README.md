# Compliance — organizações (`module-organizations`)

## Código de referência

- [`apps/api/src/modules/organizations/`](../../../apps/api/src/modules/organizations/)

## Documentos arquivados

| Título | Tipo | Fonte (URL) | Obtido em | Ficheiro local |
|--------|------|-------------|-----------|----------------|
| — | — | — | — | — |

## Requisitos e notas preliminares

- **LGPD:** separação de dados por organização; membros e papéis; responsabilidade pelo tratamento em contexto multi-tenant.
- Documentar relação entre controlador/co-controlador se aplicável ao modelo de negócio.
- Ver [`../01-brasil-lei-e-normas/`](../01-brasil-lei-e-normas/).

### Lacuna (§9) — identificação fiscal na organização

- A API persiste campos opcionais `legal_name`, `tax_id_type` (`cpf` / `cnpj`) e `tax_id` (normalizado, único quando preenchido) em `organizations`.
- **Estado:** armazenamento técnico preparado; política de recolha, base legal, consentimento, retention e DPIA **não** estão fechados neste repositório. Antes de obrigar preenchimento ou usar `tax_id` para facturação/compliance fiscal, actualizar este módulo e o [`../00-meta/INDEX.md`](../00-meta/INDEX.md) com requisitos explícitos e artefactos.

## Ver também

- [`../00-meta/INDEX.md`](../00-meta/INDEX.md)
- [`../module-plan-entitlements/`](../module-plan-entitlements/)
