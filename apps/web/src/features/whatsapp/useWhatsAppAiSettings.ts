import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@shared/lib/apiClient';

export const useWhatsAppAiSettings = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['whatsapp', 'settings', 'ai-provider'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ provider?: string }>('/whatsapp/settings/ai-provider');
      return data;
    },
  });

  const mutation = useMutation({
    mutationFn: async (provider: string) => {
      await apiClient.put('/whatsapp/settings/ai-provider', { provider });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['whatsapp', 'settings', 'ai-provider'] });
    },
  });

  return { query, mutation };
};
