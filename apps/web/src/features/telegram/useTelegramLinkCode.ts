import { useMutation } from '@tanstack/react-query';
import apiClient from '@shared/lib/apiClient';

export interface TelegramLinkCodeResponse {
  nonce: string;
  expiresAt: string;
  deepLink: string;
}

export const useTelegramLinkCode = () =>
  useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<TelegramLinkCodeResponse>('/telegram/link-code');
      return data;
    },
  });
