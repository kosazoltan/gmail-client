// Build trigger: env var update 2026-03-04
// Production: VITE_API_URL környezeti változóból, vagy /api
// Development: /api (proxied by Vite)
export const API_BASE = import.meta.env.VITE_API_URL || '/api';
const BASE_URL = API_BASE;

// H3: Typed TimeoutError — replaces fragile string-match on magyar message
class TimeoutError extends Error {
  constructor() {
    super('Request timed out');
    this.name = 'TimeoutError';
  }
}

class HttpStatusError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpStatusError';
    this.status = status;
  }
}

class ApiTemporarilyUnavailableError extends Error {
  retryAt: number;

  constructor(retryAt: number) {
    super('API temporarily unavailable');
    this.name = 'ApiTemporarilyUnavailableError';
    this.retryAt = retryAt;
  }
}

// Default request timeout (30 seconds)
const DEFAULT_TIMEOUT = 30000;

// Exponential backoff retry configuration
const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY = 1000; // 1s
const MAX_RETRY_DELAY = 30000; // 30s
const OUTAGE_COOLDOWN_MS = 15000;
const HEALTH_PROBE_TIMEOUT = 8000;

/** Track consecutive failures per endpoint prefix for adaptive polling */
const _failureCounters = new Map<string, number>();

type ApiDegradationReason = 'upstream' | 'network';

export interface ApiDegradationState {
  isDegraded: boolean;
  retryAt: number | null;
  reason: ApiDegradationReason | null;
  message: string | null;
}

const _apiDegradationListeners = new Set<(state: ApiDegradationState) => void>();
let _apiDegradationState: ApiDegradationState = {
  isDegraded: false,
  retryAt: null,
  reason: null,
  message: null,
};

function emitApiDegradationState(): void {
  const snapshot = { ..._apiDegradationState };
  _apiDegradationListeners.forEach((listener) => listener(snapshot));
}

function setApiDegraded(reason: ApiDegradationReason, message: string): void {
  const nextRetryAt = Date.now() + OUTAGE_COOLDOWN_MS;
  _apiDegradationState = {
    isDegraded: true,
    retryAt: Math.max(_apiDegradationState.retryAt ?? 0, nextRetryAt),
    reason,
    message,
  };
  emitApiDegradationState();
}

function clearApiDegraded(): void {
  if (!_apiDegradationState.isDegraded) return;
  _apiDegradationState = {
    isDegraded: false,
    retryAt: null,
    reason: null,
    message: null,
  };
  emitApiDegradationState();
}

function shouldShortCircuitRequest(endpointPrefix: string): boolean {
  if (!_apiDegradationState.isDegraded || !_apiDegradationState.retryAt) return false;
  if (Date.now() >= _apiDegradationState.retryAt) return false;
  // A recovery probe endpointet engedjük.
  return endpointPrefix !== '/health';
}

function isBrowserOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
}

function isApiOutageSignal(err: unknown): boolean {
  if (err instanceof HttpStatusError) return err.status >= 502;
  if (err instanceof TimeoutError) return true;
  if (err instanceof TypeError) return true;
  if (err instanceof Error) {
    return err.message === 'Failed to fetch' || err.message.includes('NetworkError');
  }
  return false;
}

function outageReasonFromError(err: unknown): ApiDegradationReason {
  return err instanceof HttpStatusError ? 'upstream' : 'network';
}

function outageMessageFromError(err: unknown): string {
  if (err instanceof HttpStatusError) return `HTTP ${err.status}`;
  if (err instanceof TimeoutError) return 'Request timeout';
  if (err instanceof Error) return err.message;
  return 'Network failure';
}

export function getApiDegradationState(): ApiDegradationState {
  return { ..._apiDegradationState };
}

export function subscribeApiDegradation(
  listener: (state: ApiDegradationState) => void,
): () => void {
  _apiDegradationListeners.add(listener);
  listener({ ..._apiDegradationState });
  return () => {
    _apiDegradationListeners.delete(listener);
  };
}

