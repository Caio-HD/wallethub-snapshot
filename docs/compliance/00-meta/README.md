# Meta — biblioteca de compliance

Esta pasta define **convenções** e o **índice mestre** da biblioteca de documentos de compliance em `docs/compliance/`.

## Objectivos

- Uma **fonte de verdade** para saber que documentos existem, onde estão guardados e quando foram obtidos.
- Nomenclatura **estável** de ficheiros descarregados para auditoria e diffs.
- Evitar duplicação desnecessária: leis e normas gerais ficam preferencialmente em [`../01-brasil-lei-e-normas/`](../01-brasil-lei-e-normas/); as pastas `module-*` referenciam e acrescentam o que for específico do módulo.

## Convenção de nomes de ficheiros

Formato recomendado para artefactos descarregados:

```text
YYYY-MM-DD__<fonte-curta>__<titulo-curto>.<ext>
```

Exemplos:

- `2026-04-16__anpd__guia-orientativo-xyz.pdf`
- `2026-04-16__meta__whatsapp-business-policy.html`

Regras:

- Use **ASCII** no slug (`titulo-curto`) para compatibilidade entre sistemas.
- Se o documento for actualizado pelo emissor, acrescente na ficha do `INDEX.md` a nova versão/data sem apagar o registo anterior (historial).

## Par canónico + versão legível para LLMs

Muitos PDFs ou HTMLs oficiais são **pouco úteis** para auditoria automatizada (binários, OCR, markup pesado). Para cada documento relevante, mantêm-se **dois** artefactos com o **mesmo** slug e data:

| Artefacto | Extensão típica | Finalidade |
|-----------|-----------------|------------|
| **Canónico** | `.pdf` ou `.html` | Evidência integral, formato emitido pela fonte (auditoria humana, integridade). |
| **Legível LLM** | `.md` | Texto plano estruturado (cabeçalhos, artigos) para leitura em massa, *chunking* e citação por modelos; **não** substitui o canónico. |

**Localização:** os `.md` derivados ficam em [`../artifacts/llm/`](../artifacts/llm/) (um único sítio, nomes estáveis `YYYY-MM-DD__<fonte>__<slug>.md`). Os PDF/HTML podem viver na pasta temática (`01-brasil-lei-e-normas/`, `module-*`, etc.) ou também sob `artifacts/` se preferir um arquivo central — o [`INDEX.md`](INDEX.md) regista sempre os dois caminhos.

**Fidelidade (obrigatório):**

- Preferir **extração mecânica** do canónico (`pdftotext`, HTML→Markdown, cópia de texto oficial) com revisão mínima de encoding e quebras de linha.
- **Proibido** apresentar como texto legal integral um conteúdo que seja **síntese generativa** ou parafrase não verificada.
- Se só for possível **resumo** ou trechos (limitações de licença, documento gigante), o ficheiro `.md` deve declarar no cabeçalho `kind: summary` ou `kind: excerpt` e listar o que **não** está incluído.

**Cabeçalho YAML recomendado** nos `.md` em `artifacts/llm/`:

```yaml
---
id: BR-001
title: "Lei nº 13.709/2018 (LGPD)"
canonical_path: ../01-brasil-lei-e-normas/2026-04-16__planalto__lgpd-l13709.pdf
source_url: "https://..."
obtained_date: 2026-04-16
kind: extracted
---
```

## Ficha mínima por documento

Para cada documento arquivado, registe no `README.md` da pasta e/ou no [`INDEX.md`](INDEX.md):

| Campo | Obrigatório | Descrição |
|--------|-------------|-----------|
| Título | Sim | Nome legível |
| Tipo | Sim | `lei` \| `norma` \| `orientação` \| `política_terceiro` \| `contrato` \| `outro` |
| Fonte (URL) | Sim | URL oficial ou do fornecedor |
| Obtido em | Sim | Data `YYYY-MM-DD` |
| Ficheiro local (canónico) | Se aplicável | Caminho relativo a `docs/compliance/` |
| Legível LLM (`.md`) | Se aplicável | Caminho em `artifacts/llm/` ou nota `n/a` |
| Hash SHA-256 | Não | Para integridade, se desejado |

## Recolha e auditoria (contínuo)

1. Manter o [`INDEX.md`](INDEX.md) com estado **obtido** e datas quando os documentos forem substituídos.
2. Renovar snapshots HTML/PDF quando fornecedores alterarem políticas.
3. A matriz **requisito → módulo → evidência** está em [`MATRIX.md`](MATRIX.md); actualizar quando novos módulos ou integrações forem adicionados.

## Referência

- Plano de produto e módulos: [`../../arquitetura.md`](../../arquitetura.md)
