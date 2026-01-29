// Production: VITE_API_URL környezeti változóból, vagy /api
// Development: /api (proxied by Vite)
const BASE_URL = import.meta.env.VITE_API_URL || '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${url}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Hálózati hiba' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
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
    send: (data: { to: string; subject: string; body: string; cc?: string }) =>
      request('/emails/send', { method: 'POST', body: JSON.stringify(data) }),
    reply: (data: {
      to: string;
      subject?: string;
      body: string;
      cc?: string;
      inReplyTo?: string;
      threadId?: string;
    }) => request('/emails/reply', { method: 'POST', body: JSON.stringify(data) }),
    markRead: (id: string, isRead: boolean) =>
      request(`/emails/${id}/read`, {
        method: 'PATCH',
        body: JSON.stringify({ isRead }),
      }),
    toggleStar: (id: string, isStarred: boolean) =>
      request(`/emails/${id}/star`, {
        method: 'PATCH',
        body: JSON.stringify({ isStarred }),
      }),
    delete: (id: string) =>
      request(`/emails/${id}`, { method: 'DELETE' }),
  },

  views: {
    bySender: (params?: { page?: number; accountId?: string }) => {
      const query = new URLSearchParams();
      if (params?.page) query.set('page', params.page.toString());
      if (params?.accountId) query.set('accountId', params.accountId);
      return request<{ senders: import('../types').SenderGroup[] }>(`/views/by-sender?${query}`);
    },
    bySenderEmails: (email: string) =>
      request<{ emails: import('../types').Email[]; senderEmail: string }>(
        `/views/by-sender/${encodeURIComponent(email)}`,
      ),
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
    byCategory: () =>
      request<{ categories: import('../types').Category[] }>('/views/by-category'),
    byCategoryEmails: (categoryId: string, params?: { page?: number }) => {
      const query = params?.page ? `?page=${params.page}` : '';
      return request<{ emails: import('../types').Email[]; category: import('../types').Category }>(
        `/views/by-category/${categoryId}${query}`,
      );
    },
  },

  categories: {
    list: () => request<{ categories: import('../types').Category[] }>('/categories'),
    create: (data: { name: string; color?: string; icon?: string }) =>
      request('/categories', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { name?: string; color?: string; icon?: string }) =>
      request(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request(`/categories/${id}`, { method: 'DELETE' }),
    getRules: () => request<{ rules: import('../types').CategorizationRule[] }>('/categories/rules'),
    createRule: (data: {
      categoryId: string;
      type: string;
      value: string;
      priority?: number;
    }) => request('/categories/rules', { method: 'POST', body: JSON.stringify(data) }),
    deleteRule: (id: string) =>
      request(`/categories/rules/${id}`, { method: 'DELETE' }),
    recategorize: () => request('/categories/recategorize', { method: 'POST' }),
  },

  search: {
    query: (q: string, params?: { page?: number; accountId?: string }) => {
      const query = new URLSearchParams({ q });
      if (params?.page) query.set('page', params.page.toString());
      if (params?.accountId) query.set('accountId', params.accountId);
      return request<import('../types').PaginatedEmails>(`/search?${query}`);
    },
  },

  attachments: {
    downloadUrl: (id: string) => `${BASE_URL}/attachments/${id}/download`,
  },

  contacts: {
    search: (query: string, limit = 10) =>
      request<import('../types').Contact[]>(`/contacts/search?q=${encodeURIComponent(query)}&limit=${limit}`),
    list: () => request<import('../types').Contact[]>('/contacts'),
    delete: (id: string) => request(`/contacts/${id}`, { method: 'DELETE' }),
    update: (id: string, name: string) =>
      request(`/contacts/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
    extract: () => request<{ extractedCount: number }>('/contacts/extract', { method: 'POST' }),
  },
};
