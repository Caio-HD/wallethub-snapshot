# Integração Notion

Documentação técnica da integração bidirecional entre WalletHub e Notion para sincronização de dados financeiros.

## Visão Geral

A integração Notion permite sincronizar automaticamente dados financeiros entre o WalletHub e databases do Notion, incluindo:

- **Transações**: Receitas e despesas
- **Contas**: Contas bancárias e carteiras
- **Categorias**: Categorias de transações
- **Projeções**: Projeções financeiras calculadas

A sincronização é bidirecional e em tempo real, usando:
- **WalletHub → Notion**: Entity Subscribers detectam mudanças e publicam jobs na fila `notion-sync`
- **Notion → WalletHub**: Webhooks do Notion são recebidos e processados na fila `notion-webhook`

## Configuração

### 1. Criar Databases no Notion

Crie quatro databases no Notion com as seguintes propriedades:

#### Database: Transactions

| Propriedade | Tipo | Descrição |
|------------|------|-----------|
| Amount | Number | Valor da transação |
| Date | Date | Data da transação |
| Category | Relation | Relação com database Categories |
| Account | Relation | Relação com database Accounts |
| User | Relation | Relação com usuário (opcional) |
| Direction | Select | `income` ou `expense` |
| Description | Rich Text | Descrição da transação |
| Source | Select | `web` ou `whatsapp` |
| WalletHubId | Rich Text | ID da entidade no WalletHub (oculto) |

#### Database: Accounts

| Propriedade | Tipo | Descrição |
|------------|------|-----------|
| Name | Title | Nome da conta |
| Initial Balance | Number | Saldo inicial |
| Owner Scope | Select | `all`, `user1` ou `user2` |
| Is Active | Checkbox | Se a conta está ativa |
| WalletHubId | Rich Text | ID da entidade no WalletHub (oculto) |

#### Database: Categories

| Propriedade | Tipo | Descrição |
|------------|------|-----------|
| Name | Title | Nome da categoria |
| Type | Select | `income` ou `expense` |
| Owner Scope | Select | `all`, `user1` ou `user2` |
| Is Active | Checkbox | Se a categoria está ativa |
| Sort Order | Number | Ordem de exibição |
| WalletHubId | Rich Text | ID da entidade no WalletHub (oculto) |

#### Database: Projections

| Propriedade | Tipo | Descrição |
|------------|------|-----------|
| Period Start | Date | Início do período |
| Period End | Date | Fim do período |
| Scope | Select | `all`, `user1` ou `user2` |
| Projected Income | Number | Receita projetada |
| Projected Expense | Number | Despesa projetada |
| Projected Balance | Number | Saldo projetado |
| Trend | Select | `up`, `flat` ou `down` |
| Generated At | Date | Data de geração |
| WalletHubId | Rich Text | ID da entidade no WalletHub (oculto) |

### 2. Obter API Key e Database IDs

