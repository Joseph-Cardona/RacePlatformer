const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium' });
  const page = await browser.newPage();
  
  const consoleMessages = [];
  page.on('console', msg => {
    console.log(`PAGE LOG: ${msg.text()}`);
    consoleMessages.push(msg.text());
  });

  await page.goto('http://localhost:5173/');
  
  // Wait a bit to ensure potential logs appear
  await page.waitForTimeout(5000);
  
  console.log('--- CONSOLE OUTPUT ---');
  console.log(consoleMessages);
  
  await page.screenshot({ path: 'screenshot.png' });
  await browser.close();
})();
