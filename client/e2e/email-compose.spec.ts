import { test, expect } from '@playwright/test';
import { setupAuthenticatedMocks } from './helpers';

test.describe('Email Compose — Modal & Validation', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedMocks(page);
    await page.route('**/api/emails**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ emails: [], total: 0 }) })
    );
    await page.route('**/api/contacts**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ contacts: [] }) })
    );
    await page.route('**/api/templates**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ templates: [] }) })
    );
    await page.route('**/api/settings**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ settings: {} }) })
    );
  });

  test('compose page opens via /compose route', async ({ page }) => {
    await page.goto('/compose');

    // Should show the compose form with To, Subject fields
    await expect(page.getByPlaceholder(/címzett/i).or(page.getByText(/címzett/i)).first()).toBeVisible({ timeout: 10_000 });
  });

  test('send button exists and compose form has required fields', async ({ page }) => {
    await page.goto('/compose');

    // Send button should be present
    const sendButton = page.locator('button').filter({ has: page.locator('svg.lucide-send') });
    await expect(sendButton.first()).toBeVisible({ timeout: 10_000 });

    // Subject/Tárgy field should exist
    const subjectInput = page.getByPlaceholder(/tárgy/i);
    await expect(subjectInput).toBeVisible();
  });

  test('compose form can be filled', async ({ page }) => {
    await page.goto('/compose');

    // Fill in the subject
    const subjectInput = page.getByPlaceholder(/tárgy/i);
    await expect(subjectInput).toBeVisible({ timeout: 10_000 });
    await subjectInput.fill('Teszt tárgy sor');
    await expect(subjectInput).toHaveValue('Teszt tárgy sor');
  });
});
