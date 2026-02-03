import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useUnifiedInbox(params?: { page?: number; filterAccountId?: string }) {
  return useQuery({
    queryKey: ['unified-inbox', params?.page || 1, params?.filterAccountId || 'all'],
    queryFn: () => api.views.unified(params),
    staleTime: 30000,
  });
}
