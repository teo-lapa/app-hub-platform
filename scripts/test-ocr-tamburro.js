const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('🧪 Test OCR con Tesseract.js + tamburro1241lapa.pdf');

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: {
      width: 1920,
      height: 1080
    }
  });

  const page = await browser.newPage();

  // Console logs
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('OCR') || text.includes('🔍') || text.includes('✅') || text.includes('📄')) {
      console.log('  BROWSER:', text);
    }
  });

  console.log('📂 Aprendo http://localhost:3004/pdf-analyzer...');

  await page.goto('http://localhost:3004/pdf-analyzer', {
    waitUntil: 'networkidle0',
    timeout: 15000
  });

  console.log('✅ Pagina caricata');
  console.log('📁 Caricando tamburro1241lapa.pdf...');

  // Aspetta che l'input file sia disponibile
  await page.waitForSelector('input[type="file"]', { timeout: 5000 });

  // Trova l'input file
  const fileInput = await page.$('input[type="file"]');

  if (!fileInput) {
    // Prova con un selettore alternativo
    const inputs = await page.$$('input');
    console.log(`Trovati ${inputs.length} input elements`);

    for (const input of inputs) {
      const type = await input.evaluate(el => el.type);
      console.log(`  - Input type: ${type}`);
    }

    throw new Error('Input file non trovato!');
  }

  // Carica il PDF
  const pdfPath = path.join('C:', 'Users', 'lapa', 'Downloads', 'tamburro1241lapa.pdf');

  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF non trovato: ${pdfPath}`);
  }

  await fileInput.uploadFile(pdfPath);

  console.log(`✅ PDF caricato: ${pdfPath}`);
  console.log('🔄 Cliccando "Analizza Tutti"...');

  // Aspetta un secondo per assicurarsi che il file sia caricato
  await page.waitForTimeout(1000);

  // Clicca il pulsante "Analizza Tutti"
  await page.click('button:has-text("Analizza")');

  console.log('⏳ Attendendo OCR...');

  // Aspetta fino a 120 secondi per il completamento dell'OCR
  let ocrCompleted = false;
  let attempts = 0;
  const maxAttempts = 120; // 120 secondi

  while (!ocrCompleted && attempts < maxAttempts) {
    await page.waitForTimeout(1000);
    attempts++;

    // Controlla se c'è un risultato (badge colorato con tipo documento)
    const resultFound = await page.evaluate(() => {
      const badges = document.querySelectorAll('[class*="bg-"]');
      for (const badge of badges) {
        const text = badge.textContent || '';
        if (text.includes('FATTURA') || text.includes('ORDINE') || text.includes('RICEVUTA') || text.includes('ALTRO')) {
          return true;
        }
      }
      return false;
    });

    // Controlla se c'è un errore
    const errorFound = await page.evaluate(() => {
      const body = document.body.textContent || '';
      return body.includes('ERRORE OCR') || body.includes('OCR fallito');
    });

    if (resultFound) {
      ocrCompleted = true;
      console.log('✅ OCR COMPLETATO!');

      // Estrai il risultato
      const result = await page.evaluate(() => {
        const body = document.body.textContent || '';

        // Trova il tipo di documento
        let docType = 'Unknown';
        const types = ['FATTURA', 'ORDINE', 'RICEVUTA', 'DDT', 'ALTRO'];
        for (const type of types) {
          if (body.includes(type)) {
            docType = type;
            break;
          }
        }

        // Trova la confidenza
        let confidence = body.match(/Confidenza:\s*(\d+)%/);
        confidence = confidence ? confidence[1] : 'Unknown';

        return { docType, confidence };
      });

      console.log('\n📊 RISULTATO:');
      console.log(`   Tipo documento: ${result.docType}`);
      console.log(`   Confidenza: ${result.confidence}%`);
      console.log('\n✅ TEST PASSATO! Tesseract.js funziona correttamente!\n');

      break;
    } else if (errorFound) {
      console.log('❌ ERRORE RILEVATO!');

      const errorMsg = await page.evaluate(() => {
        return document.body.textContent || '';
      });

      console.log('Dettagli errore:', errorMsg);
      throw new Error('OCR fallito');
    }

    if (attempts % 10 === 0) {
      console.log(`   ... ancora in attesa (${attempts}s)`);
    }
  }

  if (!ocrCompleted) {
    throw new Error('Timeout: OCR non completato in 120 secondi');
  }

  console.log('🎉 Test completato! Chiudo il browser tra 5 secondi...');
  await page.waitForTimeout(5000);

  await browser.close();

})().catch(err => {
  console.error('\n❌ TEST FALLITO:', err.message);
  console.error(err);
  process.exit(1);
});
