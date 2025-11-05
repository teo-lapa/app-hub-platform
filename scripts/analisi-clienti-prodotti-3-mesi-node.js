#!/usr/bin/env node
/**
 * ANALISI CLIENTI E PRODOTTI - ULTIMI 3 MESI
 * ==========================================
 * Analisi dettagliata degli ordini consegnati per:
 * 1. Clienti che hanno comprato meno (analisi settimanale e mensile)
 * 2. Prodotti che hanno diminuito il fatturato (analisi settimanale e mensile)
 */

const fs = require('fs');
const path = require('path');

// Configurazione Odoo
const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_USERNAME = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

// ========================================
// UTILITY: Calcola periodi
// ========================================
function calcolaPeriodi() {
  const oggi = new Date();
  const treMesiFa = new Date();
  treMesiFa.setDate(oggi.getDate() - 90);

  // Settimane
  const settimane = [];
  for (let i = 0; i < 12; i++) {
    const fineSett = new Date();
    fineSett.setDate(oggi.getDate() - (i * 7));
    const inizioSett = new Date(fineSett);
    inizioSett.setDate(fineSett.getDate() - 7);

    settimane.push({
      nome: `Settimana ${12 - i}`,
      inizio: inizioSett.toISOString().split('T')[0],
      fine: fineSett.toISOString().split('T')[0]
    });
  }

  // Mesi
  const mesi = [];
  for (let i = 0; i < 3; i++) {
    const fineMese = new Date();
    fineMese.setDate(oggi.getDate() - (i * 30));
    const inizioMese = new Date(fineMese);
    inizioMese.setDate(fineMese.getDate() - 30);

    mesi.push({
      nome: `Mese ${3 - i}`,
      inizio: inizioMese.toISOString().split('T')[0],
      fine: fineMese.toISOString().split('T')[0]
    });
  }

  return {
    settimane: settimane.reverse(),
    mesi: mesi.reverse(),
    inizioTotale: treMesiFa.toISOString().split('T')[0],
    fineTotale: oggi.toISOString().split('T')[0]
  };
}

