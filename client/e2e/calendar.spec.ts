import { test, expect } from '@playwright/test';
import { setupAuthenticatedMocks } from './helpers';

const mockEvents = [
  {
    id: 'event-1',
    summary: 'Heti standup',
    description: 'Csapat meeting',
    start: { dateTime: new Date().toISOString() },
    end: { dateTime: new Date(Date.now() + 3600000).toISOString() },
    location: 'Teams',
    htmlLink: 'https://calendar.google.com/event/1',
  },
  {
    id: 'event-2',
    summary: 'Ebéd Péterrel',
    description: '',
    start: { dateTime: new Date(Date.now() + 7200000).toISOString() },
    end: { dateTime: new Date(Date.now() + 10800000).toISOString() },
    location: 'Étterem',
    htmlLink: 'https://calendar.google.com/event/2',
  },
];

test.describe('Calendar — View & Event Management', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedMocks(page);
    await page.route('**/api/emails**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ emails: [], total: 0 }) })
    );
    // Mock calendar events
    await page.route('**/api/calendar/events**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ events: mockEvents }),
      })
    );
    await page.route('**/api/calendar/today', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ events: mockEvents }),
      })
    );
  });

  test('calendar view loads and shows events', async ({ page }) => {
    await page.goto('/calendar');

    // Calendar heading/icon should be visible
    await expect(page.locator('svg.lucide-calendar').or(page.getByText(/naptár/i)).first()).toBeVisible({ timeout: 10_000 });

    // Events should be displayed
    await expect(page.getByText('Heti standup')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Ebéd Péterrel')).toBeVisible();
  });

  test('create event button opens modal', async ({ page }) => {
    await page.goto('/calendar');

    // Find the "+" or "Új esemény" / Plus button — visible, not hover-only!
    const createButton = page.locator('button').filter({ has: page.locator('svg.lucide-plus') });
    await expect(createButton.first()).toBeVisible({ timeout: 10_000 });

    await createButton.first().click();

    // Modal should open with form fields
    await expect(
      page.getByPlaceholder(/esemény neve/i)
        .or(page.getByPlaceholder(/cím/i))
        .or(page.getByText(/új esemény/i))
        .first()
    ).toBeVisible({ timeout: 5_000 });
  });

  test('delete event button is VISIBLE (not hover-only)', async ({ page }) => {
    await page.goto('/calendar');

    // Wait for events to load
    await expect(page.getByText('Heti standup')).toBeVisible({ timeout: 10_000 });

    // The delete/trash icon should be VISIBLE without hover
    // Look for trash buttons near events
    const trashButtons = page.locator('button').filter({ has: page.locator('svg.lucide-trash-2') });
    const count = await trashButtons.count();

    // At least one delete button should exist for the events
    expect(count).toBeGreaterThan(0);

    // The first delete button should be visible (not hidden behind hover)
    await expect(trashButtons.first()).toBeVisible();
  });
});
