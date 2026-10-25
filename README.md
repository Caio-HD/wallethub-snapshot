# WalletHub

> **Snapshot notice.** This repository is a single, one-time copy of WalletHub, a personal finance app I build and use every day. Development continues in a private repository; **this copy does not receive updates**. Deployment scripts, infrastructure details, security reports and internal tooling were removed, and hostnames were replaced with placeholders.
>
> **Aviso.** Este repositório é uma cópia única do WalletHub, um app de finanças pessoais que construo e uso todos os dias. O desenvolvimento continua num repositório privado; **esta cópia não recebe atualizações**.

Aplicação financeira auto-hospedável com **multi-tenant por organização**: cada utilizador pode pertencer a várias organizações (espaço de trabalho), com dados financeiros isolados por `organization_id`, cabeçalho **`X-Organization-Id`** nas rotas protegidas por `ActiveOrganizationGuard`, e papel global JWT `admin` ou `super_admin` (este último para operações de plataforma). Integração bidireccional com WhatsApp e RAG por organização onde aplicável.

## Visão Rápida
- **Backend:** NestJS + PostgreSQL + Redis (BullMQ para filas e projeções).
- **Frontend:** React + Vite, TailwindCSS e React Query.
- **Integrações:** Webhook WhatsApp Cloud API, projeções automáticas, dashboards em tempo real.

Documentação completa: [`docs/README.md`](docs/README.md) - Índice principal da documentação

Principais seções:
- [Arquitetura](docs/arquitetura.md) - Arquitetura do sistema e modelo de dados
- [Desenvolvimento](docs/desenvolvimento.md) - Guia de setup e desenvolvimento
- [CLI e Workflows](docs/cli-workflows.md) - Documentação da CLI e workflows

Pendências: [`docs/backlog.md`](docs/backlog.md)

## Pré-requisitos
- Node.js 20+
- Docker e Docker Compose (para stack completa)
- PostgreSQL 15+
- Redis 6+

## Como Executar (desenvolvimento)
```bash
# Na raiz do repositório (instala todos os workspaces e dependências)
npm install

# Backend
cd apps/api
npm run build
npm run migration:run   # primeira vez / após mudanças de schema
npm run start:dev

# Frontend (em outro terminal)
cd apps/web
npm run dev
```

> Nota: os workflows da CLI (`wallethub workflow dev:start`) executam automaticamente `npm install` na raiz, verificam dependências de runtime críticas da API com `npm run deps:check` em `apps/api` e sobem o stack Docker com `docker compose ... up -d --build`, garantindo que imagens e containers usem sempre as versões mais recentes das dependências declaradas.

Alternativamente, builds a partir da raiz: `npm run build -w @wallethub/api`, `npm run build -w @wallethub/web`.

Configure as variáveis de ambiente principais:
- `DATABASE_URL` ou `DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASSWORD`/`DB_NAME`
- `REDIS_URL`
- `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY`
- `META_APP_SECRET`, `WHATSAPP_PHONE_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_VERIFY_TOKEN`

No desenvolvimento, o seed `ops/dev/seeds/base.sql` cria utilizadores de exemplo (`rick` com `super_admin`, `nya` com `admin`) e **uma organização por utilizador** (`Rick workspace`, `Nya workspace`) com membership `owner`. Ver [Arquitetura — organizações](docs/arquitetura.md) e [compliance ORG-001](docs/compliance/module-organizations/README.md) para dados fiscais opcionais da org.

### Banco de Dados Local (Docker)
- Arquitetura padrão descrita em `ops/dev/docker-compose.db.yml`, com persistência em `ops/dev/volumes` e backups em `ops/dev/backups`. O Postgres **não** executa mais `base.sql` no `initdb` (o schema vem das migrations da API); use `wallethub db seed` após as migrations.
- Manifestos de ambiente em `config/envs`. O perfil padrão `personal` injeta variáveis para Docker Compose e para os comandos da CLI.
- **Configuração inicial**: Copie `config/envs/personal.json.example` para `config/envs/personal.json` e ajuste as credenciais. A CLI também cria automaticamente se o arquivo não existir.
- Principais comandos:
  - `npm exec -- wallethub db up` / `down` — sobe/derruba Postgres, Redis e Adminer.
  - `npm exec -- wallethub db psql` — abre um shell `psql` autenticado no container (Postgres exposto em `localhost:55432`).
  - `npm exec -- wallethub db backup` — gera dump em `ops/dev/backups/postgres`.
  - `npm exec -- wallethub db seed` — aplica `ops/dev/seeds/base.sql` (ou use `--file`).
  - `npm exec -- wallethub db diagnose` — exibe status do Compose, `select version()` (Postgres `localhost:55432`) e `redis-cli ping` (Redis `localhost:56379`).
- Para alternar ambientes, utilize a flag `--env <nome>` e adicione novos manifestos em `config/envs/*.json`.

#### Proxy Vite: `ECONNREFUSED` em `/api/...` (Docker)
O dev server do `web` encaminha `/api` para `http://api:<porta interna>` (ex.: `3001`). Esse erro significa que **nada está a escutar** nessa porta no contentor da API — tipicamente a API ainda a arrancar, ou o processo Nest caiu (migrations, JWT, DB, etc.).

1. Ver logs: `docker logs wallethub_api` (ou `docker compose -f ops/dev/docker-compose.yml logs -f api`).
2. Confirmar JWT: ficheiro `secrets/jwt/.env.jwt` referenciado no compose.
3. Postgres/Redis com healthcheck OK; na primeira subida a API pode demorar até ~2 min (instalação de deps no contentor).
4. O serviço `web` só arranca depois da API passar no healthcheck; se o `web` não subir, trate primeiro a API até `GET /api/health` responder 200 dentro do contentor.

### Menu interativo
- `npm run WalletHub` abre o menu agrupado em quatro categorias:
  - **Ambiente Completo**: inicia, derruba ou reseta toda a stack (`db up` + diagnósticos).
  - **Banco de Dados**: acessos pontuais (`psql`), backups, seeds e healthcheck.
  - **Serviços de Desenvolvimento**: sobe/derruba docker-compose.ci e expõe atalhos para iniciar API/Web (bloqueiam o terminal atual).
  - **Pipelines e Diagnóstico**: executa `wallethub ci` ou `wallethub diagnose`.
- Use `ESC`, “Voltar” ou “Sair” para retornar/encerrar. Todos os fluxos reutilizam os comandos existentes e aceitam `--env <nome>`.

## Testes
Os testes residem em pastas separadas do código de produção (`apps/api/tests/`, `apps/web/tests/`). Ver [Regras](docs/Regras.md).

```bash
cd apps/api && npm run test
cd apps/api && npm run test:e2e
cd apps/web && npm run test
```

Consulte [docs/backlog.md](docs/backlog.md) para o status atual e itens ainda em aberto (ex.: ajustes na configuração do Jest e vulnerabilidades do frontend).

## CHANGELOG
Alterações relevantes são registadas em [CHANGELOG.md](CHANGELOG.md). Deve ser atualizado a cada alteração, com status da build, resultados dos testes e cobertura quando aplicável (ver [Regras](docs/Regras.md)).
