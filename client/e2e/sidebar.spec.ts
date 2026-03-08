import { test, expect } from '@playwright/test';
import { setupAuthenticatedMocks, setupEmailMocks } from './helpers';

test.describe('Sidebar — Navigation & Active State', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedMocks(page);
    await setupEmailMocks(page, []);
    // Mock calendar, tasks, dashboard, etc.
    await page.route('**/api/calendar/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ events: [] }) })
    );
    await page.route('**/api/detected-tasks**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tasks: [] }) })
    );
    await page.route('**/api/ai/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ conversations: [] }) })
    );
  });

  test('sidebar shows all main navigation items', async ({ page }) => {
    await page.goto('/');

    // Main group items (always visible): Home, Inbox, Compose
    await expect(page.getByRole('link', { name: /^home$/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('link', { name: /^inbox$/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /^compose$/i })).toBeVisible();

    // AI Nézetek group (open by default): Naptár, Tasks
    await expect(page.getByRole('link', { name: /naptár/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /^tasks$/i })).toBeVisible();
  });

  test('sidebar navigation works — clicking navigates to correct route', async ({ page }) => {
    await page.goto('/');

    // Navigate to Home (Dashboard)
    await page.getByRole('link', { name: /^home$/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // Navigate to Calendar (Naptár — in AI Nézetek, open by default)
    await page.getByRole('link', { name: /naptár/i }).click();
    await expect(page).toHaveURL(/\/calendar/);

    // Navigate back to Inbox
    await page.getByRole('link', { name: /^inbox$/i }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('active sidebar item has correct visual state', async ({ page }) => {
    await page.goto('/dashboard');

    // The Home link should have the active NavLink class
    const homeLink = page.getByRole('link', { name: /^home$/i });
    await expect(homeLink).toBeVisible({ timeout: 10_000 });
    // NavLink active class adds bg color
    await expect(homeLink).toHaveClass(/bg-/);
  });

  test('categories section is visible in sidebar', async ({ page }) => {
    // Mock views/by-category with a user category (non-system)
    await page.route('**/api/views/by-category**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          categories: [
            { id: 'cat-1', name: 'Munka', color: '#3B82F6', icon: 'briefcase', isSystem: false, is_system: false, emailCount: 5 },
          ],
        }),
      })
    );

    await page.goto('/');
    // "Saját kategóriák" header appears when user categories exist (in AI Nézetek, open by default)
    await expect(page.getByText(/saját kategóriák/i)).toBeVisible({ timeout: 10_000 });
    // The category name should be visible
    await expect(page.getByText('Munka')).toBeVisible();
  });
});
