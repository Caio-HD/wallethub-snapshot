import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildUserPhotoUrl, resolveWalletHubApiBaseURL } from '@shared/lib/walletHubApiBaseUrl';

describe('resolveWalletHubApiBaseURL', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('usa /api quando VITE_API_URL está vazia', () => {
    vi.stubEnv('VITE_API_URL', '');
    expect(resolveWalletHubApiBaseURL()).toBe('/api');
  });

  it('preserva caminhos relativos sem protocolo', () => {
    vi.stubEnv('VITE_API_URL', '/proxy-api');
    expect(resolveWalletHubApiBaseURL()).toBe('/proxy-api');
  });

  it('anexa /api à origem http sem pathname', () => {
    vi.stubEnv('VITE_API_URL', 'http://localhost:3030');
    expect(resolveWalletHubApiBaseURL()).toBe('http://localhost:3030/api');
  });

  it('remove barras finais antes de normalizar', () => {
    vi.stubEnv('VITE_API_URL', 'http://localhost:3030///');
    expect(resolveWalletHubApiBaseURL()).toBe('http://localhost:3030/api');
  });

  it('mantém URL absoluta quando o pathname já não é só /', () => {
    vi.stubEnv('VITE_API_URL', 'http://localhost:3030/custom');
    expect(resolveWalletHubApiBaseURL()).toBe('http://localhost:3030/custom');
  });

  it('volta a /api quando a URL absoluta é inválida', () => {
    vi.stubEnv('VITE_API_URL', 'http://%20%20[');
    expect(resolveWalletHubApiBaseURL()).toBe('/api');
  });
});

describe('buildUserPhotoUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('retorna null sem userId ou storagePath', () => {
    expect(buildUserPhotoUrl('', '2024/01/a.jpg')).toBeNull();
    expect(buildUserPhotoUrl('user-id', null)).toBeNull();
    expect(buildUserPhotoUrl('user-id', '')).toBeNull();
  });

  it('monta URL com base API e cache-buster', () => {
    vi.stubEnv('VITE_API_URL', 'https://api.example.com/api');
    const url = buildUserPhotoUrl('abc-123', '2024/06/photo.jpg');
    expect(url).toBe(
      'https://api.example.com/api/users/photo/abc-123?v=2024%2F06%2Fphoto.jpg',
    );
  });

  it('usa /api relativo quando VITE_API_URL está vazia', () => {
    vi.stubEnv('VITE_API_URL', '');
    expect(buildUserPhotoUrl('uid', 'path/img.png')).toBe(
      '/api/users/photo/uid?v=path%2Fimg.png',
    );
  });
});
