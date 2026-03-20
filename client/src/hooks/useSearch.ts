import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { AdvancedSearchFilters } from '../components/email/AdvancedSearch';

const MAX_QUERY_LENGTH = 500;
const HISTORY_KEY = 'zmail-search-history-v1';

export function buildOperatorQuery(filters: AdvancedSearchFilters): string {
  const parts: string[] = [];
  if (filters.from) parts.push(`from:${filters.from}`);
  if (filters.to) parts.push(`to:${filters.to}`);
  if (filters.subject) parts.push(`subject:${filters.subject}`);
  if (filters.after) parts.push(`after:${filters.after}`);
  if (filters.before) parts.push(`before:${filters.before}`);
  if (filters.hasAttachment) parts.push('has:attachment');
  if (filters.label) parts.push(`label:${filters.label}`);
  if (filters.isRead === 'read') parts.push('-is:unread');
  if (filters.isRead === 'unread') parts.push('is:unread');
  return parts.join(' ').trim();
}

export function pushSearchHistory(query: string): string[] {
  const q = query.trim();
  if (!q) return [];
  const prev = getSearchHistory().filter((item) => item !== q);
  const next = [q, ...prev].slice(0, 10);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  return next;
}

export function getSearchHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 10) : [];
  } catch {
    return [];
  }
}

export function useSearch(
  query: string,
  params?: { page?: number; limit?: number; accountId?: string; allAccounts?: boolean },
) {
  const normalizedQuery = query.trim().slice(0, MAX_QUERY_LENGTH);

  return useQuery({
    queryKey: ['search', normalizedQuery, params],
    queryFn: () => api.search.query(normalizedQuery, params),
    enabled: normalizedQuery.length >= 2,
  });
}
