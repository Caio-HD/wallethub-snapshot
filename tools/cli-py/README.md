# WalletHub CLI (Python)

Ferramenta de Developer Experience para WalletHub. É a única CLI do projeto (a versão Node.js foi removida).

## Launcher na raiz do repositório (venv automático)

Na raiz do clone, sem instalar antes no sistema:

```bash
python3 wallethub.py
```

Na primeira execução, a CLI cria `tools/cli-py/.venv`, instala o pacote em modo editável (`pip install -e`) e reinicia o processo com o Python desse venv. Isto evita o erro PEP 668 (`externally-managed-environment`) em Ubuntu/Debian ao instalar dependências com `pip`.

Para desativar o bootstrap (CI, pipelines ou quando já usa `pipx`/venv manual): defina `WALLETHUB_SKIP_VENV=1` e garanta que o interpretador atual tem as dependências instaladas (por exemplo `pip install -e tools/cli-py` dentro de um venv).

O bootstrap atualiza `pip`, `setuptools` e `wheel` antes do `pip install -e` (setuptools recente evita `AttributeError: module 'pkgutil' has no attribute 'ImpImporter'` no Python 3.12+). Se um `.venv` antigo ainda falhar, apague `tools/cli-py/.venv` e volte a executar o launcher.

## Instalação rápida

```bash
# Via pipx (recomendado)
pipx install -e tools/cli-py

# Ou via venv
cd tools/cli-py && python -m venv venv && source venv/bin/activate  # Linux/macOS
# Windows: venv\Scripts\activate
pip install -e .
```

**Requisitos:** Python 3.11+, Node.js/npm, Docker. No Windows, `wallethub ci` e `wallethub deploy` requerem bash (WSL ou Git for Windows).

Documentação completa (instalação, troubleshooting, migração, comandos e workflows): [docs/cli-workflows.md](../../docs/cli-workflows.md).

## Uso

```bash
wallethub --help
wallethub menu
wallethub workflow dev:start
```
