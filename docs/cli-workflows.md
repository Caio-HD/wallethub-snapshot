# CLI e Workflows

Este documento descreve a CLI do WalletHub (Python), seus comandos e workflows automatizados.

## Visão Geral

A CLI é a ferramenta única de developer experience: instale via **pipx** ou **venv** (ver seção [Instalação da CLI](#instalação-da-cli) abaixo) e use o comando `wallethub`. Os scripts npm na raiz (`npm run wallethub`, `npm run setup`, etc.) dependem do binário `wallethub` no PATH. Todos os workflows seguem o princípio DRY e reutilizam comandos existentes.

## Instalação da CLI

### Requisitos

- Python 3.11 ou superior
- pip (geralmente vem com Python)
- Node.js e npm (para build dos serviços)
- Docker e Docker Compose

**Ambiente híbrido:** No Windows, os comandos `ci` e `deploy` requerem bash (WSL ou Git for Windows). Em produção, execute o deploy no servidor Ubuntu.

### Launcher na raiz (sem instalação prévia)

Na raiz do repositório:

```bash
python3 wallethub.py
```

Na primeira execução, é criado `tools/cli-py/.venv` e instalado o pacote em modo editável, depois o processo é reiniciado com o Python desse venv (evita PEP 668 / `externally-managed-environment` no Python do sistema em Ubuntu/Debian).

Para desativar este bootstrap (por exemplo em CI quando já existe um venv ou `pipx`): exporte `WALLETHUB_SKIP_VENV=1` e use um interpretador com as dependências instaladas manualmente (`pip install -e tools/cli-py`).

O bootstrap atualiza `setuptools` e `wheel` juntamente com o `pip` antes do modo editável, para compatibilidade com Python 3.12+ (evita erros ligados a `pkgutil.ImpImporter`). Com um `.venv` criado antes desta correção, apagar `tools/cli-py/.venv` e voltar a correr o launcher repõe dependências corretas.

### Opção 1: Via pipx (Recomendado)

pipx instala a CLI em um ambiente isolado, evitando conflitos com outros projetos Python.

```bash
# Instalar pipx (se não tiver)
python -m pip install --user pipx
python -m pipx ensurepath

# Instalar CLI WalletHub (na raiz do repositório)
pipx install -e tools/cli-py
```

### Opção 2: Via venv local

```bash
cd tools/cli-py
python -m venv venv

# No Windows:
venv\Scripts\activate

# No Linux/macOS:
source venv/bin/activate

# Instalar CLI
pip install -e .
```

### Opção 3: Via Poetry (Desenvolvimento)

```bash
cd tools/cli-py
poetry install
poetry run wallethub --help
```

### Verificação

Após instalação, verifique se funciona: `wallethub --help`. Se instalado via venv sem ativar: `python -m wallethub --help`.

### Executar sem instalar

Na raiz do repositório é possível executar a CLI sem instalação (pipx/venv):

- **Qualquer SO:** `python wallethub.py [args]` (ex.: `python wallethub.py --help`, `python wallethub.py menu`).
- **Linux/macOS:** opcionalmente `./wallethub.py [args]` após `chmod +x wallethub.py`.

Requisito: Python 3.11+ no PATH.

### Atualização e desinstalação

- **pipx:** `pipx upgrade wallethub-cli` / `pipx uninstall wallethub-cli`
- **venv:** `pip install --upgrade -e .` na pasta `tools/cli-py` / `deactivate` e remover a pasta `venv`

### Troubleshooting

- **Comando não encontrado:** pipx — verifique se `~/.local/bin` está no PATH; venv — ative o ambiente; Windows — use `python -m wallethub`.
- **Dependências Python faltando:** `pip install typer rich questionary tenacity pydantic python-dotenv pyyaml requests cryptography`
- **Permissão (Windows):** execute como administrador se necessário: `pipx install -e tools/cli-py`

## Migração (CLI Node → Python)

A CLI WalletHub é **apenas a versão Python** (`tools/cli-py`). A CLI Node.js/TypeScript (`tools/cli`) foi removida do repositório.

- **Instalação:** pipx ou venv (ver seção [Instalação da CLI](#instalação-da-cli) acima).
- **Comando:** `wallethub` (deve estar no PATH após a instalação).
- Os scripts npm na raiz (`npm run wallethub`, `npm run setup`, etc.) chamam o binário `wallethub`; é necessário ter a CLI Python instalada para que funcionem.

Em caso de problemas: verifique Python 3.11+ e execute `wallethub diagnose`; no Windows, para `ci` e `deploy`, instale WSL ou Git for Windows.

## Ambiente híbrido (Windows dev / Ubuntu prod)

- **Desenvolvimento (Windows):** Requisitos: Python 3.11+, Node/npm, Docker Desktop. Para `wallethub ci` e `wallethub deploy` a partir do Windows é necessário **bash** (WSL ou Git for Windows); o comando `ci` verifica a presença de bash e orienta em caso de falha.
- **Produção (Ubuntu):** O deploy de produção deve ser executado no servidor Ubuntu; o script `ops/prod/deploy-local.sh` e o docker-compose são pensados para Linux. A partir do Windows, o deploy usa caminhos em formato WSL (recomenda-se usar WSL).

## Menu Interativo

O menu interativo oferece acesso organizado a todos os workflows:

```bash
wallethub menu
# ou (se o npm run estiver configurado)
npm run WalletHub
```

### Estrutura do Menu

O menu está organizado em três categorias principais:

#### 1. Desenvolvimento
- **Iniciar stack local** - Validações + stack + diagnósticos
- **Iniciar stack com testes** - Validações + stack + testes pós-stack
- **Parar stack** - Mantém volumes
- **Resetar stack** - Remove volumes

#### 2. Produção
- **Deploy completo** - Backup + CI + release + deploy + migrações + diagnósticos
- **Parar produção** - Derruba stack

#### 3. Manutenção
- **Gerar/rotacionar secrets JWT** - Com histórico automático
- **Gerar backup de produção** - Postgres com timestamp
- **Restaurar backup de produção** - Seleção interativa

## Workflows de Desenvolvimento

### `dev:start` - Iniciar Stack Local

Inicia o ambiente de desenvolvimento com validações pré-stack e stack completo.

**Comportamento padrão (sem flags):**
- Validações pré-stack: Docker, chaves JWT (geradas automaticamente se ausentes), lint/type-check/build dos apps (na API, `validate-build` = ESLint **só em `src/**/*.ts`** + `nest build`)
- Subida do stack: Postgres, Redis, Adminer, API e Web
- Execução de migrations e seed
- Diagnóstico básico do stack

**Flags opcionais:**
- `--with-tests`: Executa testes pós-stack completos (unitários, e2e e healthchecks) após stack estar pronto. **100% de sucesso obrigatório** - workflow falha se qualquer teste falhar

**Exemplos:**
```bash
# Início rápido (apenas validações + stack + diagnósticos)
wallethub workflow dev:start

# Com testes pós-stack
wallethub workflow dev:start --with-tests
```

### `dev:stop` - Parar Stack

Derruba o stack local mantendo volumes (dados preservados).

```bash
wallethub workflow dev:stop
```

### `dev:reset` - Resetar Stack

Derruba o stack local removendo volumes (limpeza completa).

```bash
wallethub workflow dev:reset
```

## Workflows de Produção

### `prod:start` - Iniciar Ambiente de Produção

Executa workflow completo de produção:

1. Garante configuração de ambiente (cria `production.json` se necessário)
2. Faz backup do banco de dados
3. Executa CI completo (com artifacts em `ops/prod/artifacts/ci/`)
4. Gera imagens de release
5. Aplica stack de deploy
6. Aguarda serviços estarem prontos
7. Executa migrações do banco de dados
8. Executa diagnósticos
9. Verifica saúde dos serviços (Postgres, Redis, API, Frontend)

**Exemplo:**
```bash
wallethub workflow prod:start
```

### `prod:stop` - Parar Ambiente de Produção

Derruba stack de produção.

```bash
wallethub workflow prod:stop
```

## Workflows de Manutenção

### Gerar/Rotacionar Secrets JWT

Gera novo par de chaves RSA e arquiva as antigas com histórico automático.

**Funcionalidades:**
- Gera par de chaves RSA 4096 bits
- Arquiva chaves antigas em `secrets/jwt/history/`
- Mantém histórico dos últimos 5 pares
- Exporta variáveis em `.env.jwt`

**Uso via menu:**
- Acesse o menu e selecione "Manutenção" → "Gerar/rotacionar secrets JWT"

**Uso direto:**
```bash
wallethub secrets jwt
```

### Gerar Backup de Produção

Cria backup do banco Postgres com timestamp.

**Funcionalidades:**
- Verifica se Postgres está rodando
- Cria backup em formato custom (`.dump`)
- Salva em `ops/prod/backups/postgres/`
- Nome automático com timestamp

**Uso via menu:**
- Acesse o menu e selecione "Manutenção" → "Gerar backup de produção"

### Restaurar Backup de Produção

Lista backups disponíveis e restaura o selecionado.

**Funcionalidades:**
- Lista backups disponíveis (`.dump` e `.sql`)
- Mostra tamanho e data de modificação
- Seleção interativa
- Suporta formatos custom (`.dump`) e plain (`.sql`)

**Uso via menu:**
- Acesse o menu e selecione "Manutenção" → "Restaurar backup de produção"

## Comandos da CLI

### Banco de Dados

```bash
# Subir/derruba stack
wallethub db up|down

# Shell psql
wallethub db psql

# Backup
wallethub db backup

# Seed
wallethub db seed

# Diagnóstico
wallethub db diagnose
```

### Deploy

```bash
# Subir stack de produção
wallethub deploy up

# Derrubar stack
wallethub deploy down

# Logs
wallethub deploy logs

# Status
wallethub deploy ps
```

### Outros Comandos

```bash
# Setup inicial
wallethub setup

# CI completo
wallethub ci

# Release (imagens)
wallethub release

# Diagnóstico geral
wallethub diagnose
```

## Estrutura de Artifacts Gerados

Os workflows geram relatórios timestampados em:

**Desenvolvimento:**
- `ops/dev/artifacts/pre-stack/{timestamp}/` - Validações pré-stack (lint, type-check, build, diagnose)
- `ops/dev/artifacts/post-stack/{timestamp}/` - Testes pós-stack (unitários, e2e, healthchecks, diagnose-stack)

**Produção:**
- `ops/prod/artifacts/ci/{timestamp}/` - Relatórios de CI (reutiliza estrutura de `ops/ci/artifacts/`)

> **Observação**: todos os diretórios de artefatos (`ops/ci/artifacts`, `ops/dev/artifacts`, `ops/prod/artifacts`) são ignorados no Git e recriados automaticamente pelos scripts para manter o repositório limpo.

**Cleanup automático:** Apenas os últimos 10 artifacts são mantidos por categoria (limpeza automática após cada geração).

## Comportamento e Regras

- **Validações pré-stack**: Se falharem, não sobe stack (fail-fast)
- **Testes pós-stack**: Executa todos os testes (unitários, e2e e healthchecks). **100% de sucesso obrigatório** - workflow falha se qualquer teste falhar, conforme regras do projeto
- **Produção usa Traefik**: Proxy reverso direto (DNS → IP do servidor), não Cloudflare Tunnel
- **Automação completa**: Chaves JWT e configurações de ambiente são geradas/criadas automaticamente se ausentes
- **Backups automáticos**: Workflow de produção cria backup antes de aplicar mudanças

## Variáveis de Ambiente

Os workflows utilizam configurações de ambiente definidas em `config/envs/*.json`. O ambiente padrão é `personal`.

Para usar um ambiente diferente:
```bash
wallethub workflow dev:start --env production
```

---

**Ver também**: [Desenvolvimento](desenvolvimento.md) | [Deploy e Operações](deploy-operacoes.md) | [Arquitetura](arquitetura.md)

