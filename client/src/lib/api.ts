// Production: VITE_API_URL környezeti változóból, vagy /api
// Development: /api (proxied by Vite)
const BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Default request timeout (30 seconds)
const DEFAULT_TIMEOUT = 30000;

async function request<T>(url: string, options?: RequestInit & { timeout?: number }): Promise<T> {
  const { timeout = DEFAULT_TIMEOUT, ...fetchOptions } = options || {};

  // FIX: Add timeout using AbortController
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
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('A kérés időtúllépés miatt megszakadt');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
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
      request<{ success: boolean; messagesProcessed: number; message: string }>(`/accounts/${id}/resync`, {
        method: 'POST',
      }),
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
    send: (data: {
      to: string;
      subject: string;
      body: string;
      cc?: string;
      attachments?: Array<{ filename: string; mimeType: string; content: string }>;
    }) =>
      request('/emails/send', { method: 'POST', body: JSON.stringify(data) }),
    reply: (data: {
      to: string;
      subject?: string;
      body: string;
      cc?: string;
      inReplyTo?: string;
      threadId?: string;
      attachments?: Array<{ filename: string; mimeType: string; content: string }>;
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
    batchDelete: (emailIds: string[]) =>
      request<{ deletedCount: number; failedCount: number }>('/emails/batch', {
        method: 'DELETE',
        body: JSON.stringify({ emailIds }),
      }),
  },

  views: {
    bySender: (params?: { page?: number; accountId?: string }) => {
      const query = new URLSearchParams();
      if (params?.page !== undefined) query.set('page', params.page.toString());
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
      if (params?.page !== undefined) query.set('page', params.page.toString());
      if (params?.accountId) query.set('accountId', params.accountId);
      return request<import('../types').PaginatedEmails>(`/search?${query}`);
    },
  },

  attachments: {
    downloadUrl: (id: string) => `${BASE_URL}/attachments/${id}/download`,
    list: (params: {
      type?: string;
      search?: string;
      sort?: 'date' | 'size' | 'name';
      order?: 'asc' | 'desc';
      page?: number;
      limit?: number;
    } = {}) => {
      const query = new URLSearchParams();
      if (params.type) query.set('type', params.type);
      if (params.search) query.set('search', params.search);
      if (params.sort) query.set('sort', params.sort);
      if (params.order) query.set('order', params.order);
      if (params.page) query.set('page', params.page.toString());
      if (params.limit) query.set('limit', params.limit.toString());
      return request<import('../types').AttachmentListResult>(`/attachments?${query}`);
    },
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
    update: (id: string, data: { name?: string; body?: string; subject?: string; shortcut?: string }) =>
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
    due: () =>
      request<{ reminders: import('../types').Reminder[] }>('/reminders/due'),
    count: () => request<{ count: number }>('/reminders/count'),
    create: (data: { emailId: string; remindAt: number; note?: string }) =>
      request<{ reminder: import('../types').Reminder }>('/reminders', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (
      id: string,
      data: { remindAt?: number; note?: string; isCompleted?: boolean },
    ) =>
      request<{ reminder: import('../types').Reminder }>(`/reminders/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<{ success: boolean }>(`/reminders/${id}`, { method: 'DELETE' }),
    complete: (id: string) =>
      request<{ reminder: import('../types').Reminder }>(`/reminders/${id}/complete`, {
        method: 'POST',
      }),
  },

  database: {
    getStats: () => request<import('../types').DatabaseStats>('/database/stats'),
    listEmails: (params: {
      page?: number;
      limit?: number;
      sortBy?: 'date' | 'from' | 'subject' | 'size';
      sortOrder?: 'asc' | 'desc';
      search?: string;
      dateFrom?: number;
      dateTo?: number;
      hasAttachments?: boolean;
      isRead?: boolean;
    } = {}) => {
      const query = new URLSearchParams();
      if (params.page) query.set('page', params.page.toString());
      if (params.limit) query.set('limit', params.limit.toString());
      if (params.sortBy) query.set('sortBy', params.sortBy);
      if (params.sortOrder) query.set('sortOrder', params.sortOrder);
      if (params.search) query.set('search', params.search);
      if (params.dateFrom) query.set('dateFrom', params.dateFrom.toString());
      if (params.dateTo) query.set('dateTo', params.dateTo.toString());
      if (params.hasAttachments !== undefined) query.set('hasAttachments', params.hasAttachments.toString());
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
      request<{ filename: string; path: string; size: number }>('/database/backup', { method: 'POST' }),
    listBackups: () => request<{ backups: import('../types').Backup[] }>('/database/backups'),
    downloadBackupUrl: (filename: string) => `${BASE_URL}/database/backups/${encodeURIComponent(filename)}`,
    deleteBackup: (filename: string) =>
      request(`/database/backups/${encodeURIComponent(filename)}`, { method: 'DELETE' }),
    vacuum: () => request('/database/vacuum', { method: 'POST' }),
    cleanup: () => request('/database/cleanup', { method: 'POST' }),
  },

  labels: {
    list: () =>
      request<{ labels: import('../types').GmailLabel[] }>('/labels'),
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
    getEmails: (params: {
      page?: number;
      limit?: number;
      senderId?: string;
      includeMuted?: boolean;
    } = {}) => {
      const query = new URLSearchParams();
      if (params.page) query.set('page', params.page.toString());
      if (params.limit) query.set('limit', params.limit.toString());
      if (params.senderId) query.set('senderId', params.senderId);
      if (params.includeMuted) query.set('includeMuted', 'true');
      return request<import('../types').NewsletterEmailsResult>(`/newsletters/emails?${query}`);
    },
    getStats: () =>
      request<import('../types').NewsletterStats>('/newsletters/stats'),
  },

  push: {
    getVapidKey: () =>
      request<{ publicKey: string }>('/push/vapid-public-key'),
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
    list: () =>
      request<{ pinnedEmailIds: string[] }>('/pinned'),
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
    getAll: () =>
      request<{ settings: Record<string, unknown> }>('/settings'),
    get: (key: string) =>
      request<{ value: unknown }>(`/settings/${key}`),
    set: (key: string, value: unknown) =>
      request<{ success: boolean; key: string; value: unknown }>(`/settings/${key}`, {
        method: 'PUT',
        body: JSON.stringify({ value }),
      }),
    delete: (key: string) =>
      request<{ success: boolean }>(`/settings/${key}`, { method: 'DELETE' }),
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
        subject: string | null;
        body: string | null;
        scheduledAt: number;
        status: string;
        createdAt: number;
      }>('/scheduled', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: {
      to?: string;
      cc?: string;
      subject?: string;
      body?: string;
      scheduledAt?: number;
    }) =>
      request<{ success: boolean }>(`/scheduled/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<{ success: boolean }>(`/scheduled/${id}`, { method: 'DELETE' }),
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
    emails: () =>
      request<{ emails: string[] }>('/vip/emails'),
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
    delete: (id: string) =>
      request<{ success: boolean }>(`/vip/${id}`, { method: 'DELETE' }),
    toggle: (email: string, name?: string) =>
      request<{ isVip: boolean; id?: string }>('/vip/toggle', {
        method: 'POST',
        body: JSON.stringify({ email, name }),
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
