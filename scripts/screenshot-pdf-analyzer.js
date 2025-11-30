const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: {
      width: 1920,
      height: 1080
    }
  });

  const page = await browser.newPage();

  console.log('Opening http://localhost:3004/pdf-analyzer...');

  await page.goto('http://localhost:3004/pdf-analyzer', {
    waitUntil: 'networkidle0',
    timeout: 10000
  });

  console.log('Page loaded! Browser window is open.');
  console.log('Press Ctrl+C to close when done.');

  // Keep browser open
  // REMOVED SLEEP - await new Promise(() => {}); // Wait until Ctrl+C // 5 minutes

})().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
