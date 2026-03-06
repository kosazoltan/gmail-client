import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { api } from '../lib/api';

const QUERY_KEY = ['market', 'briefing'];

export function useMarketAnalysis() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const resp = await api.market.briefing();
      return resp.data;
    },
    staleTime: 25 * 60 * 1000, // 25 perc
    refetchInterval: 30 * 60 * 1000, // 30 perc
    retry: 1,
  });

  const forceRefresh = useCallback(async () => {
    const resp = await api.market.briefing(true);
    queryClient.setQueryData(QUERY_KEY, resp.data);
  }, [queryClient]);

  return { ...query, forceRefresh };
}