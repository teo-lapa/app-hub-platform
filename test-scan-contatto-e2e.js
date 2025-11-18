/**
 * TEST END-TO-END - SCAN CONTATTO
 * Simula il flusso completo: upload immagine -> estrazione dati -> salvataggio Odoo
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

// Configurazione
const API_BASE_URL = 'https://app-hub-platform-awwgha9lx-teo-lapas-projects.vercel.app';
const TEST_IMAGE_URL = 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800'; // Business card example

// Colori per console
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Step 1: Usa immagine di test locale
async function downloadTestImage() {
  log('\n[1/4] Caricamento immagine di test...', 'cyan');

  const testFile = path.join(__dirname, 'test-business-card-real.jpg');

  if (!fs.existsSync(testFile)) {
    throw new Error(`File di test non trovato: ${testFile}`);
  }

  log(`✓ Immagine trovata: ${testFile}`, 'green');
  log(`  Dimensione: ${(fs.statSync(testFile).size / 1024).toFixed(2)} KB`, 'bright');

  return testFile;
}

// Step 2: Chiama API scan-contatto
async function scanContact(imagePath) {
  log('\n[2/4] Invio immagine a /api/scan-contatto...', 'cyan');

  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', fs.createReadStream(imagePath));

    const options = {
      method: 'POST',
      host: 'app-hub-platform-awwgha9lx-teo-lapas-projects.vercel.app',
      path: '/api/scan-contatto',
      headers: form.getHeaders()
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const result = JSON.parse(data);

          if (res.statusCode === 200 && result.success) {
            log(`✓ Status: ${res.statusCode}`, 'green');
            log(`✓ Contact data ricevuto:`, 'green');
            log(`  - Nome: ${result.data.contact.name || 'N/A'}`, 'bright');
            log(`  - Email: ${result.data.contact.email || 'N/A'}`, 'bright');
            log(`  - Telefono: ${result.data.contact.phone || 'N/A'}`, 'bright');
            log(`  - Azienda: ${result.data.contact.company_name || 'N/A'}`, 'bright');
            resolve(result.data.contact);
          } else {
            log(`✗ Status: ${res.statusCode}`, 'red');
            log(`✗ Errore: ${JSON.stringify(result, null, 2)}`, 'red');
            reject(new Error(result.error || 'Scan failed'));
          }
        } catch (err) {
          log(`✗ Parse error: ${err.message}`, 'red');
          log(`Raw response: ${data}`, 'yellow');
          reject(err);
        }
      });
    });

    req.on('error', (err) => {
      log(`✗ Request error: ${err.message}`, 'red');
      reject(err);
    });

    form.pipe(req);
  });
}

// Step 3: Salva in Odoo
async function saveToOdoo(contactData) {
  log('\n[3/4] Salvataggio contatto in Odoo...', 'cyan');

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(contactData);

    const options = {
      method: 'POST',
      host: 'app-hub-platform-awwgha9lx-teo-lapas-projects.vercel.app',
      path: '/api/scan-contatto/save',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const result = JSON.parse(data);

          if (res.statusCode === 200 && result.success) {
            log(`✓ Status: ${res.statusCode}`, 'green');
            log(`✓ Contatto creato in Odoo!`, 'green');
            log(`  - ID Odoo: ${result.contact.id}`, 'bright');
            log(`  - Nome: ${result.contact.display_name}`, 'bright');
            log(`  - Link: https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com/web#id=${result.contact.id}&model=res.partner`, 'cyan');
            resolve(result.contact);
          } else {
            log(`✗ Status: ${res.statusCode}`, 'red');
            log(`✗ Errore: ${JSON.stringify(result, null, 2)}`, 'red');
            reject(new Error(result.error || 'Save failed'));
          }
        } catch (err) {
          log(`✗ Parse error: ${err.message}`, 'red');
          log(`Raw response: ${data}`, 'yellow');
          reject(err);
        }
      });
    });

    req.on('error', (err) => {
      log(`✗ Request error: ${err.message}`, 'red');
      reject(err);
    });

    req.write(postData);
    req.end();
  });
}

// Step 4: Verifica in Odoo (usando Python script)
async function verifyInOdoo(odooId) {
  log('\n[4/4] Verifica contatto in Odoo...', 'cyan');

  return new Promise((resolve, reject) => {
    const { exec } = require('child_process');

    const pythonScript = `
import xmlrpc.client, ssl
ssl._create_default_https_context = ssl._create_unverified_context

CONFIG = {
    'url': 'https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com',
    'db': 'lapadevadmin-lapa-v2-staging-2406-25408900',
    'username': 'paul@lapa.ch',
    'password': 'lapa201180'
}

common = xmlrpc.client.ServerProxy(f"{CONFIG['url']}/xmlrpc/2/common")
uid = common.authenticate(CONFIG['db'], CONFIG['username'], CONFIG['password'], {})
models = xmlrpc.client.ServerProxy(f"{CONFIG['url']}/xmlrpc/2/object")

contact = models.execute_kw(
    CONFIG['db'], uid, CONFIG['password'],
    'res.partner', 'read',
    [${odooId}],
    {'fields': ['id', 'name', 'display_name', 'email', 'phone', 'mobile', 'vat', 'street', 'city']}
)

if contact:
    c = contact[0]
    print(f"FOUND: {c['display_name']}")
    print(f"Email: {c.get('email', 'N/A')}")
    print(f"Phone: {c.get('phone', 'N/A')}")
else:
    print("NOT_FOUND")
`;

    exec(`python3 -c "${pythonScript.replace(/"/g, '\\"')}"`, (error, stdout, stderr) => {
      if (error) {
        log(`✗ Errore verifica: ${stderr}`, 'red');
        reject(error);
        return;
      }

      if (stdout.includes('FOUND:')) {
        log(`✓ Contatto verificato in Odoo!`, 'green');
        log(stdout, 'bright');
        resolve(true);
      } else {
        log(`✗ Contatto NON trovato in Odoo`, 'red');
        reject(new Error('Contact not found in Odoo'));
      }
    });
  });
}

// Main test execution
async function runE2ETest() {
  log('\n' + '='.repeat(80), 'bright');
  log('TEST END-TO-END - SCAN CONTATTO', 'bright');
  log('='.repeat(80), 'bright');

  const startTime = Date.now();
  let imagePath = null;
  let contactData = null;
  let odooContact = null;

  try {
    // Step 1: Download test image
    imagePath = await downloadTestImage();

    // Step 2: Scan contact from image
    contactData = await scanContact(imagePath);

    // Step 3: Save to Odoo
    odooContact = await saveToOdoo(contactData);

    // Step 4: Verify in Odoo
    await verifyInOdoo(odooContact.id);

    // SUCCESS
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    log('\n' + '='.repeat(80), 'green');
    log('✓✓✓ TEST COMPLETATO CON SUCCESSO! ✓✓✓', 'green');
    log('='.repeat(80), 'green');
    log(`Durata totale: ${duration}s`, 'bright');
    log(`Contatto ID Odoo: ${odooContact.id}`, 'bright');
    log(`Link Odoo: https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com/web#id=${odooContact.id}&model=res.partner`, 'cyan');

    // Nessun cleanup necessario - usiamo file di test fisso
    process.exit(0);

  } catch (error) {
    // FAILURE
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    log('\n' + '='.repeat(80), 'red');
    log('✗✗✗ TEST FALLITO ✗✗✗', 'red');
    log('='.repeat(80), 'red');
    log(`Errore: ${error.message}`, 'red');
    log(`Durata: ${duration}s`, 'bright');

    // Nessun cleanup necessario - usiamo file di test fisso
    process.exit(1);
  }
}

// Run test
runE2ETest();
