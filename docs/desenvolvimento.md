# Guia de Desenvolvimento

Este documento descreve como configurar o ambiente de desenvolvimento, executar testes e trabalhar com a stack local.

> ⚠️ **AVISO — comandos destrutivos:** instruções deste guia que removem volumes
> (`docker compose down -v`, "Resetar stack removendo volumes") são **exclusivas do
> ambiente de desenvolvimento local**. **Jamais** execute-as no servidor de produção —
> lá elas destruiriam dados reais e violam a política de não-exclusão
> (`WalletHub/ops/paas/ROLLBACK-RUNBOOK.md`).

## Pré-requisitos

- Node.js 20+
- Docker e Docker Compose V2
- Bash (ou Git Bash em Windows)
- Portas 5432/6379 livres para Postgres/Redis internos de teste

## Setup Inicial

### Instalação

```bash
# Na raiz do projeto
npm install
```

A primeira execução do workspace gera `package-lock.json` e compila a CLI via `prepare`.

### Comandos Principais da CLI

- `wallethub setup` - Instala dependências dos serviços e recompila a CLI
- `wallethub dev up|down` - Sobe/derruba Postgres/Redis
- `wallethub dev api|web` - Watchers para desenvolvimento
- `wallethub ci` - Pipeline completo
- `wallethub release` - Imagens de produção
- `wallethub diagnose` - Checagens de ambiente/Bash/Docker/envs

Scripts npm na raiz (`npm run ci`, `npm run setup`, etc.) encapsulam essas chamadas.

## Assistência IA (kit Antigravity em `.agent/`)

Quando uma tarefa usar **agentes** do kit (Markdown em `.agent/agents/`):

1. **Passo zero:** seguir primeiro [`.agent/agents/orchestrator.md`](../.agent/agents/orchestrator.md) (coordenação e clarificação antes de especialistas).
2. **Arquitectura:** alinhar decisões a [`.agent/ARCHITECTURE.md`](../.agent/ARCHITECTURE.md) em vez de inventar padrões paralelos ao kit.

Isto reflecte a regra do workspace `.cursor/rules/wallethub-agent-architecture.mdc`.

## Stack Local (Docker Compose)

### Configuração

- Compose dedicado em `ops/dev/docker-compose.db.yml` mantém Postgres, Redis e Adminer
- Volumes bind em `ops/dev/volumes` (dados Postgres/Redis)
- Backups em `ops/dev/backups`
- Manifestos de ambiente em `config/envs/*.json` (padrão: `personal`)

> **Observação**: os diretórios `ops/dev/volumes` e `ops/dev/backups` são ignorados no Git e criados automaticamente pelos workflows. Se estiver operando manualmente, crie-os antes de executar os comandos.

### Comandos do Banco de Dados

```bash
# Subir/derruba stack
npm exec -- wallethub db up
npm exec -- wallethub db down

# Shell psql autenticado (Postgres exposto em localhost:55432)
npm exec -- wallethub db psql

# Backup (pg_dump custom/plain)
npm exec -- wallethub db backup

# Seed (aplica SQL local via docker cp)
npm exec -- wallethub db seed

# Diagnóstico
npm exec -- wallethub db diagnose
```

### Schema PostgreSQL e seed

1. **Migrations:** o schema é criado pela migration `InitialWalletHubSchema` (`apps/api/src/database/migrations/1770000000000-InitialWalletHubSchema.ts`). Com `synchronize` desligado por defeito, aplique com:
   - `cd apps/api && npm run build && npm run migration:run`, ou
   - stack `ops/dev/docker-compose.yml`: a API usa `TYPEORM_MIGRATIONS_RUN=true` no primeiro arranque.
2. **Opt-in perigoso:** `TYPEORM_SYNCHRONIZE=true` apenas para bases vazias/protótipos; nunca misturar com migrations numa base já migrada.
3. **Seed de desenvolvimento:** `ops/dev/seeds/base.sql` assume o schema já aplicado. Ordem: migrations → `npm exec -- wallethub db seed` (ou seed automático do workflow quando `users` está vazio).
4. **Reset:** bases criadas com migrations antigas (ficheiros removidos) devem usar volume Postgres novo ou `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` antes de correr a migration única.

Para alternar ambientes, utilize a flag `--env <nome>` e adicione novos manifestos em `config/envs/*.json`.

