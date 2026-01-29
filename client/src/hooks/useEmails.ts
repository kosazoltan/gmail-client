import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      queryClient.invalidateQueries({ queryKey: ['email'] });
      // Kategória és egyéb nézetek frissítése is
      queryClient.invalidateQueries({ queryKey: ['views'] });
      queryClient.invalidateQueries({ queryKey: ['search'] });
    },
  });
}
