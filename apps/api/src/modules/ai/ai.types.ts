export interface AiMessageContext {
  text: string;
  userPhone: string;
  locale?: string;
  metadata?: Record<string, unknown>;
}

export interface AiMessageResponse {
  reply: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    model?: string;
    provider?: string;
  };
  extra?: Record<string, unknown>;
}

export interface AiProvider {
  readonly name: 'openai' | 'vertex' | 'deepseek' | 'openrouter';
  isConfigured(): boolean;
  generateMessage(context: AiMessageContext): Promise<AiMessageResponse>;
}

/** One message in an agent conversation (system, user, assistant, or tool) */
export interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  name?: string;
}

/** Tool call from the model (id, name, arguments JSON string) */
export interface AgentToolCall {
  id: string;
  name: string;
  arguments: string;
}

/** Agent turn: either a text message or tool calls from the model */
export interface AgentTurnResult {
  content: string | null;
  toolCalls: AgentToolCall[];
  usage?: AiMessageResponse['usage'];
  finishReason?: string;
}

/** OpenAI/Vertex compatible tool definition for chat */
export interface AiChatTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: { type: 'object'; properties?: Record<string, unknown>; required?: string[] };
  };
}

/** Optional: provider can implement chat with tools for the agent loop */
export interface AiProviderWithTools extends AiProvider {
  chatWithTools(messages: AgentMessage[], tools: AiChatTool[]): Promise<AgentTurnResult>;
}
