import { test, expect } from '@playwright/test';
import { setupAuthenticatedMocks, setupEmailMocks } from './helpers';

test.describe('Responsive — Mobile & Desktop Layouts', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedMocks(page);
    await setupEmailMocks(page, []);
  });

  test('mobile viewport (375px): sidebar is hidden, hamburger menu visible', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    // On mobile, sidebar should be hidden (translated off-screen)
    // The hamburger/menu button should be visible in header
    const menuButton = page.locator('button').filter({ has: page.locator('svg.lucide-menu') });
    await expect(menuButton.first()).toBeVisible({ timeout: 10_000 });

    // Sidebar links should NOT be visible by default on mobile
    // The sidebar is translated off-screen with -translate-x-full
    const sidebarNav = page.getByRole('link', { name: /dashboard/i });
    await expect(sidebarNav).not.toBeVisible();
  });

  test('mobile viewport: hamburger opens sidebar overlay', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    // Click hamburger to open sidebar
    const menuButton = page.locator('button').filter({ has: page.locator('svg.lucide-menu') });
    await expect(menuButton.first()).toBeVisible({ timeout: 10_000 });
    await menuButton.first().click();

    // Sidebar should now be visible with overlay
    await expect(page.getByRole('link', { name: /beérkezett/i })).toBeVisible({ timeout: 3_000 });

    // Overlay backdrop should be present
    const overlay = page.locator('div.fixed.inset-0');
    await expect(overlay.first()).toBeVisible();
  });

  test('desktop viewport (1280px): sidebar is open by default', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');

    // On desktop, sidebar should be visible with navigation links
    await expect(page.getByRole('link', { name: /beérkezett/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('link', { name: /dashboard/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /naptár/i })).toBeVisible();
  });

  test('desktop viewport: sidebar collapse toggle works', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');

    // Sidebar should be open
    await expect(page.getByRole('link', { name: /beérkezett/i })).toBeVisible({ timeout: 10_000 });

    // Find the collapse button (ChevronLeft icon in sidebar) — MUST exist
    const collapseButton = page.locator('button').filter({ has: page.locator('svg.lucide-chevron-left') });
    await expect(collapseButton.first()).toBeVisible({ timeout: 5000 });
    await collapseButton.first().click();
    // Wait briefly for animation
    await page.waitForTimeout(300);
  });
});
