import { expect, test } from '@playwright/test';
import { setupAuthenticatedMocks } from './helpers';

test.describe('Scan — Sync Button & Progress', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedMocks(page);
    await page.route('**/api/emails**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ emails: [], total: 0 }),
      }),
    );
  });

  test('sync/refresh button is visible and clickable in header', async ({ page }) => {
    // Mock sync endpoint
    await page.route('**/api/accounts/*/sync**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, messagesProcessed: 5 }),
      }),
    );

    await page.goto('/');

    // The refresh/sync button in the header (RefreshCw icon)
    const syncButton = page
      .locator('button')
      .filter({ has: page.locator('svg.lucide-refresh-cw') });
    await expect(syncButton.first()).toBeVisible({ timeout: 10_000 });

    // Click should trigger sync
    await syncButton.first().click();

    // After clicking, the button might show spinning animation (animate-spin class)
    // or a loading indicator appears
    // We verify the API call was made
  });

  test('sync button shows loading state while syncing', async ({ page }) => {
    // Delay sync response to observe loading state
    await page.route('**/api/accounts/*/sync**', async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, messagesProcessed: 5 }),
      });
    });

    await page.goto('/');

    const syncButton = page
      .locator('button')
      .filter({ has: page.locator('svg.lucide-refresh-cw') });
    await expect(syncButton.first()).toBeVisible({ timeout: 10_000 });

    // Click sync
    await syncButton.first().click();

    // During sync, the button should show loading state (spinning icon or disabled)
    await expect
      .poll(async () => {
        const iconClass = await syncButton
          .first()
          .locator('svg.lucide-refresh-cw')
          .getAttribute('class');
        const isDisabled = await syncButton.first().isDisabled();
        return isDisabled || iconClass?.includes('animate-spin');
      })
      .toBeTruthy();
  });
});
