import { expect, test } from '@playwright/test';
import { mockEmails, setupAuthenticatedMocks, setupEmailMocks } from './helpers';

test.describe('Email List — Loading & Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedMocks(page);
  });

  test('email list loads with content (skeleton → content transition)', async ({ page }) => {
    // Delay email response to observe loading state
    const delayedBody = JSON.stringify({
      emails: mockEmails,
      total: mockEmails.length,
      page: 1,
      totalPages: 1,
    });
    await page.route('**/api/emails**', async (route) => {
      await new Promise((r) => setTimeout(r, 500));
      await route.fulfill({ status: 200, contentType: 'application/json', body: delayedBody });
    });
    await page.route('**/api/views/inbox**', async (route) => {
      await new Promise((r) => setTimeout(r, 500));
      await route.fulfill({ status: 200, contentType: 'application/json', body: delayedBody });
    });

    await page.goto('/');
    // Eventually the email subject should appear
    await expect(page.getByText('Teszt email tárgy')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Második email', { exact: true })).toBeVisible();
  });

  test('clicking an email opens detail view', async ({ page }) => {
    await setupEmailMocks(page);
    // Mock email detail
    await page.route('**/api/emails/email-1**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...mockEmails[0],
          body: 'Ez a teljes email tartalma',
          bodyHtml: '<p>Ez a teljes email tartalma</p>',
        }),
      }),
    );

    await page.goto('/');
    await expect(page.getByText('Teszt email tárgy')).toBeVisible({ timeout: 10_000 });
    await page.getByText('Teszt email tárgy').click();

    // Detail view should appear with the email content
    await expect(page.getByText('Ez a teljes email tartalma')).toBeVisible({ timeout: 5_000 });
  });

  test('star/unstar toggle works', async ({ page }) => {
    await setupEmailMocks(page);
    // Mock star toggle endpoint
    await page.route('**/api/emails/*/star', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      }),
    );

    await page.goto('/');
    await expect(page.getByText('Teszt email tárgy')).toBeVisible({ timeout: 10_000 });

    // Find star buttons — the unstarred email should have a clickable star
    const starButtons = page.locator('button').filter({ has: page.locator('svg.lucide-star') });
    const starCount = await starButtons.count();
    expect(starCount).toBeGreaterThan(0);

    // Click star and wait for API call concurrently to avoid race condition
    const [starRequest] = await Promise.all([
      page.waitForRequest('**/api/emails/*/star'),
      starButtons.first().click(),
    ]);
    expect(starRequest.url()).toContain('/star');
  });

  test('delete confirmation moves email to trash via proxy-safe endpoint', async ({ page }) => {
    await setupEmailMocks(page);
    await page.route('**/api/emails/email-1**', (route) => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname.endsWith('/trash')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      }

      if (pathname.endsWith('/thread')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            threadId: 'thread-1',
            accountEmail: 'test@gmail.com',
            emails: [
              {
                ...mockEmails[0],
                body: 'Ez a teljes email tartalma',
                bodyHtml: '<p>Ez a teljes email tartalma</p>',
              },
            ],
          }),
        });
      }

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...mockEmails[0],
          body: 'Ez a teljes email tartalma',
          bodyHtml: '<p>Ez a teljes email tartalma</p>',
        }),
      });
    });

    await page.goto('/');
    await expect(page.getByText('Teszt email tárgy')).toBeVisible({ timeout: 10_000 });
    await page.getByText('Teszt email tárgy').click();
    await expect(page.getByText('Ez a teljes email tartalma')).toBeVisible({ timeout: 5_000 });

    await page.getByLabel('Törlés').first().click();
    const deleteModal = page.locator('div.fixed').filter({ hasText: 'Email törlése' });
    await expect(deleteModal).toBeVisible();

    const [deleteRequest] = await Promise.all([
      page.waitForRequest('**/api/emails/email-1/trash**'),
      deleteModal.getByRole('button', { name: 'Törlés', exact: true }).click(),
    ]);

    expect(deleteRequest.method()).toBe('POST');
    await expect(deleteModal).toBeHidden({ timeout: 5_000 });
  });
});
