import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VertexAI } from '@google-cloud/vertexai';
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
export class VertexProvider implements AiProvider {
  readonly name = 'vertex' as const;
  private readonly logger = new Logger(VertexProvider.name);
  private vertex?: VertexAI;
  private modelName?: string;

  constructor(private readonly configService: ConfigService) {}

  private ensureClient() {
    if (this.vertex) {
      return;
    }
    const config = this.configService.get<AiProviderConfig>('ai');
    if (!config?.vertex?.projectId) {
      this.logger.warn('VERTEX_PROJECT_ID não configurado. Provider permanecerá inativo.');
      return;
    }
    this.vertex = new VertexAI({
      project: config.vertex.projectId,
      location: config.vertex.location ?? 'us-central1',
    });
    this.modelName = config.vertex.model ?? 'gemini-1.5-flash';
  }

  isConfigured(): boolean {
    this.ensureClient();
    return Boolean(this.vertex && this.modelName);
  }

  async generateMessage(context: AiMessageContext): Promise<AiMessageResponse> {
    this.ensureClient();
    if (!this.vertex || !this.modelName) {
      throw new Error('Provider Vertex não configurado');
    }

    const model = this.vertex.getGenerativeModel({ model: this.modelName });
    const response = await model.generateContent({
      contents: [
        {
          role: 'system',
          parts: [
            {
              text: 'Você é um assistente financeiro para a carteira WalletHub. Responda em português, curto e objetivo.',
            },
          ],
        },
        {
          role: 'user',
          parts: [
            {
              text: context.text,
            },
          ],
        },
      ],
    });

    const { candidates = [], usageMetadata } = response.response ?? {};
    const candidate = candidates[0];
    const parts = candidate?.content?.parts ?? [];
    const reply = parts
      .map((part) => ('text' in part && part.text ? part.text : ''))
      .join(' ')
      .trim();

    return {
      reply,
      usage: {
        totalTokens: usageMetadata?.totalTokenCount,
        inputTokens: usageMetadata?.promptTokenCount,
        outputTokens: usageMetadata?.candidatesTokenCount,
        model: this.modelName,
        provider: this.name,
      },
      extra: {
        candidateIndex: candidate?.index,
        finishReason: candidate?.finishReason,
      },
    };
  }

  async chatWithTools(messages: AgentMessage[], tools: AiChatTool[]): Promise<AgentTurnResult> {
    this.ensureClient();
    if (!this.vertex || !this.modelName) {
      throw new Error('Provider Vertex não configurado');
    }

    const toolDeclarations = tools.map((t) => ({
      name: t.function.name,
      description: t.function.description,
      parameters: {
        type: 'OBJECT' as const,
        properties: t.function.parameters?.properties ?? {},
        required: t.function.parameters?.required ?? [],
      },
    }));

    const contents: Array<{
      role: string;
      parts: Array<{
        text?: string;
        functionCall?: { name: string; args: Record<string, unknown> };
        functionResponse?: { name: string; response: Record<string, unknown> };
      }>;
    }> = [];
    for (const m of messages) {
      if (m.role === 'system') {
        contents.push({ role: 'user', parts: [{ text: `[Sistema] ${m.content}` }] });
      } else if (m.role === 'user') {
        contents.push({ role: 'user', parts: [{ text: m.content }] });
      } else if (m.role === 'assistant') {
        contents.push({ role: 'model', parts: [{ text: m.content }] });
      } else if (m.role === 'tool') {
        contents.push({
          role: 'user',
          parts: [
            {
              functionResponse: {
                name: m.name ?? 'tool',
                response: { content: m.content },
              },
            } as { functionResponse: { name: string; response: Record<string, unknown> } },
          ],
        });
      }
    }

    const model = this.vertex.getGenerativeModel({
      model: this.modelName,
      ...(toolDeclarations.length > 0 && {
        tools: [{ functionDeclarations: toolDeclarations }] as unknown as NonNullable<
          Parameters<typeof this.vertex.getGenerativeModel>[0]
        >['tools'],
      }),
    });

    const response = await model.generateContent({
      contents: contents.map((c) => ({ role: c.role as 'user' | 'model', parts: c.parts })),
    } as Parameters<ReturnType<typeof this.vertex.getGenerativeModel>['generateContent']>[0]);

    const { candidates = [], usageMetadata } = response.response ?? {};
    const candidate = candidates[0];
    const parts = candidate?.content?.parts ?? [];

    let content: string | null = null;
    const toolCalls: AgentTurnResult['toolCalls'] = [];

    for (const part of parts) {
      if (part.text) {
        content = (content ?? '') + part.text;
      }
      const fc = part as { functionCall?: { name: string; args?: Record<string, unknown> } };
      if (fc.functionCall?.name) {
        toolCalls.push({
          id: `vertex-${fc.functionCall.name}-${Date.now()}`,
          name: fc.functionCall.name,
          arguments: JSON.stringify(fc.functionCall.args ?? {}),
        });
      }
    }

    if (content) content = content.trim();

    return {
      content: content || null,
      toolCalls,
      usage: usageMetadata
        ? {
            inputTokens: usageMetadata.promptTokenCount,
            outputTokens: usageMetadata.candidatesTokenCount,
            totalTokens: usageMetadata.totalTokenCount,
            model: this.modelName,
            provider: this.name,
          }
        : undefined,
      finishReason: candidate?.finishReason?.toString(),
    };
  }
}
