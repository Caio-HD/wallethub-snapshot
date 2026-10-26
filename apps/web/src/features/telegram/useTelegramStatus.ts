import { useQuery } from '@tanstack/react-query';
import apiClient from '@shared/lib/apiClient';

export interface QueueStatus {
  waiting: number;
  active: number;
}

export interface TelegramHealthResponse {
  inbound: QueueStatus;
  outbound: QueueStatus;
}

export const useTelegramStatus = () =>
  useQuery<TelegramHealthResponse>({
    queryKey: ['telegram', 'status'],
    queryFn: async () => {
      const { data } = await apiClient.get<TelegramHealthResponse>('/telegram/health');
      return data;
    },
    staleTime: 1000 * 30,
    retry: 1,
  });
