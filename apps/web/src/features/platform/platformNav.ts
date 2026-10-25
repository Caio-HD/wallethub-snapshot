export type PlatformHubTabId =
  | 'orgs'
  | 'users'
  | 'rag'
  | 'ai'
  | 'integrations'
  | 'otp-whatsapp'
  | 'notion'
  | 'audit';

export const PLATFORM_TAB_LABELS: Record<PlatformHubTabId, string> = {
  orgs: 'Organizações',
  users: 'Utilizadores',
  rag: 'Base de conhecimento',
  ai: 'Histórico IA',
  integrations: 'Integrações',
  'otp-whatsapp': 'OTP / WhatsApp',
  notion: 'Notion',
  audit: 'Auditoria',
};

export type PlatformBreadcrumbItem = {
  label: string;
  to?: string;
};

export function platformPath(params: {
  tab: PlatformHubTabId;
  orgId?: string;
  userId?: string;
}): string {
  const search = new URLSearchParams({ tab: params.tab });
  if (params.orgId) search.set('orgId', params.orgId);
  if (params.userId) search.set('userId', params.userId);
  return `/platform?${search.toString()}`;
}

export function buildPlatformBreadcrumbs(
  tab: PlatformHubTabId,
  detail?: {
    orgId?: string | null;
    orgName?: string | null;
    userId?: string | null;
    userName?: string | null;
  },
): PlatformBreadcrumbItem[] {
  const root: PlatformBreadcrumbItem = {
    label: 'Console',
    to: platformPath({ tab: 'orgs' }),
  };

  if (tab === 'orgs') {
    if (detail?.orgId) {
      return [
        root,
        { label: 'Organizações', to: platformPath({ tab: 'orgs' }) },
        { label: detail.orgName?.trim() || '…' },
      ];
    }
    return [root, { label: 'Organizações' }];
  }

  if (tab === 'users') {
    if (detail?.userId) {
      return [
        root,
        { label: 'Utilizadores', to: platformPath({ tab: 'users' }) },
        { label: detail.userName?.trim() || '…' },
      ];
    }
    return [root, { label: 'Utilizadores' }];
  }

  return [root, { label: PLATFORM_TAB_LABELS[tab] }];
}
