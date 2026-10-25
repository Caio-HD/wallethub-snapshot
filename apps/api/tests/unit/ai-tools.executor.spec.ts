import { AiToolsExecutor } from '@app/modules/ai/tools/ai-tools.executor';
import { DashboardService } from '@app/modules/dashboard/dashboard.service';
import { ProjectionsService } from '@app/modules/projections/projections.service';
import { BudgetsService } from '@app/modules/budgets/budgets.service';
import { TransactionsService } from '@app/modules/transactions/transactions.service';
import { CategoriesService } from '@app/modules/categories/categories.service';
import { AccountsService } from '@app/modules/accounts/accounts.service';
import type { CategoryEntity } from '@app/database/entities/category.entity';
import { McpClientService } from '@app/modules/mcp/mcp-client.service';
import { RagSearchService } from '@app/modules/rag/rag-search.service';
import { AiTracingService } from '@app/modules/ai/tracing/ai-tracing.service';
import type { InvestmentsService } from '@app/modules/investments/investments.service';

describe('AiToolsExecutor', () => {
  const mockContext = { organizationId: 'org-1', userId: 'user-1', scope: 'all' as const };

  const stubMcp = {
    hasTool: jest.fn().mockReturnValue(false),
    callTool: jest.fn(),
  } as unknown as McpClientService;
  const stubRag = {
    isEnabled: jest.fn().mockReturnValue(false),
    search: jest.fn(),
  } as unknown as RagSearchService;
  const stubTracing = {
    isTracingEnabled: jest.fn().mockReturnValue(false),
    appendObservation: jest.fn(),
  } as unknown as AiTracingService;
  const stubInvestments = {} as unknown as InvestmentsService;

  describe('list_categories', () => {
    it('returns active categories as id and name', async () => {
      const categories = [
        { id: 'cat-1', name: 'Alimentação', type: 'expense' as const, isActive: true },
        { id: 'cat-2', name: 'Salário', type: 'income' as const, isActive: true },
      ];
      const categoriesService = {
        findAll: jest.fn().mockResolvedValue(categories),
      } as unknown as CategoriesService;

      const executor = new AiToolsExecutor(
        {} as DashboardService,
        {} as ProjectionsService,
        {} as BudgetsService,
        {} as TransactionsService,
        categoriesService,
        {} as AccountsService,
        stubMcp,
        stubRag,
        stubInvestments,
        stubTracing,
      );

      const result = await executor.execute('list_categories', {}, mockContext, 'call-1');

      expect(categoriesService.findAll).toHaveBeenCalledWith('org-1');
      expect(result.toolCallId).toBe('call-1');
      const data = JSON.parse(result.content);
      expect(data).toHaveLength(2);
      expect(data[0]).toEqual({ id: 'cat-1', name: 'Alimentação', type: 'expense' });
      expect(data[1]).toEqual({ id: 'cat-2', name: 'Salário', type: 'income' });
    });
  });

  describe('get_dashboard_summary', () => {
    it('delegates to dashboard service and returns summary JSON', async () => {
      const summary = {
        period: '2025-03',
        scope: 'all',
        totalIncome: 5000,
        totalExpense: 3000,
        balance: 2000,
        topCategories: [],
      };
      const dashboardService = {
        getSummary: jest.fn().mockResolvedValue(summary),
      } as unknown as DashboardService;

      const executor = new AiToolsExecutor(
        dashboardService,
        {} as ProjectionsService,
        {} as BudgetsService,
        {} as TransactionsService,
        {} as CategoriesService,
        {} as AccountsService,
        stubMcp,
        stubRag,
        stubInvestments,
        stubTracing,
      );

      const result = await executor.execute(
        'get_dashboard_summary',
        { period: '2025-03' },
        mockContext,
        'call-2',
      );

      expect(dashboardService.getSummary).toHaveBeenCalledWith('all', '2025-03', 'org-1');
      expect(result.toolCallId).toBe('call-2');
      const data = JSON.parse(result.content);
      expect(data.period).toBe('2025-03');
      expect(data.balance).toBe(2000);
    });
  });

  describe('search_knowledge', () => {
    it('returns disabled message when RAG is off', async () => {
      const rag = {
        isEnabled: jest.fn().mockReturnValue(false),
        search: jest.fn(),
      } as unknown as RagSearchService;

      const executor = new AiToolsExecutor(
        {} as DashboardService,
        {} as ProjectionsService,
        {} as BudgetsService,
        {} as TransactionsService,
        {} as CategoriesService,
        {} as AccountsService,
        stubMcp,
        rag,
        stubInvestments,
        stubTracing,
      );

      const result = await executor.execute(
        'search_knowledge',
        { query: 'test' },
        mockContext,
        'c1',
      );
      const data = JSON.parse(result.content);
      expect(data.message).toMatch(/RAG desativado/i);
      expect(rag.search).not.toHaveBeenCalled();
    });
  });

  describe('unknown tool', () => {
    it('returns error content for unknown tool name', async () => {
      const executor = new AiToolsExecutor(
        {} as DashboardService,
        {} as ProjectionsService,
        {} as BudgetsService,
        {} as TransactionsService,
        {} as CategoriesService,
        {} as AccountsService,
        stubMcp,
        stubRag,
        stubInvestments,
        stubTracing,
      );

      const result = await executor.execute('unknown_tool', {}, mockContext, 'id');

      const data = JSON.parse(result.content);
      expect(data.error).toContain('desconhecida');
    });
  });
});
