import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useEmails(params: {
  accountId?: string;
  page?: number;
  limit?: number;
  sort?: string;
}) {
  return useQuery({
    queryKey: ['emails', params],
    queryFn: () => api.emails.list(params),
    enabled: !!params.accountId,
  });
}

export function useEmailsInfinite(params: {
  accountId?: string;
  limit?: number;
  sort?: string;
}) {
  return useInfiniteQuery({
    queryKey: ['emails-infinite', params.accountId, params.limit, params.sort],
    queryFn: ({ pageParam = 1 }) => api.emails.list({ ...params, page: pageParam }),
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

export function useEmailDetail(emailId: string | null, accountId?: string) {
  return useQuery({
    queryKey: ['email', emailId],
    queryFn: () => api.emails.get(emailId!, accountId),
    enabled: !!emailId,
  });
}

export interface EmailAttachment {
  filename: string;
  mimeType: string;
  content: string; // Base64
}

export function useSendEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      to: string;
      subject: string;
      body: string;
      cc?: string;
      attachments?: EmailAttachment[];
    }) => api.emails.send(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emails'] });
    },
  });
}

export function useReplyEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      to: string;
      subject?: string;
      body: string;
      cc?: string;
      inReplyTo?: string;
      threadId?: string;
      attachments?: EmailAttachment[];
    }) => api.emails.reply(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emails'] });
    },
  });
}

export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ emailId, isRead }: { emailId: string; isRead: boolean }) =>
      api.emails.markRead(emailId, isRead),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emails'] });
    },
  });
}

export function useToggleStar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ emailId, isStarred }: { emailId: string; isStarred: boolean }) =>
      api.emails.toggleStar(emailId, isStarred),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emails'] });
    },
  });
}

export function useDeleteEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (emailId: string) => api.emails.delete(emailId),
    onSuccess: () => {
      // MINDEN email listát frissítünk azonnal - beleértve az infinite query-ket is
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      queryClient.invalidateQueries({ queryKey: ['emails-infinite'] });
      queryClient.invalidateQueries({ queryKey: ['email'] });
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      queryClient.invalidateQueries({ queryKey: ['inbox-infinite'] }); // Infinite scroll inbox
      queryClient.invalidateQueries({ queryKey: ['unified-inbox'] });
      queryClient.invalidateQueries({ queryKey: ['unified-inbox-infinite'] }); // Infinite scroll unified
      queryClient.invalidateQueries({ queryKey: ['trash'] });
      queryClient.invalidateQueries({ queryKey: ['trash-infinite'] }); // Infinite scroll trash
      queryClient.invalidateQueries({ queryKey: ['views'] });
      queryClient.invalidateQueries({ queryKey: ['search'] });
    },
  });
}

export function useBatchDeleteEmails() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (emailIds: string[]) => api.emails.batchDelete(emailIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      queryClient.invalidateQueries({ queryKey: ['emails-infinite'] });
      queryClient.invalidateQueries({ queryKey: ['email'] });
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      queryClient.invalidateQueries({ queryKey: ['inbox-infinite'] });
      queryClient.invalidateQueries({ queryKey: ['unified-inbox'] });
      queryClient.invalidateQueries({ queryKey: ['unified-inbox-infinite'] });
      queryClient.invalidateQueries({ queryKey: ['trash'] });
      queryClient.invalidateQueries({ queryKey: ['trash-infinite'] });
      queryClient.invalidateQueries({ queryKey: ['views'] });
      queryClient.invalidateQueries({ queryKey: ['search'] });
    },
  });
}
