import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { ConfigService } from '@nestjs/config';
import {
  AiMessageContext,
  AiMessageResponse,
  AiProvider,
  AgentMessage,
  AgentTurnResult,
  AiChatTool,
} from '../ai.types';
import { AiProviderConfig } from '../../../core/config/ai.config';

@Injectable()
export class OpenAiProvider implements AiProvider {
  readonly name = 'openai' as const;
  private readonly logger = new Logger(OpenAiProvider.name);
  private client?: OpenAI;
  private model?: string;

  constructor(private readonly configService: ConfigService) {}

  private ensureClient() {
    if (this.client) {
      return;
    }
    const aiConfig = this.configService.get<AiProviderConfig>('ai');
    const apiKey = aiConfig?.openai?.apiKey;
    if (!apiKey) {
      this.logger.warn('OPENAI_API_KEY não configurada. Provider permanecerá inativo.');
      return;
    }
    this.model = aiConfig?.openai?.model ?? 'gpt-4o-mini';
    this.client = new OpenAI({ apiKey });
  }

  isConfigured(): boolean {
    this.ensureClient();
    return Boolean(this.client && this.model);
  }

  async generateMessage(context: AiMessageContext): Promise<AiMessageResponse> {
    this.ensureClient();
    if (!this.client || !this.model) {
      throw new Error('Provider OpenAI não configurado');
    }

    const completion = await this.client.responses.create({
      model: this.model,
      input: [
        {
          role: 'system',
          content: `Você é um assistente financeiro para a carteira WalletHub. Responda em português, curto e objetivo.`,
        },
        {
          role: 'user',
          content: context.text,
        },
      ],
    });

    const reply =
      completion.output_text?.[0]?.trim() ??
      completion.output
        ?.flatMap((item) =>
          item.type === 'message'
            ? item.content.map((part) => ('text' in part ? part.text : '')).join(' ')
            : [],
        )
        .join(' ')
        .trim() ??
      '';

    return {
      reply,
      usage: {
        inputTokens: completion.usage?.input_tokens,
        outputTokens: completion.usage?.output_tokens,
        totalTokens: completion.usage?.total_tokens,
        model: this.model,
        provider: this.name,
      },
      extra: {
        id: completion.id,
      },
    };
  }

  async chatWithTools(messages: AgentMessage[], tools: AiChatTool[]): Promise<AgentTurnResult> {
    this.ensureClient();
    if (!this.client || !this.model) {
      throw new Error('Provider OpenAI não configurado');
    }

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
      };
    });

    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: apiMessages,
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: tools.length > 0 ? 'auto' : undefined,
    });

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
            model: this.model,
            provider: this.name,
          }
        : undefined,
      finishReason: choice?.finish_reason ?? undefined,
    };
  }
}
