import type { Page } from '@playwright/test';

/** Standard mock session for authenticated user */
export const mockSession = {
  authenticated: true,
  activeAccountId: 'acc-1',
  accounts: [{ id: 'acc-1', email: 'test@gmail.com', name: 'Test User' }],
};

/** Mock email data */
export const mockEmails = [
  {
    id: 'email-1',
    accountId: 'acc-1',
    threadId: 'thread-1',
    subject: 'Teszt email tárgy',
    from: 'sender@example.com',
    fromName: 'Sender Name',
    fromEmail: 'sender@example.com',
    to: 'test@gmail.com',
    snippet: 'Ez egy teszt email snippet...',
    date: Date.now() - 3600000,
    isRead: false,
    isStarred: false,
    labels: '["INBOX"]',
    hasAttachments: false,
  },
  {
    id: 'email-2',
    accountId: 'acc-1',
    threadId: 'thread-2',
    subject: 'Második email',
    from: 'other@example.com',
    fromName: 'Other Person',
    fromEmail: 'other@example.com',
    to: 'test@gmail.com',
    snippet: 'Második email tartalma...',
    date: Date.now() - 7200000,
    isRead: true,
    isStarred: true,
    labels: '["INBOX"]',
    hasAttachments: true,
  },
];

/** Setup standard API mocks for an authenticated session */
export async function setupAuthenticatedMocks(page: Page) {
  await page.route('**/api/auth/session', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockSession) })
  );
  await page.route('**/api/vip**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ senders: [] }) })
  );
  await page.route('**/api/pinned**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ pinnedEmails: [] }) })
  );
  await page.route('**/api/labels**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ labels: [] }) })
  );
  await page.route('**/api/saved-searches**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ searches: [] }) })
  );
  await page.route('**/api/reminders/due-count**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0 }) })
  );
  await page.route('**/api/dashboard**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) })
  );
  await page.route('**/api/smart-folders**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ folders: [] }) })
  );
  await page.route('**/api/detected-tasks/stats**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ open: 0, snoozed: 0 }) })
  );
  await page.route('**/api/categories**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ categories: [] }) })
  );
  await page.route('**/api/accounts**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ accounts: mockSession.accounts }),
    })
  );
}

/** Setup email list mock */
export async function setupEmailMocks(page: Page, emails = mockEmails) {
  await page.route('**/api/emails**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ emails, total: emails.length }),
    })
  );
}
