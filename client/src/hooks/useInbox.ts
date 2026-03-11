import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { api, getFailureCount } from '../lib/api';

export function useInbox(params: { accountId?: string; page?: number } = {}) {
  return useQuery({
    queryKey: ['inbox', params],
    queryFn: () => api.views.inbox(params),
    enabled: !!params.accountId,
  });
}

export function useInboxInfinite(params: { accountId?: string } = {}) {
  return useInfiniteQuery({
    queryKey: ['inbox-infinite', params.accountId],
    queryFn: ({ pageParam = 1 }) => api.views.inbox({ ...params, page: pageParam }),
    enabled: !!params.accountId,
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.page < lastPage.totalPages) {
        return lastPage.page + 1;
      }
      return undefined;
    },
  });
}

export function useUnreadCount(accountId?: string) {
  return useQuery({
    queryKey: ['unread-count', accountId],
    queryFn: () => api.dashboard.get(),
    enabled: !!accountId,
    select: (data) => data.unreadCount,
    refetchInterval: (query) => {
      if (query.state.status === 'error') {
        const failures = getFailureCount('/dashboard');
        return Math.min(60000 * Math.pow(2, Math.min(failures, 3)), 300000);
      }
      return 60000; // 60 seconds
    },
  });
}
