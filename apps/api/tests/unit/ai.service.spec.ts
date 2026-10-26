import { ConfigService } from '@nestjs/config';
import { AiService } from '@app/modules/ai/ai.service';
import { OpenAiProvider } from '@app/modules/ai/providers/openai.provider';
import { VertexProvider } from '@app/modules/ai/providers/vertex.provider';
import { DeepseekProvider } from '@app/modules/ai/providers/deepseek.provider';
import { OpenRouterProvider } from '@app/modules/ai/providers/openrouter.provider';
import { AiToolsExecutor } from '@app/modules/ai/tools/ai-tools.executor';
import { AgentToolCatalogService } from '@app/modules/ai/agent-tool-catalog.service';
import { AiTracingService } from '@app/modules/ai/tracing/ai-tracing.service';

describe('AiService', () => {
  describe('runAgent', () => {
    it('returns null when no provider is configured', async () => {
      const configService = {
        get: jest.fn().mockReturnValue({ defaultProvider: 'none', requestTimeoutMs: 20000 }),
      } as unknown as ConfigService;

      const openAiProvider = { name: 'openai', isConfigured: jest.fn().mockReturnValue(false) } as unknown as OpenAiProvider;
      const vertexProvider = { name: 'vertex', isConfigured: jest.fn().mockReturnValue(false) } as unknown as VertexProvider;
      const deepseekProvider = { name: 'deepseek', isConfigured: jest.fn().mockReturnValue(false) } as unknown as DeepseekProvider;
      const openRouterProvider = { name: 'openrouter', isConfigured: jest.fn().mockReturnValue(false) } as unknown as OpenRouterProvider;
      const toolsExecutor = {} as AiToolsExecutor;
      const toolCatalog = {
        toChatTools: jest.fn().mockReturnValue([]),
      } as unknown as AgentToolCatalogService;
      const tracing = {
        isTracingEnabled: jest.fn().mockReturnValue(false),
      } as unknown as AiTracingService;

      const service = new AiService(
        configService,
        openAiProvider,
        vertexProvider,
        deepseekProvider,
        openRouterProvider,
        toolsExecutor,
        toolCatalog,
        tracing,
      );
      service.onModuleInit();

      const result = await service.runAgent({ userId: 'u1', scope: 'all' }, 'Qual meu saldo?');

      expect(result).toBeNull();
    });

    it('returns reply when provider supports chatWithTools and returns text', async () => {
      const configService = {
        get: jest.fn().mockReturnValue({ defaultProvider: 'openai', requestTimeoutMs: 20000 }),
      } as unknown as ConfigService;

      const openAiProvider = {
        name: 'openai',
        isConfigured: jest.fn().mockReturnValue(true),
        chatWithTools: jest.fn().mockResolvedValue({
          content: 'Seu saldo é R$ 1.500,00.',
          toolCalls: [],
          usage: { inputTokens: 10, outputTokens: 5 },
        }),
      } as unknown as OpenAiProvider;

      const vertexProvider = { name: 'vertex', isConfigured: jest.fn().mockReturnValue(false) } as unknown as VertexProvider;
      const deepseekProvider = { name: 'deepseek', isConfigured: jest.fn().mockReturnValue(false) } as unknown as DeepseekProvider;
      const openRouterProvider = { name: 'openrouter', isConfigured: jest.fn().mockReturnValue(false) } as unknown as OpenRouterProvider;
      const toolsExecutor = {} as AiToolsExecutor;
      const toolCatalog = {
        toChatTools: jest.fn().mockReturnValue([]),
      } as unknown as AgentToolCatalogService;
      const tracing = {
        isTracingEnabled: jest.fn().mockReturnValue(false),
      } as unknown as AiTracingService;

      const service = new AiService(
        configService,
        openAiProvider,
        vertexProvider,
        deepseekProvider,
        openRouterProvider,
        toolsExecutor,
        toolCatalog,
        tracing,
      );
      service.onModuleInit();

      const result = await service.runAgent({ userId: 'u1', scope: 'all' }, 'Qual meu saldo?');

      expect(result).not.toBeNull();
      expect(result?.reply).toBe('Seu saldo é R$ 1.500,00.');
      expect(openAiProvider.chatWithTools).toHaveBeenCalled();
    });
  });
});
