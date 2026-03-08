import { test, expect } from '@playwright/test';
import { setupAuthenticatedMocks } from './helpers';

test.describe('Settings — Page & Account Info', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedMocks(page);
    await page.route('**/api/emails**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ emails: [], total: 0 }) })
    );
    await page.route('**/api/settings**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ settings: {} }) })
    );
    await page.route('**/api/vip**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ senders: [] }) })
    );
    await page.route('**/api/templates**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ templates: [] }) })
    );
  });

  test('settings page loads with section headers', async ({ page }) => {
    await page.goto('/settings');

    // Settings header should be visible
    await expect(page.getByText(/beállítások/i).first()).toBeVisible({ timeout: 10_000 });

    // Should show settings sections
    await expect(page.getByText(/swipe műveletek/i)).toBeVisible();
    await expect(page.getByText(/email küldés/i)).toBeVisible();
  });

  test('settings page shows all setting sections', async ({ page }) => {
    await page.goto('/settings');

    // All sections from SettingsView should be present
    await expect(page.getByText(/swipe műveletek/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/email küldés/i)).toBeVisible();
    await expect(page.getByText(/értesítések/i)).toBeVisible();
  });
});
