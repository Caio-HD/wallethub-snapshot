import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AiMessageContext,
  AiMessageResponse,
  AiProvider,
  AiProviderWithTools,
  AgentMessage,
} from './ai.types';
import { AgentContext, AgentRunResult, RunAgentOptions } from './tools/ai-tool.types';
import { AiProviderConfig } from '../../core/config/ai.config';
import { OpenAiProvider } from './providers/openai.provider';
import { VertexProvider } from './providers/vertex.provider';
import { DeepseekProvider } from './providers/deepseek.provider';
import { OpenRouterProvider } from './providers/openrouter.provider';
import { AiToolsExecutor } from './tools/ai-tools.executor';
import { AgentToolCatalogService } from './agent-tool-catalog.service';
import { AiTracingService } from './tracing/ai-tracing.service';

const AGENT_SYSTEM_PROMPT = `Você é um assistente financeiro avançado do WalletHub. Sua função é ajudar o usuário a criar e organizar lançamentos, analisar gastos, orçamentos e projeções, acompanhar investimentos (carteira, não execução de ordens), e dar sugestões objetivas.

Regras:
- Responda sempre em português, de forma clara e objetiva.
- Use APENAS os dados retornados pelas ferramentas; nunca invente valores ou números.
- Para documentação global e notas pessoais do utilizador, use search_knowledge quando disponível (RAG privado + documentação).
- Para registrar receitas ou despesas, use create_transaction após obter categoria e conta com list_categories e list_accounts se necessário.
- Para investimentos: get_portfolio_summary, list_investment_movements e register_investment_movement (sempre no âmbito do utilizador autenticado).
- Para análises de fluxo, use get_dashboard_summary, get_evolution_report, get_projection e get_budgets. O parâmetro userId (UUID) restringe ao utilizador; omitir = conjunto (categorias partilhadas).
- Ao dar sugestões (reserva de emergência, corte de gastos, alertas), baseie-se exclusivamente nos dados das ferramentas.`;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private providers: Record<string, AiProvider> = {};

  constructor(
    private readonly configService: ConfigService,
    private readonly openAiProvider: OpenAiProvider,
    private readonly vertexProvider: VertexProvider,
    private readonly deepseekProvider: DeepseekProvider,
    private readonly openRouterProvider: OpenRouterProvider,
    private readonly toolsExecutor: AiToolsExecutor,
    private readonly toolCatalog: AgentToolCatalogService,
    private readonly tracing: AiTracingService,
  ) {}

  onModuleInit() {
    this.providers[this.openAiProvider.name] = this.openAiProvider;
    this.providers[this.vertexProvider.name] = this.vertexProvider;
    this.providers[this.deepseekProvider.name] = this.deepseekProvider;
    this.providers[this.openRouterProvider.name] = this.openRouterProvider;
  }

  private getConfig(): AiProviderConfig {
    return (
      this.configService.get<AiProviderConfig>('ai') ?? {
        defaultProvider: 'none',
        requestTimeoutMs: 20000,
      }
    );
  }

  private resolveProvider(preferred?: string): AiProvider | undefined {
    const config = this.getConfig();
    const providerKey = preferred ?? config.defaultProvider;
    if (!providerKey || providerKey === 'none') {
      return undefined;
    }
    const provider = this.providers[providerKey];
    if (!provider?.isConfigured()) {
      this.logger.warn(`Provider ${providerKey} não configurado. Fallback para outro provedor.`);
      const alternative = Object.values(this.providers).find((p) => p.isConfigured());
      return alternative;
    }
    return provider;
  }

  /**
   * LLM health/observability. Config-only by default (fast, free); `ping=true` runs a live
   * probe against the OpenRouter primary model. Returns no secrets — only model ids.
   */
  async getLlmHealth(ping = false): Promise<{
    status: 'ok' | 'degraded';
    defaultProvider: string;
    primaryModel: string | null;
    configuredModels: string[];
    configuredProviders: string[];
    actualModel?: string;
    error?: string;
  }> {
    const config = this.getConfig();
    const orHealth = this.openRouterProvider.getHealth();
    const base = {
      defaultProvider: config.defaultProvider,
      primaryModel: orHealth.primaryModel,
      configuredModels: orHealth.configuredModels,
      configuredProviders: this.getConfiguredProviders().map((p) => p.id),
    };

    if (!ping) return { status: 'ok', ...base };

    try {
      const res = await this.openRouterProvider.generateMessage({ text: 'ping', userPhone: '' });
      return { status: 'ok', ...base, actualModel: res.usage?.model };
    } catch (err) {
      return { status: 'degraded', ...base, error: (err as Error).message };
    }
  }

  getConfiguredProviders(): { id: string; name: string }[] {
    const list: { id: string; name: string }[] = [];
    if (this.providers['openrouter']?.isConfigured())
      list.push({ id: 'openrouter', name: 'OpenRouter (free)' });
    if (this.providers['openai']?.isConfigured()) list.push({ id: 'openai', name: 'OpenAI' });
    if (this.providers['vertex']?.isConfigured())
      list.push({ id: 'vertex', name: 'Gemini (Vertex)' });
    if (this.providers['deepseek']?.isConfigured()) list.push({ id: 'deepseek', name: 'DeepSeek' });
    return list;
  }

  async generateReply(
    context: AiMessageContext,
    preferred?: 'openai' | 'vertex' | 'deepseek' | 'openrouter',
  ): Promise<AiMessageResponse | null> {
    const provider = this.resolveProvider(preferred);
    if (!provider) {
      this.logger.warn('Nenhum provedor de IA configurado. Retornando null.');
      return null;
    }

    return provider.generateMessage(context);
  }

  /**
   * Runs the financial agent with tools: interprets the user message, calls tools as needed, returns a final reply.
   */
  async runAgent(
    context: AgentContext,
    message: string,
    options: RunAgentOptions = {},
  ): Promise<AgentRunResult | null> {
    const provider = this.resolveProvider(options.preferredProvider);
    if (!provider) {
      this.logger.warn('Nenhum provedor de IA configurado. runAgent retorna null.');
      return null;
    }

    const tracingActive = options.tracingEnabled !== false && this.tracing.isTracingEnabled();
    const traceSession = tracingActive
      ? await this.tracing.startTrace({
          userId: context.userId,
          channel: context.channel ?? 'web',
          whatsappEventId: context.whatsappEventId ?? null,
        })
      : null;

    const traceHandle = traceSession
      ? {
          traceId: traceSession.traceId,
          nextSeq: () => traceSession.seq.next(),
        }
      : null;

    const execContext: AgentContext = {
      ...context,
      channel: context.channel ?? 'web',
      trace: traceHandle,
    };

    const finalize = async (
      status: 'completed' | 'failed',
      params: {
        usage?: AgentRunResult['usage'];
        finalReply?: string | null;
        errorMessage?: string | null;
      },
    ) => {
      if (!traceSession) return;
      await this.tracing.finalizeTrace(traceSession.traceId, status, {
        provider: params.usage?.provider ?? null,
        model: params.usage?.model ?? null,
        usage: params.usage as Record<string, unknown> | null,
        finalReply: params.finalReply ?? null,
        errorMessage: params.errorMessage ?? null,
      });
    };

    try {
      if (traceSession) {
        await this.tracing.appendObservation(
          traceSession.traceId,
          traceSession.seq.next(),
          'user_message',
          null,
          { content: message },
        );
      }

      const providerWithTools = provider as AiProviderWithTools;
      if (typeof providerWithTools.chatWithTools !== 'function') {
        this.logger.warn('Provedor não suporta chatWithTools. Fallback para generateReply.');
        const response = await provider.generateMessage({ text: message, userPhone: '' });
        if (!response) {
          await finalize('failed', { errorMessage: 'generateMessage retornou vazio' });
          return null;
        }
        await finalize('completed', {
          usage: response.usage,
          finalReply: response.reply,
        });
        return {
          reply: response.reply,
          usage: response.usage,
          extra: response.extra,
        };
      }

      const maxRounds = options.maxToolRounds ?? 5;
      const chatTools = this.toolCatalog.toChatTools();
      const messages: AgentMessage[] = [
        { role: 'system', content: AGENT_SYSTEM_PROMPT },
        ...(options.history || []),
        { role: 'user', content: message },
      ];

      const toolsUsed: string[] = [];
      let lastUsage: AgentRunResult['usage'];

      for (let round = 0; round < maxRounds; round++) {
        const turn = await providerWithTools.chatWithTools(messages, chatTools);
        lastUsage = turn.usage;

        if (traceSession) {
          await this.tracing.appendObservation(
            traceSession.traceId,
            traceSession.seq.next(),
            'llm',
            null,
            {
              round,
              content: turn.content,
              usage: turn.usage,
              finishReason: turn.finishReason,
              toolCallCount: turn.toolCalls.length,
            },
          );
        }

        if (turn.toolCalls.length === 0) {
          const reply = turn.content ?? 'Não foi possível gerar uma resposta.';
          await finalize('completed', { usage: lastUsage, finalReply: reply });
          return {
            reply,
            usage: lastUsage,
            toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
          };
        }

        messages.push({ role: 'assistant', content: turn.content ?? '' });
        for (const tc of turn.toolCalls) {
          toolsUsed.push(tc.name);
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(tc.arguments || '{}') as Record<string, unknown>;
          } catch {
            /* ignore */
          }

          if (traceSession) {
            await this.tracing.appendObservation(
              traceSession.traceId,
              traceSession.seq.next(),
              'tool',
              tc.name,
              {
                phase: 'call',
                toolCallId: tc.id,
                arguments: tc.arguments?.slice(0, 12_000) ?? '',
              },
            );
          }

          const result = await this.toolsExecutor.execute(tc.name, args, execContext, tc.id);

          if (traceSession) {
            await this.tracing.appendObservation(
              traceSession.traceId,
              traceSession.seq.next(),
              'tool',
              tc.name,
              {
                phase: 'result',
                toolCallId: tc.id,
                contentPreview: result.content.slice(0, 12_000),
              },
            );
          }

          messages.push({
            role: 'tool',
            content: result.content,
            toolCallId: result.toolCallId || tc.id,
            name: tc.name,
          });
        }
      }

      this.logger.warn(
        `runAgent atingiu máximo de rodadas (${maxRounds}). Retornando última resposta.`,
      );
      const lastAssistant = messages.filter((m) => m.role === 'assistant').pop();
      const reply = lastAssistant?.content ?? 'Limite de etapas atingido. Tente reformular.';
      await finalize('completed', { usage: lastUsage, finalReply: reply });
      return {
        reply,
        usage: lastUsage,
        toolsUsed,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await finalize('failed', { errorMessage: msg });
      throw err;
    }
  }
}
