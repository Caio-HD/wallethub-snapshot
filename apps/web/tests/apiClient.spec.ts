import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient, { bindAccessTokenProvider, bindOrganizationIdProvider } from '@shared/lib/apiClient';

describe('apiClient interceptors', () => {
  beforeEach(() => {
    bindAccessTokenProvider(() => null);
    bindOrganizationIdProvider(() => null);
  });

  afterEach(() => {
    bindAccessTokenProvider(() => null);
    bindOrganizationIdProvider(() => null);
  });

  it('adiciona Authorization e X-Organization-Id fora de /auth/', async () => {
    bindAccessTokenProvider(() => 'access-token');
    bindOrganizationIdProvider(() => 'org-123');

    const seen = await new Promise<import('axios').InternalAxiosRequestConfig>((resolve) => {
      void apiClient.get('http://example.test/transactions', {
        adapter: (config) => {
          resolve(config);
          return Promise.resolve({
            data: {},
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
          });
        },
      });
    });

    expect(seen.headers.Authorization).toBe('Bearer access-token');
    expect(seen.headers['X-Organization-Id']).toBe('org-123');
  });

  it('envia só X-Organization-Id quando o token é nulo', async () => {
    bindAccessTokenProvider(() => null);
    bindOrganizationIdProvider(() => 'org-only');

    const seen = await new Promise<import('axios').InternalAxiosRequestConfig>((resolve) => {
      void apiClient.get('/transactions', {
        adapter: (config) => {
          resolve(config);
          return Promise.resolve({
            data: {},
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
          });
        },
      });
    });

    expect(seen.headers.Authorization).toBeUndefined();
    expect(seen.headers['X-Organization-Id']).toBe('org-only');
  });

  it('envia só Authorization quando a organização é nula', async () => {
    bindAccessTokenProvider(() => 'tok-only');
    bindOrganizationIdProvider(() => null);

    const seen = await new Promise<import('axios').InternalAxiosRequestConfig>((resolve) => {
      void apiClient.get('/transactions', {
        adapter: (config) => {
          resolve(config);
          return Promise.resolve({
            data: {},
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
          });
        },
      });
    });

    expect(seen.headers.Authorization).toBe('Bearer tok-only');
    expect(seen.headers['X-Organization-Id']).toBeUndefined();
  });

  it('não adiciona cabeçalhos em rotas /auth/', async () => {
    bindAccessTokenProvider(() => 'access-token');
    bindOrganizationIdProvider(() => 'org-123');

    const seen = await new Promise<import('axios').InternalAxiosRequestConfig>((resolve) => {
      void apiClient.get('/auth/login', {
        adapter: (config) => {
          resolve(config);
          return Promise.resolve({
            data: {},
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
          });
        },
      });
    });

    expect(seen.headers.Authorization).toBeUndefined();
    expect(seen.headers['X-Organization-Id']).toBeUndefined();
  });
});
