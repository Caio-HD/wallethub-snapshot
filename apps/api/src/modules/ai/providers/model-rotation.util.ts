import OpenAI from 'openai';

/**
 * Client-side model rotation for OpenAI-compatible providers (OpenRouter free tier),
 * the safety net beneath OpenRouter's native `models: [...]` body fallback.
 *
 * Free models return intermittent 429s and frequently hang, so a single request is
 * retried across an ordered model list until one answers. Single source of truth for
 * both `generateMessage` and `chatWithTools` in the OpenRouter provider (DRY).
 */

export interface RotationOutcome<T> {
  result: T;
  /** Model that actually answered. */
  modelUsed: string;
  /** Models that failed before success (0 = primary worked). */
  fallbackCount: number;
}

export interface RotationOptions {
  baseBackoffMs?: number;
  onAttemptFailed?: (info: { model: string; attempt: number; error: string }) => void;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function statusOf(err: unknown): number | undefined {
  if (err instanceof OpenAI.APIError && typeof err.status === 'number') return err.status;
  return undefined;
}

function isRetryable(err: unknown): boolean {
  const status = statusOf(err);
  if (status === 429 || (status !== undefined && status >= 500)) return true;
  // Connection/timeout errors from the SDK (no HTTP status).
  if (err instanceof OpenAI.APIConnectionError || err instanceof OpenAI.APIConnectionTimeoutError) {
    return true;
  }
  const name = (err as { name?: string })?.name ?? '';
  return name === 'AbortError' || name === 'TimeoutError';
}

function retryAfterMs(err: unknown): number | undefined {
  if (!(err instanceof OpenAI.APIError)) return undefined;
  const header = (err.headers as Record<string, string> | undefined)?.['retry-after'];
  if (!header) return undefined;
  const asSeconds = Number(header);
  if (!Number.isNaN(asSeconds)) return Math.max(0, asSeconds * 1000);
  const asDate = Date.parse(header);
  return Number.isNaN(asDate) ? undefined : Math.max(0, asDate - Date.now());
}

/**
 * Try `attempt(model)` for each model in order. On a retryable failure, wait
 * `max(Retry-After, backoff)` and move to the next model. Non-retryable errors abort
 * immediately. Throws the last error if all models fail.
 */
export async function withModelRotation<T>(
  models: string[],
  attempt: (model: string) => Promise<T>,
  opts: RotationOptions = {},
): Promise<RotationOutcome<T>> {
  if (models.length === 0) throw new Error('withModelRotation: empty model list');
  const backoff = opts.baseBackoffMs ?? 500;
  let lastError: unknown;

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    try {
      const result = await attempt(model);
      return { result, modelUsed: model, fallbackCount: i };
    } catch (err) {
      lastError = err;
      opts.onAttemptFailed?.({
        model,
        attempt: i + 1,
        error: err instanceof Error ? err.message : String(err),
      });
      const isLast = i === models.length - 1;
      if (!isRetryable(err) || isLast) throw err;
      await sleep(Math.max(retryAfterMs(err) ?? 0, backoff));
    }
  }

  // Unreachable in practice: the loop returns or throws on the last model.
  throw lastError instanceof Error
    ? lastError
    : new Error('withModelRotation: exhausted all models');
}
