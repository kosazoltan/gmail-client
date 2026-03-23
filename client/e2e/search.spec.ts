import { test, expect } from '@playwright/test';
import { setupAuthenticatedMocks, mockEmails } from './helpers';

test.describe('Search — Functionality & Suggestions', () => {
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

  test('search input is active and focusable in header', async ({ page }) => {
    await page.goto('/');

    // Header search input (visible desktop field)
    const searchInput = page.locator('header form input[placeholder*="Keres" i]:visible').first();
    await expect(searchInput).toBeVisible({ timeout: 10_000 });

    await searchInput.focus();
    await expect(searchInput).toBeFocused();
  });

  test('search triggers query flow with entered term', async ({ page }) => {
    let searchCalled = false;

    await page.route('**/api/search**', (route) => {
      searchCalled = true;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: mockEmails,
          total: mockEmails.length,
        }),
      });
    });

    await page.goto('/');

    const searchInput = page.locator('header form input[placeholder*="Keres" i]:visible').first();
    await expect(searchInput).toBeVisible({ timeout: 10_000 });

    await searchInput.fill('teszt');
    await searchInput
      .locator('xpath=ancestor::form[1]')
      .evaluate((form: HTMLFormElement) => form.requestSubmit());

    await expect.poll(() => searchCalled).toBeTruthy();
  });

  test('search results display matching emails', async ({ page }) => {
    await page.route('**/api/search**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          emails: mockEmails,
          total: mockEmails.length,
          page: 1,
          totalPages: 1,
        }),
      }),
    );

    await page.goto('/search?q=teszt');

    // Should show search results
    await expect(page.getByText('Teszt email tárgy')).toBeVisible({ timeout: 10_000 });
  });
});
