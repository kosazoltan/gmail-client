import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useMarketAnalysis() {
  return useQuery({
    queryKey: ['market', 'briefing'],
    queryFn: async () => {
      const resp = await api.market.briefing();
      return resp.data;
    },
    staleTime: 25 * 60 * 1000, // 25 perc
    refetchInterval: 30 * 60 * 1000, // 30 perc
    retry: 1,
  });
}