1. Acesse [Notion Integrations](https://www.notion.so/my-integrations)
2. Crie uma nova integração
3. Copie o **Internal Integration Token** (começa com `secret_`)
4. Compartilhe cada database com a integração (Settings → Connections)
5. Obtenha os Database IDs:
   - Abra cada database no Notion
   - O ID está na URL: `https://www.notion.so/{workspace}/{database-id}?v=...`
   - O Database ID é a parte após o workspace e antes do `?`

### 3. Configurar Webhook (Opcional)

Para sincronização Notion → WalletHub:

1. Configure um webhook no Notion apontando para: `https://seu-dominio.com/api/notion/webhook`
2. Copie o **Webhook Secret** fornecido pelo Notion
3. Adicione ao arquivo de configuração

### 4. Variáveis de Ambiente

Adicione as seguintes variáveis ao seu arquivo de configuração (`config/envs/personal.json` ou variáveis de ambiente):

```json
{
  "notion": {
    "apiKey": "secret_...",
    "transactionsDbId": "abc123...",
    "accountsDbId": "def456...",
    "categoriesDbId": "ghi789...",
    "projectionsDbId": "jkl012...",
    "webhookSecret": "webhook_secret_...",
    "syncEnabled": true
  }
}
```

Ou via variáveis de ambiente:

```bash
NOTION_API_KEY=secret_...
NOTION_TRANSACTIONS_DB_ID=abc123...
NOTION_ACCOUNTS_DB_ID=def456...
NOTION_CATEGORIES_DB_ID=ghi789...
NOTION_PROJECTIONS_DB_ID=jkl012...
NOTION_WEBHOOK_SECRET=webhook_secret_...
NOTION_SYNC_ENABLED=true
NOTION_RETRY_MAX_ATTEMPTS=3
NOTION_RETRY_DELAY_MS=1000
```

## Endpoints

### GET /api/notion/status

Verifica o status da integração Notion.

**Autenticação**: Requerida (Admin)

**Resposta**:
```json
{
  "enabled": true,
  "configured": true,
  "databases": {
    "transactions": "abc123...",
    "accounts": "def456...",
    "categories": "ghi789...",
    "projections": "jkl012..."
  }
}
```

### POST /api/notion/sync

Dispara sincronização manual (futuro).

**Autenticação**: Requerida (Admin)

**Body**:
```json
{
  "entityType": "transaction",
  "entityIds": ["uuid1", "uuid2"],
  "scope": "all"
}
```

### GET /api/notion/webhook

Verificação de webhook do Notion.

**Query Parameters**:
- `challenge`: String de desafio do Notion

**Resposta**: Retorna o `challenge` recebido

### POST /api/notion/webhook

Recebe webhooks do Notion para sincronização Notion → WalletHub.

**Headers**:
- `x-notion-signature`: Assinatura do webhook (se configurado)

**Body**: Formato do webhook Notion

## Fluxo de Sincronização

### WalletHub → Notion

1. Entidade é criada/atualizada/removida no WalletHub
2. `NotionEntitySubscriber` detecta a mudança via TypeORM events
3. Job é publicado na fila `notion-sync`
4. `NotionSyncProcessor` processa o job
5. Serviço de sincronização apropriado mapeia a entidade para formato Notion
6. Página é criada/atualizada no database Notion correspondente

### Notion → WalletHub

1. Mudança ocorre no database Notion
2. Notion envia webhook para `/api/notion/webhook`
3. `NotionController` valida assinatura e publica job na fila `notion-webhook`
4. `NotionWebhookProcessor` processa o job
5. Serviço de sincronização mapeia página Notion para entidade WalletHub
6. Entidade é atualizada no WalletHub
7. Entity Subscriber detecta mudança mas ignora (evita loop)

## Considerações Importantes

### Idempotência

- Cada entidade WalletHub tem um campo `WalletHubId` no Notion
- Isso evita duplicação ao sincronizar
- Se uma página Notion já existe com o mesmo `WalletHubId`, ela é atualizada

### Conflitos

- Atualmente, a última mudança vence
- Mudanças simultâneas podem causar sobrescrita
- Considere implementar estratégia de resolução de conflitos mais sofisticada

### Rate Limiting

- Notion API tem limites de rate
- O sistema implementa retry com backoff exponencial
- Configure `NOTION_RETRY_MAX_ATTEMPTS` e `NOTION_RETRY_DELAY_MS` conforme necessário

### Segurança

- Webhooks são validados usando assinatura HMAC-SHA256
- Configure `NOTION_WEBHOOK_SECRET` para habilitar validação
- API Key deve ser mantida segura (não commitar no código)

### Logging

- Todas as sincronizações são logadas
- Use logs para auditoria e troubleshooting
- Nível de log: `debug` para detalhes, `info` para eventos importantes

## Troubleshooting

### Sincronização não funciona

1. Verifique se `NOTION_SYNC_ENABLED=true`
2. Verifique se API Key está correta
3. Verifique se databases foram compartilhados com a integração
4. Verifique logs para erros específicos

### Webhook não recebe eventos

1. Verifique se URL do webhook está correta
2. Verifique se webhook está ativo no Notion
3. Verifique se `NOTION_WEBHOOK_SECRET` está configurado
4. Verifique logs do servidor

### Erros de rate limiting

1. Aumente `NOTION_RETRY_DELAY_MS`
2. Reduza frequência de mudanças
3. Considere implementar batching

## Arquitetura

```
WalletHub Entity → NotionEntitySubscriber → notion-sync Queue
                                              ↓
                                    NotionSyncProcessor
                                              ↓
                                    Sync Service (Transactions/Accounts/etc)
                                              ↓
                                          Notion API

Notion Database → Webhook → NotionController → notion-webhook Queue
                                              ↓
                                    NotionWebhookProcessor
                                              ↓
                                    Sync Service
                                              ↓
                                        WalletHub Entity
```

## Referências

- [Notion API Documentation](https://developers.notion.com/)
- [Notion Webhooks](https://developers.notion.com/docs/working-with-webhooks)
