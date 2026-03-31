import { test, type Page, type ConsoleMessage } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const BASE_URL = process.env.TEST_URL || 'https://www.socialfly.io'
const EMAIL = 'erik@dropfly.io'
const PASSWORD = 'Falcons2025!'

interface PageError {
  page: string
  type: 'console' | 'response' | 'crash'
  message: string
}

const allErrors: PageError[] = []

// Create a test image file for uploads
function createTestImage(): string {
  const tmpPath = path.join('/tmp', 'test-upload.jpg')
  if (!fs.existsSync(tmpPath)) {
    // Minimal valid JPEG (1x1 white pixel)
    const jpegBytes = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
      0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
      0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
      0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
      0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
      0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
      0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
      0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
      0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
      0x09, 0x0a, 0x0b, 0xff, 0xc4, 0x00, 0xb5, 0x10, 0x00, 0x02, 0x01, 0x03,
      0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7d,
      0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06,
      0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xa1, 0x08,
      0x23, 0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0, 0x24, 0x33, 0x62, 0x72,
      0x82, 0x09, 0x0a, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28,
      0x29, 0x2a, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45,
      0x46, 0x47, 0x48, 0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
      0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x73, 0x74, 0x75,
      0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
      0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3,
      0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6,
      0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9,
      0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1, 0xe2,
      0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2, 0xf3, 0xf4,
      0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01,
      0x00, 0x00, 0x3f, 0x00, 0x7b, 0x94, 0x11, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff,
      0xd9,
    ])
    fs.writeFileSync(tmpPath, jpegBytes)
  }
  return tmpPath
}

function startErrorCollector(page: Page, pageName: string) {
  const pageErrors: PageError[] = []

  const consoleHandler = (msg: ConsoleMessage) => {
    if (msg.type() === 'error') {
      const text = msg.text()
      if (text.includes('favicon.ico') || text.includes('React DevTools') || text.includes('Download the React') || text.includes('hydrat')) return
      pageErrors.push({ page: pageName, type: 'console', message: text.slice(0, 300) })
    }
  }
  page.on('console', consoleHandler)

  const responseHandler = (response: { status: () => number; url: () => string }) => {
    const status = response.status()
    const url = response.url()
    if (status >= 500 && !url.includes('favicon')) {
      pageErrors.push({ page: pageName, type: 'response', message: `${status} ${url.replace(BASE_URL, '')}` })
    }
  }
  page.on('response', responseHandler)

  return {
    stop: () => {
      page.off('console', consoleHandler)
      page.off('response', responseHandler)
      allErrors.push(...pageErrors)
      return pageErrors
    },
  }
}

function logPageResult(name: string, errs: PageError[]) {
  if (errs.length > 0) {
    console.log(`  ERRORS (${errs.length}):`)
    errs.forEach((e) => console.log(`    [${e.type}] ${e.message}`))
  } else {
    console.log('  OK')
  }
}

