import { test, expect } from '@playwright/test';

test('Check homepage and take screenshot', async ({ page }) => {
  console.log('\n📸 Checking homepage...');

  // Go to homepage
  await page.goto('http://localhost:3020');
  await page.waitForLoadState('networkidle');

  // Take screenshot
  await page.screenshot({ path: 'homepage-screenshot.png', fullPage: true });

  // Log page title and URL
  const title = await page.title();
  console.log('Page title:', title);
  console.log('Page URL:', page.url());

  // Get all buttons and links
  const buttons = await page.locator('button').allTextContents();
  const links = await page.locator('a').allTextContents();

  console.log('Buttons on page:', buttons);
  console.log('Links on page:', links);

  console.log('✅ Screenshot saved as homepage-screenshot.png');
});
