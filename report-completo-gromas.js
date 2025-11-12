/**
 * Script per creare un report completo dei prodotti GROMAS
 * con tutti i problemi da sistemare
 */

const fs = require('fs');

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_LOGIN = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

async function authenticate() {
  console.log('🔐 Autenticazione con Odoo...');

  const response = await fetch(`${ODOO_URL}/web/session/authenticate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      params: {
        db: ODOO_DB,
        login: ODOO_LOGIN,
        password: ODOO_PASSWORD
      }
    })
  });

  const data = await response.json();

  if (data.error) {
    throw new Error('Autenticazione fallita: ' + JSON.stringify(data.error));
  }

  const setCookie = response.headers.get('set-cookie');
  const sessionMatch = setCookie?.match(/session_id=([^;]+)/);

  if (!sessionMatch) {
    throw new Error('Nessun session_id ricevuto');
  }

  console.log('✅ Autenticazione riuscita!');
  return `session_id=${sessionMatch[1]}`;
}

async function callOdoo(cookies, model, method, args = [], kwargs = {}) {
  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookies
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model,
        method,
        args,
        kwargs
      },
      id: Math.floor(Math.random() * 1000000000)
    })
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`Errore ${model}.${method}: ${JSON.stringify(data.error)}`);
  }

  return data.result;
}

async function findGromas(cookies) {
  console.log('🔍 Ricerca fornitore GROMAS...');

  const partners = await callOdoo(cookies, 'res.partner', 'search_read', [[
    ['name', 'ilike', 'GROMAS']
  ]], {
    fields: ['id', 'name']
  });

  if (partners.length === 0) {
    throw new Error('Fornitore GROMAS non trovato');
  }

  console.log('✅ Fornitore trovato:', partners[0].name);
  return partners[0];
}

async function generateCompleteReport(cookies, gromasId) {
  console.log('\n📦 Generazione report completo...\n');

  // Cerca tutte le righe supplierinfo di GROMAS
  const supplierInfos = await callOdoo(cookies, 'product.supplierinfo', 'search_read', [[
    ['partner_id', '=', gromasId]
  ]], {
    fields: ['id', 'product_tmpl_id', 'product_name', 'product_code', 'price', 'currency_id', 'min_qty'],
    limit: 1000
  });

  console.log(`✅ Trovate ${supplierInfos.length} righe fornitore\n`);

  // Raccogliamo tutti i product_tmpl_id unici
  const templateIds = [...new Set(supplierInfos.map(s => s.product_tmpl_id ? s.product_tmpl_id[0] : null).filter(Boolean))];

  // Leggi tutti i template
  const templates = await callOdoo(cookies, 'product.template', 'read', [templateIds], {
    fields: [
      'id',
      'name',
      'default_code',
      'uom_id',
      'uom_po_id',
      'standard_price',
      'list_price',
      'categ_id',
      'supplier_taxes_id',
      'taxes_id',
      'active',
      'packaging_ids'
    ]
  });

  console.log(`✅ Trovati ${templates.length} prodotti unici\n`);

  // Prepara dati per CSV
  const csvData = [];
  const problemi = [];

  for (const template of templates) {
    const supplierInfo = supplierInfos.find(s => s.product_tmpl_id && s.product_tmpl_id[0] === template.id);

    const uomVendita = template.uom_id ? template.uom_id[1] : 'N/A';
    const uomAcquisto = template.uom_po_id ? template.uom_po_id[1] : 'N/A';
    const valutaFornitore = supplierInfo && supplierInfo.currency_id ? supplierInfo.currency_id[1] : 'N/A';
    const prezzoFornitore = supplierInfo ? supplierInfo.price : 'N/A';
    const imposteAcquisto = template.supplier_taxes_id && template.supplier_taxes_id.length > 0 ? 'SÌ' : 'NO';
    const imposteVendita = template.taxes_id && template.taxes_id.length > 0 ? 'SÌ' : 'NO';

    // Packaging info
    const hasPackaging = template.packaging_ids && template.packaging_ids.length > 0 ? 'SÌ' : 'NO';
    const packagingCount = template.packaging_ids ? template.packaging_ids.length : 0;

    // Identifica problemi
    const problemiProdotto = [];

    if (template.supplier_taxes_id && template.supplier_taxes_id.length > 0) {
      problemiProdotto.push('RIMUOVI_IMPOSTE_ACQUISTO');
    }

    if (valutaFornitore === 'CHF') {
      problemiProdotto.push('VALUTA_CHF->EUR');
    }

    if (uomVendita === 'PZ' && uomAcquisto === 'PZ') {
      problemiProdotto.push('VERIFICA_UOM');
    }

    // Problema: manca imballaggio
    if (!template.packaging_ids || template.packaging_ids.length === 0) {
      if (uomAcquisto === 'CRT' || uomAcquisto === 'CARTONE' || uomAcquisto === 'CONF6' || uomAcquisto.includes('CRT')) {
        problemiProdotto.push('AGGIUNGI_PACKAGING');
      }
    }

    const row = {
      'ID Template': template.id,
      'Codice': template.default_code || 'NO-CODE',
      'Nome Prodotto': template.name,
      'Categoria': template.categ_id ? template.categ_id[1] : 'N/A',
      'UoM Vendita': uomVendita,
      'UoM Acquisto': uomAcquisto,
      'Ha Imballaggio?': hasPackaging,
      'N° Imballaggi': packagingCount,
      'Costo': template.standard_price.toFixed(2),
      'Prezzo Vendita': template.list_price.toFixed(2),
      'Prezzo Fornitore': prezzoFornitore,
      'Valuta Fornitore': valutaFornitore,
      'Imposte Vendita': imposteVendita,
      'Imposte Acquisto': imposteAcquisto,
      'Attivo': template.active ? 'SÌ' : 'NO',
      'PROBLEMI': problemiProdotto.join(' | '),
      'Azioni Necessarie': problemiProdotto.length > 0 ? 'DA SISTEMARE' : 'OK'
    };

    csvData.push(row);

    if (problemiProdotto.length > 0) {
      problemi.push({
        id: template.id,
        codice: template.default_code,
        nome: template.name,
        problemi: problemiProdotto,
        packaging: hasPackaging
      });
    }
  }

  // Salva CSV
  const csvHeaders = Object.keys(csvData[0]);
  const csvRows = csvData.map(row =>
    csvHeaders.map(header => {
      const value = row[header];
      // Escape virgolette e wrappa in virgolette se contiene virgole o newline
      if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(',')
  );

  const csvContent = [csvHeaders.join(','), ...csvRows].join('\n');

  const csvFilename = 'REPORT_PRODOTTI_GROMAS.csv';
  fs.writeFileSync(csvFilename, '\ufeff' + csvContent, 'utf8'); // BOM per Excel

  console.log(`✅ CSV salvato: ${csvFilename}\n`);

  // Salva anche un report testuale dettagliato
  let reportText = '═══════════════════════════════════════════════════════════════════\n';
  reportText += '           REPORT COMPLETO PRODOTTI GROMAS\n';
  reportText += '═══════════════════════════════════════════════════════════════════\n\n';
  reportText += `Data: ${new Date().toLocaleString('it-IT')}\n`;
  reportText += `Fornitore: GROMAS s.r.l.\n`;
  reportText += `Totale prodotti: ${templates.length}\n`;
  reportText += `Prodotti con problemi: ${problemi.length}\n\n`;

  reportText += '═══════════════════════════════════════════════════════════════════\n';
  reportText += '                    RIEPILOGO PROBLEMI\n';
  reportText += '═══════════════════════════════════════════════════════════════════\n\n';

  const problemiPerTipo = {
    'RIMUOVI_IMPOSTE_ACQUISTO': 0,
    'VALUTA_CHF->EUR': 0,
    'VERIFICA_UOM': 0,
    'AGGIUNGI_PACKAGING': 0
  };

  problemi.forEach(p => {
    p.problemi.forEach(tipo => {
      problemiPerTipo[tipo]++;
    });
  });

  reportText += '📊 STATISTICHE:\n\n';
  reportText += `   • Imposte acquisto da rimuovere:  ${problemiPerTipo['RIMUOVI_IMPOSTE_ACQUISTO']} prodotti\n`;
  reportText += `   • Valuta CHF da cambiare in EUR:  ${problemiPerTipo['VALUTA_CHF->EUR']} prodotti\n`;
  reportText += `   • UoM da verificare (PZ→CRT?):    ${problemiPerTipo['VERIFICA_UOM']} prodotti\n`;
  reportText += `   • Imballaggio da aggiungere:      ${problemiPerTipo['AGGIUNGI_PACKAGING']} prodotti\n\n`;

  reportText += '═══════════════════════════════════════════════════════════════════\n';
  reportText += '              ELENCO DETTAGLIATO PRODOTTI CON PROBLEMI\n';
  reportText += '═══════════════════════════════════════════════════════════════════\n\n';

  problemi.forEach((p, index) => {
    reportText += `${index + 1}. [${p.codice || 'NO-CODE'}] ${p.nome}\n`;
    reportText += `   ID: ${p.id}\n`;
    reportText += `   Problemi: ${p.problemi.join(', ')}\n\n`;
  });

  reportText += '\n═══════════════════════════════════════════════════════════════════\n';
  reportText += '                      AZIONI CONSIGLIATE\n';
  reportText += '═══════════════════════════════════════════════════════════════════\n\n';

  reportText += '1. IMPOSTE ACQUISTO:\n';
  reportText += '   → Rimuovere imposte acquisto da TUTTI i prodotti GROMAS\n';
  reportText += '   → Motivo: Import/export - IVA gestita separatamente\n\n';

  reportText += '2. VALUTA:\n';
  reportText += '   → Cambiare da CHF a EUR per tutti i prezzi fornitore\n';
  reportText += '   → I prezzi sono già corretti, serve solo cambiare valuta\n\n';

  reportText += '3. UNITÀ DI MISURA:\n';
  reportText += '   → Verificare quali prodotti vendono a PEZZO ma acquistano a CARTONE\n';
  reportText += '   → Creare/usare UoM "CRT" dove necessario\n';
  reportText += '   → Esempio: NEOFORT (già fatto) - compra CRT, vende PZ\n\n';

  reportText += '4. IMBALLAGGI (PACKAGING):\n';
  reportText += '   → Aggiungere imballaggio "CARTONE" per prodotti con UoM acquisto CRT\n';
  reportText += '   → Specificare quantità per cartone (es: 6 pezzi per NEOFORT)\n';
  reportText += '   → Questo aiuta nella logistica e gestione ordini\n\n';

  reportText += '═══════════════════════════════════════════════════════════════════\n';

  const txtFilename = 'REPORT_PRODOTTI_GROMAS.txt';
  fs.writeFileSync(txtFilename, reportText, 'utf8');

  console.log(`✅ Report testuale salvato: ${txtFilename}\n`);

  // Summary finale
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('                    REPORT COMPLETATO!');
  console.log('═══════════════════════════════════════════════════════════════════\n');
  console.log(`📄 File generati:\n`);
  console.log(`   1. ${csvFilename} (per Excel)`);
  console.log(`   2. ${txtFilename} (report dettagliato)\n`);
  console.log(`📊 Statistiche:\n`);
  console.log(`   • Totale prodotti:                ${templates.length}`);
  console.log(`   • Prodotti con problemi:          ${problemi.length}`);
  console.log(`   • Imposte acquisto da rimuovere:  ${problemiPerTipo['RIMUOVI_IMPOSTE_ACQUISTO']}`);
  console.log(`   • Valute da sistemare (CHF→EUR):  ${problemiPerTipo['VALUTA_CHF->EUR']}`);
  console.log(`   • UoM da verificare:              ${problemiPerTipo['VERIFICA_UOM']}`);
  console.log('\n═══════════════════════════════════════════════════════════════════\n');

  return { csvData, problemi, templates };
}

async function main() {
  try {
    const cookies = await authenticate();
    const gromas = await findGromas(cookies);
    await generateCompleteReport(cookies, gromas.id);

    console.log('✅ Tutti i report sono stati generati con successo!');
    console.log('\n💡 PROSSIMI PASSI:');
    console.log('   1. Aprire i file CSV e TXT per verificare');
    console.log('   2. Controllare tutti i prodotti nella lista');
    console.log('   3. Confermare quali sistemare');
    console.log('   4. Eseguire lo script di correzione automatica\n');

  } catch (error) {
    console.error('\n❌ ERRORE:', error.message);
    process.exit(1);
  }
}

main();
