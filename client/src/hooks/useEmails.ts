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

export function useEmailsInfinite(params: { accountId?: string; limit?: number; sort?: string }) {
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
    queryKey: ['email', emailId, accountId],
    queryFn: () => api.emails.get(emailId!, accountId),
    enabled: !!emailId,
  });
}

export function useThreadConversation(emailId: string | null, accountId?: string) {
  return useQuery({
    queryKey: ['thread', emailId, accountId],
    queryFn: () => api.emails.getThread(emailId!, accountId),
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
      accountId?: string;
    }) => api.emails.send(data),
    onSuccess: () => {
      // Invalidate all email-related queries to show sent email in lists
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      queryClient.invalidateQueries({ queryKey: ['emails-infinite'] });
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      queryClient.invalidateQueries({ queryKey: ['inbox-infinite'] });
      queryClient.invalidateQueries({ queryKey: ['unified-inbox'] });
      queryClient.invalidateQueries({ queryKey: ['unified-inbox-infinite'] });
      queryClient.invalidateQueries({ queryKey: ['thread'] });
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
      accountId?: string;
    }) => api.emails.reply(data),
    onSuccess: () => {
      // Invalidate all email-related queries to show reply in thread
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      queryClient.invalidateQueries({ queryKey: ['emails-infinite'] });
      queryClient.invalidateQueries({ queryKey: ['email'] }); // Email detail for thread
      queryClient.invalidateQueries({ queryKey: ['thread'] }); // Thread conversation view
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      queryClient.invalidateQueries({ queryKey: ['inbox-infinite'] });
      queryClient.invalidateQueries({ queryKey: ['unified-inbox'] });
      queryClient.invalidateQueries({ queryKey: ['unified-inbox-infinite'] });
    },
  });
}

export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ emailId, isRead, accountId }: { emailId: string; isRead: boolean; accountId?: string }) =>
      api.emails.markRead(emailId, isRead, accountId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      queryClient.invalidateQueries({ queryKey: ['emails-infinite'] });
      queryClient.invalidateQueries({ queryKey: ['email'] });
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      queryClient.invalidateQueries({ queryKey: ['inbox-infinite'] });
      queryClient.invalidateQueries({ queryKey: ['unified-inbox'] });
      queryClient.invalidateQueries({ queryKey: ['unified-inbox-infinite'] });
      queryClient.invalidateQueries({ queryKey: ['thread'] });
    },
  });
}

export function useToggleStar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ emailId, isStarred, accountId }: { emailId: string; isStarred: boolean; accountId?: string }) =>
      api.emails.toggleStar(emailId, isStarred, accountId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      queryClient.invalidateQueries({ queryKey: ['emails-infinite'] });
      queryClient.invalidateQueries({ queryKey: ['email'] });
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      queryClient.invalidateQueries({ queryKey: ['inbox-infinite'] });
      queryClient.invalidateQueries({ queryKey: ['unified-inbox'] });
      queryClient.invalidateQueries({ queryKey: ['unified-inbox-infinite'] });
      queryClient.invalidateQueries({ queryKey: ['thread'] });
    },
  });
}

export function useDeleteEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ emailId, accountId }: { emailId: string; accountId?: string }) => api.emails.delete(emailId, accountId),
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
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['detected-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['detected-tasks', 'stats'] });
    },
  });
}

export function useBatchDeleteEmails() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ emailIds, accountId }: { emailIds: string[]; accountId?: string }) =>
      api.emails.batchDelete(emailIds, accountId),
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
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['detected-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['detected-tasks', 'stats'] });
    },
  });
}

export function useBatchMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ emailIds, isRead, accountId }: { emailIds: string[]; isRead: boolean; accountId?: string }) =>
      api.emails.batchMarkRead(emailIds, isRead, accountId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox-infinite'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
