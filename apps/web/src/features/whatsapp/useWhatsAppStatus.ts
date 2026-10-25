import { useQuery } from '@tanstack/react-query';
import apiClient from '@shared/lib/apiClient';

export interface QueueStatus {
  waiting: number;
  active: number;
}

export interface WhatsAppHealthResponse {
  inbound: QueueStatus;
  outbound: QueueStatus;
  session?: {
    status: 'unknown' | 'qr' | 'connected' | 'disconnected';
    lastConnectedAt: string | null;
    lastQr: string | null;
  };
}

export const useWhatsAppStatus = () =>
  useQuery<WhatsAppHealthResponse>({
    queryKey: ['whatsapp', 'status'],
    queryFn: async () => {
      const { data } = await apiClient.get<WhatsAppHealthResponse>('/whatsapp/health');
      return data;
    },
    staleTime: 1000 * 30,
    retry: 1,
  });
