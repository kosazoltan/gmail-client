import { test, expect } from '@playwright/test';
import { setupAuthenticatedMocks } from './helpers';

test.describe('AI Assistant — Chat Interface', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedMocks(page);
    await page.route('**/api/emails**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ emails: [], total: 0 }) })
    );
    // Mock AI conversations list
    await page.route('**/api/ai/conversations', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ conversations: [] }),
      })
    );
  });

  test('AI assistant page loads with chat interface', async ({ page }) => {
    await page.goto('/ai-assistant');

    // Should show AI-related heading or icon
    await expect(page.getByText(/ai asszisztens/i).or(page.locator('svg.lucide-bot')).first()).toBeVisible({ timeout: 10_000 });
  });

  test('AI chat input field is functional', async ({ page }) => {
    await page.goto('/ai-assistant');

    // The input/textarea for chat should be visible
    const chatInput = page.locator('textarea').first();
    await expect(chatInput).toBeVisible({ timeout: 10_000 });

    // Type into it
    await chatInput.fill('Foglald össze a mai emaileket');
    await expect(chatInput).toHaveValue('Foglald össze a mai emaileket');
  });

  test('sending a message and receiving AI response (mocked)', async ({ page }) => {
    // Mock the AI chat send endpoint
    await page.route('**/api/ai/chat', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          message: { id: 'msg-1', role: 'assistant', content: 'Összefoglalva: 3 fontos email érkezett ma.' },
          conversationId: 'conv-1',
        }),
      })
    );

    await page.goto('/ai-assistant');

    const chatInput = page.locator('textarea').first();
    await expect(chatInput).toBeVisible({ timeout: 10_000 });

    // Type a message and submit
    await chatInput.fill('Foglald össze a mai emaileket');

    // Click send button
    const sendButton = page.locator('button').filter({ has: page.locator('svg.lucide-send') });
    await sendButton.click();

    // The AI response should appear
    await expect(page.getByText(/összefoglalva/i)).toBeVisible({ timeout: 10_000 });
  });
});
