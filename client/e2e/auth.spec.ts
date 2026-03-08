import { test, expect } from '@playwright/test';

// Mock session API responses
const mockSession = {
  authenticated: true,
  activeAccountId: 'acc-1',
  accounts: [{ id: 'acc-1', email: 'test@gmail.com', name: 'Test User' }],
};

const mockNoSession = {
  authenticated: false,
  accounts: [],
};

test.describe('Auth — OAuth Login Flow', () => {
  test('unauthenticated user sees LoginScreen with Google login button', async ({ page }) => {
    // Mock: no session
    await page.route('**/api/auth/session', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockNoSession) })
    );
    // Mock: inbox returns 401
    await page.route('**/api/emails**', (route) =>
      route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Unauthorized' }) })
    );

    await page.goto('/');
    // LoginScreen should show the Google login button
    const loginButton = page.getByRole('button', { name: /bejelentkezés google fiókkal/i });
    await expect(loginButton).toBeVisible();
  });

  test('Google login button triggers OAuth redirect', async ({ page }) => {
    await page.route('**/api/auth/session', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockNoSession) })
    );
    await page.route('**/api/emails**', (route) =>
      route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Unauthorized' }) })
    );
    // Mock login URL endpoint — returns Google OAuth URL
    await page.route('**/api/auth/login', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: 'https://accounts.google.com/o/oauth2/v2/auth?mock=true' }),
      })
    );

    await page.goto('/');
    const loginButton = page.getByRole('button', { name: /bejelentkezés google fiókkal/i });
    await expect(loginButton).toBeVisible();

    // Click should trigger navigation to Google OAuth
    const [request] = await Promise.all([
      page.waitForRequest('**/api/auth/login'),
      loginButton.click(),
    ]);
    expect(request.url()).toContain('/api/auth/login');
  });

  test('authenticated user sees inbox, not login screen', async ({ page }) => {
    await page.route('**/api/auth/session', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockSession) })
    );
    // Mock emails
    await page.route('**/api/emails**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ emails: [], total: 0 }),
      })
    );
    // Mock other APIs that InboxView might call
    await page.route('**/api/vip**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ senders: [] }) })
    );
    await page.route('**/api/pinned**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ pinnedEmails: [] }) })
    );

    await page.goto('/');
    // Should NOT show login button
    await expect(page.getByRole('button', { name: /bejelentkezés google fiókkal/i })).not.toBeVisible();
  });

  test('session persistence after page reload', async ({ page }) => {
    await page.route('**/api/auth/session', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockSession) })
    );
    await page.route('**/api/emails**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ emails: [], total: 0 }) })
    );
    await page.route('**/api/vip**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ senders: [] }) })
    );
    await page.route('**/api/pinned**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ pinnedEmails: [] }) })
    );

    await page.goto('/');
    await expect(page.getByRole('button', { name: /bejelentkezés google fiókkal/i })).not.toBeVisible();

    // Reload page — session should persist (mock returns same session)
    await page.reload();
    await expect(page.getByRole('button', { name: /bejelentkezés google fiókkal/i })).not.toBeVisible();
  });
});
