import { useQuery } from '@tanstack/react-query';
import apiClient from '@shared/lib/apiClient';

export interface WhatsAppPublicConfig {
  sessionName: string;
  deviceName: string;
  reconnectIntervalMs: number;
  retryDelayMs: number;
  printQrInTerminal: boolean;
  authNamespace: string;
}

export const useWhatsAppConfig = () =>
  useQuery<WhatsAppPublicConfig>({
    queryKey: ['whatsapp', 'config'],
    queryFn: async () => {
      const { data } = await apiClient.get<WhatsAppPublicConfig>('/whatsapp/config');
      return data;
    },
    staleTime: 1000 * 60,
    retry: 1,
  });
