import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { api } from '../lib/api';
import type { DeepAnalysisData } from '../types';

const QUERY_KEY = ['market', 'briefing'];
const DEEP_ANALYSIS_KEY = ['market', 'deep-analysis'];
const TREND_KEY = ['market', 'trend'];
const NEWS_KEY = ['market', 'news'];
const CRYPTO_KEY = ['market', 'crypto'];

export function useMarketAnalysis() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const resp = await api.market.briefing();
      return resp.data;
    },
    staleTime: 5 * 60 * 1000, // 5 perc
    refetchInterval: 5 * 60 * 1000,
    retry: 1,
  });

  const forceRefresh = useCallback(async () => {
    const resp = await api.market.briefing(true);
    queryClient.setQueryData(QUERY_KEY, resp.data);
  }, [queryClient]);

  return { ...query, forceRefresh };
}

export function useDeepAnalysis() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const resp = await api.market.deepAnalysis();
      return resp.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(DEEP_ANALYSIS_KEY, data);
    },
  });

  const cachedData = queryClient.getQueryData<DeepAnalysisData>(DEEP_ANALYSIS_KEY);

  return {
    data: mutation.data ?? cachedData ?? null,
    isLoading: mutation.isPending,
    error: mutation.error,
    trigger: mutation.mutate,
    reset: mutation.reset,
  };
}

export function useTrendData(days: number = 7) {
  return useQuery({
    queryKey: [...TREND_KEY, days],
    queryFn: async () => {
      const resp = await api.market.trend(days);
      return resp.data;
    },
    staleTime: 60 * 60 * 1000, // 1 óra
    retry: 1,
  });
}

export function useNewsData() {
  return useQuery({
    queryKey: NEWS_KEY,
    queryFn: async () => {
      const resp = await api.market.news();
      return resp.articles;
    },
    staleTime: 15 * 60 * 1000, // 15 perc
    refetchInterval: 15 * 60 * 1000,
    retry: 1,
  });
}

export function useCryptoData() {
  return useQuery({
    queryKey: CRYPTO_KEY,
    queryFn: async () => {
      const resp = await api.market.crypto();
      return resp.prices;
    },
    staleTime: 5 * 60 * 1000, // 5 perc
    refetchInterval: 5 * 60 * 1000,
    retry: 1,
  });
}
