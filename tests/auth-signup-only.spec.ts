import { test, expect } from '@playwright/test';

test('User signup flow', async ({ page }) => {
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!';

  console.log('\n🧪 Testing User Signup');
  console.log('Email:', testEmail);

  // Go to homepage
  await page.goto('http://localhost:3020');
  await page.waitForLoadState('networkidle');

  // Click Sign Up
  await page.click('text=Sign Up');
  await page.waitForLoadState('networkidle');

  // Fill signup form
  await page.fill('input[type="email"]', testEmail);
  await page.fill('input[type="password"]', testPassword);
  await page.fill('input[name="fullName"]', 'Test User');

  // Submit
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard
  await page.waitForURL('**/dashboard', { timeout: 10000 });

  console.log('✅ Signup successful!');

  expect(page.url()).toContain('/dashboard');
});
