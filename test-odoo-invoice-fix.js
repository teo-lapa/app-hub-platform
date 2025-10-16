/**
 * SCRIPT DI TEST DIRETTO PER FIXARE LA FATTURA
 * Vado dritto in Odoo e modifico il prezzo della Ricotta!
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-staging-2406-24586501.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-staging-2406-24586501';
const ODOO_LOGIN = 'paul@lapa.ch';
const ODOO_PASSWORD = 'lapa201180';

const INVOICE_ID = 95619;
const LINE_ID_RICOTTA = 526795; // La riga della Ricotta con prezzo sbagliato

async function callOdoo(sessionId, model, method, args, kwargs = {}) {
  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `session_id=${sessionId}`
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
    console.error('❌ ODOO ERROR:', JSON.stringify(data.error, null, 2));
    throw new Error(data.error.data?.message || data.error.message);
  }
  return data.result;
}

async function authenticate() {
  console.log('🔐 Autenticazione Odoo...');

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
  if (data.error || !data.result?.uid) {
    throw new Error('Autenticazione fallita');
  }

  const setCookie = response.headers.get('set-cookie');
  const sessionMatch = setCookie?.match(/session_id=([^;]+)/);

  if (!sessionMatch) {
    throw new Error('Nessun session_id ricevuto');
  }

  console.log('✅ Autenticato! UID:', data.result.uid);
  return sessionMatch[1];
}

async function main() {
  try {
    // 1. AUTENTICAZIONE
    const sessionId = await authenticate();

    // 2. LEGGI LA FATTURA
    console.log('\n📄 Caricamento fattura', INVOICE_ID);
    const invoice = await callOdoo(sessionId, 'account.move', 'read', [[INVOICE_ID]], {
      fields: ['name', 'partner_id', 'amount_total', 'invoice_line_ids', 'state']
    });
    console.log('Fattura:', invoice[0].name);
    console.log('Fornitore:', invoice[0].partner_id[1]);
    console.log('Totale:', invoice[0].amount_total);
    console.log('Stato:', invoice[0].state);

    // 3. LEGGI TUTTE LE RIGHE
    console.log('\n📋 Caricamento righe fattura...');
    const lines = await callOdoo(sessionId, 'account.move.line', 'read', [invoice[0].invoice_line_ids], {
      fields: ['id', 'name', 'product_id', 'quantity', 'price_unit', 'price_subtotal', 'price_total', 'display_type']
    });

    console.log('\n📊 RIGHE FATTURA:');
    lines.forEach(line => {
      if (!line.display_type) { // Solo righe prodotto, non sezioni
        console.log(`  [${line.id}] ${line.name}`);
        console.log(`      Prodotto: ${line.product_id ? line.product_id[1] : 'N/A'}`);
        console.log(`      Qty: ${line.quantity} x €${line.price_unit} = €${line.price_subtotal}`);
        console.log('');
      }
    });

    // 4. TROVA LA RIGA DELLA RICOTTA
    const ricottaLine = lines.find(l => l.id === LINE_ID_RICOTTA);
    if (!ricottaLine) {
      throw new Error('Riga Ricotta non trovata!');
    }

    console.log('🎯 RIGA DA MODIFICARE:');
    console.log('   ID:', ricottaLine.id);
    console.log('   Descrizione:', ricottaLine.name);
    console.log('   Prezzo attuale:', ricottaLine.price_unit);
    console.log('   Prezzo corretto: 4.05');

    // 5. MODIFICA IL PREZZO
    console.log('\n🔧 MODIFICO IL PREZZO...');

    await callOdoo(sessionId, 'account.move.line', 'write', [
      [LINE_ID_RICOTTA],
      {
        price_unit: 4.05
      }
    ]);

    console.log('✅ PREZZO MODIFICATO!');

    // 6. RILEGGI LA FATTURA PER VERIFICARE
    console.log('\n🔄 Verifica nuovo totale...');
    const updatedInvoice = await callOdoo(sessionId, 'account.move', 'read', [[INVOICE_ID]], {
      fields: ['amount_total', 'amount_untaxed', 'amount_tax']
    });

    console.log('✅ NUOVO TOTALE:', updatedInvoice[0].amount_total);
    console.log('   Imponibile:', updatedInvoice[0].amount_untaxed);
    console.log('   IVA:', updatedInvoice[0].amount_tax);

    // Verifica se è corretto
    const expectedTotal = 3508.45;
    const diff = Math.abs(updatedInvoice[0].amount_total - expectedTotal);

    if (diff <= 0.02) {
      console.log('\n🎉 PERFETTO! Il totale è corretto!');
    } else {
      console.log(`\n⚠️ Differenza rimanente: €${diff.toFixed(2)}`);
    }

  } catch (error) {
    console.error('\n❌ ERRORE:', error.message);
    console.error(error);
  }
}

main();
