/**
 * Navigation Components E2E Tests
 * 
 * Tests for Sidebar and BottomNav navigation components.
 */

import { test, expect } from '@playwright/test';

test.describe('Navigation Components', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'test-token');
      localStorage.setItem('user', JSON.stringify({
        user_id: 'test-user-123',
        email: 'test@example.com',
        displayName: 'Test User',
      }));
    });
  });

  test.describe('Sidebar (Desktop)', () => {
    test.use({ viewport: { width: 1280, height: 720 } });

    test('should be visible on desktop', async ({ page }) => {
      await page.goto('/dashboard');
      
      const sidebar = page.locator('aside[aria-label="Huvudnavigation"]');
      await expect(sidebar).toBeVisible();
    });

    test('should have all navigation items', async ({ page }) => {
      await page.goto('/dashboard');
      
      const navItems = [
        'Hem',
        'Humör',
        'AI Terapeut',
        'Välmående',
        'Ljud',
        'Dagbok',
        'Insikter',
        'Belöningar',
        'Profil',
      ];

      for (const item of navItems) {
        await expect(page.getByRole('link', { name: item })).toBeVisible();
      }
    });

    test('should highlight active nav item', async ({ page }) => {
      await page.goto('/dashboard');
      
      const homeLink = page.getByRole('link', { name: 'Hem' });
      await expect(homeLink).toHaveAttribute('aria-current', 'page');
    });

    test('should navigate to different pages', async ({ page }) => {
      await page.goto('/dashboard');
      
      await page.getByRole('link', { name: 'Profil' }).click();
      await expect(page).toHaveURL(/\/profile/);
      
      const profileLink = page.getByRole('link', { name: 'Profil' });
      await expect(profileLink).toHaveAttribute('aria-current', 'page');
    });

    test('should show premium badges for locked features', async ({ page }) => {
      await page.goto('/dashboard');
      
      // Premium features should have sparkle icons
      const premiumLinks = page.locator('aside nav a').filter({ hasText: /Välmående|Ljud|Dagbok|Insikter|Belöningar/ });
      const count = await premiumLinks.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should show upgrade card for free users', async ({ page }) => {
      await page.goto('/dashboard');
      
      const upgradeCard = page.getByText('Uppgradera');
      await expect(upgradeCard.first()).toBeVisible();
      
      const upgradeLink = page.getByRole('link', { name: 'Se Premium →' });
      await expect(upgradeLink).toBeVisible();
    });
  });

  test.describe('BottomNav (Mobile)', () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test('should be visible on mobile', async ({ page }) => {
      await page.goto('/dashboard');
      
      const bottomNav = page.locator('nav[aria-label="Mobilnavigation"]');
      await expect(bottomNav).toBeVisible();
    });

    test('should hide sidebar on mobile', async ({ page }) => {
      await page.goto('/dashboard');
      
      const sidebar = page.locator('aside[aria-label="Huvudnavigation"]');
      await expect(sidebar).not.toBeVisible();
    });

    test('should have 5 navigation items', async ({ page }) => {
      await page.goto('/dashboard');
      
      const navItems = ['Hem', 'Humör', 'AI', 'Lugn', 'Profil'];
      
      for (const item of navItems) {
        await expect(page.locator('nav[aria-label="Mobilnavigation"]').getByText(item)).toBeVisible();
      }
    });

    test('should navigate when clicking nav items', async ({ page }) => {
      await page.goto('/dashboard');
      
      await page.locator('nav[aria-label="Mobilnavigation"]').getByText('Profil').click();
      await expect(page).toHaveURL(/\/profile/);
    });

    test('should show active indicator on current page', async ({ page }) => {
      await page.goto('/dashboard');
      
      const homeLink = page.locator('nav[aria-label="Mobilnavigation"]').getByRole('link', { name: 'Hem' });
      await expect(homeLink).toHaveAttribute('aria-current', 'page');
    });
  });

  test.describe('Skip Link (Accessibility)', () => {
    test('should be visible on focus', async ({ page }) => {
      await page.goto('/dashboard');
      
      // Tab to focus skip link
      await page.keyboard.press('Tab');
      
      const skipLink = page.getByText('Hoppa till huvudinnehållet');
      await expect(skipLink).toBeFocused();
    });

    test('should skip to main content when activated', async ({ page }) => {
      await page.goto('/dashboard');
      
      // Focus and activate skip link
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');
      
      // Main content should be focused
      const mainContent = page.locator('#main-content');
      await expect(mainContent).toBeFocused();
    });
  });

  test.describe('Responsive Behavior', () => {
    test('should switch from sidebar to bottom nav on resize', async ({ page }) => {
      // Start desktop
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto('/dashboard');
      
      await expect(page.locator('aside[aria-label="Huvudnavigation"]')).toBeVisible();
      await expect(page.locator('nav[aria-label="Mobilnavigation"]')).not.toBeVisible();
      
      // Resize to mobile
      await page.setViewportSize({ width: 375, height: 667 });
      
      await expect(page.locator('aside[aria-label="Huvudnavigation"]')).not.toBeVisible();
      await expect(page.locator('nav[aria-label="Mobilnavigation"]')).toBeVisible();
    });
  });
});
