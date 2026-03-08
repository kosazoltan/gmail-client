import { test, expect } from '@playwright/test';
import { setupAuthenticatedMocks, mockEmails } from './helpers';

test.describe('Search — Functionality & Suggestions', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedMocks(page);
    await page.route('**/api/emails**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ emails: [], total: 0 }) })
    );
  });

  test('search input is active and focusable in header', async ({ page }) => {
    await page.goto('/');

    // Header search input
    const searchInput = page.getByPlaceholder(/keres/i).first();
    await expect(searchInput).toBeVisible({ timeout: 10_000 });

    await searchInput.focus();
    await expect(searchInput).toBeFocused();
  });

  test('search navigates to search results page with query', async ({ page }) => {
    // Mock search results
    await page.route('**/api/search**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: mockEmails,
          total: mockEmails.length,
        }),
      })
    );

    await page.goto('/');

    const searchInput = page.getByPlaceholder(/keres/i).first();
    await expect(searchInput).toBeVisible({ timeout: 10_000 });

    // Type search query and press Enter
    await searchInput.fill('teszt');
    await searchInput.press('Enter');

    // Should navigate to search page
    await expect(page).toHaveURL(/\/search\?q=teszt/);
  });

  test('search results display matching emails', async ({ page }) => {
    await page.route('**/api/search**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: mockEmails,
          total: mockEmails.length,
        }),
      })
    );

    await page.goto('/search?q=teszt');

    // Should show search results
    await expect(page.getByText('Teszt email tárgy')).toBeVisible({ timeout: 10_000 });
  });
});
