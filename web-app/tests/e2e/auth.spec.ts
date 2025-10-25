import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should load login page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Lugn & Trygg/);
    await expect(page.locator('h1').filter({ hasText: 'Logga in' })).toBeVisible();
  });

  test('should show login form elements', async ({ page }) => {
    await page.goto('/login');

    // Check for email input
    await expect(page.locator('input[type="email"]')).toBeVisible();

    // Check for password input
    await expect(page.locator('input[type="password"]')).toBeVisible();

    // Check for login button
    await expect(page.locator('button').filter({ hasText: 'Logga in' })).toBeVisible();

    // Check for Google sign-in button
    await expect(page.locator('button').filter({ hasText: 'Fortsätt med Google' })).toBeVisible();

    // Check for register link
    await expect(page.locator('a').filter({ hasText: 'Registrera dig här' })).toBeVisible();
  });

  test('should navigate to register page', async ({ page }) => {
    await page.goto('/login');
    await page.locator('a').filter({ hasText: 'Registrera dig här' }).click();
    await expect(page).toHaveURL(/\/register/);
  });

  test('should show forgot password dialog', async ({ page }) => {
    await page.goto('/login');
    await page.locator('button').filter({ hasText: 'Glömt lösenord?' }).click();

    // Check if forgot password modal appears
    await expect(page.locator('text=Återställ lösenord')).toBeVisible();
  });

  test('should show validation errors for empty form submission', async ({ page }) => {
    await page.goto('/login');
    await page.locator('button').filter({ hasText: 'Logga in' }).click();

    // Check for HTML5 validation or error messages
    await expect(page.locator('input:invalid')).toHaveCount(2); // email and password should be required
  });

  test('should toggle password visibility', async ({ page }) => {
    await page.goto('/login');

    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toBeVisible();

    // Click the toggle button
    await page.locator('button[aria-label*="Visa lösenord"]').click();

    // Password should now be visible as text
    await expect(page.locator('input[type="text"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
  });

  test('should load register page', async ({ page }) => {
    await page.goto('/register');
    await expect(page.locator('h1').filter({ hasText: 'Skapa konto' })).toBeVisible();
  });

  test('should show register form elements', async ({ page }) => {
    await page.goto('/register');

    // Check for required form fields
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();

    // Check for register button
    await expect(page.locator('button').filter({ hasText: 'Skapa konto' })).toBeVisible();

    // Check for login link
    await expect(page.locator('a').filter({ hasText: 'Logga in istället' })).toBeVisible();
  });

  test('should navigate from register to login', async ({ page }) => {
    await page.goto('/register');
    await page.locator('a').filter({ hasText: 'Logga in istället' }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});