### Configuração de Ambiente

Os arquivos de configuração em `config/envs/` contêm credenciais sensíveis e **não são versionados** no Git. 

**Primeira configuração:**

1. Copie o arquivo de exemplo para criar sua configuração:
   ```bash
   cp config/envs/personal.json.example config/envs/personal.json
   ```

2. Edite `config/envs/personal.json` e ajuste as credenciais conforme necessário:
   - A senha padrão do docker-compose é `wallethub`
   - Se você alterou a senha no docker-compose, atualize aqui também

**Auto-criação:**

A CLI cria automaticamente `config/envs/personal.json` com valores padrão se o arquivo não existir ao executar workflows. Você pode ajustar as credenciais posteriormente.

**Nota de segurança:**

- Os arquivos em `config/envs/` estão no `.gitignore` e não devem ser commitados
- Use os arquivos `.example` como referência para novos desenvolvedores
- Para produção, o arquivo é criado automaticamente baseado em `ops/prod/.env.deploy`

### Adminer (ambiente dev)

O stack local inclui Adminer com tema customizado do WalletHub. O arquivo `ops/dev/adminer/theme.css` é montado no container em `/var/www/html/adminer.css` e aplicado automaticamente ao iniciar. Para personalizar, edite `theme.css`; as variáveis CSS em `:root` definem cores (primary, success, danger, warning, background, surface, text, border). O tema é apenas para desenvolvimento; em produção use uma ferramenta de gestão de banco mais robusta.

## Testes Automatizados

### Backend (NestJS)

```bash
cd apps/api

# Testes unitários
npm run test -- --runInBand

# Cobertura unitária (relatório em coverage/)
npm run test:cov

# Testes e2e (requer Postgres + Redis — mesmas portas que o CI publica para o host)
docker compose -f ops/ci/docker-compose.ci.yml up -d postgres redis
npm run test:e2e
```

Variáveis por omissão para e2e: ver [`apps/api/test/support/setup-e2e-env.ts`](../apps/api/test/support/setup-e2e-env.ts) (ex.: `127.0.0.1:55432` e `56379`).

Suites implementadas:
- `AuthService`, `TransactionsService`, `ProjectionsService`, utilitários

**Cobertura crítica (API):** o denominador e os portões estão em [`jest.config.ts`](../apps/api/jest.config.ts) (`collectCoverageFrom` + `coverageThreshold`). Comando: `npm run test:cov`.

**Lint e build pré-stack:** `npm run validate-build` na API executa `eslint "src/**/*.ts"` (só código em `src/`) e `nest build`. O [`jest.config.ts`](../apps/api/jest.config.ts) está no `include` do [`tsconfig.json`](../apps/api/tsconfig.json) da API e usa `readFileSync` para ler o `tsconfig.json` e alinhar `paths` do TypeScript ao `ts-jest`.

### Frontend (Vite/Vitest)

```bash
cd apps/web

# Testes unitários (exclui `tests/e2e`, reservado ao Playwright)
npm run test -- --run

# Cobertura (V8)
npm run test:cov

# E2E browser (também executado no job `web-ci` do `wallethub ci`)
npm run test:e2e
```

O Vitest usa `pool: 'forks'` com `maxForks: 1` / `minForks: 1` em [`vite.config.ts`](../apps/web/vite.config.ts) para `vitest run` / `test:cov` fiáveis no Windows (o pool `threads` podia dar timeout ao arrancar com cobertura).

### Cobertura crítica (portal de qualidade)

O relatório V8 **não** representa o monorepo inteiro a 80%: aplica-se um **conjunto crítico** (dashboard, transações, orçamentos, `apiClient`, contextos em `shared/context`), obtido por **`coverage.exclude`** de pastas fora desse conjunto (ver comentários em `vite.config.ts`). Não usar `coverage.include` só com ficheiros `.ts` — o instrumentador alinha-se a saída compilada e as métricas podem ficar a 0%.

Portões actuais (fail do CI se baixarem): linhas ≥80%; statements ≥78%; branches ≥60%; funções ≥68%.

Comandos:

```bash
cd apps/web && npm run test:cov
```

Specs (entre outras): `AuthProvider`, `DashboardPage`, `TransactionForm`, `walletHubApiBaseUrl`, `apiClient`, contextos activos, hooks de dados, smoke de componentes do dashboard.

