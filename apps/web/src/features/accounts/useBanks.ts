import { useQuery } from '@tanstack/react-query';
import apiClient from '@shared/lib/apiClient';

/** Forma canônica do COMPE para casar com o bankId já normalizado da conta. */
export const normCompe = (c: string): string =>
  c.replace(/\D/g, '').replace(/^0+/, '') || (c ? '0' : '');

export interface Bank {
  id: string;
  compeCode: string;
  ispb: string | null;
  name: string;
  shortName: string | null;
  isActive: boolean;
}

/**
 * Catálogo de bancos (COMPE) para o seletor de cadastro de conta.
 * Lista estável — cacheada por bastante tempo.
 */
export const useBanks = () => {
  const banksQuery = useQuery<Bank[]>({
    queryKey: ['banks'],
    staleTime: 1000 * 60 * 60, // 1h — catálogo muda raramente
    queryFn: async () => {
      const { data } = await apiClient.get<Bank[]>('/banks');
      return data;
    },
  });

  return { ...banksQuery, banks: banksQuery.data ?? [] };
};
