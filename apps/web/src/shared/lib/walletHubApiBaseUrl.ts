/**
 * Nest usa `setGlobalPrefix('api')`. Se `VITE_API_URL` for só a origem (ex.: `http://localhost:3030`),
 * as rotas ficam em `/api/...`; sem este ajusto o cliente chamava `/budgets/...` e recebia 404.
 */
export function resolveWalletHubApiBaseURL(): string {
  const raw = import.meta.env.VITE_API_URL?.trim();
  if (!raw) return '/api';
  const normalized = raw.replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(normalized)) {
    return normalized;
  }
  try {
    const url = new URL(normalized);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    if (path === '/' && !/\/api$/i.test(url.pathname)) {
      return `${url.origin}/api`;
    }
  } catch {
    return '/api';
  }
  return normalized;
}

/** URL pública para servir foto de perfil (storagePath = valor de user.photoUrl na BD). */
export function buildUserPhotoUrl(userId: string, storagePath: string | null | undefined): string | null {
  if (!userId || !storagePath) return null;
  const base = resolveWalletHubApiBaseURL().replace(/\/+$/, '');
  return `${base}/users/photo/${userId}?v=${encodeURIComponent(storagePath)}`;
}
