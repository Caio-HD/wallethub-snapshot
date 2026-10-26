/** Campos sensíveis — nunca mostrar valores na UI de auditoria. */
const REDACTED_KEYS = new Set([
  'password',
  'passwordHash',
  'secret',
  'totpSecret',
  'mfaSecret',
  'refreshToken',
  'accessToken',
]);

const FIELD_LABELS: Record<string, string> = {
  name: 'Nome',
  username: 'Username',
  email: 'Email',
  phoneNumber: 'Telefone',
  role: 'Papel',
  isActive: 'Ativo',
  isMfaEnabled: 'MFA',
  plan: 'Plano',
  isQa: 'Organização QA',
  legalName: 'Razão social',
  taxIdType: 'Tipo fiscal',
  taxId: 'NIF',
  timezone: 'Fuso horário',
  preferredLanguage: 'Idioma',
  messagingAiEnabled: 'IA mensagens',
  status: 'Estado',
  sourceKey: 'Chave',
  title: 'Título',
  passwordReset: 'Reset de password',
};

export interface AuditDiffRow {
  field: string;
  label: string;
  before: string;
  after: string;
  changed: boolean;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function formatValue(key: string, value: unknown): string {
  if (REDACTED_KEYS.has(key)) return '••••••••';
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'sim' : 'não';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.length === 0 ? '[]' : JSON.stringify(value);
  if (isPlainObject(value)) {
    const keys = Object.keys(value);
    return keys.length === 0 ? '{}' : JSON.stringify(value);
  }
  return String(value);
}

function collectKeys(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): string[] {
  const keys = new Set<string>();
  for (const k of Object.keys(before ?? {})) keys.add(k);
  for (const k of Object.keys(after ?? {})) keys.add(k);
  return [...keys].sort();
}

/** Diff legível entre snapshots before/after (top-level, sem JSON cru). */
export function computeAuditDiff(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): AuditDiffRow[] {
  if (!before && !after) return [];

  const keys = collectKeys(before, after);
  return keys.map((field) => {
    const b = before?.[field];
    const a = after?.[field];
    const beforeStr = formatValue(field, b);
    const afterStr = formatValue(field, a);
    return {
      field,
      label: FIELD_LABELS[field] ?? field,
      before: beforeStr,
      after: afterStr,
      changed: beforeStr !== afterStr,
    };
  });
}
