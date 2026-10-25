import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { ConfigService } from '@nestjs/config';
import {
  AiMessageContext,
  AiMessageResponse,
  AiProviderWithTools,
  AgentMessage,
  AgentTurnResult,
  AiChatTool,
} from '../ai.types';
import { AiProviderConfig } from '../../../core/config/ai.config';
import { withModelRotation } from './model-rotation.util';

const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_MODEL = 'moonshotai/kimi-k2.6:free';

const SYSTEM_PROMPT =
  'Você é um assistente financeiro para a carteira WalletHub. Responda em português, curto e objetivo.';

/**
 * OpenRouter provider (OpenAI-compatible). Mirrors {@link DeepseekProvider} (chat.completions
 * + custom baseURL) — deliberately NOT the OpenAI provider, which uses the Responses API that
 * OpenRouter does not support. Rotates across an ordered list of free models on 429/5xx/timeout
 * via OpenRouter's native `models: [...]` body fallback + the client-side rotation util.
 */
@Injectable()
export class OpenRouterProvider implements AiProviderWithTools {
  readonly name = 'openrouter' as const;
  private readonly logger = new Logger(OpenRouterProvider.name);
  private client?: OpenAI;
  private models: string[] = [];

  constructor(private readonly configService: ConfigService) {}

  private ensureClient() {
    if (this.client) {
      return;
    }
    const aiConfig = this.configService.get<AiProviderConfig>('ai');
    const apiKey = aiConfig?.openrouter?.apiKey;
    if (!apiKey) {
      this.logger.warn('OPENROUTER_API_KEY não configurada. Provider permanecerá inativo.');
      return;
    }
    this.models = aiConfig?.openrouter?.models?.length
      ? aiConfig.openrouter.models
      : [DEFAULT_MODEL];
    this.client = new OpenAI({
      apiKey,
      baseURL: DEFAULT_BASE_URL,
      // Rotation handles retries; disable the SDK's own retry to avoid double backoff.
      timeout: aiConfig?.openrouter?.timeoutMs ?? aiConfig?.requestTimeoutMs ?? 30_000,
      maxRetries: 0,
    });
  }

  isConfigured(): boolean {
    this.ensureClient();
    return Boolean(this.client && this.models.length > 0);
  }

  /** For the LLM healthcheck — no secrets, only model ids. */
  getHealth(): { configured: boolean; primaryModel: string | null; configuredModels: string[] } {
    this.ensureClient();
    return {
      configured: this.isConfigured(),
      primaryModel: this.models[0] ?? null,
      configuredModels: this.models,
    };
  }

  async generateMessage(context: AiMessageContext): Promise<AiMessageResponse> {
    this.ensureClient();
    if (!this.client || this.models.length === 0) {
      throw new Error('Provider OpenRouter não configurado');
    }
    const client = this.client;

    const outcome = await withModelRotation(
      this.models,
      (model) =>
        this.create(client, model, {
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: context.text },
          ],
        }),
      { onAttemptFailed: (i) => this.logAttemptFailed(i) },
    );

    const completion = outcome.result;
    this.logCall('generateMessage', outcome.modelUsed, outcome.fallbackCount);
    const reply = completion.choices?.[0]?.message?.content?.trim() ?? '';

    return {
      reply,
      usage: completion.usage
        ? {
            inputTokens: completion.usage.prompt_tokens,
            outputTokens: completion.usage.completion_tokens,
            totalTokens: completion.usage.total_tokens,
            model: outcome.modelUsed,
            provider: this.name,
          }
        : undefined,
      extra: { id: completion.id },
    };
  }

  async chatWithTools(messages: AgentMessage[], tools: AiChatTool[]): Promise<AgentTurnResult> {
    this.ensureClient();
    if (!this.client || this.models.length === 0) {
      throw new Error('Provider OpenRouter não configurado');
    }
    const client = this.client;

    const apiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = messages.map((m) => {
      if (m.role === 'tool') {
        return {
          role: 'tool' as const,
          tool_call_id: m.toolCallId ?? '',
          content: m.content,
        };
      }
      return {
        role: m.role,
        content: m.content,
        name: m.name,
      };
    });

    const outcome = await withModelRotation(
      this.models,
      (model) =>
        this.create(client, model, {
          messages: apiMessages,
          tools: tools.length > 0 ? tools : undefined,
          tool_choice: tools.length > 0 ? 'auto' : undefined,
        }),
      { onAttemptFailed: (i) => this.logAttemptFailed(i) },
    );

    const completion = outcome.result;
    this.logCall('chatWithTools', outcome.modelUsed, outcome.fallbackCount);
    const choice = completion.choices?.[0];
    const msg = choice?.message;
    const content = typeof msg?.content === 'string' ? msg.content.trim() : null;
    const toolCalls = (msg?.tool_calls ?? []).map((tc) => ({
      id: tc.id,
      name: tc.function?.name ?? '',
      arguments: tc.function?.arguments ?? '{}',
    }));

    return {
      content,
      toolCalls,
      usage: completion.usage
        ? {
            inputTokens: completion.usage.prompt_tokens,
            outputTokens: completion.usage.completion_tokens,
            totalTokens: completion.usage.total_tokens,
            model: outcome.modelUsed,
            provider: this.name,
          }
        : undefined,
      finishReason: choice?.finish_reason ?? undefined,
    };
  }

  /**
   * Single chat.completions call for a given model. Adds OpenRouter's native server-side
   * fallback (`models: [...]`) — an OpenRouter extension absent from the OpenAI SDK types,
   * hence the controlled cast.
   */
  private create(
    client: OpenAI,
    model: string,
    body: Omit<OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming, 'model'>,
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    const params = {
      model,
      ...body,
      // OpenRouter caps the native fallback list at 3; the client-side rotation loop
      // still covers the full configured list.
      ...(this.models.length > 1 ? { models: this.models.slice(0, 3) } : {}),
    } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming;
    return client.chat.completions.create(params);
  }

  private logCall(method: string, actualModel: string, fallbackCount: number): void {
    // Structured, PII-free observability line (regra 12 / regra 9).
    this.logger.log(
      JSON.stringify({
        event: 'llm_call',
        provider: this.name,
        method,
        requested_model: this.models[0],
        actual_model: actualModel,
        fallback_count: fallbackCount,
      }),
    );
  }

  private logAttemptFailed(info: { model: string; attempt: number; error: string }): void {
    this.logger.warn(JSON.stringify({ event: 'llm_attempt_failed', provider: this.name, ...info }));
  }
}
