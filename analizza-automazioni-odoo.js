const xmlrpc = require('xmlrpc');

// Configurazione Odoo
const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_USERNAME = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

// Parse URL
const url = new URL(ODOO_URL);
const protocol = url.protocol === 'https:' ? 'https' : 'http';
const host = url.hostname;
const port = url.port || (protocol === 'https' ? 443 : 80);

// Client setup
const commonClient = xmlrpc.createSecureClient({
  host,
  port,
  path: '/xmlrpc/2/common',
});

const objectClient = xmlrpc.createSecureClient({
  host,
  port,
  path: '/xmlrpc/2/object',
});

// Helper per chiamate Odoo
function callOdoo(model, method, domain = [], fields = []) {
  return new Promise((resolve, reject) => {
    objectClient.methodCall(
      'execute_kw',
      [
        ODOO_DB,
        uid,
        ODOO_PASSWORD,
        model,
        method,
        domain,
        fields.length > 0 ? { fields } : {},
      ],
      (error, value) => {
        if (error) reject(error);
        else resolve(value);
      }
    );
  });
}

let uid;

async function authenticate() {
  return new Promise((resolve, reject) => {
    commonClient.methodCall(
      'authenticate',
      [ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD, {}],
      (error, value) => {
        if (error) reject(error);
        else resolve(value);
      }
    );
  });
}

async function main() {
  console.log('🔐 Autenticazione Odoo...\n');

  try {
    uid = await authenticate();
    console.log(`✅ Autenticato con UID: ${uid}\n`);

    console.log('=' .repeat(80));
    console.log('🤖 RICERCA AUTOMAZIONI CONTROLLO PREZZI');
    console.log('=' .repeat(80));
    console.log();

    // ============================================================
    // 1. SCHEDULED ACTIONS (ir.cron) - SKIPPED (requires admin)
    // ============================================================
    console.log('📅 1. SCHEDULED ACTIONS (ir.cron)');
    console.log('-'.repeat(80));
    console.log('   ⚠️  Skipped - richiede permessi admin');
    console.log('   ℹ️  L\'utente ha già fornito il codice dell\'automazione Python');

    // ============================================================
    // 2. AUTOMATED ACTIONS - SKIPPED (requires admin)
    // ============================================================
    console.log('\n\n⚡ 2. AUTOMATED ACTIONS (base.automation)');
    console.log('-'.repeat(80));
    console.log('   ⚠️  Skipped - richiede permessi admin');

    // ============================================================
    // 3. SERVER ACTIONS - SKIPPED (requires admin)
    // ============================================================
    console.log('\n\n🔧 3. SERVER ACTIONS (ir.actions.server)');
    console.log('-'.repeat(80));
    console.log('   ⚠️  Skipped - richiede permessi admin');

    // ============================================================
    // 4. PRODUCT PRICELIST ITEMS (regole attive)
    // ============================================================
    console.log('\n\n💰 4. REGOLE PRICELIST ATTIVE');
    console.log('-'.repeat(80));

    const pricelistItems = await callOdoo(
      'product.pricelist.item',
      'search_read',
      [[
        ['compute_price', '=', 'fixed'],
        ['pricelist_id', '!=', false],
      ]],
      ['id', 'pricelist_id', 'product_id', 'product_tmpl_id', 'applied_on', 'fixed_price', 'compute_price']
    );

    console.log(`   📊 Totale regole fixed price: ${pricelistItems.length}`);

    // Raggruppa per listino
    const byPricelist = {};
    pricelistItems.forEach(item => {
      const pricelistName = item.pricelist_id[1];
      if (!byPricelist[pricelistName]) {
        byPricelist[pricelistName] = [];
      }
      byPricelist[pricelistName].push(item);
    });

    console.log(`\n   📋 Breakdown per Listino:`);
    Object.entries(byPricelist).forEach(([name, items]) => {
      const variantRules = items.filter(i => i.applied_on === '0_product_variant').length;
      const templateRules = items.filter(i => i.applied_on === '1_product').length;
      console.log(`      • ${name}: ${items.length} regole (${variantRules} variant, ${templateRules} template)`);
    });

    // ============================================================
    // 5. CUSTOM MODELS - SKIPPED (requires admin)
    // ============================================================
    console.log('\n\n📦 5. MODELLI CUSTOM');
    console.log('-'.repeat(80));
    console.log('   ⚠️  Skipped - richiede permessi admin');

    // ============================================================
    // 6. WEBHOOKS - SKIPPED (requires admin)
    // ============================================================
    console.log('\n\n🌐 6. WEBHOOK / EXTERNAL API');
    console.log('-'.repeat(80));
    console.log('   ⚠️  Skipped - richiede permessi admin');

    // ============================================================
    // SUMMARY
    // ============================================================
    console.log('\n\n' + '='.repeat(80));
    console.log('📊 RIEPILOGO FINALE');
    console.log('='.repeat(80));
    console.log('\n✅ DATI RACCOLTI:');
    console.log(`   • Pricelist Items (fixed price): ${pricelistItems.length}`);
    console.log(`   • Listini unici: ${Object.keys(byPricelist).length}`);
    console.log('\n⚠️  SEZIONI SKIPPATE (permessi admin richiesti):');
    console.log('   • Scheduled Actions (ir.cron)');
    console.log('   • Automated Actions (base.automation)');
    console.log('   • Server Actions (ir.actions.server)');
    console.log('   • Custom Models (ir.model)');
    console.log('   • Webhooks');
    console.log('\nℹ️  AUTOMAZIONE PYTHON FORNITA DALL\'UTENTE:');
    console.log('   • Script che analizza fatture in bozza');
    console.log('   • Confronta prezzi vendita vs ultima fattura convalidata');
    console.log('   • Identifica anomalie: prezzi zero, margini alti, duplicati');
    console.log('   • Crea task in Project Management con emoji (🆕📈📉🔥🤔😊)');
    console.log('   • Progetto ID: 86');

    console.log('\n\n✨ Analisi completata!\n');

  } catch (error) {
    console.error('❌ Errore:', error.message);
    process.exit(1);
  }
}

main();
