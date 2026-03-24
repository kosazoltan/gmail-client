import { test, expect } from '@playwright/test';
import { setupAuthenticatedMocks } from './helpers';

test.describe('Email Compose — Modal & Validation', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedMocks(page);
    await page.route('**/api/emails**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ emails: [], total: 0 }),
      }),
    );
    await page.route('**/api/contacts**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ contacts: [] }),
      }),
    );
    await page.route('**/api/templates**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ templates: [] }),
      }),
    );
    await page.route('**/api/settings**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ settings: {} }),
      }),
    );
  });

  test('compose page opens via /compose route', async ({ page }) => {
    await page.goto('/compose');

    // Should show the compose form with To, Subject fields
    await expect(
      page
        .getByPlaceholder(/címzett/i)
        .or(page.getByText(/címzett/i))
        .first(),
    ).toBeVisible({ timeout: 10_000 });
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

  test('rich paste preserves structure and sends HTML body', async ({ page }) => {
    let sentPayload: Record<string, unknown> | null = null;

    await page.route('**/api/emails/send**', async (route) => {
      const body = route.request().postData() || '{}';
      sentPayload = JSON.parse(body) as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, messageId: 'msg-test-1' }),
      });
    });

    await page.goto('/compose');

    const toInput = page.getByPlaceholder('pelda@gmail.com');
    await expect(toInput).toBeVisible({ timeout: 10_000 });
    await toInput.fill('receiver@example.com');

    const subjectInput = page.getByPlaceholder(/tárgy/i);
    await subjectInput.fill('Rich paste test');

    const editor = page.locator('[contenteditable="true"]').first();
    await expect(editor).toBeVisible();

    await editor.click();
    await editor.evaluate((el) => {
      const target = el as HTMLDivElement;
      const dt = new DataTransfer();
      dt.setData(
        'text/html',
        '<div><strong>Bold</strong> and <em>italic</em></div><ul><li>One</li><li>Two</li></ul><script>alert(1)</script>',
      );
      dt.setData('text/plain', 'Bold and italic');
      const event = new ClipboardEvent('paste', {
        clipboardData: dt,
        bubbles: true,
        cancelable: true,
      });
      target.dispatchEvent(event);
    });

    await expect(editor).toContainText('Bold');
    await expect(editor).toContainText('One');

    const editorHtml = await editor.evaluate((el) => (el as HTMLDivElement).innerHTML);
    expect(editorHtml).toContain('<strong>');
    expect(editorHtml).toContain('<li>');
    expect(editorHtml.toLowerCase()).not.toContain('<script');

    await page.getByRole('button', { name: 'Küldés' }).click();

    await expect.poll(() => sentPayload, { timeout: 10_000 }).not.toBeNull();

    const body = String(sentPayload?.body || '');
    expect(body).toContain('<strong>');
    expect(body).toContain('<li>');
    expect(body.toLowerCase()).not.toContain('<script');
  });
});