// ========================================
// AUTENTICAZIONE ODOO
// ========================================
async function autenticaOdoo() {
  console.log('\n' + '='.repeat(60));
  console.log('🔌 CONNESSIONE AD ODOO');
  console.log('='.repeat(60));
  console.log(`URL:  ${ODOO_URL}`);
  console.log(`DB:   ${ODOO_DB}`);
  console.log(`User: ${ODOO_USERNAME}`);

  const response = await fetch(`${ODOO_URL}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      params: {
        db: ODOO_DB,
        login: ODOO_USERNAME,
        password: ODOO_PASSWORD
      }
    })
  });

  const result = await response.json();

  if (!result.result || !result.result.uid) {
    throw new Error('Autenticazione fallita!');
  }

  console.log(`✅ Autenticato con UID: ${result.result.uid}`);

  return {
    uid: result.result.uid,
    sessionId: result.result.session_id,
    cookies: response.headers.get('set-cookie')
  };
}

// ========================================
// CHIAMATA RPC GENERICA
// ========================================
async function chiamataOdoo(session, model, method, args, kwargs = {}) {
  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': session.cookies || ''
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model,
        method,
        args,
        kwargs
      }
    })
  });

  const result = await response.json();

  if (result.error) {
    throw new Error(`Errore Odoo: ${JSON.stringify(result.error)}`);
  }

  return result.result;
}

// ========================================
// ESTRAZIONE ORDINI CONSEGNATI
// ========================================
async function estraiOrdiniConsegnati(session, dataInizio, dataFine) {
  console.log(`\n📦 Estrazione ordini consegnati dal ${dataInizio} al ${dataFine}`);

  // 1. Cerca ordini confermati
  const ordini = await chiamataOdoo(
    session,
    'sale.order',
    'search_read',
    [[
      ['state', 'in', ['sale', 'done']],
      ['date_order', '>=', dataInizio],
      ['date_order', '<=', dataFine]
    ]],
    {
      fields: ['id', 'name', 'partner_id', 'date_order', 'amount_total', 'picking_ids', 'order_line'],
      limit: 2000
    }
  );

  console.log(`   Trovati ${ordini.length} ordini confermati`);

  // 2. Filtra solo ordini con consegne completate
  const ordiniConsegnati = [];

  for (let i = 0; i < ordini.length; i++) {
    const ordine = ordini[i];

    if (i % 50 === 0) {
      console.log(`   Verificate consegne: ${i}/${ordini.length} ordini...`);
    }

    if (ordine.picking_ids && ordine.picking_ids.length > 0) {
      try {
        const pickings = await chiamataOdoo(
          session,
          'stock.picking',
          'search_read',
          [[['id', 'in', ordine.picking_ids]]],
          { fields: ['state'] }
        );

        const consegnate = pickings.filter(p => p.state === 'done').length;
        if (consegnate > 0) {
          ordiniConsegnati.push(ordine);
        }
      } catch (err) {
        console.error(`   ⚠️  Errore verifica picking per ordine ${ordine.id}: ${err.message}`);
      }
    }
  }

  console.log(`   ✅ ${ordiniConsegnati.length} ordini con consegne completate`);
  return ordiniConsegnati;
}

// ========================================
// ESTRAZIONE DETTAGLI PRODOTTI
// ========================================
async function estraiDettagliOrdini(session, ordini) {
  console.log(`\n📋 Estrazione dettagli prodotti da ${ordini.length} ordini`);

  const dettagli = [];

  for (let i = 0; i < ordini.length; i++) {
    const ordine = ordini[i];

    if (i % 20 === 0) {
      console.log(`   Processati ${i}/${ordini.length} ordini...`);
    }

    if (!ordine.order_line || ordine.order_line.length === 0) {
      continue;
    }

    try {
      const righe = await chiamataOdoo(
        session,
        'sale.order.line',
        'search_read',
        [[['id', 'in', ordine.order_line]]],
        {
          fields: ['product_id', 'product_uom_qty', 'price_unit', 'price_subtotal', 'qty_delivered']
        }
      );

      for (const riga of righe) {
        if (riga.qty_delivered > 0) {
          dettagli.push({
            ordineId: ordine.id,
            ordineName: ordine.name,
            clienteId: ordine.partner_id ? ordine.partner_id[0] : null,
            clienteName: ordine.partner_id ? ordine.partner_id[1] : 'Sconosciuto',
            dataOrdine: ordine.date_order.split(' ')[0],
            prodottoId: riga.product_id ? riga.product_id[0] : null,
            prodottoName: riga.product_id ? riga.product_id[1] : 'Sconosciuto',
            quantita: riga.qty_delivered,
            prezzoUnitario: riga.price_unit,
            totale: riga.price_subtotal
          });
        }
      }
    } catch (err) {
      console.error(`   ⚠️  Errore righe ordine ${ordine.id}: ${err.message}`);
    }
  }

  console.log(`   ✅ Estratti ${dettagli.length} righe prodotti consegnati`);
  return dettagli;
}

// ========================================
// ANALISI CLIENTI
// ========================================
function analizzaClienti(dettagli, periodi) {
  console.log('\n' + '='.repeat(60));
  console.log('👥 ANALISI CLIENTI PER PERIODO');
  console.log('='.repeat(60));

  const risultati = {
    settimanale: [],
    mensile: [],
    confrontoGlobale: {}
  };

  // Analisi settimanale
  console.log('\n📊 Analisi Settimanale:');
  for (const settimana of periodi.settimane) {
    const venditeClienti = {};

    for (const d of dettagli) {
      if (d.dataOrdine >= settimana.inizio && d.dataOrdine <= settimana.fine) {
        venditeClienti[d.clienteName] = (venditeClienti[d.clienteName] || 0) + d.totale;
      }
    }

    const clientiOrdinati = Object.entries(venditeClienti).sort((a, b) => a[1] - b[1]);

    risultati.settimanale.push({
      periodo: settimana.nome,
      date: `${settimana.inizio} / ${settimana.fine}`,
      top10Meno: clientiOrdinati.slice(0, 10),
      totaleClienti: clientiOrdinati.length
    });

    console.log(`\n   ${settimana.nome} (${settimana.inizio} / ${settimana.fine})`);
    console.log(`   Totale clienti attivi: ${clientiOrdinati.length}`);
    if (clientiOrdinati.length > 0) {
      console.log(`   Top 3 che hanno comprato meno:`);
      for (let i = 0; i < Math.min(3, clientiOrdinati.length); i++) {
        console.log(`      ${i + 1}. ${clientiOrdinati[i][0]}: €${clientiOrdinati[i][1].toFixed(2)}`);
      }
    }
  }

  // Analisi mensile
  console.log('\n📊 Analisi Mensile:');
  for (const mese of periodi.mesi) {
    const venditeClienti = {};

    for (const d of dettagli) {
      if (d.dataOrdine >= mese.inizio && d.dataOrdine <= mese.fine) {
        venditeClienti[d.clienteName] = (venditeClienti[d.clienteName] || 0) + d.totale;
      }
    }

    const clientiOrdinati = Object.entries(venditeClienti).sort((a, b) => a[1] - b[1]);

    risultati.mensile.push({
      periodo: mese.nome,
      date: `${mese.inizio} / ${mese.fine}`,
      top10Meno: clientiOrdinati.slice(0, 10),
      totaleClienti: clientiOrdinati.length
    });

    console.log(`\n   ${mese.nome} (${mese.inizio} / ${mese.fine})`);
    console.log(`   Totale clienti attivi: ${clientiOrdinati.length}`);
    if (clientiOrdinati.length > 0) {
      console.log(`   Top 5 che hanno comprato meno:`);
      for (let i = 0; i < Math.min(5, clientiOrdinati.length); i++) {
        console.log(`      ${i + 1}. ${clientiOrdinati[i][0]}: €${clientiOrdinati[i][1].toFixed(2)}`);
      }
    }
  }

  // Confronto globale
  const venditeTotali = {};
  for (const d of dettagli) {
    venditeTotali[d.clienteName] = (venditeTotali[d.clienteName] || 0) + d.totale;
  }

  const clientiOrdinati = Object.entries(venditeTotali).sort((a, b) => a[1] - b[1]);
  risultati.confrontoGlobale = {
    top20Meno: clientiOrdinati.slice(0, 20),
    totaleClienti: clientiOrdinati.length
  };

  console.log(`\n📊 Confronto Globale (3 mesi):`);
  console.log(`   Totale clienti attivi: ${clientiOrdinati.length}`);
  console.log(`   Top 10 che hanno comprato meno:`);
  for (let i = 0; i < Math.min(10, clientiOrdinati.length); i++) {
    console.log(`      ${i + 1}. ${clientiOrdinati[i][0]}: €${clientiOrdinati[i][1].toFixed(2)}`);
  }

  return risultati;
}

// ========================================
// ANALISI PRODOTTI
// ========================================
function analizzaProdotti(dettagli, periodi) {
  console.log('\n' + '='.repeat(60));
  console.log('📦 ANALISI PRODOTTI PER PERIODO');
  console.log('='.repeat(60));

  const risultati = {
    settimanale: [],
    mensile: []
  };

  // Analisi settimanale
  console.log('\n📊 Analisi Settimanale:');
  const venditeSettimanali = {};

  for (let idx = 0; idx < periodi.settimane.length; idx++) {
    const settimana = periodi.settimane[idx];

    for (const d of dettagli) {
      if (d.dataOrdine >= settimana.inizio && d.dataOrdine <= settimana.fine) {
        if (!venditeSettimanali[d.prodottoName]) {
          venditeSettimanali[d.prodottoName] = Array(periodi.settimane.length).fill(0);
        }
        venditeSettimanali[d.prodottoName][idx] += d.totale;
      }
    }
  }

  // Calcola prodotti in calo
  const prodottiInCalo = [];
  for (const [prodotto, vendite] of Object.entries(venditeSettimanali)) {
    if (vendite.length >= 2) {
      const meta = Math.floor(vendite.length / 2);
      const mediaPrima = vendite.slice(0, meta).reduce((a, b) => a + b, 0) / meta;
      const mediaDopo = vendite.slice(meta).reduce((a, b) => a + b, 0) / (vendite.length - meta);
      const diminuzione = mediaPrima - mediaDopo;

      if (diminuzione > 0) {
        const percentuale = mediaPrima > 0 ? (diminuzione / mediaPrima * 100) : 0;
        prodottiInCalo.push({
          prodotto,
          diminuzione,
          percentuale,
          vendite
        });
      }
    }
  }

  prodottiInCalo.sort((a, b) => b.diminuzione - a.diminuzione);
  risultati.settimanale = prodottiInCalo.slice(0, 30);

  console.log(`\n   Top 10 prodotti con maggior calo settimanale:`);
  for (let i = 0; i < Math.min(10, prodottiInCalo.length); i++) {
    const p = prodottiInCalo[i];
    console.log(`      ${i + 1}. ${p.prodotto}`);
    console.log(`         Calo: €${p.diminuzione.toFixed(2)} (-${p.percentuale.toFixed(1)}%)`);
  }

  // Analisi mensile
  console.log('\n📊 Analisi Mensile:');
  const venditeMensili = {};

  for (let idx = 0; idx < periodi.mesi.length; idx++) {
    const mese = periodi.mesi[idx];

    for (const d of dettagli) {
      if (d.dataOrdine >= mese.inizio && d.dataOrdine <= mese.fine) {
        if (!venditeMensili[d.prodottoName]) {
          venditeMensili[d.prodottoName] = Array(periodi.mesi.length).fill(0);
        }
        venditeMensili[d.prodottoName][idx] += d.totale;
      }
    }
  }

  const prodottiInCaloMensile = [];
  for (const [prodotto, vendite] of Object.entries(venditeMensili)) {
    if (vendite.length === 3) {
      const diminuzione = vendite[0] - vendite[2];
      if (diminuzione > 0) {
        const percentuale = vendite[0] > 0 ? (diminuzione / vendite[0] * 100) : 0;
        prodottiInCaloMensile.push({
          prodotto,
          diminuzione,
          percentuale,
          mese1: vendite[0],
          mese2: vendite[1],
          mese3: vendite[2]
        });
      }
    }
  }

  prodottiInCaloMensile.sort((a, b) => b.diminuzione - a.diminuzione);
  risultati.mensile = prodottiInCaloMensile.slice(0, 30);

  console.log(`\n   Top 10 prodotti con maggior calo mensile:`);
  for (let i = 0; i < Math.min(10, prodottiInCaloMensile.length); i++) {
    const p = prodottiInCaloMensile[i];
    console.log(`      ${i + 1}. ${p.prodotto}`);
    console.log(`         Mese 1: €${p.mese1.toFixed(2)}`);
    console.log(`         Mese 2: €${p.mese2.toFixed(2)}`);
    console.log(`         Mese 3: €${p.mese3.toFixed(2)}`);
    console.log(`         Calo totale: €${p.diminuzione.toFixed(2)} (-${p.percentuale.toFixed(1)}%)`);
  }

  return risultati;
}

// ========================================
// SALVATAGGIO RISULTATI
// ========================================
function salvaRisultati(analisiClienti, analisiProdotti, periodi, ordiniCount, dettagliCount) {
  const outputDir = path.join(__dirname, '..', 'analisi-output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' +
                     new Date().toTimeString().split(' ')[0].replace(/:/g, '');

  const jsonFilename = `analisi-clienti-prodotti-3-mesi-${timestamp}.json`;
  const txtFilename = `analisi-clienti-prodotti-3-mesi-${timestamp}.txt`;

  const jsonPath = path.join(outputDir, jsonFilename);
  const txtPath = path.join(outputDir, txtFilename);

  // Salva JSON
  const risultati = {
    timestamp: new Date().toISOString(),
    periodi,
    statistiche: {
      ordiniConsegnati: ordiniCount,
      righeProdotto: dettagliCount,
      clientiUnici: analisiClienti.confrontoGlobale.totaleClienti
    },
    analisiClienti,
    analisiProdotti
  };

  fs.writeFileSync(jsonPath, JSON.stringify(risultati, null, 2), 'utf-8');
  console.log(`\n💾 Risultati JSON salvati in: ${jsonPath}`);

  // Salva TXT
  let txtContent = '='.repeat(80) + '\n';
  txtContent += 'ANALISI CLIENTI E PRODOTTI - ULTIMI 3 MESI\n';
  txtContent += '='.repeat(80) + '\n';
  txtContent += `Generato il: ${new Date().toLocaleString('it-IT')}\n`;
  txtContent += `Periodo: ${periodi.inizioTotale} / ${periodi.fineTotale}\n`;
  txtContent += '\n';

  // CLIENTI
  txtContent += '='.repeat(80) + '\n';
  txtContent += 'ANALISI CLIENTI - CHI HA COMPRATO MENO\n';
  txtContent += '='.repeat(80) + '\n\n';

  txtContent += 'ANALISI MENSILE:\n';
  txtContent += '-'.repeat(80) + '\n';
  for (const m of analisiClienti.mensile) {
    txtContent += `\n${m.periodo} (${m.date})\n`;
    txtContent += `Totale clienti attivi: ${m.totaleClienti}\n`;
    txtContent += 'Top 10 che hanno comprato meno:\n';
    for (let i = 0; i < m.top10Meno.length; i++) {
      const [cliente, totale] = m.top10Meno[i];
      txtContent += `   ${(i + 1).toString().padStart(2)}. ${cliente.padEnd(50)} €${totale.toFixed(2).padStart(12)}\n`;
    }
  }

  txtContent += '\n' + '='.repeat(80) + '\n';
  txtContent += 'CONFRONTO GLOBALE (3 MESI)\n';
  txtContent += '='.repeat(80) + '\n';
  txtContent += `Totale clienti attivi: ${analisiClienti.confrontoGlobale.totaleClienti}\n`;
  txtContent += 'Top 20 che hanno comprato meno:\n';
  for (let i = 0; i < analisiClienti.confrontoGlobale.top20Meno.length; i++) {
    const [cliente, totale] = analisiClienti.confrontoGlobale.top20Meno[i];
    txtContent += `   ${(i + 1).toString().padStart(2)}. ${cliente.padEnd(50)} €${totale.toFixed(2).padStart(12)}\n`;
  }

  // PRODOTTI
  txtContent += '\n\n' + '='.repeat(80) + '\n';
  txtContent += 'ANALISI PRODOTTI - DIMINUZIONE FATTURATO\n';
  txtContent += '='.repeat(80) + '\n\n';

  txtContent += 'ANALISI MENSILE:\n';
  txtContent += '-'.repeat(80) + '\n';
  txtContent += 'Top 30 prodotti con maggior calo:\n\n';
  for (let i = 0; i < analisiProdotti.mensile.length; i++) {
    const p = analisiProdotti.mensile[i];
    txtContent += `${(i + 1).toString().padStart(2)}. ${p.prodotto}\n`;
    txtContent += `    Mese 1: €${p.mese1.toFixed(2).padStart(10)}\n`;
    txtContent += `    Mese 2: €${p.mese2.toFixed(2).padStart(10)}\n`;
    txtContent += `    Mese 3: €${p.mese3.toFixed(2).padStart(10)}\n`;
    txtContent += `    Calo:   €${p.diminuzione.toFixed(2).padStart(10)} (-${p.percentuale.toFixed(1)}%)\n\n`;
  }

  fs.writeFileSync(txtPath, txtContent, 'utf-8');
  console.log(`💾 Report TXT salvato in: ${txtPath}`);

  return { jsonPath, txtPath };
}

// ========================================
// FUNZIONE PRINCIPALE
// ========================================
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 ANALISI CLIENTI E PRODOTTI - ULTIMI 3 MESI');
  console.log('='.repeat(60));

  try {
    // 1. Calcola periodi
    const periodi = calcolaPeriodi();
    console.log(`\n📅 Periodo analisi: ${periodi.inizioTotale} / ${periodi.fineTotale}`);
    console.log(`   Settimane da analizzare: ${periodi.settimane.length}`);
    console.log(`   Mesi da analizzare: ${periodi.mesi.length}`);

    // 2. Autenticazione
    const session = await autenticaOdoo();

    // 3. Estrai ordini consegnati
    const ordini = await estraiOrdiniConsegnati(session, periodi.inizioTotale, periodi.fineTotale);

    if (ordini.length === 0) {
      console.log('\n⚠️  Nessun ordine consegnato trovato nel periodo!');
      return;
    }

    // 4. Estrai dettagli prodotti
    const dettagli = await estraiDettagliOrdini(session, ordini);

    if (dettagli.length === 0) {
      console.log('\n⚠️  Nessun dettaglio prodotto trovato!');
      return;
    }

    // 5. Analisi clienti
    const analisiClienti = analizzaClienti(dettagli, periodi);

    // 6. Analisi prodotti
    const analisiProdotti = analizzaProdotti(dettagli, periodi);

    // 7. Salva risultati
    const { jsonPath, txtPath } = salvaRisultati(
      analisiClienti,
      analisiProdotti,
      periodi,
      ordini.length,
      dettagli.length
    );

    console.log('\n' + '='.repeat(60));
    console.log('✅ ANALISI COMPLETATA CON SUCCESSO!');
    console.log('='.repeat(60));
    console.log(`\n📊 Statistiche:`);
    console.log(`   • Ordini consegnati analizzati: ${ordini.length}`);
    console.log(`   • Righe prodotto elaborate: ${dettagli.length}`);
    console.log(`   • Clienti unici: ${analisiClienti.confrontoGlobale.totaleClienti}`);
    console.log(`   • Prodotti in calo (settimana): ${analisiProdotti.settimanale.length}`);
    console.log(`   • Prodotti in calo (mese): ${analisiProdotti.mensile.length}`);
    console.log(`\n📁 File generati:`);
    console.log(`   • JSON: ${jsonPath}`);
    console.log(`   • TXT:  ${txtPath}`);

  } catch (error) {
    console.error('\n❌ ERRORE:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Esegui
main();
