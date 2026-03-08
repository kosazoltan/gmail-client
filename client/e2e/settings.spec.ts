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

    // Section labels are <span> elements inside section headers
    // Use locator('span') to avoid matching tips/descriptions
    await expect(page.locator('span').filter({ hasText: 'Swipe műveletek' })).toBeVisible();
    await expect(page.locator('span').filter({ hasText: 'Email küldés' })).toBeVisible();
  });

  test('settings page shows all setting sections', async ({ page }) => {
    await page.goto('/settings');

    // All section labels from SettingsView should be present
    await expect(page.locator('span').filter({ hasText: 'Swipe műveletek' })).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('span').filter({ hasText: 'Email küldés' })).toBeVisible();
    await expect(page.locator('span').filter({ hasText: 'Értesítések' })).toBeVisible();
  });
});
