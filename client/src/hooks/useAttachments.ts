import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface AttachmentFilterParams {
  type?: string;
  search?: string;
  sort?: 'date' | 'size' | 'name';
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export function useAttachments(params: AttachmentFilterParams = {}) {
  return useQuery({
    queryKey: ['attachments', params],
    queryFn: () => api.attachments.list(params),
  });
}
