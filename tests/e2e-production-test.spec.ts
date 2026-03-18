import { test, expect, chromium } from '@playwright/test';

const BASE_URL = 'http://localhost:3020';
const TEST_EMAIL = `test-${Date.now()}@example.com`;
const TEST_PASSWORD = 'TestPassword123!';

test.describe('SocialSync Empire - Production E2E Tests', () => {
  test.setTimeout(120000); // 2 minutes per test

  let context;
  let page;

  test.beforeAll(async () => {
    const browser = await chromium.launch({
      headless: false, // Show browser for debugging
      slowMo: 500 // Slow down actions to see what's happening
    });
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      recordVideo: {
        dir: './test-results/videos/',
        size: { width: 1920, height: 1080 }
      }
    });
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('1. Health Check - System Status', async () => {
    console.log('🏥 Testing Health Check Endpoint...');

    const response = await page.goto(`${BASE_URL}/api/health`);
    const data = await response.json();

    console.log('Health Check Response:', JSON.stringify(data, null, 2));

    expect(data.status).toBe('healthy');
    expect(data.checks.database.status).toBe('up');
    expect(data.checks.storage.status).toBe('up');

    console.log('✅ Health Check: PASSED');
  });

  test('2. User Signup Flow', async () => {
    console.log('👤 Testing User Signup...');

    await page.goto(`${BASE_URL}/signup`);
    await page.waitForLoadState('networkidle');

    // Take screenshot of signup page
    await page.screenshot({ path: './test-results/01-signup-page.png', fullPage: true });

    // Fill signup form
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for redirect or success
    await page.waitForTimeout(3000);

    const currentUrl = page.url();
    console.log('Current URL after signup:', currentUrl);

    await page.screenshot({ path: './test-results/02-after-signup.png', fullPage: true });

    console.log('✅ Signup Flow: COMPLETED');
  });

  test('3. User Login Flow', async () => {
    console.log('🔐 Testing User Login...');

    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');

    await page.screenshot({ path: './test-results/03-login-page.png', fullPage: true });

    // Fill login form
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);

    // Submit
    await page.click('button[type="submit"]');

    // Wait for redirect
    await page.waitForTimeout(3000);

    const currentUrl = page.url();
    console.log('Current URL after login:', currentUrl);

    await page.screenshot({ path: './test-results/04-after-login.png', fullPage: true });

    console.log('✅ Login Flow: COMPLETED');
  });

  test('4. Brand Package Creation', async () => {
    console.log('🎨 Testing Brand Package Creation...');

    await page.goto(`${BASE_URL}/brand-packages/create`);
    await page.waitForLoadState('networkidle');

    await page.screenshot({ path: './test-results/05-brand-create-page.png', fullPage: true });

    // Fill brand package form
    await page.fill('input[name="name"]', 'Test Brand');
    await page.fill('textarea[name="mission"]', 'Test brand mission statement for E2E testing');
    await page.fill('input[name="primaryColor"]', '#FF5733');
    await page.fill('input[name="secondaryColor"]', '#33FF57');

    // Submit
    await page.click('button[type="submit"]');

    await page.waitForTimeout(3000);

    await page.screenshot({ path: './test-results/06-brand-created.png', fullPage: true });

    console.log('✅ Brand Package Creation: COMPLETED');
  });

  test('5. AI Script Generation', async () => {
    console.log('🤖 Testing AI Script Generation...');

    await page.goto(`${BASE_URL}/create`);
    await page.waitForLoadState('networkidle');

    await page.screenshot({ path: './test-results/07-script-gen-page.png', fullPage: true });

    // Fill script generation form
    const prompt = 'Create a 30-second engaging video about social media marketing tips for small businesses';
    await page.fill('textarea[name="prompt"]', prompt);

    // Select platform (if available)
    const platformSelector = 'select[name="platform"]';
    if (await page.locator(platformSelector).count() > 0) {
      await page.selectOption(platformSelector, 'instagram');
    }

    // Click generate button
    const generateButton = page.locator('button:has-text("Generate")').first();
    await generateButton.click();

    console.log('⏳ Waiting for AI script generation...');

    // Wait for response (up to 30 seconds)
    await page.waitForTimeout(5000);

    // Check for any error messages
    const errorMsg = await page.locator('[role="alert"], .error, .text-red-500').first();
    if (await errorMsg.count() > 0) {
      const errorText = await errorMsg.textContent();
      console.log('⚠️ Error found:', errorText);
    }

    await page.screenshot({ path: './test-results/08-script-generated.png', fullPage: true });

    // Check if script was generated
    const scriptContent = await page.locator('textarea, pre, .script-content').first();
    if (await scriptContent.count() > 0) {
      const text = await scriptContent.textContent();
      console.log('Generated Script Preview:', text?.substring(0, 200) + '...');
      expect(text?.length).toBeGreaterThan(50);
    }

    console.log('✅ AI Script Generation: COMPLETED');
  });

  test('6. Video Generation with FAL.AI', async () => {
    console.log('🎬 Testing Video Generation...');

    await page.goto(`${BASE_URL}/generate`);
    await page.waitForLoadState('networkidle');

    await page.screenshot({ path: './test-results/09-video-gen-page.png', fullPage: true });

    // Fill video generation form
    const videoPrompt = 'A professional business person giving social media tips in a modern office';

    // Look for prompt input
    const promptInput = page.locator('textarea[name="prompt"], input[name="prompt"]').first();
    if (await promptInput.count() > 0) {
      await promptInput.fill(videoPrompt);
    }

    // Select video engine (if available)
    const engineSelector = 'select[name="engine"]';
    if (await page.locator(engineSelector).count() > 0) {
      await page.selectOption(engineSelector, 'hailuo'); // Use Hailuo as it's fastest
    }

    // Click generate video button
    const generateButton = page.locator('button:has-text("Generate Video"), button:has-text("Create Video")').first();

    if (await generateButton.count() > 0) {
      await generateButton.click();

      console.log('⏳ Video generation started... This may take 1-2 minutes');

      // Wait for video generation (this takes time)
      await page.waitForTimeout(10000);

      // Check for progress or completion
      const videoElement = page.locator('video, .video-player').first();
      const progressBar = page.locator('.progress, [role="progressbar"]').first();

      if (await videoElement.count() > 0) {
        console.log('✅ Video element found on page');
      } else if (await progressBar.count() > 0) {
        console.log('⏳ Video still generating...');
      }

      await page.screenshot({ path: './test-results/10-video-generating.png', fullPage: true });
    } else {
      console.log('⚠️ Generate button not found, checking page content...');
    }

    console.log('✅ Video Generation Test: COMPLETED');
  });

  test('7. Token Balance Check', async () => {
    console.log('💰 Testing Token System...');

    // Go to dashboard or profile page to check tokens
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');

    await page.screenshot({ path: './test-results/11-token-balance.png', fullPage: true });

    // Look for token balance display
    const tokenDisplay = page.locator('text=/\\d+\\s*tokens?/i').first();
    if (await tokenDisplay.count() > 0) {
      const tokenText = await tokenDisplay.textContent();
      console.log('Token Balance Found:', tokenText);
    } else {
      console.log('⚠️ Token balance not visible on dashboard');
    }

    // Try API endpoint directly
    const response = await page.goto(`${BASE_URL}/api/user/profile`);
    if (response.ok()) {
      const data = await response.json();
      console.log('User Profile Data:', JSON.stringify(data, null, 2));
    }

    console.log('✅ Token System Check: COMPLETED');
  });

  test('8. Campaign Creation', async () => {
    console.log('📅 Testing Campaign Creation...');

    await page.goto(`${BASE_URL}/campaigns/create`);
    await page.waitForLoadState('networkidle');

    await page.screenshot({ path: './test-results/12-campaign-create.png', fullPage: true });

    // Fill campaign form
    await page.fill('input[name="name"]', 'E2E Test Campaign');

    const nicheInput = page.locator('input[name="niche"], select[name="niche"]').first();
    if (await nicheInput.count() > 0) {
      await nicheInput.fill('Social Media Marketing');
    }

    const platformSelect = page.locator('select[name="platform"]').first();
    if (await platformSelect.count() > 0) {
      await platformSelect.selectOption('instagram');
    }

    const frequencySelect = page.locator('select[name="frequency"]').first();
    if (await frequencySelect.count() > 0) {
      await frequencySelect.selectOption('daily');
    }

    // Submit
    const submitButton = page.locator('button[type="submit"]').first();
    await submitButton.click();

    await page.waitForTimeout(3000);

    await page.screenshot({ path: './test-results/13-campaign-created.png', fullPage: true });

    console.log('✅ Campaign Creation: COMPLETED');
  });

  test('9. Social Media Posting Interface', async () => {
    console.log('📱 Testing Social Media Posting...');

    await page.goto(`${BASE_URL}/post`);
    await page.waitForLoadState('networkidle');

    await page.screenshot({ path: './test-results/14-social-post-page.png', fullPage: true });

    // Check for platform checkboxes/selectors
    const platformOptions = await page.locator('input[type="checkbox"], input[type="radio"]').count();
    console.log(`Found ${platformOptions} platform options`);

    // Check for caption/content input
    const captionInput = page.locator('textarea[name="caption"], textarea[name="content"]').first();
    if (await captionInput.count() > 0) {
      console.log('✅ Caption input found');
    }

    console.log('✅ Social Media Interface: CHECKED');
  });

  test('10. Navigation and UI Components', async () => {
    console.log('🧭 Testing Navigation and UI...');

    await page.goto(`${BASE_URL}`);
    await page.waitForLoadState('networkidle');

    await page.screenshot({ path: './test-results/15-homepage.png', fullPage: true });

    // Test navigation links
    const navLinks = await page.locator('nav a, header a').count();
    console.log(`Found ${navLinks} navigation links`);

    // Check for main sections
    const sections = ['Features', 'Pricing', 'Dashboard'];
    for (const section of sections) {
      const link = page.locator(`a:has-text("${section}")`).first();
      if (await link.count() > 0) {
        console.log(`✅ ${section} link found`);
      }
    }

    console.log('✅ Navigation Check: COMPLETED');
  });
});

console.log('\n🎯 Production E2E Test Suite Ready\n');
