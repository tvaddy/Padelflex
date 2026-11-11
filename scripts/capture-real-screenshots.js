const fs = require('fs');
const path = require('path');
const { chromium } = require('/root/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core');

async function run() {
  console.log('--- CAPTURING AUTHENTIC APP SCREENSHOTS ---');
  const screenshotsDir = path.join(process.cwd(), 'public', 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const browser = await chromium.launch({
    executablePath: '/ms-playwright/chromium-1254/chrome-linux64/chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  // Mobile Context (Modern smartphone viewport: 412x915, 2x scale)
  const mobileContext = await browser.newContext({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  });

  const page = await mobileContext.newPage();
  
  await page.goto('http://127.0.0.1:3000', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('padelflex_access_code_v1', 'test');
    localStorage.setItem('padelflex_token_v1', 'test:token');
    localStorage.setItem('padelflex_lang', 'en'); // Capture in English for GitHub README
  });

  console.log('Navigating to app with English locale & test profile...');
  await page.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // If login form is shown, submit 'test'
  const content = await page.content();
  if (content.includes('Sign in') || content.includes('Logg inn') || content.includes('ACCESS CODE') || content.includes('TILGANGSKODE')) {
    const input = await page.$('input');
    if (input) {
      await input.fill('test');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
    }
  }

  await page.waitForTimeout(1000);

  // The 6 tabs in navbar:
  // nth(0) = Match
  // nth(1) = Tournament
  // nth(2) = Leagues
  // nth(3) = History
  // nth(4) = Players
  // nth(5) = Help

  // 1. Capture Live Tournament (Mobile)
  console.log('Capturing real screenshot 1: Live Tournament (tournament-live.png)...');
  await page.locator('.grid.grid-cols-3 button').nth(1).click();
  await page.waitForTimeout(800);
  
  await page.screenshot({
    path: path.join(screenshotsDir, 'tournament-live.png'),
    fullPage: false
  });
  console.log('✓ Successfully saved real tournament-live.png');

  // 2. Capture League Standings (Mobile)
  console.log('Capturing real screenshot 2: League Standings (leagues-standings.png)...');
  await page.locator('.grid.grid-cols-3 button').nth(2).click();
  await page.waitForTimeout(800);

  await page.screenshot({
    path: path.join(screenshotsDir, 'leagues-standings.png'),
    fullPage: false
  });
  console.log('✓ Successfully saved real leagues-standings.png');

  // 3. Open Result Card Modal and capture real share card
  console.log('Capturing real screenshot 3: Social Result Card (social-share-card.png)...');
  await page.locator('.grid.grid-cols-3 button').nth(1).click();
  await page.waitForTimeout(800);

  // Find share button
  const shareBtn = page.locator('button:has-text("Share Result"), button:has-text("Del resultat"), button:has-text("Share card"), button:has-text("Del kort")').first();
  if (await shareBtn.count() > 0) {
    console.log('Clicking share button to open real ResultCardModal...');
    await shareBtn.click();
    await page.waitForTimeout(1000);

    const cardEl = page.locator('div[class*="bg-gradient-to-br from-[#0f110d]"]').first();
    if (await cardEl.count() > 0) {
      await cardEl.screenshot({
        path: path.join(screenshotsDir, 'social-share-card.png')
      });
      console.log('✓ Successfully saved real social-share-card.png (isolated card element)');
    } else {
      await page.screenshot({
        path: path.join(screenshotsDir, 'social-share-card.png'),
        fullPage: false
      });
      console.log('✓ Successfully saved real social-share-card.png (viewport screenshot)');
    }

    // Close modal
    const closeBtn = page.locator('button[aria-label="Close"], button[aria-label="Lukk"], button:has-text("✕")').first();
    if (await closeBtn.count() > 0) {
      await closeBtn.click().catch(() => {});
      await page.waitForTimeout(400);
    }
  } else {
    console.warn('Share button not found on tournament screen.');
  }

  // 4. Capture Desktop View (1280x800)
  console.log('Capturing real screenshot 4: Desktop Overview (desktop-tournament.png)...');
  const desktopContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2
  });
  const dtPage = await desktopContext.newPage();
  await dtPage.goto('http://127.0.0.1:3000', { waitUntil: 'domcontentloaded' });
  await dtPage.evaluate(() => {
    localStorage.setItem('padelflex_access_code_v1', 'test');
    localStorage.setItem('padelflex_token_v1', 'test:token');
    localStorage.setItem('padelflex_lang', 'en');
  });
  await dtPage.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle' });
  await dtPage.waitForTimeout(1000);

  const dtContent = await dtPage.content();
  if (dtContent.includes('Sign in') || dtContent.includes('Logg inn') || dtContent.includes('ACCESS CODE') || dtContent.includes('TILGANGSKODE')) {
    const input = await dtPage.$('input');
    if (input) {
      await input.fill('test');
      await dtPage.keyboard.press('Enter');
      await dtPage.waitForTimeout(2000);
    }
  }

  // Click Tournament tab on desktop
  await dtPage.locator('button:has-text("Tournament"), button:has-text("Turnering")').first().click().catch(() => {});
  await dtPage.waitForTimeout(800);

  await dtPage.screenshot({
    path: path.join(screenshotsDir, 'desktop-tournament.png'),
    fullPage: false
  });
  console.log('✓ Successfully saved real desktop-tournament.png');

  await browser.close();
  console.log('ALL AUTHENTIC SCREENSHOTS CAPTURED SUCCESSFULLY!');
}

run().catch((err) => {
  console.error('Capture failed with error:', err);
  process.exit(1);
});
