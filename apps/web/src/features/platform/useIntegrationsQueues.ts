import { useQuery } from '@tanstack/react-query';
import { fetchIntegrationsQueues } from '@features/platform/api';

export const useIntegrationsQueues = () =>
  useQuery({
    queryKey: ['platform', 'integrations', 'queues'],
    queryFn: fetchIntegrationsQueues,
    staleTime: 1000 * 30,
    retry: 1,
  });
