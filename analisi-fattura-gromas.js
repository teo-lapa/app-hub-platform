/**
 * Script per analizzare i prodotti della fattura GROMAS
 * e generare piano di azioni per sistemare TUTTO
 */

const fs = require('fs');

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_LOGIN = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

// Prodotti dalla fattura con analisi
const PRODOTTI_FATTURA = [
  { codice: '26425', descrizione: 'GUANTI NERI M NITRILE REFLEXX 100 PZ', pezzi_per_cartone: 0, tipo: 'SINGOLO', prezzo_fattura: 4.29 },
  { codice: '032133', descrizione: 'SECCHIO CON STRIZZATORE RETT 12LT ZIF', pezzi_per_cartone: 0, tipo: 'SINGOLO', prezzo_fattura: 2.64 },
  { codice: '09632', descrizione: 'NEOFORT RAPIDO LT 0.75X6 +1SP', pezzi_per_cartone: 6, tipo: 'CARTONE', prezzo_fattura: 17.52 },
  { codice: '09731', descrizione: 'PULIVAT CONF 750 ML X 6 PZ', pezzi_per_cartone: 6, tipo: 'CARTONE', prezzo_fattura: 18.48 },
  { codice: '09733', descrizione: 'UNI5 SOAP IGIENIZZANTE BIANCO MANI 5KGX4', pezzi_per_cartone: 4, tipo: 'CARTONE', prezzo_fattura: 19.55 },
  { codice: '11563', descrizione: 'PULIGEN DISINCROSTANTE FLAC 1LT X12', pezzi_per_cartone: 12, tipo: 'CARTONE', prezzo_fattura: 5.5 },
  { codice: '270420', descrizione: 'EQO PIATTI A MANO TAN KG 5X4 INTER', pezzi_per_cartone: 4, tipo: 'CARTONE', prezzo_fattura: 18.0 },
  { codice: '270421', descrizione: 'EQO PAVIMENTI ARANCIA-LIM KG 5X4 INTER', pezzi_per_cartone: 4, tipo: 'CARTONE', prezzo_fattura: 15.84 },
  { codice: '270423', descrizione: 'EQO BAGNO ANTICALCARE LT0.75X6+6SP INTER', pezzi_per_cartone: 6, tipo: 'CARTONE', prezzo_fattura: 11.22 },
  { codice: '270425', descrizione: 'EQO LAVASTOVIGLIE TAN KG 5.5 X 2 INTER', pezzi_per_cartone: 2, tipo: 'CARTONE', prezzo_fattura: 13.1 },
  { codice: '31128', descrizione: 'RICAMBIO MOP SINTETICO', pezzi_per_cartone: 0, tipo: 'SINGOLO', prezzo_fattura: 3.14 },
  { codice: '26424', descrizione: 'GUANTI NERI L NITRILE REFLEX 100 PZ', pezzi_per_cartone: 0, tipo: 'SINGOLO', prezzo_fattura: 4.29 },
  { codice: '50004', descrizione: 'PELLICOLA SUPERPACK 300 MT CHAMPAGNE BOX', pezzi_per_cartone: 0, tipo: 'SINGOLO', prezzo_fattura: 5.0 },
  { codice: '70114', descrizione: 'EFFICACE MULTIGEN IGIENIZZANTE 0.75LT X6', pezzi_per_cartone: 6, tipo: 'CARTONE', prezzo_fattura: 2.97 },
  { codice: '96855', descrizione: 'SACCHETTI CARTA BIANCO 14X30 B35 1000PZ', pezzi_per_cartone: 0, tipo: 'SINGOLO', prezzo_fattura: 19.25 },
  { codice: '39726', descrizione: 'ARGONIT AF/2 DISINFETTANTE LT0.75X6', pezzi_per_cartone: 6, tipo: 'CARTONE', prezzo_fattura: 19.8 },
  { codice: '31828', descrizione: 'VINCO AMMORBIDENTE M.BIANCO 5KG X4 INTER', pezzi_per_cartone: 4, tipo: 'CARTONE', prezzo_fattura: 7.7 },
  { codice: '270426', descrizione: 'EQO BRILLANTANTE TAN KG 5 X 2 INTER', pezzi_per_cartone: 2, tipo: 'CARTONE', prezzo_fattura: 15.08 },
  { codice: '411024', descrizione: 'POLIUNTO X2 GROMAS 800 STRAPPI', pezzi_per_cartone: 0, tipo: 'SINGOLO', prezzo_fattura: 6.55 },
  { codice: '26426', descrizione: 'GUANTI NERI S NITRILE REFLEXX 100 PZ', pezzi_per_cartone: 0, tipo: 'SINGOLO', prezzo_fattura: 4.29 },
  { codice: '26423', descrizione: 'GUANTI NERI XL NITRILE REFLEX 100 PZ', pezzi_per_cartone: 0, tipo: 'SINGOLO', prezzo_fattura: 4.29 },
  { codice: '270424', descrizione: 'EQO VETRI E MULT LT 0.75X6+6SP INTER', pezzi_per_cartone: 6, tipo: 'CARTONE', prezzo_fattura: 9.3 },
  { codice: '032123', descrizione: 'SPUGNA ZINCATA ACCIAIO 40GR x 25 pz ZIF', pezzi_per_cartone: 25, tipo: 'CARTONE', prezzo_fattura: 0.44 },
  { codice: '270422', descrizione: 'EQO SGRASSATORE LIM LT 0.75X6+6SP INTER', pezzi_per_cartone: 6, tipo: 'CARTONE', prezzo_fattura: 9.9 },
  { codice: '032120', descrizione: 'SCOPA CROMA ROSSO/NERO ZIF', pezzi_per_cartone: 0, tipo: 'SINGOLO', prezzo_fattura: 1.26 },
  { codice: '032124', descrizione: 'SPUGNA FIBRA 50PZ GROSSA ZIF', pezzi_per_cartone: 50, tipo: 'CARTONE', prezzo_fattura: 0.33 }
];

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

  console.log('✅ Autenticazione riuscita!\n');
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
  const partners = await callOdoo(cookies, 'res.partner', 'search_read', [[
    ['name', 'ilike', 'GROMAS']
  ]], {
    fields: ['id', 'name']
  });

  if (partners.length === 0) {
    throw new Error('Fornitore GROMAS non trovato');
  }

  return partners[0];
}

