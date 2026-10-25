import * as Joi from 'joi';

/** Comma-separated origins, same semantics as `main.ts` CORS (`split(',')`). */
function commaSeparatedUris(value: unknown, helpers: Joi.CustomHelpers): unknown {
  if (value === undefined || value === null || value === '') {
    return value;
  }
  if (typeof value !== 'string') {
    return helpers.error('any.invalid');
  }
  const segments = value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const segment of segments) {
    const { error } = Joi.string().uri().validate(segment);
    if (error) {
      return helpers.error('any.invalid');
    }
  }
  return value;
}

/** Single source of truth for environment variable validation. */
export const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  API_PREFIX: Joi.string().default('api'),
  FRONTEND_URL: Joi.string().optional().allow('').custom(commaSeparatedUris),
  DATABASE_URL: Joi.string().uri().optional(),
  DB_HOST: Joi.string().optional(),
  DB_PORT: Joi.number().optional(),
  DB_USER: Joi.string().optional(),
  DB_PASSWORD: Joi.string().optional(),
  DB_NAME: Joi.string().optional(),
  DB_SSL: Joi.boolean().optional(),
  TYPEORM_LOGGING: Joi.string().valid('true', 'false').optional(),
  TYPEORM_SYNCHRONIZE: Joi.string().valid('true', 'false').optional(),
  TYPEORM_MIGRATIONS_RUN: Joi.string().valid('true', 'false').optional(),
  JWT_PRIVATE_KEY: Joi.string().required(),
  JWT_PUBLIC_KEY: Joi.string().required(),
  JWT_ACCESS_TTL: Joi.string().default('900s'),
  JWT_REFRESH_TTL: Joi.string().default('86400s'),
  REDIS_URL: Joi.string().optional(),
  REDIS_HOST: Joi.string().optional(),
  REDIS_PORT: Joi.number().optional(),
  REDIS_PASSWORD: Joi.string().optional(),
  REDIS_TLS: Joi.boolean().optional(),
  META_APP_SECRET: Joi.string().optional().allow(''),
  WHATSAPP_PHONE_ID: Joi.string().optional().allow(''),
  WHATSAPP_ACCESS_TOKEN: Joi.string().optional().allow(''),
  WHATSAPP_VERIFY_TOKEN: Joi.string().optional().allow(''),
  AI_DEFAULT_PROVIDER: Joi.string()
    .valid('openai', 'vertex', 'deepseek', 'openrouter', 'none')
    .optional(),
  OPENAI_API_KEY: Joi.string().optional().allow(''),
  OPENAI_MODEL: Joi.string().optional(),
  OPENROUTER_API_KEY: Joi.string().optional().allow(''),
  OPENROUTER_MODEL: Joi.string().optional(),
  OPENROUTER_MODELS: Joi.string().optional(),
  OPENROUTER_TIMEOUT_MS: Joi.number().optional(),
  DEEPSEEK_API_KEY: Joi.string().optional().allow(''),
  DEEPSEEK_MODEL: Joi.string().optional(),
  VERTEX_PROJECT_ID: Joi.string().optional(),
  VERTEX_LOCATION: Joi.string().optional(),
  VERTEX_MODEL: Joi.string().optional(),
  AI_REQUEST_TIMEOUT_MS: Joi.number().optional(),
  EVOLUTION_API_URL: Joi.string().uri().optional(),
  EVOLUTION_API_KEY: Joi.string().optional().allow(''),
  EVOLUTION_INSTANCE_NAME: Joi.string().optional(),
  STORAGE_TYPE: Joi.string().valid('local', 's3', 'minio').optional(),
  STORAGE_LOCAL_PATH: Joi.string().optional(),
  STORAGE_S3_BUCKET: Joi.string().optional(),
  STORAGE_S3_REGION: Joi.string().optional(),
  STORAGE_S3_ENDPOINT: Joi.string().uri().optional(),
  STORAGE_S3_ACCESS_KEY_ID: Joi.string().optional(),
  STORAGE_S3_SECRET_ACCESS_KEY: Joi.string().optional(),
  STORAGE_MINIO_BUCKET: Joi.string().optional(),
  STORAGE_MINIO_ENDPOINT: Joi.string().uri().optional(),
  STORAGE_MINIO_ACCESS_KEY: Joi.string().optional(),
  STORAGE_MINIO_SECRET_KEY: Joi.string().optional(),
  STORAGE_MAX_FILE_SIZE: Joi.number().optional(),
  STORAGE_ALLOWED_MIME_TYPES: Joi.string().optional(),
  NOTION_API_KEY: Joi.string().optional(),
  NOTION_TRANSACTIONS_DB_ID: Joi.string().optional(),
  NOTION_ACCOUNTS_DB_ID: Joi.string().optional(),
  NOTION_CATEGORIES_DB_ID: Joi.string().optional(),
  NOTION_PROJECTIONS_DB_ID: Joi.string().optional(),
  NOTION_WEBHOOK_SECRET: Joi.string().optional(),
  NOTION_SYNC_ENABLED: Joi.string().valid('true', 'false').optional(),
  NOTION_RETRY_MAX_ATTEMPTS: Joi.number().optional(),
  NOTION_RETRY_DELAY_MS: Joi.number().optional(),
  RAG_ENABLED: Joi.string().valid('true', 'false').optional(),
  RAG_EMBEDDING_MODEL: Joi.string().optional(),
  RAG_EMBEDDING_DIMENSIONS: Joi.number().optional(),
  RAG_TOP_K: Joi.number().optional(),
  RAG_CHUNK_SIZE_CHARS: Joi.number().optional(),
  RAG_CHUNK_OVERLAP_CHARS: Joi.number().optional(),
  AI_TRACE_ENABLED: Joi.string().valid('true', 'false').optional(),
  AI_OBSERVATION_MAX_PAYLOAD_CHARS: Joi.number().optional(),
  MCP_SERVERS_JSON: Joi.string().optional(),
  BRAPI_TOKEN: Joi.string().optional().allow(''),
  INVESTMENT_QUOTES_REPEAT_MS: Joi.number().optional(),
  INVESTMENT_BR_MIN_REFRESH_SEC: Joi.number().optional(),
  INVESTMENT_INTL_MIN_REFRESH_SEC: Joi.number().optional(),
  RESEND_API_KEY: Joi.string().optional().allow(''),
  RESEND_FROM: Joi.string().optional().allow(''),
  EMAIL_OTP_SUBJECT: Joi.string().optional().allow(''),
  EMAIL_OTP_HTML: Joi.string().optional().allow(''),
  EMAIL_OTP_TTL_MINUTES: Joi.number().optional(),
  TWILIO_ACCOUNT_SID: Joi.string().optional().allow(''),
  TWILIO_AUTH_TOKEN: Joi.string().optional().allow(''),
  TWILIO_PHONE_NUMBER: Joi.string().optional().allow(''),
  TWILIO_OTP_BODY: Joi.string().optional().allow(''),
  SUPER_ADMIN_BYPASS_ENABLED: Joi.string().valid('true', 'false').optional(),
});