test.describe('Full Smoke Test', () => {
  test.setTimeout(300000) // 5 minutes

  let page: Page
  const testImagePath = createTestImage()

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage()
    // Login
    await page.goto(`${BASE_URL}/auth/login`)
    await page.getByRole('textbox', { name: 'Email' }).fill(EMAIL)
    await page.getByRole('textbox', { name: 'Password' }).fill(PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.waitForURL('**/dashboard', { timeout: 15000 })
    console.log('--- Logged in ---\n')
  })

  test.afterAll(async () => {
    console.log('\n\n========== FULL SMOKE TEST RESULTS ==========')
    console.log(`Total errors: ${allErrors.length}`)
    if (allErrors.length > 0) {
      const byPage: Record<string, PageError[]> = {}
      for (const e of allErrors) {
        if (!byPage[e.page]) byPage[e.page] = []
        byPage[e.page].push(e)
      }
      for (const [pageName, errs] of Object.entries(byPage)) {
        console.log(`\n  ${pageName}:`)
        errs.forEach((e) => console.log(`    [${e.type}] ${e.message}`))
      }
    } else {
      console.log('ALL PAGES CLEAN!')
    }
    console.log('==============================================\n')
    await page.close()
  })

  test('Dashboard', async () => {
    console.log('\nDashboard')
    const c = startErrorCollector(page, 'Dashboard')
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle', timeout: 20000 })
    await page.waitForTimeout(2000)
    logPageResult('Dashboard', c.stop())
  })

  test('Brand — view and analyze', async () => {
    console.log('\nBrand')
    const c = startErrorCollector(page, 'Brand')
    await page.goto(`${BASE_URL}/brand`, { waitUntil: 'networkidle', timeout: 20000 })
    await page.waitForTimeout(2000)

    // Try clicking "Enter your website URL" or brand setup
    const setupLink = page.locator('a[href="/brand/setup"]').first()
    if (await setupLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await setupLink.click()
      await page.waitForTimeout(2000)
    }
    logPageResult('Brand', c.stop())
  })

  test('Content — list page', async () => {
    console.log('\nContent List')
    const c = startErrorCollector(page, 'Content List')
    await page.goto(`${BASE_URL}/content`, { waitUntil: 'networkidle', timeout: 20000 })
    await page.waitForTimeout(2000)
    logPageResult('Content List', c.stop())
  })

  test('Content Create — Photo tab (generate image)', async () => {
    console.log('\nContent Create (Photo)')
    const c = startErrorCollector(page, 'Content Create (Photo)')
    await page.goto(`${BASE_URL}/content/create?type=photo`, { waitUntil: 'networkidle', timeout: 20000 })
    await page.waitForTimeout(1000)

    // Fill in prompt
    const promptInput = page.locator('textarea').first()
    if (await promptInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await promptInput.fill('A beautiful sunset over the ocean, professional photo')
      await page.waitForTimeout(500)
    }

    // Try selecting platforms — click any platform checkbox/button visible
    const igButton = page.locator('button:has-text("Instagram"), label:has-text("Instagram")').first()
    if (await igButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await igButton.click().catch(() => {})
    }

    logPageResult('Content Create (Photo)', c.stop())
  })

  test('Content Create — Video tab', async () => {
    console.log('\nContent Create (Video)')
    const c = startErrorCollector(page, 'Content Create (Video)')
    await page.goto(`${BASE_URL}/content/create?type=video`, { waitUntil: 'networkidle', timeout: 20000 })
    await page.waitForTimeout(1000)
    logPageResult('Content Create (Video)', c.stop())
  })

  test('Content Create — Caption tab', async () => {
    console.log('\nContent Create (Caption)')
    const c = startErrorCollector(page, 'Content Create (Caption)')
    await page.goto(`${BASE_URL}/content/create?type=caption`, { waitUntil: 'networkidle', timeout: 20000 })
    await page.waitForTimeout(1000)

    // Try uploading a file
    const fileInput = page.locator('input[type="file"]').first()
    if (await fileInput.count() > 0) {
      await fileInput.setInputFiles(testImagePath)
      await page.waitForTimeout(3000) // Wait for upload
    }

    // Fill context
    const contextInput = page.locator('textarea, input[placeholder*="escribe"], #caption-context').first()
    if (await contextInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await contextInput.fill('Team photo at our product launch event')
    }

    logPageResult('Content Create (Caption)', c.stop())
  })

  test('Media Library — view and upload', async () => {
    console.log('\nMedia Library')
    const c = startErrorCollector(page, 'Media Library')
    await page.goto(`${BASE_URL}/media`, { waitUntil: 'networkidle', timeout: 20000 })
    await page.waitForTimeout(2000)

    // Try upload
    const fileInput = page.locator('input[type="file"]').first()
    if (await fileInput.count() > 0) {
      await fileInput.setInputFiles(testImagePath)
      await page.waitForTimeout(4000) // Wait for upload + refresh
    }

    logPageResult('Media Library', c.stop())
  })

  test('Schedule — view calendar', async () => {
    console.log('\nSchedule')
    const c = startErrorCollector(page, 'Schedule')
    await page.goto(`${BASE_URL}/schedule`, { waitUntil: 'networkidle', timeout: 20000 })
    await page.waitForTimeout(2000)

    // Click calendar navigation buttons if visible
    const nextBtn = page.locator('button:has(svg)').filter({ hasText: '' }).nth(1)
    if (await nextBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await nextBtn.click().catch(() => {})
      await page.waitForTimeout(500)
    }

    logPageResult('Schedule', c.stop())
  })

  test('Campaigns — view and create', async () => {
    console.log('\nCampaigns')
    const c = startErrorCollector(page, 'Campaigns')
    await page.goto(`${BASE_URL}/campaigns`, { waitUntil: 'networkidle', timeout: 20000 })
    await page.waitForTimeout(2000)

    // Try creating a campaign
    const createBtn = page.locator('button:has-text("Create"), button:has-text("New Campaign")').first()
    if (await createBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await createBtn.click()
      await page.waitForTimeout(1500)

      // Fill campaign form if dialog appeared
      const nameInput = page.locator('input[placeholder*="ampaign"], input[name="name"]').first()
      if (await nameInput.isVisible({ timeout: 1500 }).catch(() => false)) {
        await nameInput.fill('Smoke Test Campaign')

        // Try to submit
        const submitBtn = page.locator('button:has-text("Create"), button:has-text("Save")').last()
        if (await submitBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await submitBtn.click()
          await page.waitForTimeout(2000)
        }
      }
    }

    logPageResult('Campaigns', c.stop())
  })

  test('Templates — view and create', async () => {
    console.log('\nTemplates')
    const c = startErrorCollector(page, 'Templates')
    await page.goto(`${BASE_URL}/templates`, { waitUntil: 'networkidle', timeout: 20000 })
    await page.waitForTimeout(2000)

    // Try creating a template
    const createBtn = page.locator('button:has-text("Create"), button:has-text("New Template")').first()
    if (await createBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await createBtn.click()
      await page.waitForTimeout(1500)

      // Fill template form
      const nameInput = page.locator('input[placeholder*="emplate"], input[name="name"]').first()
      if (await nameInput.isVisible({ timeout: 1500 }).catch(() => false)) {
        await nameInput.fill('Smoke Test Template')

        const submitBtn = page.locator('button:has-text("Create"), button:has-text("Save")').last()
        if (await submitBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await submitBtn.click()
          await page.waitForTimeout(2000)
        }
      }
    }

    logPageResult('Templates', c.stop())
  })

  test('Automations — view and create', async () => {
    console.log('\nAutomations')
    const c = startErrorCollector(page, 'Automations')
    await page.goto(`${BASE_URL}/automations`, { waitUntil: 'networkidle', timeout: 20000 })
    await page.waitForTimeout(2000)

    // Try creating an automation
    const createBtn = page.locator('a[href="/automations/create"], button:has-text("Create"), button:has-text("New")').first()
    if (await createBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await createBtn.click()
      await page.waitForURL('**/automations/create', { timeout: 5000 }).catch(() => {})
      await page.waitForTimeout(2000)
    }

    logPageResult('Automations', c.stop())
  })

  test('Automations Create page', async () => {
    console.log('\nAutomations Create')
    const c = startErrorCollector(page, 'Automations Create')
    await page.goto(`${BASE_URL}/automations/create`, { waitUntil: 'networkidle', timeout: 20000 })
    await page.waitForTimeout(2000)

    // Try filling out automation form
    const nameInput = page.locator('input[placeholder*="utomation"], input[name="name"], input').first()
    if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await nameInput.fill('Smoke Test Automation')
    }

    logPageResult('Automations Create', c.stop())
  })

  test('Analytics', async () => {
    console.log('\nAnalytics')
    const c = startErrorCollector(page, 'Analytics')
    await page.goto(`${BASE_URL}/analytics`, { waitUntil: 'networkidle', timeout: 20000 })
    await page.waitForTimeout(2000)

    // Switch time ranges
    const tabs = ['7d', '30d', '90d']
    for (const tab of tabs) {
      const tabBtn = page.locator(`button:has-text("${tab}"), [role="tab"]:has-text("${tab}")`).first()
      if (await tabBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await tabBtn.click()
        await page.waitForTimeout(1000)
      }
    }

    logPageResult('Analytics', c.stop())
  })

  test('Platforms', async () => {
    console.log('\nPlatforms')
    const c = startErrorCollector(page, 'Platforms')
    await page.goto(`${BASE_URL}/platforms`, { waitUntil: 'networkidle', timeout: 20000 })
    await page.waitForTimeout(2000)

    // Click Sync All
    const syncBtn = page.locator('button:has-text("Sync")').first()
    if (await syncBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await syncBtn.click()
      await page.waitForTimeout(2000)
    }

    logPageResult('Platforms', c.stop())
  })

  test('Settings — Profile tab', async () => {
    console.log('\nSettings (Profile)')
    const c = startErrorCollector(page, 'Settings (Profile)')
    await page.goto(`${BASE_URL}/settings?tab=profile`, { waitUntil: 'networkidle', timeout: 20000 })
    await page.waitForTimeout(2000)
    logPageResult('Settings (Profile)', c.stop())
  })

  test('Settings — Billing tab', async () => {
    console.log('\nSettings (Billing)')
    const c = startErrorCollector(page, 'Settings (Billing)')
    await page.goto(`${BASE_URL}/settings?tab=billing`, { waitUntil: 'networkidle', timeout: 20000 })
    await page.waitForTimeout(3000) // Extra time for billing data fetch
    logPageResult('Settings (Billing)', c.stop())
  })

  test('Settings — Notifications tab', async () => {
    console.log('\nSettings (Notifications)')
    const c = startErrorCollector(page, 'Settings (Notifications)')
    await page.goto(`${BASE_URL}/settings?tab=notifications`, { waitUntil: 'networkidle', timeout: 20000 })
    await page.waitForTimeout(1500)
    logPageResult('Settings (Notifications)', c.stop())
  })

  test('Pricing page', async () => {
    console.log('\nPricing')
    const c = startErrorCollector(page, 'Pricing')
    await page.goto(`${BASE_URL}/pricing`, { waitUntil: 'networkidle', timeout: 20000 })
    await page.waitForTimeout(1500)

    // Toggle yearly
    const yearlyBtn = page.locator('button:has-text("Yearly")').first()
    if (await yearlyBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await yearlyBtn.click()
      await page.waitForTimeout(500)
    }

    // Toggle back to monthly
    const monthlyBtn = page.locator('button:has-text("Monthly")').first()
    if (await monthlyBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await monthlyBtn.click()
      await page.waitForTimeout(500)
    }

    logPageResult('Pricing', c.stop())
  })
})
