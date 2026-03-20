import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useAnalytics(enabled = true) {
  return useQuery({
    queryKey: ['analytics-dashboard'],
    queryFn: () =>
      api.analytics.get() as Promise<{
        dailyVolume: Array<{ day: string; count: number }>;
        avgResponseHours: number;
        topSenders: Array<{ email: string; name: string; count: number }>;
        categories: Array<{ name: string; count: number }>;
        weeklyComparison: { current: number; previous: number };
      }>,
    enabled,
  });
}