### Builds

```bash
# Verificação de TypeScript e bundlers
cd apps/api && npm run build
cd apps/web && npm run build
```

## Dependências e containers

### Convenção: uma fonte de verdade

Todas as dependências de **runtime** usadas no código de um app (API ou Web) devem estar declaradas no `package.json` desse app:

- **API:** [apps/api/package.json](apps/api/package.json) — `dependencies` (e `devDependencies` para ferramentas de build/teste).
- **Web:** [apps/web/package.json](apps/web/package.json) — idem.

Não depender apenas de dependências transitivas ou de hoisting: se o código importa um pacote diretamente (ex.: `class-validator`, `@hapi/boom`), esse pacote deve constar no `package.json` do app. Os containers de desenvolvimento fazem `npm install` na raiz do monorepo; as dependências dos workspaces são instaladas a partir desses ficheiros.

### Verificação no container (API)

O script [apps/api/scripts/check-runtime-deps.js](apps/api/scripts/check-runtime-deps.js) é executado no container antes de `nest start --watch`. Ele verifica que pacotes críticos do bootstrap (class-validator, typeorm, bullmq, etc.) estão resolvíveis. Se algo faltar, o container falha em segundos em vez de falhar mais tarde com "package is missing". Para adicionar novos pacotes críticos ao check, edite a lista `deps` nesse script.

### Após adicionar dependências novas

Quando adicionar uma nova dependência ao `package.json` da API ou do Web:

1. Na raiz: `npm install` (para atualizar o lockfile e instalar localmente).
2. Em **Docker (stack dev)**: o volume nomeado `api_node_modules` (e `web_node_modules`) persiste entre runs. Se o container já tiver sido executado antes com um `node_modules` antigo, pode ser necessário **recriar os volumes** para que o `npm install` no CMD reponha o conteúdo. Use a opção **4 (Resetar stack removendo volumes)** do menu e em seguida a opção **1 (Iniciar stack local)**; ou execute `docker compose -f ops/dev/docker-compose.yml down -v` e depois suba de novo.

## Pipeline Docker Unificado

### Execução Local

```bash
# Opção bruta
./ops/ci/run-all.sh

# Via CLI
npm run ci
```

Ambos geram artefatos em `ops/ci/artifacts`.

### Artefatos Coletados

- Coberturas: `ops/ci/artifacts/api/coverage-unit`, `ops/ci/artifacts/web/coverage-unit`
- Relatórios e2e: `ops/ci/artifacts/api/jest-e2e-results.json`, `ops/ci/artifacts/web/playwright`
- Builds: `dist-*.tgz`

### Imagens de Produção

```bash
# Via Docker Compose
docker compose -f ops/ci/docker-compose.ci.yml --profile release build

# Via CLI
npm exec -- wallethub release
```

Produz as imagens `wallethub/api:ci` e `wallethub/web:ci` com as camadas de produção.

### Continuous Integration

Workflow GitHub Actions (`.github/workflows/ci.yml`) roda `npm exec -- wallethub ci` em pushes/PRs para `main`/`develop`, fazendo upload dos artefatos gerados.

**O que o `ops/ci/run-all.sh` bloqueia em caso de falha:** lint API, testes unitários API (com cobertura), testes e2e API, build API; lint Web, testes unitários Web (Vitest com cobertura), testes e2e Web (Playwright), build Web. Qualquer passo a `FAIL` no `summary.txt` deve impedir merge até correcção.

## Scripts NPM

O script `ops/ci/run-all.sh` permanece como núcleo do pipeline; a CLI somente o orquestra.

Principais scripts na raiz:
- `npm run ci` - Pipeline completo
- `npm run setup` - Setup inicial
- `npm run build` - Build dos serviços
- `npm run test` - Testes (quando disponível)

## Menu Interativo

```bash
npm run WalletHub
# ou
npm exec -- wallethub menu
```

O menu oferece acesso agrupado a:
- **Desenvolvimento**: workflows de stack local
- **Produção**: workflows de deploy
- **Manutenção**: secrets, backups e restore

Para mais detalhes sobre workflows, consulte [CLI e Workflows](cli-workflows.md).

---

**Ver também**: [Arquitetura](arquitetura.md) | [CLI e Workflows](cli-workflows.md) | [Deploy e Operações](deploy-operacoes.md)

