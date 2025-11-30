const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  await page.goto('http://localhost:3000/jetson-ocr', { waitUntil: 'networkidle0' });

  await page.screenshot({ path: 'jetson-hub-screenshot.png', fullPage: true });

  console.log('Screenshot salvato: jetson-hub-screenshot.png');

  // Aspetta 5 secondi così puoi vedere la pagina
  // REMOVED SLEEP - closes immediately

  await browser.close();
})();
