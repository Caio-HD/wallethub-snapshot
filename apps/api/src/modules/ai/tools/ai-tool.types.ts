import { AgentMessage } from '../ai.types';

/** 'all' = conjunto partilhado; caso contrário UUID do utilizador. */
export type DataScope = string;

/** Contador partilhado de observações num trace (sessão única). */
export interface AgentTraceHandle {
  traceId: string;
  nextSeq(): number;
}

/** Context for agent execution: user and default data scope */
export interface AgentContext {
  userId: string;
  scope: DataScope;
  /** Optional period (yyyy-MM); defaults to current month when not provided by tools */
  period?: string;
  organizationId?: string;
  channel?: 'web' | 'whatsapp' | 'telegram';
  whatsappEventId?: string | null;
  telegramEventId?: string | null;
  /** Quando presente, o executor pode registar observações adicionais (ex.: RAG). */
  trace?: AgentTraceHandle | null;
}

/** Single tool call request from the LLM */
export interface ToolCallRequest {
  id: string;
  name: string;
  arguments: string;
}

/** Result of executing one tool (serializable for LLM) */
export interface ToolCallResult {
  toolCallId: string;
  content: string;
}

/** Agent run options */
export interface RunAgentOptions {
  /** Max rounds of tool calls (default 5) */
  maxToolRounds?: number;
  /** Preferred provider */
  preferredProvider?: 'openai' | 'vertex' | 'deepseek' | 'openrouter';
  /** Optional history of messages */
  history?: AgentMessage[];
  /** Quando false, não grava em ai_agent_traces / ai_trace_observations */
  tracingEnabled?: boolean;
}

/** Agent run result */
export interface AgentRunResult {
  reply: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    model?: string;
    provider?: string;
  };
  toolsUsed?: string[];
  extra?: Record<string, unknown>;
}
