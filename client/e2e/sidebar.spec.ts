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

    // Dashboard section items
    await expect(page.getByRole('link', { name: /dashboard/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('link', { name: /naptár/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /feladatok/i })).toBeVisible();

    // Email section items
    await expect(page.getByRole('link', { name: /beérkezett/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /minden levél/i })).toBeVisible();
  });

  test('sidebar navigation works — clicking navigates to correct route', async ({ page }) => {
    await page.goto('/');

    // Navigate to Dashboard
    await page.getByRole('link', { name: /dashboard/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // Navigate to Calendar
    await page.getByRole('link', { name: /naptár/i }).click();
    await expect(page).toHaveURL(/\/calendar/);

    // Navigate back to Inbox
    await page.getByRole('link', { name: /beérkezett/i }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('active sidebar item has correct visual state', async ({ page }) => {
    await page.goto('/dashboard');

    // The Dashboard link should have the active NavLink class
    const dashboardLink = page.getByRole('link', { name: /dashboard/i });
    await expect(dashboardLink).toBeVisible({ timeout: 10_000 });
    // NavLink active class typically adds bg color
    await expect(dashboardLink).toHaveClass(/bg-/);
  });

  test('categories section is visible in sidebar', async ({ page }) => {
    // Mock categories
    await page.route('**/api/categories**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          categories: [
            { id: 'cat-1', name: 'Munka', color: '#3B82F6', icon: 'briefcase', isSystem: false },
          ],
        }),
      })
    );

    await page.goto('/');
    await expect(page.getByText(/kategóriák/i)).toBeVisible({ timeout: 10_000 });
  });
});
