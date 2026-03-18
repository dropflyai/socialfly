import { test, expect } from '@playwright/test';

test('Login with existing user', async ({ page }) => {
  const testEmail = 'manual-test-1765693040928@example.com';
  const testPassword = 'TestPassword123!';

  console.log('\n🔐 Testing Login with Existing User');
  console.log('Email:', testEmail);

  // Navigate to login page
  console.log('\n1️⃣  Navigating to login page...');
  await page.goto('http://localhost:3020/auth/login');
  await page.waitForLoadState('networkidle');

  // Fill login form
  console.log('\n2️⃣  Filling login form...');
  await page.fill('input[name="email"]', testEmail);
  await page.fill('input[name="password"]', testPassword);

  // Submit
  console.log('\n3️⃣  Submitting login...');
  await page.click('button[type="submit"]');

  // Wait for redirect
  await page.waitForURL('**/dashboard', { timeout: 10000 });

  console.log('\n4️⃣  Verifying dashboard...');
  await page.waitForSelector('text=Welcome', { timeout: 5000 });

  const welcomeText = await page.textContent('h2');
  console.log('   Welcome message:', welcomeText);

  // Take screenshot
  await page.screenshot({ path: 'login-test.png', fullPage: true });
  console.log('\n✅ Login test successful!');
  console.log('📸 Screenshot saved: login-test.png');
});