async function analyzeProduct(cookies, prodotto, gromasId) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📦 ANALISI: [${prodotto.codice}] ${prodotto.descrizione}`);
  console.log(`${'='.repeat(80)}\n`);

  // Cerca prodotto in Odoo per codice
  const products = await callOdoo(cookies, 'product.template', 'search_read', [[
    ['default_code', '=', prodotto.codice]
  ]], {
    fields: [
      'id',
      'name',
      'default_code',
      'uom_id',
      'uom_po_id',
      'standard_price',
      'list_price',
      'supplier_taxes_id',
      'taxes_id',
      'seller_ids'
    ]
  });

  if (products.length === 0) {
    console.log('❌ PRODOTTO NON TROVATO IN ODOO!');
    return {
      trovato: false,
      codice: prodotto.codice,
      azioni: ['PRODOTTO_NON_ESISTE']
    };
  }

  const product = products[0];
  console.log('✅ Prodotto trovato in Odoo');
  console.log(`   ID: ${product.id}`);
  console.log(`   Nome: ${product.name}\n`);

  // Leggi info fornitore
  let supplierInfo = null;
  if (product.seller_ids && product.seller_ids.length > 0) {
    const sellers = await callOdoo(cookies, 'product.supplierinfo', 'read', [product.seller_ids], {
      fields: ['id', 'partner_id', 'price', 'currency_id']
    });

    supplierInfo = sellers.find(s => s.partner_id && s.partner_id[0] === gromasId);
  }

  // COMPARAZIONE
  const azioni = [];
  const dettagli = {};

  console.log('📊 SITUAZIONE ATTUALE vs DESIDERATA:\n');

  // 1. UoM
  const uomVenditaAttuale = product.uom_id ? product.uom_id[1] : 'N/A';
  const uomAcquistoAttuale = product.uom_po_id ? product.uom_po_id[1] : 'N/A';

  const uomVenditaDesiderata = 'PZ';
  const uomAcquistoDesiderata = prodotto.tipo === 'CARTONE' ? 'CRT' : 'PZ';

  console.log(`   🏷️  UoM Vendita:`);
  console.log(`      ATTUALE: ${uomVenditaAttuale}`);
  console.log(`      DESIDERATA: ${uomVenditaDesiderata}`);

  if (uomVenditaAttuale !== uomVenditaDesiderata) {
    azioni.push('CAMBIA_UOM_VENDITA');
    dettagli.uom_vendita = { attuale: uomVenditaAttuale, desiderata: uomVenditaDesiderata };
    console.log(`      ❌ DA CAMBIARE!`);
  } else {
    console.log(`      ✅ OK`);
  }

  console.log(`\n   📦 UoM Acquisto:`);
  console.log(`      ATTUALE: ${uomAcquistoAttuale}`);
  console.log(`      DESIDERATA: ${uomAcquistoDesiderata}`);

  if (uomAcquistoAttuale !== uomAcquistoDesiderata) {
    azioni.push('CAMBIA_UOM_ACQUISTO');
    dettagli.uom_acquisto = { attuale: uomAcquistoAttuale, desiderata: uomAcquistoDesiderata };
    console.log(`      ❌ DA CAMBIARE!`);
  } else {
    console.log(`      ✅ OK`);
  }

  // 2. Costo
  const costoAttuale = product.standard_price;
  const costoDesiderato = prodotto.tipo === 'CARTONE'
    ? (prodotto.prezzo_fattura / prodotto.pezzi_per_cartone)
    : prodotto.prezzo_fattura;

  console.log(`\n   💰 Costo:`);
  console.log(`      ATTUALE: ${costoAttuale.toFixed(2)}€`);
  console.log(`      DESIDERATO: ${costoDesiderato.toFixed(2)}€ ${prodotto.tipo === 'CARTONE' ? `(${prodotto.prezzo_fattura}€ / ${prodotto.pezzi_per_cartone} pz)` : ''}`);

  if (Math.abs(costoAttuale - costoDesiderato) > 0.01) {
    azioni.push('AGGIORNA_COSTO');
    dettagli.costo = { attuale: costoAttuale, desiderato: costoDesiderato };
    console.log(`      ❌ DA AGGIORNARE!`);
  } else {
    console.log(`      ✅ OK`);
  }

  // 3. Imposte Acquisto
  const hasImposteAcquisto = product.supplier_taxes_id && product.supplier_taxes_id.length > 0;

  console.log(`\n   🧾 Imposte Acquisto:`);
  console.log(`      ATTUALE: ${hasImposteAcquisto ? 'SÌ (presenti)' : 'NO'}`);
  console.log(`      DESIDERATA: NO (import/export)`);

  if (hasImposteAcquisto) {
    azioni.push('RIMUOVI_IMPOSTE_ACQUISTO');
    console.log(`      ❌ DA RIMUOVERE!`);
  } else {
    console.log(`      ✅ OK`);
  }

  // 4. Valuta Fornitore
  if (supplierInfo) {
    const valutaAttuale = supplierInfo.currency_id ? supplierInfo.currency_id[1] : 'N/A';
    const valutaDesiderata = 'EUR';

    console.log(`\n   💶 Valuta Fornitore:`);
    console.log(`      ATTUALE: ${valutaAttuale}`);
    console.log(`      DESIDERATA: ${valutaDesiderata}`);

    if (valutaAttuale !== valutaDesiderata) {
      azioni.push('CAMBIA_VALUTA_FORNITORE');
      dettagli.valuta = { attuale: valutaAttuale, desiderata: valutaDesiderata };
      console.log(`      ❌ DA CAMBIARE!`);
    } else {
      console.log(`      ✅ OK`);
    }
  } else {
    console.log(`\n   ⚠️  Nessuna info fornitore GROMAS trovata`);
  }

  // 5. Packaging
  if (prodotto.tipo === 'CARTONE') {
    console.log(`\n   📦 Packaging:`);
    console.log(`      NECESSARIO: 1 CRT = ${prodotto.pezzi_per_cartone} PZ`);
    azioni.push('VERIFICA_PACKAGING');
    dettagli.packaging = { pezzi: prodotto.pezzi_per_cartone };
    console.log(`      ⚠️  DA VERIFICARE/CREARE`);
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log(`📋 AZIONI NECESSARIE: ${azioni.length > 0 ? azioni.length : 'NESSUNA (tutto OK!)'}`);
  if (azioni.length > 0) {
    azioni.forEach(a => console.log(`   • ${a}`));
  }
  console.log(`${'='.repeat(80)}\n`);

  return {
    trovato: true,
    codice: prodotto.codice,
    descrizione: prodotto.descrizione,
    tipo: prodotto.tipo,
    pezzi_per_cartone: prodotto.pezzi_per_cartone,
    odoo_id: product.id,
    odoo_name: product.name,
    azioni,
    dettagli,
    supplier_info_id: supplierInfo ? supplierInfo.id : null
  };
}

async function main() {
  try {
    const cookies = await authenticate();
    const gromas = await findGromas(cookies);

    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('     ANALISI PRODOTTI FATTURA GROMAS vs ODOO');
    console.log('═══════════════════════════════════════════════════════════════════\n');
    console.log(`📄 Fattura: 2715 del 30/10/2025`);
    console.log(`🏢 Fornitore: ${gromas.name} (ID: ${gromas.id})`);
    console.log(`📦 Prodotti da analizzare: ${PRODOTTI_FATTURA.length}\n`);

    const risultati = [];

    for (const prodotto of PRODOTTI_FATTURA) {
      const risultato = await analyzeProduct(cookies, prodotto, gromas.id);
      risultati.push(risultato);

      // Pausa per non sovraccaricare
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // RIEPILOGO FINALE
    console.log('\n\n');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('                    RIEPILOGO FINALE');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    const prodottiOK = risultati.filter(r => r.trovato && r.azioni.length === 0);
    const prodottiDaSistemare = risultati.filter(r => r.trovato && r.azioni.length > 0);
    const prodottiNonTrovati = risultati.filter(r => !r.trovato);

    console.log(`✅ Prodotti già OK: ${prodottiOK.length}`);
    console.log(`⚠️  Prodotti da sistemare: ${prodottiDaSistemare.length}`);
    console.log(`❌ Prodotti non trovati: ${prodottiNonTrovati.length}\n`);

    // Conta azioni per tipo
    const azioniPerTipo = {};
    risultati.forEach(r => {
      r.azioni.forEach(azione => {
        azioniPerTipo[azione] = (azioniPerTipo[azione] || 0) + 1;
      });
    });

    console.log('📊 AZIONI NECESSARIE:\n');
    Object.entries(azioniPerTipo).forEach(([azione, count]) => {
      console.log(`   • ${azione}: ${count} prodotti`);
    });

    // Salva report JSON
    const report = {
      data_analisi: new Date().toISOString(),
      fattura: '2715',
      fornitore: gromas.name,
      totale_prodotti: PRODOTTI_FATTURA.length,
      prodotti_ok: prodottiOK.length,
      prodotti_da_sistemare: prodottiDaSistemare.length,
      prodotti_non_trovati: prodottiNonTrovati.length,
      azioni_per_tipo: azioniPerTipo,
      dettaglio_prodotti: risultati
    };

    fs.writeFileSync('ANALISI_FATTURA_GROMAS.json', JSON.stringify(report, null, 2), 'utf8');
    console.log('\n✅ Report salvato: ANALISI_FATTURA_GROMAS.json');

    // Salva anche CSV con piano azioni
    const csvRows = risultati
      .filter(r => r.trovato && r.azioni.length > 0)
      .map(r => ({
        'Codice': r.codice,
        'Nome': r.descrizione,
        'Tipo': r.tipo,
        'Pezzi/Cartone': r.pezzi_per_cartone || '-',
        'ID Odoo': r.odoo_id,
        'Azioni': r.azioni.join(' | ')
      }));

    if (csvRows.length > 0) {
      const csvHeaders = Object.keys(csvRows[0]);
      const csvContent = [
        csvHeaders.join(','),
        ...csvRows.map(row =>
          csvHeaders.map(h => {
            const val = row[h];
            return typeof val === 'string' && val.includes(',') ? `"${val}"` : val;
          }).join(',')
        )
      ].join('\n');

      fs.writeFileSync('PIANO_AZIONI_FATTURA.csv', '\ufeff' + csvContent, 'utf8');
      console.log('✅ Piano azioni salvato: PIANO_AZIONI_FATTURA.csv');
    }

    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log('                    ANALISI COMPLETATA!');
    console.log('═══════════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ ERRORE:', error.message);
    process.exit(1);
  }
}

main();
