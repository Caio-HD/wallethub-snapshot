/** Rótulos pt-PT para o console de plataforma (evita expor enums crus na UI). */

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super admin',
  admin: 'Administrador',
  owner: 'Proprietário',
  member: 'Membro',
};

const PLAN_LABELS: Record<string, string> = {
  free: 'Gratuito',
  pro: 'Pro',
  plus: 'Plus',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Ativo',
  inactive: 'Inativo',
  invited: 'Convidado',
  suspended: 'Suspenso',
};

export const formatPlatformRole = (role: string) => ROLE_LABELS[role] ?? role;

export const formatPlatformPlan = (plan: string) => PLAN_LABELS[plan] ?? plan;

export const formatPlatformStatus = (status: string) => STATUS_LABELS[status] ?? status;

const AUDIT_ACTION_LABELS: Record<string, string> = {
  create: 'Criação',
  update: 'Actualização',
  deactivate: 'Desactivação',
  impersonate: 'Impersonation (auditoria)',
  read: 'Leitura',
};

const AUDIT_ENTITY_LABELS: Record<string, string> = {
  organization: 'Organização',
  organization_membership: 'Membro',
  user: 'Utilizador',
  transaction: 'Transação',
  account: 'Conta',
  category: 'Categoria',
  rag_document: 'Documento RAG',
  notion_sync: 'Sync Notion',
};

export const formatAuditAction = (action: string) => AUDIT_ACTION_LABELS[action] ?? action;

export const formatAuditEntityType = (entityType: string) =>
  AUDIT_ENTITY_LABELS[entityType] ?? entityType;

export const AUDIT_ENTITY_TYPES = Object.keys(AUDIT_ENTITY_LABELS);

export const AUDIT_ACTIONS = Object.keys(AUDIT_ACTION_LABELS);
