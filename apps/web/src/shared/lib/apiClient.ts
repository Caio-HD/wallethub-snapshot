import axios from 'axios';
import { resolveWalletHubApiBaseURL } from './walletHubApiBaseUrl';

export { resolveWalletHubApiBaseURL };

const apiClient = axios.create({
  baseURL: resolveWalletHubApiBaseURL(),
  timeout: 10000,
});

let accessTokenProvider: (() => string | null) | null = null;
let organizationIdProvider: (() => string | null) | null = null;

export const bindAccessTokenProvider = (provider: () => string | null) => {
  accessTokenProvider = provider;
};

export const bindOrganizationIdProvider = (provider: () => string | null) => {
  organizationIdProvider = provider;
};

apiClient.interceptors.request.use((config) => {
  if (accessTokenProvider) {
    const token = accessTokenProvider();
    if (token && !config.url?.startsWith('/auth/')) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  if (organizationIdProvider) {
    const organizationId = organizationIdProvider();
    if (organizationId && !config.url?.startsWith('/auth/')) {
      config.headers = config.headers ?? {};
      config.headers['X-Organization-Id'] = organizationId;
    }
  }
  return config;
});

export default apiClient;
