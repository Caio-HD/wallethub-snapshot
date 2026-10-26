import { isAxiosError } from 'axios';

/**
 * Extrai a mensagem de erro legível de uma resposta de API (axios).
 * O backend NestJS expõe `message` como string ou array (erros de validação).
 * Como defesa, também trata o formato aninhado `{ message, error, statusCode }`
 * — que, quando não tratado, fazia o cliente cair no toast genérico
 * (ex.: "Error sending code" no fluxo de OTP).
 */
export function extractApiErrorMessage(error: unknown): string | undefined {
  if (!isAxiosError(error)) return undefined;
  const message = error.response?.data?.message;
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) return message.join(', ');
  const nested = (message as { message?: unknown } | undefined)?.message;
  if (typeof nested === 'string') return nested;
  if (Array.isArray(nested)) return nested.join(', ');
  return undefined;
}
