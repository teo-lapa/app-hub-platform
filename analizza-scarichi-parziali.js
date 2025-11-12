/**
 * Script per analizzare gli scarichi parziali negli ordini OUT residui
 * Per ogni ordine pronto residuo:
 * - Legge i messaggi del chatter
 * - Trova messaggi di "scarico parziale"
 * - Estrae prodotti non scaricati
 * - Crea report dettagliato
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_LOGIN = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

const fs = require('fs');

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

async function getOrdiniProntiResidui(cookies) {
  console.log('📋 Ricerca ordini OUT PRONTI residui (escluso oggi)...\n');

  const oggiStr = '2025-11-08';

  const pickings = await callOdoo(cookies, 'stock.picking', 'search_read', [[
    ['picking_type_code', '=', 'outgoing'],
    ['state', '=', 'assigned'], // Solo PRONTI
    ['scheduled_date', '<', oggiStr]
  ]], {
    fields: [
      'name',
      'partner_id',
      'scheduled_date',
      'state',
      'origin',
      'move_ids_without_package',
      'message_ids'
    ],
    order: 'scheduled_date desc'
  });

  console.log(`✅ Trovati ${pickings.length} ordini PRONTI residui\n`);
  return pickings;
}

async function getMessaggiChatter(cookies, pickingId, pickingName) {
  console.log(`   📨 Lettura messaggi chatter per ${pickingName}...`);

  try {
    const messages = await callOdoo(cookies, 'mail.message', 'search_read', [[
      ['res_id', '=', pickingId],
      ['model', '=', 'stock.picking']
    ]], {
      fields: ['body', 'author_id', 'date', 'message_type', 'subtype_id', 'attachment_ids', 'subject'],
      order: 'date desc',
      limit: 100 // Prendi più messaggi
    });

    // Leggi anche gli allegati se presenti
    for (const msg of messages) {
      if (msg.attachment_ids && msg.attachment_ids.length > 0) {
        try {
          const attachments = await callOdoo(cookies, 'ir.attachment', 'read', [
            msg.attachment_ids
          ], {
            fields: ['name', 'datas_fname', 'description', 'mimetype']
          });
          msg.attachments = attachments;
        } catch (e) {
          msg.attachments = [];
        }
      } else {
        msg.attachments = [];
      }
    }

    return messages;
  } catch (error) {
    console.log(`   ⚠️  Errore lettura messaggi: ${error.message}`);
    return [];
  }
}

async function getProdottiNonScaricati(cookies, moveIds) {
  if (moveIds.length === 0) return [];

  const moves = await callOdoo(cookies, 'stock.move', 'read', [moveIds], {
    fields: ['product_id', 'product_uom_qty', 'quantity', 'product_uom', 'state']
  });

  // Filtra solo prodotti con quantità effettiva = 0 o inferiore a richiesta
  return moves.filter(m => m.quantity === 0 || m.quantity < m.product_uom_qty);
}

function cercaScarichiParziali(messages) {
  const scarichi = [];

  for (const msg of messages) {
    const body = msg.body || '';
    const subject = msg.subject || '';
    const bodyLower = body.toLowerCase();
    const subjectLower = subject.toLowerCase();

    // Verifica se ha allegati audio/file per scarico parziale
    const hasScaricoAttachment = msg.attachments && msg.attachments.some(att =>
      (att.name && att.name.toLowerCase().includes('scarico')) ||
      (att.name && att.name.toLowerCase().includes('giustificazione')) ||
      (att.description && att.description.toLowerCase().includes('scarico'))
    );

    // Cerca parole chiave per scarico parziale
    const isScaricoMsg =
      bodyLower.includes('scarico parziale') ||
      subjectLower.includes('scarico parziale') ||
      bodyLower.includes('**scarico parziale**') ||
      bodyLower.includes('parziale') ||
      bodyLower.includes('non scaricato') ||
      bodyLower.includes('non consegnato') ||
      bodyLower.includes('mancante') ||
      bodyLower.includes('non disponibile') ||
      bodyLower.includes('giustificazione autista') ||
      hasScaricoAttachment;

    if (isScaricoMsg) {
      const allegati = msg.attachments.map(att => ({
        id: att.id, // IMPORTANTE: salva l'ID per scaricare l'allegato dopo
        nome: att.name || att.datas_fname,
        tipo: att.mimetype,
        descrizione: att.description
      }));

      scarichi.push({
        autore: msg.author_id ? msg.author_id[1] : 'Sistema',
        data: msg.date,
        subject: subject,
        messaggio: body.replace(/<[^>]*>/g, '').trim(), // Rimuove HTML
        tipo: msg.message_type,
        allegati: allegati,
        hasAudio: allegati.some(a => a.tipo && a.tipo.includes('audio'))
      });
    }
  }

  return scarichi;
}

async function getSalesOrderPickings(cookies, salesOrderName) {
  if (!salesOrderName) return [];

  try {
    // 1. Trova il Sales Order
    const salesOrders = await callOdoo(cookies, 'sale.order', 'search_read', [[
      ['name', '=', salesOrderName]
    ]], {
      fields: ['name', 'picking_ids'],
      limit: 1
    });

    if (salesOrders.length === 0) {
      return [];
    }

    const pickingIds = salesOrders[0].picking_ids;
    if (!pickingIds || pickingIds.length === 0) {
      return [];
    }

    // 2. Leggi tutti i picking collegati
    const pickings = await callOdoo(cookies, 'stock.picking', 'read', [pickingIds], {
      fields: ['name', 'state', 'picking_type_code', 'date_done', 'id']
    });

    return pickings;
  } catch (error) {
    console.log(`   ⚠️  Errore ricerca picking per ${salesOrderName}: ${error.message}`);
    return [];
  }
}

async function trovaOutCompletato(cookies, salesOrderName) {
  console.log(`   🔍 Cerco OUT completato per ordine ${salesOrderName}...`);

  const pickings = await getSalesOrderPickings(cookies, salesOrderName);

  // Filtra solo OUT completati
  const outCompletati = pickings
    .filter(p => p.picking_type_code === 'outgoing' && p.state === 'done')
    .sort((a, b) => {
      // Ordina per data completamento (più recente prima)
      const dateA = a.date_done ? new Date(a.date_done) : new Date(0);
      const dateB = b.date_done ? new Date(b.date_done) : new Date(0);
      return dateB - dateA;
    });

  if (outCompletati.length > 0) {
    console.log(`   ✅ Trovato OUT completato: ${outCompletati[0].name}`);
    return outCompletati[0];
  }

  console.log(`   ⚠️  Nessun OUT completato trovato per ${salesOrderName}`);
  return null;
}

async function analizzaOrdine(cookies, picking, index, total) {
  console.log(`\n[${index + 1}/${total}] 🔍 Analisi ${picking.name} - ${picking.partner_id[1]}`);

  const report = {
    numeroOrdineResiduo: picking.name,
    cliente: picking.partner_id[1],
    dataPrevisita: picking.scheduled_date,
    salesOrder: picking.origin || 'N/A',
    outCompletato: null,
    prodottiNonScaricati: [],
    messaggiScaricoParziale: [],
    haScarichiParziali: false
  };

  // 1. Trova OUT completato collegato al Sales Order
  const outCompletato = await trovaOutCompletato(cookies, picking.origin);

  if (outCompletato) {
    report.outCompletato = outCompletato.name;

    // 2. Leggi messaggi chatter dell'OUT COMPLETATO
    const messaggi = await getMessaggiChatter(cookies, outCompletato.id, outCompletato.name);
    console.log(`   📬 Trovati ${messaggi.length} messaggi nell'OUT completato`);

    // 3. Cerca scarichi parziali
    const scarichi = cercaScarichiParziali(messaggi);
    if (scarichi.length > 0) {
      console.log(`   ⚠️  Trovati ${scarichi.length} messaggi di scarico parziale!`);
      report.haScarichiParziali = true;
      report.messaggiScaricoParziale = scarichi;
    } else {
      console.log(`   ✅ Nessun messaggio di scarico parziale trovato`);
    }
  }

  // 4. Leggi prodotti non scaricati dall'ordine RESIDUO
  const prodottiNonScaricati = await getProdottiNonScaricati(
    cookies,
    picking.move_ids_without_package
  );

  if (prodottiNonScaricati.length > 0) {
    console.log(`   📦 Trovati ${prodottiNonScaricati.length} prodotti non scaricati nell'ordine residuo`);
    report.prodottiNonScaricati = prodottiNonScaricati.map(p => ({
      nome: p.product_id[1],
      quantitaRichiesta: p.product_uom_qty,
      quantitaEffettiva: p.quantity,
      uom: p.product_uom[1]
    }));
  }

  return report;
}

function generaReportTestuale(reports) {
  let output = '';

  output += '═══════════════════════════════════════════════════════════════\n';
  output += '  REPORT SCARICHI PARZIALI - ORDINI OUT RESIDUI\n';
  output += `  Data analisi: ${new Date().toLocaleString('it-IT')}\n`;
  output += `  Totale ordini analizzati: ${reports.length}\n`;
  output += '═══════════════════════════════════════════════════════════════\n\n';

  reports.forEach((report, idx) => {
    output += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    output += `${idx + 1}. ORDINE RESIDUO: ${report.numeroOrdineResiduo}\n`;
    output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    output += `📋 INFORMAZIONI ORDINE:\n`;
    output += `   • Cliente: ${report.cliente}\n`;
    output += `   • Data prevista: ${new Date(report.dataPrevisita).toLocaleDateString('it-IT')}\n`;
    output += `   • Sales Order: ${report.salesOrder}\n`;
    output += `   • OUT Completato: ${report.outCompletato || 'Non trovato'}\n\n`;

    // Messaggi scarico parziale
    if (report.haScarichiParziali) {
      output += `⚠️  SCARICHI PARZIALI REGISTRATI: ${report.messaggiScaricoParziale.length}\n\n`;

      report.messaggiScaricoParziale.forEach((scarico, i) => {
        output += `   ${i + 1}. 👤 Autore: ${scarico.autore}\n`;
        output += `      📅 Data: ${new Date(scarico.data).toLocaleString('it-IT')}\n`;

        if (scarico.subject) {
          output += `      📌 Oggetto: ${scarico.subject}\n`;
        }

        if (scarico.messaggio) {
          output += `      💬 Messaggio:\n`;
          output += `      ${scarico.messaggio.split('\n').join('\n      ')}\n`;
        }

        if (scarico.allegati && scarico.allegati.length > 0) {
          output += `      📎 Allegati (${scarico.allegati.length}):\n`;
          scarico.allegati.forEach(all => {
            const icon = all.tipo?.includes('audio') ? '🎤' : '📄';
            output += `         ${icon} ${all.nome} (${all.tipo || 'N/A'})\n`;
          });
        }
        output += '\n';
      });
    } else {
      output += `✅ NESSUNO SCARICO PARZIALE REGISTRATO NEL CHATTER\n\n`;
    }

    // Prodotti non scaricati
    if (report.prodottiNonScaricati.length > 0) {
      output += `📦 PRODOTTI NON SCARICATI: ${report.prodottiNonScaricati.length}\n\n`;

      report.prodottiNonScaricati.forEach((prod, i) => {
        output += `   ${i + 1}. ${prod.nome}\n`;
        output += `      Richiesta: ${prod.quantitaRichiesta} ${prod.uom}\n`;
        output += `      Scaricata: ${prod.quantitaEffettiva} ${prod.uom}\n`;
        output += `      Mancante: ${prod.quantitaRichiesta - prod.quantitaEffettiva} ${prod.uom}\n\n`;
      });
    } else {
      output += `✅ TUTTI I PRODOTTI SCARICATI CORRETTAMENTE\n\n`;
    }
  });

  // RIEPILOGO FINALE
  output += '\n\n═══════════════════════════════════════════════════════════════\n';
  output += '  RIEPILOGO STATISTICHE\n';
  output += '═══════════════════════════════════════════════════════════════\n\n';

  const conScarichi = reports.filter(r => r.haScarichiParziali).length;
  const conProdottiMancanti = reports.filter(r => r.prodottiNonScaricati.length > 0).length;
  const ok = reports.filter(r => !r.haScarichiParziali && r.prodottiNonScaricati.length === 0).length;

  output += `📊 Ordini con messaggi di scarico parziale: ${conScarichi}\n`;
  output += `📦 Ordini con prodotti non scaricati: ${conProdottiMancanti}\n`;
  output += `✅ Ordini senza problemi registrati: ${ok}\n`;
  output += `📋 Totale ordini analizzati: ${reports.length}\n\n`;

  return output;
}

async function main() {
  try {
    const cookies = await authenticate();

    // 1. Ottieni ordini pronti residui
    const ordini = await getOrdiniProntiResidui(cookies);

    if (ordini.length === 0) {
      console.log('✅ Nessun ordine residuo da analizzare!');
      return;
    }

    // 2. Analizza ogni ordine
    const reports = [];
    for (let i = 0; i < ordini.length; i++) {
      const report = await analizzaOrdine(cookies, ordini[i], i, ordini.length);
      reports.push(report);
    }

    // 3. Genera report
    console.log('\n\n📄 Generazione report...');

    const reportTestuale = generaReportTestuale(reports);

    // Salva su file
    const filename = `REPORT_SCARICHI_PARZIALI_${new Date().toISOString().split('T')[0]}.txt`;
    fs.writeFileSync(filename, reportTestuale, 'utf8');
    console.log(`✅ Report salvato in: ${filename}`);

    // Salva anche JSON per analisi programmatica
    const filenameJson = `REPORT_SCARICHI_PARZIALI_${new Date().toISOString().split('T')[0]}.json`;
    fs.writeFileSync(filenameJson, JSON.stringify(reports, null, 2), 'utf8');
    console.log(`✅ Report JSON salvato in: ${filenameJson}`);

    // Mostra report a schermo
    console.log('\n' + reportTestuale);

  } catch (error) {
    console.error('\n❌ ERRORE:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
