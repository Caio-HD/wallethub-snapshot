import { registerAs } from '@nestjs/config';

export interface AiProviderConfig {
  defaultProvider: 'openai' | 'vertex' | 'deepseek' | 'openrouter' | 'none';
  openai?: {
    apiKey?: string;
    model?: string;
  };
  openrouter?: {
    apiKey?: string;
    /** Ordered rotation list (1st = primary). */
    models?: string[];
    timeoutMs?: number;
  };
  vertex?: {
    projectId?: string;
    location?: string;
    model?: string;
    serviceAccountPath?: string;
  };
  deepseek?: {
    apiKey?: string;
    model?: string;
  };
  requestTimeoutMs: number;
}

export const aiConfig = registerAs('ai', (): AiProviderConfig => {
  const defaultProvider = (process.env.AI_DEFAULT_PROVIDER?.toLowerCase() ?? 'none') as
    'openai' | 'vertex' | 'deepseek' | 'openrouter' | 'none';

  const openrouterModels = (
    process.env.OPENROUTER_MODELS ??
    process.env.OPENROUTER_MODEL ??
    'moonshotai/kimi-k2.6:free'
  )
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    defaultProvider,
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
    },
    openrouter: {
      apiKey: process.env.OPENROUTER_API_KEY,
      models: openrouterModels,
      timeoutMs: process.env.OPENROUTER_TIMEOUT_MS
        ? Number(process.env.OPENROUTER_TIMEOUT_MS)
        : undefined,
    },
    vertex: {
      projectId: process.env.VERTEX_PROJECT_ID,
      location: process.env.VERTEX_LOCATION ?? 'us-central1',
      model: process.env.VERTEX_MODEL ?? 'gemini-1.5-flash',
      serviceAccountPath: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    },
    deepseek: {
      apiKey: process.env.DEEPSEEK_API_KEY,
      model: process.env.DEEPSEEK_MODEL ?? 'deepseek-chat',
    },
    requestTimeoutMs: Number(process.env.AI_REQUEST_TIMEOUT_MS ?? 20000),
  };
});
