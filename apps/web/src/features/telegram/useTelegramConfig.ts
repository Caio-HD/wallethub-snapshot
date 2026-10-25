import { useQuery } from '@tanstack/react-query';
import apiClient from '@shared/lib/apiClient';

export interface TelegramPublicConfig {
  botUsername: string | null;
  webhookConfigured: boolean;
  webhookPathToken: string | null;
  webhookSecretConfigured: boolean;
}

export const useTelegramConfig = () =>
  useQuery<TelegramPublicConfig>({
    queryKey: ['telegram', 'config'],
    queryFn: async () => {
      const { data } = await apiClient.get<TelegramPublicConfig>('/telegram/config');
      return data;
    },
    staleTime: 1000 * 60,
    retry: 1,
  });