export async function probeApiRecovery(): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HEALTH_PROBE_TIMEOUT);
  try {
    const response = await fetch(`${BASE_URL}/health`, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      signal: controller.signal,
    });
    if (response.ok) {
      clearApiDegraded();
      return true;
    }
    if (response.status >= 502 && isBrowserOnline()) {
      setApiDegraded('upstream', `HTTP ${response.status}`);
    }
    return false;
  } catch (err) {
    const normalizedError =
      err instanceof Error && err.name === 'AbortError' ? new TimeoutError() : err;
    if (isApiOutageSignal(normalizedError) && isBrowserOnline()) {
      setApiDegraded(
        outageReasonFromError(normalizedError),
        outageMessageFromError(normalizedError),
      );
    }
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function getFailureCount(endpointPrefix: string): number {
  return _failureCounters.get(endpointPrefix) ?? 0;
}

export function resetFailureCount(endpointPrefix: string): void {
  _failureCounters.delete(endpointPrefix);
}

/** Check if an error is retryable (network/server errors, not client errors) */
function isRetryableError(err: unknown): boolean {
  if (err instanceof ApiTemporarilyUnavailableError) return false;
  if (err instanceof TypeError) return true; // Network error (fetch failed)
  if (err instanceof TimeoutError) return true;
  if (err instanceof HttpStatusError) return err.status >= 500 || err.status === 0;
  if (err instanceof Error) {
    // HTTP 5xx or 0 (network) are retryable; 4xx are not
    const httpMatch = err.message.match(/HTTP (\d+)/);
    if (httpMatch) {
      const status = parseInt(httpMatch[1], 10);
      return status >= 500 || status === 0;
    }
    // CORS errors and network failures
    if (err.message === 'Failed to fetch' || err.message.includes('NetworkError')) return true;
  }
  return false;
}

async function request<T>(
  url: string,
  options?: RequestInit & { timeout?: number; retries?: number },
): Promise<T> {
  const { timeout = DEFAULT_TIMEOUT, retries = MAX_RETRIES, ...fetchOptions } = options || {};
  const endpointPrefix = url.split('?')[0];

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (shouldShortCircuitRequest(endpointPrefix)) {
      throw new ApiTemporarilyUnavailableError(_apiDegradationState.retryAt ?? Date.now());
    }

    // Wait before retry (not on first attempt)
    if (attempt > 0) {
      const delay = Math.min(INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1), MAX_RETRY_DELAY);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${BASE_URL}${url}`, {
        ...fetchOptions,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...fetchOptions?.headers,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Hálózati hiba' }));
        throw new HttpStatusError(response.status, error.error || `HTTP ${response.status}`);
      }

      // Success — reset failure counter
      _failureCounters.delete(endpointPrefix);
      clearApiDegraded();
      return response.json();
    } catch (err) {
      lastError = err;

      if (err instanceof Error && err.name === 'AbortError') {
        lastError = new TimeoutError();
      }

      if (isApiOutageSignal(lastError) && isBrowserOnline()) {
        setApiDegraded(outageReasonFromError(lastError), outageMessageFromError(lastError));
        break;
      }

      // Only retry on retryable errors
      if (!isRetryableError(lastError) || attempt === retries) {
        break;
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Track failure for adaptive polling
  const currentFailures = _failureCounters.get(endpointPrefix) ?? 0;
  _failureCounters.set(endpointPrefix, currentFailures + 1);

  throw lastError;
}

/**
 * Fire a lightweight warm-up ping on app load.
 * Wakes up the Render cold-start without blocking the UI.
 */
export function warmUpBackend(): void {
  fetch(`${BASE_URL}/health`, { credentials: 'include', method: 'GET' }).catch(() => {
    // Silent — just warming up the server
  });
}

// Auth
export const api = {
  auth: {
    getLoginUrl: () => request<{ url: string }>('/auth/login'),
    getSession: () => request<import('../types').SessionInfo>('/auth/session'),
    logout: (accountId: string) =>
      request('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ accountId }),
      }),
    switchAccount: (accountId: string) =>
      request('/auth/switch-account', {
        method: 'POST',
        body: JSON.stringify({ accountId }),
      }),
  },

  accounts: {
    getAll: () => request<{ accounts: import('../types').Account[] }>('/accounts'),
    delete: (id: string) => request(`/accounts/${id}`, { method: 'DELETE' }),
    sync: (id: string, full = false) =>
      request(`/accounts/${id}/sync${full ? '?full=true' : ''}`, {
        method: 'POST',
      }),
    resync: (id: string) =>
      request<{ success: boolean; messagesProcessed: number; message: string }>(
        `/accounts/${id}/resync`,
        {
          method: 'POST',
        },
      ),
    updateColor: (id: string, color: string) =>
      request<{ success: boolean; color: string }>(`/accounts/${id}/color`, {
        method: 'PUT',
        body: JSON.stringify({ color }),
      }),
  },

  emails: {
    list: (params: { accountId?: string; page?: number; limit?: number; sort?: string } = {}) => {
      const query = new URLSearchParams();
      if (params.accountId) query.set('accountId', params.accountId);
      if (params.page) query.set('page', params.page.toString());
      if (params.limit) query.set('limit', params.limit.toString());
      if (params.sort) query.set('sort', params.sort);
      return request<import('../types').PaginatedEmails>(`/emails?${query}`);
    },
    get: (id: string, accountId?: string) => {
      const query = accountId ? `?accountId=${accountId}` : '';
      return request<import('../types').Email>(`/emails/${id}${query}`);
    },
    getThread: (emailId: string, accountId?: string) => {
      const query = accountId ? `?accountId=${accountId}` : '';
      return request<import('../types').ThreadConversation>(`/emails/${emailId}/thread${query}`);
    },
    send: (data: {
      to: string;
      subject: string;
      body: string;
      cc?: string;
      attachments?: Array<{ filename: string; mimeType: string; content: string }>;
      accountId?: string;
    }) =>
      request<{
        success: boolean;
        messageId?: string;
        scheduledId?: string;
        undoAvailable?: boolean;
        undoSeconds?: number;
      }>(
        `/emails/send${data.accountId ? `?accountId=${encodeURIComponent(data.accountId)}` : ''}`,
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
      ),
    reply: (data: {
      to: string;
      subject?: string;
      body: string;
      cc?: string;
      bcc?: string;
      inReplyTo?: string;
      threadId?: string;
      attachments?: Array<{ filename: string; mimeType: string; content: string }>;
      accountId?: string;
    }) =>
      request<{
        success: boolean;
        messageId?: string;
        scheduledId?: string;
        undoAvailable?: boolean;
        undoSeconds?: number;
      }>(
        `/emails/reply${data.accountId ? `?accountId=${encodeURIComponent(data.accountId)}` : ''}`,
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
      ),
    markRead: (id: string, isRead: boolean, accountId?: string) =>
      request(
        `/emails/${id}/read${accountId ? `?accountId=${encodeURIComponent(accountId)}` : ''}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ isRead }),
        },
      ),
    toggleStar: (id: string, isStarred: boolean, accountId?: string) =>
      request(
        `/emails/${id}/star${accountId ? `?accountId=${encodeURIComponent(accountId)}` : ''}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ isStarred }),
        },
      ),
    delete: (id: string, accountId?: string) =>
      request(
        `/emails/${id}/trash${accountId ? `?accountId=${encodeURIComponent(accountId)}` : ''}`,
        {
          method: 'POST',
          retries: 0,
        },
      ),
    batchDelete: (emailIds: string[], accountId?: string) =>
      request<{ deletedCount: number; failedCount: number }>(
        `/emails/batch-delete${accountId ? `?accountId=${encodeURIComponent(accountId)}` : ''}`,
        {
          method: 'POST',
          body: JSON.stringify({ emailIds }),
          timeout: 180000, // Nagy batch törlés Gmail oldalon lassabb lehet.
          retries: 0, // Írási műveletnél ne duplikáljunk retry-val.
        },
      ),
    batchMarkRead: (emailIds: string[], isRead: boolean, accountId?: string) =>
      request<{ updatedCount: number }>(
        '/emails/batch-read' + (accountId ? `?accountId=${encodeURIComponent(accountId)}` : ''),
        {
          method: 'PATCH',
          body: JSON.stringify({ emailIds, isRead }),
        },
      ),
  },

  views: {
    bySender: (params?: { page?: number; accountId?: string }) => {
      const query = new URLSearchParams();
      if (params?.page !== undefined) query.set('page', params.page.toString());
      if (params?.accountId) query.set('accountId', params.accountId);
      return request<{ senders: import('../types').SenderGroup[] }>(`/views/by-sender?${query}`);
    },
    bySenderEmails: (email: string, accountId?: string) => {
      const query = accountId ? `?accountId=${encodeURIComponent(accountId)}` : '';
      return request<{ emails: import('../types').Email[]; senderEmail: string }>(
        `/views/by-sender/${encodeURIComponent(email)}${query}`,
      );
    },
    byTopic: (params?: { page?: number }) => {
      const query = params?.page ? `?page=${params.page}` : '';
      return request<{ topics: import('../types').Topic[] }>(`/views/by-topic${query}`);
    },
    byTopicEmails: (topicId: string) =>
      request<{ emails: import('../types').Email[]; topic: import('../types').Topic }>(
        `/views/by-topic/${topicId}`,
      ),
    byTime: () => request<{ periods: import('../types').TimePeriod[] }>('/views/by-time'),
    byTimeEmails: (periodId: string, params?: { page?: number }) => {
      const query = params?.page ? `?page=${params.page}` : '';
      return request<{ emails: import('../types').Email[]; periodId: string }>(
        `/views/by-time/${periodId}${query}`,
      );
    },
    byCategory: () => request<{ categories: import('../types').Category[] }>('/views/by-category'),
    byCategoryEmails: (categoryId: string, params?: { page?: number }) => {
      const query = params?.page ? `?page=${params.page}` : '';
      return request<{ emails: import('../types').Email[]; category: import('../types').Category }>(
        `/views/by-category/${categoryId}${query}`,
      );
    },
    inbox: (params?: { page?: number; accountId?: string }) => {
      const query = new URLSearchParams();
      if (params?.page !== undefined) query.set('page', params.page.toString());
      if (params?.accountId) query.set('accountId', params.accountId);
      return request<import('../types').PaginatedEmails>(`/views/inbox?${query}`);
    },
    trash: (params?: { page?: number; accountId?: string }) => {
      const query = new URLSearchParams();
      if (params?.page !== undefined) query.set('page', params.page.toString());
      if (params?.accountId) query.set('accountId', params.accountId);
      return request<import('../types').PaginatedEmails>(`/views/trash?${query}`);
    },
    unified: (params?: { page?: number; filterAccountId?: string }) => {
      const query = new URLSearchParams();
      if (params?.page !== undefined) query.set('page', params.page.toString());
      if (params?.filterAccountId) query.set('filterAccountId', params.filterAccountId);
      return request<{
        emails: import('../types').Email[];
        total: number;
        page: number;
        totalPages: number;
        accounts: Array<{
          accountId: string;
          email: string;
          color: string;
          count: number;
        }>;
      }>(`/views/unified?${query}`);
    },
  },

  categories: {
    list: () => request<{ categories: import('../types').Category[] }>('/categories'),
    create: (data: {
      name: string;
      color?: string;
      icon?: string;
      description?: string;
      sort_order?: number;
    }) =>
      request<import('../types').Category>('/categories', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (
      id: string,
      data: {
        name?: string;
        color?: string;
        icon?: string;
        description?: string;
        sort_order?: number;
      },
    ) => request(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request(`/categories/${id}`, { method: 'DELETE' }),
    addEmail: (categoryId: string, emailId: string) =>
      request<{ success: boolean }>(`/categories/${categoryId}/add-email`, {
        method: 'POST',
        body: JSON.stringify({ emailId }),
      }),
    removeEmail: (categoryId: string, emailId: string) =>
      request<{ success: boolean }>(`/categories/${categoryId}/remove-email`, {
        method: 'POST',
        body: JSON.stringify({ emailId }),
      }),
    getEmails: (categoryId: string, page = 1) =>
      request<{
        emails: import('../types').Email[];
        total: number;
        page: number;
        totalPages: number;
        category: import('../types').Category;
      }>(`/categories/${categoryId}/emails?page=${page}`),
    getCategoriesForEmail: (emailId: string) =>
      request<{ categories: import('../types').Category[] }>(`/categories/for-email/${emailId}`),
    getRules: () =>
      request<{ rules: import('../types').CategorizationRule[] }>('/categories/rules'),
    createRule: (data: { categoryId: string; type: string; value: string; priority?: number }) =>
      request('/categories/rules', { method: 'POST', body: JSON.stringify(data) }),
    deleteRule: (id: string) => request(`/categories/rules/${id}`, { method: 'DELETE' }),
    recategorize: () => request('/categories/recategorize', { method: 'POST' }),
  },

  search: {
    query: (
      q: string,
      params?: { page?: number; limit?: number; accountId?: string; allAccounts?: boolean },
    ) => {
      const query = new URLSearchParams({ q });
      if (params?.page !== undefined) query.set('page', params.page.toString());
      if (params?.limit !== undefined) query.set('limit', params.limit.toString());
      if (params?.accountId) query.set('accountId', params.accountId);
      if (params?.allAccounts) query.set('allAccounts', 'true');
      return request<import('../types').PaginatedEmails>(`/search?${query}`);
    },
  },

  attachments: {
    downloadUrl: (id: string) => `${BASE_URL}/attachments/${id}/download`,
    list: (
      params: {
        type?: string;
        search?: string;
        sort?: 'date' | 'size' | 'name';
        order?: 'asc' | 'desc';
        page?: number;
        limit?: number;
      } = {},
    ) => {
      const query = new URLSearchParams();
      if (params.type) query.set('type', params.type);
      if (params.search) query.set('search', params.search);
      if (params.sort) query.set('sort', params.sort);
      if (params.order) query.set('order', params.order);
      if (params.page) query.set('page', params.page.toString());
      if (params.limit) query.set('limit', params.limit.toString());
      return request<import('../types').AttachmentListResult>(`/attachments?${query}`);
    },
    analyze: (id: string) =>
      request<import('../types').AttachmentAnalysis>(`/attachments/${id}/analyze`, {
        method: 'POST',
        timeout: 60000, // 60s — AI elemzés lassabb lehet
      }),
  },

  contacts: {
    list: (query = '', limit = 20) =>
      request<import('../types').Contact[]>(
        `/contacts?q=${encodeURIComponent(query)}&limit=${limit}`,
      ),
    frequent: (limit = 20) =>
      request<import('../types').Contact[]>(`/contacts/frequent?limit=${limit}`),
    search: (query: string, limit = 10) =>
      request<import('../types').Contact[]>(
        `/contacts?q=${encodeURIComponent(query)}&limit=${limit}`,
      ),
    add: (email: string, name?: string) =>
      request<import('../types').Contact>('/contacts', {
        method: 'POST',
        body: JSON.stringify({ email, name }),
      }),
    delete: (id: string) => request(`/contacts/${id}`, { method: 'DELETE' }),
    harvest: () =>
      request<{ success: boolean; processed: number }>('/contacts/harvest', { method: 'POST' }),
    update: (id: string, name: string) =>
      request(`/contacts/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
    extract: () => request<{ extractedCount: number }>('/contacts/harvest', { method: 'POST' }),
    fixEncoding: () =>
      request<{
        success: boolean;
        fixed: { contacts: number; senderGroups: number; emails: number };
        message: string;
      }>('/contacts/fix-encoding', { method: 'POST' }),
  },

  savedSearches: {
    list: () => request<{ searches: import('../types').SavedSearch[] }>('/searches'),
    create: (data: { name: string; query: string; icon?: string; color?: string }) =>
      request<import('../types').SavedSearch>('/searches', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: { name?: string; query?: string; icon?: string; color?: string }) =>
      request<import('../types').SavedSearch>(`/searches/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) => request<{ success: boolean }>(`/searches/${id}`, { method: 'DELETE' }),
    use: (id: string) => request<{ success: boolean }>(`/searches/${id}/use`, { method: 'POST' }),
  },

  templates: {
    list: () => request<{ templates: import('../types').Template[] }>('/templates'),
    create: (data: { name: string; body: string; subject?: string; shortcut?: string }) =>
      request<import('../types').Template>('/templates', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (
      id: string,
      data: { name?: string; body?: string; subject?: string; shortcut?: string },
    ) =>
      request<import('../types').Template>(`/templates/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) => request<{ success: boolean }>(`/templates/${id}`, { method: 'DELETE' }),
    use: (id: string) => request<{ success: boolean }>(`/templates/${id}/use`, { method: 'POST' }),
  },

  snooze: {
    list: () =>
      request<{
        snoozed: Array<{
          id: string;
          emailId: string;
          snoozeUntil: number;
          createdAt: number;
          emailSubject: string | null;
          emailFrom: string | null;
          emailFromName: string | null;
        }>;
      }>('/snooze'),
    create: (emailId: string, snoozeUntil: number) =>
      request<{ id: string; emailId: string; snoozeUntil: number }>('/snooze', {
        method: 'POST',
        body: JSON.stringify({ emailId, snoozeUntil }),
      }),
    delete: (emailId: string) =>
      request<{ success: boolean }>(`/snooze/${emailId}`, { method: 'DELETE' }),
  },

  reminders: {
    list: (includeCompleted = false) =>
      request<{ reminders: import('../types').Reminder[] }>(
        `/reminders?includeCompleted=${includeCompleted}`,
      ),
    due: () => request<{ reminders: import('../types').Reminder[] }>('/reminders/due'),
    count: () => request<{ count: number }>('/reminders/count'),
    create: (data: { emailId: string; remindAt: number; note?: string }) =>
      request<{ reminder: import('../types').Reminder }>('/reminders', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: { remindAt?: number; note?: string; isCompleted?: boolean }) =>
      request<{ reminder: import('../types').Reminder }>(`/reminders/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    delete: (id: string) => request<{ success: boolean }>(`/reminders/${id}`, { method: 'DELETE' }),
    complete: (id: string) =>
      request<{ reminder: import('../types').Reminder }>(`/reminders/${id}/complete`, {
        method: 'POST',
      }),
  },

  database: {
    getStats: () => request<import('../types').DatabaseStats>('/database/stats'),
    listEmails: (
      params: {
        page?: number;
        limit?: number;
        sortBy?: 'date' | 'from' | 'subject' | 'size';
        sortOrder?: 'asc' | 'desc';
        search?: string;
        dateFrom?: number;
        dateTo?: number;
        hasAttachments?: boolean;
        isRead?: boolean;
      } = {},
    ) => {
      const query = new URLSearchParams();
      if (params.page) query.set('page', params.page.toString());
      if (params.limit) query.set('limit', params.limit.toString());
      if (params.sortBy) query.set('sortBy', params.sortBy);
      if (params.sortOrder) query.set('sortOrder', params.sortOrder);
      if (params.search) query.set('search', params.search);
      if (params.dateFrom) query.set('dateFrom', params.dateFrom.toString());
      if (params.dateTo) query.set('dateTo', params.dateTo.toString());
      if (params.hasAttachments !== undefined)
        query.set('hasAttachments', params.hasAttachments.toString());
      if (params.isRead !== undefined) query.set('isRead', params.isRead.toString());
      return request<{
        emails: import('../types').DatabaseEmail[];
        total: number;
        page: number;
        totalPages: number;
      }>(`/database/emails?${query}`);
    },
    deleteEmails: (emailIds: string[]) =>
      request<{ deletedCount: number }>('/database/emails', {
        method: 'DELETE',
        body: JSON.stringify({ emailIds }),
      }),
    deleteByDateRange: (dateFrom: number, dateTo: number) =>
      request<{ deletedCount: number }>('/database/emails/by-date', {
        method: 'DELETE',
        body: JSON.stringify({ dateFrom, dateTo }),
      }),
    deleteOldEmails: (olderThanDays: number) =>
      request<{ deletedCount: number }>('/database/emails/old', {
        method: 'DELETE',
        body: JSON.stringify({ olderThanDays }),
      }),
    createBackup: () =>
      request<{ filename: string; path: string; size: number }>('/database/backup', {
        method: 'POST',
      }),
    listBackups: () => request<{ backups: import('../types').Backup[] }>('/database/backups'),
    downloadBackupUrl: (filename: string) =>
      `${BASE_URL}/database/backups/${encodeURIComponent(filename)}`,
    deleteBackup: (filename: string) =>
      request(`/database/backups/${encodeURIComponent(filename)}`, { method: 'DELETE' }),
    vacuum: () => request('/database/vacuum', { method: 'POST' }),
    cleanup: () => request('/database/cleanup', { method: 'POST' }),
  },

  labels: {
    list: () => request<{ labels: import('../types').GmailLabel[] }>('/labels'),
    create: (data: { name: string; backgroundColor?: string; textColor?: string }) =>
      request<{ label: { id: string; name: string } }>('/labels', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    delete: (labelId: string) =>
      request<{ success: boolean }>(`/labels/${labelId}`, { method: 'DELETE' }),
    addToEmail: (emailId: string, labelIds: string[]) =>
      request<{ success: boolean }>(`/labels/email/${emailId}/add`, {
        method: 'POST',
        body: JSON.stringify({ labelIds }),
      }),
    removeFromEmail: (emailId: string, labelIds: string[]) =>
      request<{ success: boolean }>(`/labels/email/${emailId}/remove`, {
        method: 'POST',
        body: JSON.stringify({ labelIds }),
      }),
    moveEmail: (emailId: string, addLabelIds: string[], removeLabelIds: string[]) =>
      request<{ success: boolean }>(`/labels/email/${emailId}/move`, {
        method: 'POST',
        body: JSON.stringify({ addLabelIds, removeLabelIds }),
      }),
  },

  newsletters: {
    getSenders: () =>
      request<{ senders: import('../types').NewsletterSender[] }>('/newsletters/senders'),
    sync: () =>
      request<{ success: boolean; detectedCount: number; message: string }>('/newsletters/sync', {
        method: 'POST',
      }),
    muteSender: (id: string, muted: boolean) =>
      request<{ success: boolean; muted: boolean }>(`/newsletters/senders/${id}/mute`, {
        method: 'PATCH',
        body: JSON.stringify({ muted }),
      }),
    removeSender: (id: string) =>
      request<{ success: boolean }>(`/newsletters/senders/${id}`, { method: 'DELETE' }),
    getEmails: (
      params: {
        page?: number;
        limit?: number;
        senderId?: string;
        includeMuted?: boolean;
      } = {},
    ) => {
      const query = new URLSearchParams();
      if (params.page) query.set('page', params.page.toString());
      if (params.limit) query.set('limit', params.limit.toString());
      if (params.senderId) query.set('senderId', params.senderId);
      if (params.includeMuted) query.set('includeMuted', 'true');
      return request<import('../types').NewsletterEmailsResult>(`/newsletters/emails?${query}`);
    },
    getStats: () => request<import('../types').NewsletterStats>('/newsletters/stats'),
  },

  push: {
    getVapidKey: () => request<{ publicKey: string }>('/push/vapid-public-key'),
    subscribe: (subscription: PushSubscriptionJSON) =>
      request<{ success: boolean; message: string }>('/push/subscribe', {
        method: 'POST',
        body: JSON.stringify({ subscription }),
      }),
    unsubscribe: (endpoint: string) =>
      request<{ success: boolean; message: string }>('/push/unsubscribe', {
        method: 'POST',
        body: JSON.stringify({ endpoint }),
      }),
    test: () =>
      request<{ success: boolean; sent: number; failed: number }>('/push/test', {
        method: 'POST',
      }),
  },

  pinned: {
    list: () => request<{ pinnedEmailIds: string[] }>('/pinned'),
    pin: (emailId: string) =>
      request<{ success: boolean; pinnedAt?: number }>(`/pinned/${emailId}`, {
        method: 'POST',
      }),
    unpin: (emailId: string) =>
      request<{ success: boolean }>(`/pinned/${emailId}`, {
        method: 'DELETE',
      }),
    toggle: (emailId: string) =>
      request<{ isPinned: boolean; pinnedAt?: number }>(`/pinned/${emailId}/toggle`, {
        method: 'POST',
      }),
  },

  settings: {
    getAll: () => request<{ settings: Record<string, unknown> }>('/settings'),
    get: (key: string) => request<{ value: unknown }>(`/settings/${key}`),
    set: (key: string, value: unknown) =>
      request<{ success: boolean; key: string; value: unknown }>(`/settings/${key}`, {
        method: 'PUT',
        body: JSON.stringify({ value }),
      }),
    delete: (key: string) =>
      request<{ success: boolean }>(`/settings/${key}`, { method: 'DELETE' }),
  },

  quota: {
    get: () => request<{ quota: { calls: number; limit: number; percent: number } }>('/quota'),
  },

  inboxRules: {
    list: () => request<{ rules: Array<Record<string, unknown>> }>('/inbox-rules'),
    create: (data: Record<string, unknown>) =>
      request<{ rule: Record<string, unknown> }>('/inbox-rules', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Record<string, unknown>) =>
      request<{ rule: Record<string, unknown> }>(`/inbox-rules/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<{ success: boolean }>(`/inbox-rules/${id}`, { method: 'DELETE' }),
  },

  scheduled: {
    list: () =>
      request<{
        scheduledEmails: Array<{
          id: string;
          to: string;
          cc: string | null;
          subject: string | null;
          body: string | null;
          scheduledAt: number;
          status: string;
          createdAt: number;
        }>;
      }>('/scheduled'),
    create: (data: {
      to: string;
      cc?: string;
      subject?: string;
      body?: string;
      scheduledAt: number;
    }) =>
      request<{
        id: string;
        to: string;
        cc: string | null;
        bcc: string | null;
        subject: string | null;
        body: string | null;
        scheduledAt: number;
        status: string;
        createdAt: number;
      }>('/scheduled', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (
      id: string,
      data: {
        to?: string;
        cc?: string;
        subject?: string;
        body?: string;
        scheduledAt?: number;
      },
    ) =>
      request<{ success: boolean }>(`/scheduled/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) => request<{ success: boolean }>(`/scheduled/${id}`, { method: 'DELETE' }),
    sendNow: (id: string) =>
      request<{ success: boolean }>(`/scheduled/${id}/send-now`, { method: 'POST' }),
  },

  vip: {
    list: () =>
      request<{
        vipSenders: Array<{
          id: string;
          email: string;
          name: string | null;
          createdAt: number;
        }>;
      }>('/vip'),
    emails: () => request<{ emails: string[] }>('/vip/emails'),
    suggest: () =>
      request<{
        suggestions: Array<{ email: string; name: string | null; reason: string }>;
      }>('/vip/suggest'),
    applySuggestions: (items: Array<{ email: string; name?: string | null }>) =>
      request<{ added: number; items: Array<{ id: string; email: string; name: string | null }> }>(
        '/vip/apply-suggestions',
        { method: 'POST', body: JSON.stringify({ items }) },
      ),
    add: (email: string, name?: string) =>
      request<{
        id: string;
        email: string;
        name: string | null;
        createdAt: number;
      }>('/vip', {
        method: 'POST',
        body: JSON.stringify({ email, name }),
      }),
    update: (id: string, name: string) =>
      request<{ success: boolean }>(`/vip/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name }),
      }),
    delete: (id: string) => request<{ success: boolean }>(`/vip/${id}`, { method: 'DELETE' }),
    toggle: (email: string, name?: string) =>
      request<{ isVip: boolean; id?: string }>('/vip/toggle', {
        method: 'POST',
        body: JSON.stringify({ email, name }),
      }),
  },

  calendar: {
    today: () => request<{ events: import('../types').CalendarEvent[] }>('/calendar/today'),
    week: () =>
      request<{
        events: import('../types').CalendarEvent[];
        weekStart: string;
        weekEnd: string;
      }>('/calendar/week'),
    events: (params?: { timeMin?: string; timeMax?: string }) => {
      const query = new URLSearchParams();
      if (params?.timeMin) query.set('timeMin', params.timeMin);
      if (params?.timeMax) query.set('timeMax', params.timeMax);
      const qs = query.toString();
      return request<{ events: import('../types').CalendarEvent[] }>(
        `/calendar/events${qs ? `?${qs}` : ''}`,
      );
    },
    create: (data: {
      summary: string;
      description?: string;
      location?: string;
      start: string;
      end?: string;
      isAllDay: boolean;
    }) =>
      request<{ event: import('../types').CalendarEvent }>('/calendar', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (
      id: string,
      data: {
        summary: string;
        description?: string;
        location?: string;
        start: string;
        end?: string;
        isAllDay: boolean;
      },
    ) =>
      request<{ event: import('../types').CalendarEvent }>(`/calendar/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) => request<{ success: boolean }>(`/calendar/${id}`, { method: 'DELETE' }),
    suggestions: () => request<{ events: Array<Record<string, unknown>> }>('/calendar/suggestions'),
    suggestionsFromEmail: (emailId: string) =>
      request<{ events: Array<Record<string, unknown>> }>(
        `/calendar/suggestions/from-email/${emailId}`,
        {
          method: 'POST',
        },
      ),
    syncSuggestion: (id: string) =>
      request<{ event: Record<string, unknown> | null }>(`/calendar/suggestions/${id}/sync`, {
        method: 'POST',
      }),
  },

  tasks: {
    lists: () => request<{ lists: import('../types').TaskList[] }>('/tasks/lists'),
    listTasks: (listId: string, showCompleted = true) =>
      request<{ tasks: import('../types').GoogleTask[] }>(
        `/tasks/list/${listId}?showCompleted=${showCompleted}`,
      ),
    updateTask: (
      listId: string,
      taskId: string,
      data: { status?: string; title?: string; notes?: string; due?: string },
    ) =>
      request<{ task: import('../types').GoogleTask }>(`/tasks/list/${listId}/task/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    createTask: (listId: string, data: { title: string; notes?: string; due?: string }) =>
      request<{ task: import('../types').GoogleTask }>(`/tasks/list/${listId}`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    deleteTask: (listId: string, taskId: string) =>
      request<{ success: boolean }>(`/tasks/list/${listId}/task/${taskId}`, {
        method: 'DELETE',
      }),
  },

  dashboard: {
    get: () => request<import('../types').DashboardData>('/dashboard'),
    feed: () => request<import('../types').DashboardFeed>('/dashboard/feed'),
  },

  market: {
    briefing: (refresh?: boolean) =>
      request<import('../types').MarketBriefingResponse>(
        `/market/briefing${refresh ? '?refresh=true' : ''}`,
        {
          timeout: 120000, // 120s — AI + RSS fetch can take 60-90s on cold start
          retries: 1, // Only 1 retry — avoid 503 loop while server generates
        },
      ),
    deepAnalysis: (refresh?: boolean) =>
      request<import('../types').DeepAnalysisResponse>(
        `/market/deep-analysis${refresh ? '?refresh=true' : ''}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          timeout: 120000, // 120s — align with server-side AI timeout and fallback reuse
        },
      ),
    trend: (days: number = 7) =>
      request<import('../types').TrendResponse>(`/market/trend?days=${days}`),
    news: () => request<import('../types').NewsResponse>('/market/news'),
    crypto: () => request<import('../types').CryptoResponse>('/market/crypto'),
  },

  intelligence: {
    extractActionItems: (emailId: string) =>
      request<{ success: boolean; actionItems: import('../types').ActionItem[] }>(
        `/intelligence/action-items/${emailId}`,
        { method: 'POST', timeout: 60000 },
      ),
    getActionItems: (emailId: string) =>
      request<{ success: boolean; actionItems: import('../types').ActionItem[] }>(
        `/intelligence/action-items/${emailId}`,
      ),
    toggleActionItem: (id: string, isDone: boolean) =>
      request<{ success: boolean }>(`/intelligence/action-items/${id}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify({ isDone }),
      }),
    detectSentiment: (emailId: string) =>
      request<import('../types').SentimentResult>(`/intelligence/sentiment/${emailId}`, {
        method: 'POST',
        timeout: 60000,
      }),
    suggestReply: (emailId: string) =>
      request<{ success: boolean; suggestions: import('../types').ReplySuggestion[] }>(
        `/intelligence/suggest-reply/${emailId}`,
        { method: 'POST', timeout: 60000 },
      ),
    findRelated: (emailId: string) =>
      request<{ success: boolean; relatedEmails: import('../types').RelatedEmail[] }>(
        `/intelligence/related/${emailId}`,
      ),
    bulkAnalyze: (emailIds: string[]) =>
      request<{
        success: boolean;
        results: Array<{
          emailId: string;
          actionItems: import('../types').ActionItem[];
          sentiment: import('../types').SentimentResult;
        }>;
      }>('/intelligence/bulk-analyze', {
        method: 'POST',
        body: JSON.stringify({ emailIds }),
        timeout: 120000,
      }),
    weeklyReport: () =>
      request<{ success: boolean; report: import('../types').WeeklyReportData }>(
        '/intelligence/weekly-report',
        { timeout: 60000 },
      ),
  },

  smartFolders: {
    list: () =>
      request<{ success: boolean; folders: import('../types').SmartFolder[] }>('/smart-folders'),
    getEmails: (folderId: string, page = 1) =>
      request<{
        success: boolean;
        emails: import('../types').Email[];
        total: number;
        page: number;
        totalPages: number;
      }>(`/smart-folders/${folderId}/emails?page=${page}`),
    create: (data: { name: string; rules: import('../types').SmartFolderRule[]; icon?: string }) =>
      request<{ success: boolean; folder: import('../types').SmartFolder }>('/smart-folders', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (
      id: string,
      data: {
        name?: string;
        icon?: string;
        rules?: import('../types').SmartFolderRule[];
        sortOrder?: number;
      },
    ) =>
      request<{ success: boolean; folder: import('../types').SmartFolder }>(
        `/smart-folders/${id}`,
        { method: 'PUT', body: JSON.stringify(data) },
      ),
    delete: (id: string) =>
      request<{ success: boolean }>(`/smart-folders/${id}`, { method: 'DELETE' }),
    generate: (description: string) =>
      request<{
        success: boolean;
        folder: {
          name: string;
          icon?: string;
          description: string;
          rules: import('../types').SmartFolderRule[];
        };
        method: 'ai' | 'fallback';
      }>('/smart-folders/generate', {
        method: 'POST',
        body: JSON.stringify({ description }),
      }),
    classify: (limit?: number) =>
      request<{ success: boolean; classified: number; unclassified: number }>(
        '/smart-folders/classify',
        {
          method: 'POST',
          body: JSON.stringify({ limit: limit ?? 50 }),
        },
      ),
    classifyStatus: () => request<{ unclassified: number }>('/smart-folders/classify/status'),
  },

  // Smart Features
  smart: {
    getDailyBrief: () => request<import('../types').DailyBriefData>('/smart/daily-brief'),
    getPriorities: () =>
      request<{ priorities: import('../types').PriorityEmail[] }>('/smart/priorities'),
    getFollowUps: () => request<{ followups: import('../types').FollowUp[] }>('/smart/followups'),
    getAnalytics: (period: string) =>
      request<import('../types').AnalyticsData>(`/smart/analytics?period=${period}`),
  },

  analytics: {
    get: () => request('/analytics'),
  },

  // Workflows
  workflows: {
    list: () => request<{ workflows: import('../types').WorkflowData[] }>('/workflows'),
    generate: (prompt: string) =>
      request<{
        workflow: import('../types').WorkflowData;
        warnings: string[];
        source: 'ai' | 'fallback';
      }>('/workflows/generate', {
        method: 'POST',
        body: JSON.stringify({ prompt }),
      }),
    create: (data: Partial<import('../types').WorkflowData>) =>
      request<{ workflow: import('../types').WorkflowData }>('/workflows', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<import('../types').WorkflowData>) =>
      request<{ workflow: import('../types').WorkflowData }>(`/workflows/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) => request<void>(`/workflows/${id}`, { method: 'DELETE' }),
    run: (id: string, emailId?: string, sourceEmailIds?: string[]) =>
      request<void>(`/workflows/${id}/run`, {
        method: 'POST',
        body: JSON.stringify({ triggerEmailId: emailId, sourceEmailIds }),
      }),
    runs: (id: string) =>
      request<{ runs: import('../types').RunLogEntry[] }>(`/workflows/${id}/runs`),
  },

  // AI
  ai: {
    chat: (message: string, conversationId?: string, emailId?: string) =>
      request<import('../types').AiAgentResponse>('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ message, conversationId, emailId }),
      }),
    confirmAction: (
      pendingAction: import('../types').PendingAgentAction,
      conversationId?: string,
    ) =>
      request<{ reply: string; result?: import('../types').AgentExecutionResult | null }>(
        '/ai/confirm-action',
        {
          method: 'POST',
          body: JSON.stringify({ pendingAction, conversationId }),
        },
      ),
    smartSearch: (query: string, suggestionsOnly?: boolean) =>
      request<import('../types').SmartSearchResult>('/ai/smart-search', {
        method: 'POST',
        body: JSON.stringify({ query, suggestionsOnly }),
      }),
    getConversations: () =>
      request<{
        conversations: Array<{ id: string; title: string; updatedAt: number; createdAt: number }>;
      }>('/ai/conversations'),
    getConversationMessages: (id: string) =>
      request<{
        messages: Array<{
          id: string;
          role: string;
          content: string;
          timestamp: number;
          result?: import('../types').AgentExecutionResult | null;
          pendingAction?: import('../types').PendingAgentAction | null;
        }>;
      }>(`/ai/conversations/${id}/messages`),
    deleteConversation: (id: string) =>
      request<{ success: boolean }>(`/ai/conversations/${id}`, { method: 'DELETE' }),
  },

  sse: {
    eventsUrl: () => `${BASE_URL}/sse/events`,
  },

  brief: {
    generate: () =>
      request<{
        success: boolean;
        brief: {
          date: string;
          summary: string;
          highlights: string[];
          actionItemsCount: number;
          urgentCount: number;
          totalEmails: number;
          generatedAt: number;
        };
      }>('/brief/generate', { method: 'POST', timeout: 60000 }),
    latest: () =>
      request<{
        brief: {
          date: string;
          summary: string;
          highlights: string[];
          actionItemsCount: number;
          urgentCount: number;
          totalEmails: number;
          generatedAt: number;
          isFresh: boolean;
        } | null;
      }>('/brief/latest'),
  },

  detectedTasks: {
    list: (params?: { status?: string; priority?: string; page?: number; limit?: number }) => {
      const query = new URLSearchParams();
      if (params?.status) query.set('status', params.status);
      if (params?.priority) query.set('priority', params.priority);
      if (params?.page) query.set('page', params.page.toString());
      if (params?.limit) query.set('limit', params.limit.toString());
      return request<{ tasks: import('../types').DetectedTask[]; total: number }>(
        `/detected-tasks?${query}`,
      );
    },
    stats: () =>
      request<{ open: number; high: number; medium: number; low: number }>('/detected-tasks/stats'),
    scan: (daysBack: number) =>
      request<{
        newTasksCount: number;
        unsnoozedCount: number;
        tasks: import('../types').DetectedTask[];
      }>('/detected-tasks/scan', { method: 'POST', body: JSON.stringify({ daysBack }) }),
    update: (id: string, data: { status: string }) =>
      request<{ success: boolean }>(`/detected-tasks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<{ success: boolean }>(`/detected-tasks/${id}`, { method: 'DELETE' }),
    snooze: (id: string, days: number) =>
      request<{ success: boolean; snoozedUntil: number }>(`/detected-tasks/${id}/snooze`, {
        method: 'POST',
        body: JSON.stringify({ days }),
      }),
  },

  translate: {
    translate: (text: string, targetLang = 'hu', sourceLang = 'auto') =>
      request<{
        translatedText: string;
        detectedLanguage: string;
        source: string;
      }>('/translate', {
        method: 'POST',
        body: JSON.stringify({ text, targetLang, sourceLang }),
      }),
    detect: (text: string) =>
      request<{
        detectedLanguage: string;
        confidence: number;
      }>('/translate/detect', {
        method: 'POST',
        body: JSON.stringify({ text }),
      }),
    languages: () =>
      request<{
        languages: Array<{ code: string; name: string }>;
      }>('/translate/languages'),
  },
};
