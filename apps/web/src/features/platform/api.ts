import apiClient from '@shared/lib/apiClient';
import type { Role, Tokens } from '@entities/user';

export async function startMfaEnrollment(): Promise<{ qrCode: string; secret: string }> {
  const { data } = await apiClient.post<{ qrCode: string; secret: string }>(
    '/auth/mfa/enroll/start',
  );
  return data;
}

/** Returns fresh tokens whose access JWT carries isMfaEnabled=true. */
export async function confirmMfaEnrollment(token: string): Promise<Tokens> {
  const { data } = await apiClient.post<Tokens>('/auth/mfa/enroll/confirm', { token });
  return data;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface PlatformOrgListItem {
  id: string;
  name: string;
  plan: 'free' | 'pro' | 'plus';
  isQa: boolean;
  memberCount: number;
  transactionCount: number;
  createdAt: string;
}

export interface PlatformOrgDetail {
  id: string;
  name: string;
  plan: 'free' | 'pro' | 'plus';
  isQa: boolean;
  legalName: string | null;
  taxIdType: 'cpf' | 'cnpj' | null;
  taxId: string | null;
  createdAt: string;
  members: PlatformOrgMember[];
}

export interface PlatformOrgMember {
  userId: string;
  name: string;
  email: string | null;
  role: string;
  status: string;
  messagingAiEnabled: boolean;
}

export interface PlatformOrgTransaction {
  id: string;
  occurredAt: string;
  amount: string;
  direction: 'income' | 'expense';
  description: string | null;
  category: string | null;
  account: string | null;
}

export interface PlatformOrgAccount {
  id: string;
  name: string;
  isActive: boolean;
}
export interface PlatformOrgCategory {
  id: string;
  name: string;
  type: 'income' | 'expense';
}

export interface PlatformUserMembership {
  organizationId: string;
  organizationName: string;
  role: string;
}
export interface PlatformUser {
  id: string;
  username: string;
  name: string;
  phoneNumber: string | null;
  email: string | null;
  isActive: boolean;
  role: Role;
  isMfaEnabled: boolean;
  timezone: string | null;
  preferredLanguage: string | null;
  memberships: PlatformUserMembership[];
  createdAt: string;
  updatedAt: string;
}

export interface PlatformAuditEntry {
  id: string;
  actorUserId: string | null;
  actorLabel: string | null;
  action: 'create' | 'update' | 'deactivate' | 'impersonate' | 'read';
  entityType: string;
  entityId: string | null;
  entityLabel: string | null;
  organizationId: string | null;
  organizationName: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  query: Record<string, unknown> | null;
  createdAt: string;
}

export async function fetchPlatformOrganizations(params: {
  page?: number;
  limit?: number;
  q?: string;
  plan?: string;
}): Promise<Paginated<PlatformOrgListItem>> {
  const { data } = await apiClient.get<Paginated<PlatformOrgListItem>>(
    '/admin/platform/organizations',
    { params },
  );
  return data;
}

export async function fetchPlatformOrgDetail(id: string): Promise<PlatformOrgDetail> {
  const { data } = await apiClient.get<PlatformOrgDetail>(`/admin/platform/organizations/${id}`);
  return data;
}

export async function fetchPlatformOrgTransactions(
  id: string,
  params: { page?: number; limit?: number; from?: string; to?: string; q?: string },
): Promise<Paginated<PlatformOrgTransaction>> {
  const { data } = await apiClient.get<Paginated<PlatformOrgTransaction>>(
    `/admin/platform/organizations/${id}/transactions`,
    { params },
  );
  return data;
}

export async function fetchPlatformOrgAccounts(id: string): Promise<PlatformOrgAccount[]> {
  const { data } = await apiClient.get<PlatformOrgAccount[]>(
    `/admin/platform/organizations/${id}/accounts`,
  );
  return data;
}

export async function fetchPlatformOrgCategories(id: string): Promise<PlatformOrgCategory[]> {
  const { data } = await apiClient.get<PlatformOrgCategory[]>(
    `/admin/platform/organizations/${id}/categories`,
  );
  return data;
}

export async function patchPlatformOrganization(
  id: string,
  body: Partial<{
    name: string;
    plan: string;
    isQa: boolean;
    legalName: string | null;
    taxIdType: 'cpf' | 'cnpj' | null;
    taxId: string | null;
  }>,
): Promise<PlatformOrgDetail> {
  const { data } = await apiClient.patch<PlatformOrgDetail>(
    `/admin/platform/organizations/${id}`,
    body,
  );
  return data;
}

export async function createPlatformOrganization(body: {
  name: string;
  plan?: 'free' | 'pro' | 'plus';
  isQa?: boolean;
  ownerUserId?: string;
}): Promise<PlatformOrgDetail> {
  const { data } = await apiClient.post<PlatformOrgDetail>('/admin/platform/organizations', body);
  return data;
}

export async function startPlatformImpersonation(
  organizationId: string,
): Promise<{ organizationId: string; organizationName: string }> {
  const { data } = await apiClient.post<{ organizationId: string; organizationName: string }>(
    '/admin/platform/impersonate',
    { organizationId },
  );
  return data;
}

export async function addPlatformOrgMember(
  organizationId: string,
  body: { userId: string; role: 'owner' | 'admin' | 'member' },
): Promise<void> {
  await apiClient.post(`/admin/platform/organizations/${organizationId}/members`, body);
}

export async function patchPlatformOrgMember(
  organizationId: string,
  userId: string,
  body: Partial<{ role: 'owner' | 'admin' | 'member'; status: 'active' | 'invited'; messagingAiEnabled: boolean }>,
): Promise<void> {
  await apiClient.patch(`/admin/platform/organizations/${organizationId}/members/${userId}`, body);
}

export async function removePlatformOrgMember(organizationId: string, userId: string): Promise<void> {
  await apiClient.delete(`/admin/platform/organizations/${organizationId}/members/${userId}`);
}

export async function fetchPlatformUsers(params: {
  page?: number;
  limit?: number;
  q?: string;
}): Promise<Paginated<PlatformUser>> {
  // Super_admin-gated list (toPublic includes memberships). Consolidated onto /admin/platform/*;
  // the legacy /admin/users is deprecated (Sunset 2026-10-01).
  const { data } = await apiClient.get<Paginated<PlatformUser>>('/admin/platform/users', { params });
  return data;
}

export async function fetchPlatformUser(id: string): Promise<PlatformUser> {
  const { data } = await apiClient.get<PlatformUser>(`/admin/platform/users/${id}`);
  return data;
}

export async function patchPlatformUser(
  id: string,
  body: Partial<{
    name: string;
    role: Role;
    isActive: boolean;
    email: string | null;
    phoneNumber: string | null;
    timezone: string | null;
    preferredLanguage: string | null;
  }>,
): Promise<PlatformUser> {
  const { data } = await apiClient.patch<PlatformUser>(`/admin/platform/users/${id}`, body);
  return data;
}

export async function resetPlatformUserPassword(id: string, password: string): Promise<void> {
  await apiClient.post(`/admin/platform/users/${id}/reset-password`, { password });
}

export async function disablePlatformUserMfa(id: string): Promise<void> {
  await apiClient.post(`/admin/platform/users/${id}/mfa/disable`);
}

export async function fetchPlatformAudit(params: {
  page?: number;
  limit?: number;
  entityType?: string;
  actorUserId?: string;
  organizationId?: string;
  action?: string;
  from?: string;
  to?: string;
  q?: string;
}): Promise<Paginated<PlatformAuditEntry>> {
  const { data } = await apiClient.get<Paginated<PlatformAuditEntry>>('/admin/platform/audit', {
    params,
  });
  return data;
}

export interface PlatformAuditExportFilters {
  entityType?: string;
  actorUserId?: string;
  organizationId?: string;
  action?: string;
  from?: string;
  to?: string;
  q?: string;
}

export interface PlatformAuditExportResult {
  items: PlatformAuditEntry[];
  total: number;
  exported: number;
  truncated: boolean;
}

export async function exportPlatformAudit(
  params: PlatformAuditExportFilters & { format?: 'csv' | 'json' },
): Promise<Blob | PlatformAuditExportResult> {
  const format = params.format ?? 'csv';
  if (format === 'json') {
    const { data } = await apiClient.get<PlatformAuditExportResult>('/admin/platform/audit/export', {
      params: { ...params, format: 'json' },
    });
    return data;
  }
  const { data } = await apiClient.get<Blob>('/admin/platform/audit/export', {
    params: { ...params, format: 'csv' },
    responseType: 'blob',
  });
  return data;
}

/** Create a platform user. Super_admin-gated + ElevatedAccessGuard; audited via /admin/platform/*. */
export async function createPlatformUser(body: {
  username: string;
  name: string;
  phoneNumber: string;
  password: string;
  email?: string;
}): Promise<PlatformUser> {
  const { data } = await apiClient.post<PlatformUser>('/admin/platform/users', body);
  return data;
}

// ----------------------------------------------------------------- RAG corpus
// Read + write of the platform-wide RAG corpus. All routes are super_admin + ElevatedAccessGuard;
// writes were moved off the formerly-open `/rag/documents` onto `/admin/rag/documents` (PR: legacy
// admin retirement).
export interface RagDocumentListItem {
  id: string;
  sourceKey: string;
  title: string | null;
  contentHash: string | null;
  metadata: Record<string, unknown> | null;
  updatedAt: string;
  chunkCount: number;
}

export interface RagDocumentDetail extends RagDocumentListItem {
  body: string;
}

export async function fetchRagDocuments(params: {
  page?: number;
  limit?: number;
}): Promise<Paginated<RagDocumentListItem>> {
  const { data } = await apiClient.get<Paginated<RagDocumentListItem>>('/admin/rag/documents', {
    params,
  });
  return data;
}

export async function fetchRagDocument(sourceKey: string): Promise<RagDocumentDetail> {
  const encoded = encodeURIComponent(sourceKey);
  const { data } = await apiClient.get<RagDocumentDetail>(`/admin/rag/documents/${encoded}`);
  return data;
}

export async function upsertRagDocument(body: {
  sourceKey: string;
  title?: string;
  body: string;
  metadata?: Record<string, unknown>;
}): Promise<unknown> {
  const { data } = await apiClient.post('/admin/rag/documents', body);
  return data;
}

export async function deleteRagDocument(sourceKey: string): Promise<{ deleted: boolean }> {
  const encoded = encodeURIComponent(sourceKey);
  const { data } = await apiClient.delete<{ deleted: boolean }>(`/admin/rag/documents/${encoded}`);
  return data;
}

// ----------------------------------------------------------------- AI history
export interface AiSessionRow {
  id: string;
  userId: string | null;
  userName: string | null;
  channel: string;
  sessionDate: string;
  createdAt: string;
}

export async function fetchAiSessions(params: {
  page?: number;
  limit?: number;
  userId?: string;
  channel?: 'web' | 'whatsapp' | 'telegram';
  from?: string;
  to?: string;
}): Promise<Paginated<AiSessionRow>> {
  const { data } = await apiClient.get<Paginated<AiSessionRow>>('/admin/ai/sessions', { params });
  return data;
}

export interface AiTraceRow {
  id: string;
  sessionId: string;
  channel?: string;
  sessionDate?: string;
  status: string;
  provider: string | null;
  model: string | null;
  startedAt: string;
  finishedAt: string | null;
  errorMessage: string | null;
  finalReply: string | null;
}

export async function fetchAiTraces(params: {
  page?: number;
  limit?: number;
  sessionId?: string;
  from?: string;
  to?: string;
}): Promise<Paginated<AiTraceRow>> {
  const { data } = await apiClient.get<Paginated<AiTraceRow>>('/admin/ai/traces', { params });
  return data;
}

export interface AiTraceObservation {
  id: string;
  sequence: number;
  observationType: string;
  name: string | null;
  payload: unknown;
  createdAt: string;
}

export interface AiTraceDetail {
  id: string;
  sessionId: string;
  userId: string | null;
  userName: string | null;
  channel: string;
  sessionDate: string;
  whatsappEventId: string | null;
  telegramEventId: string | null;
  status: string;
  provider: string | null;
  model: string | null;
  usage: unknown;
  errorMessage: string | null;
  finalReply: string | null;
  startedAt: string;
  finishedAt: string | null;
  observations: AiTraceObservation[];
}

export async function fetchAiTraceDetail(id: string, obsLimit?: number): Promise<AiTraceDetail> {
  const { data } = await apiClient.get<AiTraceDetail>(`/admin/ai/traces/${id}`, {
    params: obsLimit ? { obsLimit } : undefined,
  });
  return data;
}

// ----------------------------------------------------------------- Integrations + Notion
export interface IntegrationsStatus {
  ragEnabled: boolean;
  mcpConfigured: boolean;
  mcpServerCount: number;
}

export async function fetchIntegrationsStatus(): Promise<IntegrationsStatus> {
  const { data } = await apiClient.get<IntegrationsStatus>('/admin/integrations/status');
  return data;
}

export interface QueueHealthStatus {
  status: 'up' | 'down';
  counts?: Record<string, number>;
  error?: string;
}

export interface IntegrationsQueuesReport {
  status: 'up' | 'degraded';
  timestamp: string;
  queues: Record<string, QueueHealthStatus>;
}

export async function fetchIntegrationsQueues(): Promise<IntegrationsQueuesReport> {
  const { data } = await apiClient.get<IntegrationsQueuesReport>('/admin/integrations/queues');
  return data;
}

export interface NotionStatus {
  enabled: boolean;
  configured: boolean;
  databases: {
    transactions: string;
    accounts: string;
    categories: string;
    projections: string;
  };
}

export async function fetchNotionStatus(): Promise<NotionStatus> {
  const { data } = await apiClient.get<NotionStatus>('/admin/integrations/notion/status');
  return data;
}

export async function triggerNotionSync(
  entityType: 'transaction' | 'account' | 'category' | 'projection',
) {
  const { data } = await apiClient.post<{ message: string; queued: number }>(
    '/admin/integrations/notion/sync',
    { entityType },
  );
  return data;
}

// ----------------------------------------------------------------- OTP por WhatsApp (Evolution)
export interface OtpWhatsAppStatus {
  enabled: boolean;
  instanceName: string;
  capable: boolean;
  connectionState: string;
}

export async function fetchOtpWhatsAppStatus(): Promise<OtpWhatsAppStatus> {
  const { data } = await apiClient.get<OtpWhatsAppStatus>('/admin/integrations/evolution/otp');
  return data;
}

export async function createOtpWhatsAppInstance(): Promise<{ instanceName: string }> {
  const { data } = await apiClient.post<{ instanceName: string }>(
    '/admin/integrations/evolution/otp/instance',
  );
  return data;
}

/** Retorna o QR (Evolution): normalmente `{ base64, code, pairingCode, count }`. */
export async function connectOtpWhatsApp(): Promise<Record<string, unknown>> {
  const { data } = await apiClient.post<Record<string, unknown>>(
    '/admin/integrations/evolution/otp/connect',
  );
  return data;
}

export async function logoutOtpWhatsApp(): Promise<{ instanceName: string }> {
  const { data } = await apiClient.post<{ instanceName: string }>(
    '/admin/integrations/evolution/otp/logout',
  );
  return data;
}

export async function updateOtpWhatsAppSettings(patch: {
  enabled?: boolean;
  instanceName?: string;
}): Promise<{ enabled: boolean; instanceName?: string }> {
  const { data } = await apiClient.patch<{ enabled: boolean; instanceName?: string }>(
    '/admin/integrations/evolution/otp',
    patch,
  );
  return data;
}
