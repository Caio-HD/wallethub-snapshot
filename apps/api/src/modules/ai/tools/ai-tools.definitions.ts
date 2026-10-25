/**
 * Tool definitions for the financial AI agent.
 * JSON Schema format compatible with OpenAI Chat Completions and Vertex Gemini function calling.
 */
const scopeUserIdProperty = {
  userId: {
    type: 'string',
    description:
      'UUID do utilizador para âmbito individual (categorias partilhadas + desse titular). Omitir para conjunto (só categorias partilhadas).',
  },
} as const;

export const AI_TOOL_DEFINITIONS = [
  {
    name: 'get_dashboard_summary',
    description:
      'Obtém o resumo financeiro do período: saldo, receitas, despesas, top 5 categorias de despesa e uso de orçamento.',
    parameters: {
      type: 'object' as const,
      properties: {
        ...scopeUserIdProperty,
        period: {
          type: 'string',
          description: 'Período no formato yyyy-MM (ex: 2025-03). Omitir para mês atual.',
        },
      },
      required: [] as string[],
    },
  },
  {
    name: 'get_evolution_report',
    description:
      'Obtém a evolução mensal de receitas, despesas e saldo nos últimos N meses (até 24).',
    parameters: {
      type: 'object' as const,
      properties: {
        ...scopeUserIdProperty,
        months: {
          type: 'number',
          description: 'Número de meses (1 a 24). Padrão 6.',
        },
      },
      required: [] as string[],
    },
  },
  {
    name: 'get_projection',
    description:
      'Obtém a projeção de fluxo de caixa atual: receita/despesa projetadas, saldo projetado e tendência (up/flat/down).',
    parameters: {
      type: 'object' as const,
      properties: {
        ...scopeUserIdProperty,
      },
      required: [] as string[],
    },
  },
  {
    name: 'get_budgets',
    description: 'Lista orçamentos por categoria e orçamento mensal total para o período e escopo.',
    parameters: {
      type: 'object' as const,
      properties: {
        ...scopeUserIdProperty,
        period: {
          type: 'string',
          description: 'Período yyyy-MM. Omitir para mês atual.',
        },
      },
      required: [] as string[],
    },
  },
  {
    name: 'list_transactions',
    description:
      'Lista transações com filtros opcionais (período, categoria, conta). Retorna as mais recentes primeiro.',
    parameters: {
      type: 'object' as const,
      properties: {
        limit: {
          type: 'number',
          description: 'Máximo de transações a retornar (padrão 20, máx 50)',
        },
        period: {
          type: 'string',
          description: 'Período yyyy-MM para filtrar. Omitir para último mês.',
        },
      },
      required: [] as string[],
    },
  },
  {
    name: 'create_transaction',
    description:
      'Registra uma nova transação (receita ou despesa). Requer categoria e conta válidas; use list_categories e list_accounts se necessário.',
    parameters: {
      type: 'object' as const,
      properties: {
        amount: {
          type: 'number',
          description: 'Valor numérico (sempre positivo)',
        },
        direction: {
          type: 'string',
          enum: ['income', 'expense'],
          description: 'Tipo: income = receita, expense = despesa',
        },
        categoryId: {
          type: 'string',
          description: 'UUID da categoria (obtido em list_categories)',
        },
        accountId: {
          type: 'string',
          description: 'UUID da conta (obtido em list_accounts)',
        },
        description: {
          type: 'string',
          description: 'Descrição opcional da transação',
        },
      },
      required: ['amount', 'direction', 'categoryId', 'accountId'],
    },
  },
  {
    name: 'list_categories',
    description:
      'Lista todas as categorias ativas (receita e despesa) com id e nome para uso em create_transaction.',
    parameters: {
      type: 'object' as const,
      properties: {},
      required: [] as string[],
    },
  },
  {
    name: 'list_accounts',
    description: 'Lista todas as contas ativas com id e nome para uso em create_transaction.',
    parameters: {
      type: 'object' as const,
      properties: {},
      required: [] as string[],
    },
  },
  {
    name: 'get_portfolio_summary',
    description:
      'Resumo da carteira de investimentos do utilizador: totais, posições com quantidade, preço médio, cotação mais recente e P/L não realizado quando houver cotação.',
    parameters: {
      type: 'object' as const,
      properties: {},
      required: [] as string[],
    },
  },
  {
    name: 'list_investment_movements',
    description:
      'Lista movimentos de investimento (compras, vendas, dividendos) do utilizador, mais recentes primeiro.',
    parameters: {
      type: 'object' as const,
      properties: {
        limit: {
          type: 'number',
          description: 'Máximo de movimentos (padrão 30, máx 50)',
        },
      },
      required: [] as string[],
    },
  },
  {
    name: 'register_investment_movement',
    description:
      'Regista compra, venda ou dividendo na carteira. Símbolo em maiúsculas (ex.: PETR4, VALE3). Para ativos internacionais use market INTL; cotação aproximada via Stooq (ex.: AAPL). Dividendo: quantity=0 e unitPrice=valor total recebido, ou quantity=ações e unitPrice=por ação.',
    parameters: {
      type: 'object' as const,
      properties: {
        symbol: { type: 'string', description: 'Ticker (ex.: PETR4, AAPL)' },
        market: { type: 'string', enum: ['BR', 'INTL'], description: 'BR = B3, INTL = exterior' },
        instrumentKind: {
          type: 'string',
          enum: ['stock', 'fii', 'etf', 'other'],
          description: 'Tipo do ativo',
        },
        movementKind: {
          type: 'string',
          enum: ['buy', 'sell', 'dividend'],
          description: 'Compra, venda ou dividendo',
        },
        quantity: {
          type: 'number',
          description: 'Quantidade de ações/unidades (0 em dividendo só total)',
        },
        unitPrice: { type: 'number', description: 'Preço unitário ou total conforme movementKind' },
        fees: { type: 'number', description: 'Taxas opcionais' },
        occurredAt: {
          type: 'string',
          description: 'Data ISO opcional; omitir para agora',
        },
        notes: { type: 'string', description: 'Notas opcionais' },
        quoteSymbol: {
          type: 'string',
          description: 'Opcional INTL: símbolo Stooq (ex.: aapl.us)',
        },
        displayName: { type: 'string', description: 'Nome amigável opcional' },
      },
      required: [
        'symbol',
        'market',
        'instrumentKind',
        'movementKind',
        'quantity',
        'unitPrice',
      ] as string[],
    },
  },
  {
    name: 'search_knowledge',
    description:
      'Pesquisa na base de conhecimento via RAG: documentação global do produto e notas/documentos pessoais do utilizador. Use antes de inventar informação.',
    parameters: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Pergunta ou termos de pesquisa em linguagem natural',
        },
        topK: {
          type: 'number',
          description: 'Número máximo de excertos (opcional, padrão da configuração)',
        },
      },
      required: ['query'] as string[],
    },
  },
] as const;

export type AiToolName = (typeof AI_TOOL_DEFINITIONS)[number]['name'];

/** Convert to OpenAI/Vertex chat tool format */
export function toChatTools(
  definitions: ReadonlyArray<{
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties?: Record<string, unknown>;
      required?: readonly string[];
    };
  }>,
): Array<{
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: { type: 'object'; properties?: Record<string, unknown>; required?: string[] };
  };
}> {
  return definitions.map((d) => ({
    type: 'function' as const,
    function: {
      name: d.name,
      description: d.description,
      parameters: {
        type: 'object' as const,
        properties: d.parameters.properties,
        required: d.parameters.required ? [...d.parameters.required] : [],
      },
    },
  }));
}
