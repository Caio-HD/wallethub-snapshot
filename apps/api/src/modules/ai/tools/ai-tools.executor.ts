import { Injectable, Logger } from '@nestjs/common';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { isUuid } from '../../../common/utils/is-uuid.js';
import { DashboardService, type DashboardScope } from '../../dashboard/dashboard.service';
import { ProjectionsService } from '../../projections/projections.service';
import { BudgetsService } from '../../budgets/budgets.service';
import { TransactionsService } from '../../transactions/transactions.service';
import { CategoriesService } from '../../categories/categories.service';
import { AccountsService } from '../../accounts/accounts.service';
import { InvestmentsService } from '../../investments/investments.service';
import { AgentContext, ToolCallResult } from './ai-tool.types';
import { AI_TOOL_DEFINITIONS, AiToolName } from './ai-tools.definitions';
import { McpClientService } from '../../mcp/mcp-client.service';
import { RagSearchService } from '../../rag/rag-search.service';
import { AiTracingService } from '../tracing/ai-tracing.service.js';

@Injectable()
export class AiToolsExecutor {
  private readonly logger = new Logger(AiToolsExecutor.name);

  constructor(
    private readonly dashboardService: DashboardService,
    private readonly projectionsService: ProjectionsService,
    private readonly budgetsService: BudgetsService,
    private readonly transactionsService: TransactionsService,
    private readonly categoriesService: CategoriesService,
    private readonly accountsService: AccountsService,
    private readonly mcpClient: McpClientService,
    private readonly ragSearch: RagSearchService,
    private readonly investmentsService: InvestmentsService,
    private readonly tracing: AiTracingService,
  ) {}

  /** Returns current month in yyyy-MM */
  private defaultPeriod(): string {
    return format(new Date(), 'yyyy-MM');
  }

  /** Tool arg userId (UUID) overrides context default; invalid UUID falls back to context. */
  private resolveDataScope(args: Record<string, unknown>, context: AgentContext): DashboardScope {
    const raw = args.userId;
    if (typeof raw === 'string' && raw.trim() !== '' && isUuid(raw)) {
      return raw;
    }
    return context.scope === 'all' || isUuid(context.scope) ? context.scope : 'all';
  }

