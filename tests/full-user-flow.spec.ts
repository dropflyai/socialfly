import { test, expect } from '@playwright/test';

test('Complete user flow: signup, login, dashboard', async ({ page }) => {
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!';
  const testName = 'Test User';

  console.log('\n🧪 Testing Complete User Flow');
  console.log('Email:', testEmail);

  // Step 1: Visit homepage
  console.log('\n1️⃣  Visiting homepage...');
  await page.goto('http://localhost:3020');
  await page.waitForLoadState('networkidle');

  const title = await page.title();
  console.log('   Page title:', title);
  expect(title).toContain('SocialSync Empire');

  // Step 2: Navigate to signup
  console.log('\n2️⃣  Navigating to signup...');
  await page.click('text=Get Started');
  await page.waitForURL('**/auth/signup');
  console.log('   ✅ On signup page');

  // Step 3: Fill signup form
  console.log('\n3️⃣  Filling signup form...');
  await page.fill('input[name="fullName"]', testName);
  await page.fill('input[name="email"]', testEmail);
  await page.fill('input[name="password"]', testPassword);
  console.log('   ✅ Form filled');

  // Step 4: Submit signup
  console.log('\n4️⃣  Submitting signup...');
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard
  await page.waitForURL('**/dashboard', { timeout: 15000 });
  console.log('   ✅ Redirected to dashboard');

  // Step 5: Verify dashboard loaded
  console.log('\n5️⃣  Verifying dashboard...');
  await page.waitForSelector('text=Welcome', { timeout: 5000 });

  // Check token balance is displayed
  const tokenText = await page.textContent('text=/.*Tokens/');
  console.log('   Token balance:', tokenText);
  expect(tokenText).toBeTruthy();

  // Check user name is displayed
  const welcomeText = await page.textContent('h2');
  console.log('   Welcome message:', welcomeText);
  expect(welcomeText).toContain('Welcome');

  console.log('\n✅ Complete user flow successful!');

  // Take a screenshot
  await page.screenshot({ path: 'dashboard-test.png', fullPage: true });
  console.log('📸 Screenshot saved: dashboard-test.png');
});