  async execute(
    toolName: string,
    args: Record<string, unknown>,
    context: AgentContext,
    toolCallId = '',
  ): Promise<ToolCallResult> {
    if (this.mcpClient.hasTool(toolName)) {
      return { toolCallId, content: await this.mcpClient.callTool(toolName, args) };
    }

    const name = toolName as AiToolName;
    const def = AI_TOOL_DEFINITIONS.find((t) => t.name === name);
    if (!def) {
      return { toolCallId, content: JSON.stringify({ error: `Tool desconhecida: ${toolName}` }) };
    }

    try {
      const scope = this.resolveDataScope(args, context);
      const period = (args.period as string) ?? context.period ?? this.defaultPeriod();

      switch (name) {
        case 'get_dashboard_summary': {
          if (!context.organizationId) {
            return { toolCallId, content: JSON.stringify({ error: 'Organização não definida.' }) };
          }
          const summary = await this.dashboardService.getSummary(
            scope,
            period,
            context.organizationId,
          );
          return { toolCallId, content: JSON.stringify(summary, null, 0) };
        }
        case 'get_evolution_report': {
          if (!context.organizationId) {
            return { toolCallId, content: JSON.stringify({ error: 'Organização não definida.' }) };
          }
          const months = Math.min(24, Math.max(1, Number(args.months) || 6));
          const report = await this.dashboardService.getEvolutionReport(
            scope,
            months,
            context.organizationId,
          );
          return { toolCallId, content: JSON.stringify(report, null, 0) };
        }
        case 'get_projection': {
          const projection = await this.projectionsService.getLatest(scope, context.organizationId);
          if (!projection) {
            return {
              toolCallId,
              content: JSON.stringify({ message: 'Nenhuma projeção disponível.' }),
            };
          }
          return {
            toolCallId,
            content: JSON.stringify(
              {
                periodStart: projection.periodStart,
                periodEnd: projection.periodEnd,
                projectedIncome: projection.projectedIncome,
                projectedExpense: projection.projectedExpense,
                projectedBalance: projection.projectedBalance,
                trend: projection.trend,
                generatedAt: projection.generatedAt,
              },
              null,
              0,
            ),
          };
        }
        case 'get_budgets': {
          const categoryBudgets = await this.budgetsService.getCategoryBudgets(scope, period);
          const monthly = await this.budgetsService.getMonthlyBudget(scope, period);
          return {
            toolCallId,
            content: JSON.stringify({ categoryBudgets, monthlyBudget: monthly }, null, 0),
          };
        }
        case 'list_transactions': {
          const limit = Math.min(50, Math.max(1, Number(args.limit) || 20));
          const periodStr =
            args.period != null && typeof args.period === 'string' ? args.period : undefined;
          const range = periodStr
            ? {
                start: startOfMonth(new Date(`${periodStr}-01`)),
                end: endOfMonth(new Date(`${periodStr}-01`)),
              }
            : {
                start: startOfMonth(new Date()),
                end: endOfMonth(new Date()),
              };
          const list = await this.transactionsService.findAll({
            userId: context.userId,
            organizationId: context.organizationId,
            range: { start: range.start, end: range.end },
          });
          const slice = list.slice(0, limit).map((t) => ({
            id: t.id,
            occurredAt: t.occurredAt,
            amount: t.amount,
            direction: t.direction,
            description: t.description,
            categoryName: t.category?.name,
            accountName: t.account?.name,
          }));
          return { toolCallId, content: JSON.stringify(slice, null, 0) };
        }
        case 'create_transaction': {
          const amount = Number(args.amount);
          const direction = String(args.direction) as 'income' | 'expense';
          const categoryId = String(args.categoryId);
          const accountId = String(args.accountId);
          const description =
            args.description != null && typeof args.description === 'string'
              ? args.description
              : undefined;
          if (Number.isNaN(amount) || amount <= 0) {
            return { toolCallId, content: JSON.stringify({ error: 'Valor inválido.' }) };
          }
          if (!context.organizationId) {
            return {
              toolCallId,
              content: JSON.stringify({ error: 'Organização não disponível no contexto.' }),
            };
          }
          const created = await this.transactionsService.create(
            {
              occurredAt: new Date().toISOString(),
              accountId,
              categoryId,
              userId: context.userId,
              amount,
              description,
              source: 'web',
            },
            context.organizationId,
          );
          return {
            toolCallId,
            content: JSON.stringify({
              success: true,
              id: created.id,
              message: `${direction === 'income' ? 'Receita' : 'Despesa'} de R$ ${amount.toFixed(2)} registrada.`,
            }),
          };
        }
        case 'list_categories': {
          if (!context.organizationId) {
            return { toolCallId, content: JSON.stringify([]) };
          }
          const categories = await this.categoriesService.findAll(context.organizationId);
          const active = categories
            .filter((c) => c.isActive)
            .map((c) => ({ id: c.id, name: c.name, type: c.type }));
          return { toolCallId, content: JSON.stringify(active, null, 0) };
        }
        case 'list_accounts': {
          const accounts = await this.accountsService.findAll(undefined, context.organizationId);
          const list = accounts.map((a) => ({ id: a.id, name: a.name }));
          return { toolCallId, content: JSON.stringify(list, null, 0) };
        }
        case 'get_portfolio_summary': {
          const summary = await this.investmentsService.getPortfolioSummary(context.userId);
          return { toolCallId, content: JSON.stringify(summary, null, 0) };
        }
        case 'list_investment_movements': {
          const limit = Math.min(50, Math.max(1, Number(args.limit) || 30));
          const list = await this.investmentsService.listMovements(context.userId);
          const slice = list.slice(0, limit).map((m) => ({
            id: m.id,
            kind: m.kind,
            quantity: Number(m.quantity),
            unitPrice: Number(m.unitPrice),
            fees: Number(m.fees),
            occurredAt: m.occurredAt,
            notes: m.notes,
            symbol: m.instrument?.symbol,
            market: m.instrument?.market,
          }));
          return { toolCallId, content: JSON.stringify(slice, null, 0) };
        }
        case 'register_investment_movement': {
          const symbol = typeof args.symbol === 'string' ? args.symbol.trim() : '';
          const market = args.market === 'INTL' ? 'INTL' : 'BR';
          const instrumentKind = ['stock', 'fii', 'etf', 'other'].includes(
            String(args.instrumentKind),
          )
            ? (String(args.instrumentKind) as 'stock' | 'fii' | 'etf' | 'other')
            : null;
          const movementKind = ['buy', 'sell', 'dividend'].includes(String(args.movementKind))
            ? (String(args.movementKind) as 'buy' | 'sell' | 'dividend')
            : null;
          const quantity = Number(args.quantity);
          const unitPrice = Number(args.unitPrice);
          const fees = args.fees != null ? Number(args.fees) : undefined;
          if (!symbol || !instrumentKind || !movementKind) {
            return {
              toolCallId,
              content: JSON.stringify({
                error: 'symbol, instrumentKind e movementKind são obrigatórios.',
              }),
            };
          }
          if (Number.isNaN(quantity) || Number.isNaN(unitPrice)) {
            return {
              toolCallId,
              content: JSON.stringify({ error: 'quantity e unitPrice numéricos.' }),
            };
          }
          try {
            const created = await this.investmentsService.createMovement(
              context.userId,
              {
                symbol,
                market,
                kind: instrumentKind,
                movementKind,
                quantity,
                unitPrice,
                fees: Number.isNaN(fees ?? 0) ? undefined : fees,
                occurredAt:
                  typeof args.occurredAt === 'string' && args.occurredAt.trim() !== ''
                    ? args.occurredAt
                    : undefined,
                notes: typeof args.notes === 'string' ? args.notes : undefined,
                quoteSymbol: typeof args.quoteSymbol === 'string' ? args.quoteSymbol : undefined,
                displayName: typeof args.displayName === 'string' ? args.displayName : undefined,
              },
              context.organizationId ?? '',
            );
            return {
              toolCallId,
              content: JSON.stringify(
                { success: true, id: created.id, message: 'Movimento registado.' },
                null,
                0,
              ),
            };
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { toolCallId, content: JSON.stringify({ error: message }) };
          }
        }
        case 'search_knowledge': {
          const query = typeof args.query === 'string' ? args.query : '';
          const topK = args.topK != null ? Number(args.topK) : undefined;
          if (!this.ragSearch.isEnabled()) {
            return {
              toolCallId,
              content: JSON.stringify({
                message:
                  'RAG desativado. Configure OPENAI_API_KEY e não defina RAG_ENABLED=false para ativar.',
              }),
            };
          }
          if (context.trace && this.tracing.isTracingEnabled()) {
            await this.tracing.appendObservation(
              context.trace.traceId,
              context.trace.nextSeq(),
              'retrieval',
              'search_knowledge',
              { query: query.slice(0, 2000), topK },
            );
          }
          const rows = await this.ragSearch.search(query, topK, context.userId);
          const payload = rows.map((r) => ({
            content: r.content,
            distance: r.distance,
            documentId: r.documentId,
            chunkIndex: r.chunkIndex,
          }));
          return { toolCallId, content: JSON.stringify({ chunks: payload }, null, 0) };
        }
        default: {
          return {
            toolCallId,
            content: JSON.stringify({ error: `Tool não implementada: ${toolName}` }),
          };
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Tool ${name} failed: ${message}`);
      return { toolCallId, content: JSON.stringify({ error: message }) };
    }
  }
}
