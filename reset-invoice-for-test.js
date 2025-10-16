/**
 * RESET INVOICE - Ripristina il prezzo a €10.00 per testare l'app
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-staging-2406-24586501.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-staging-2406-24586501';
const ODOO_LOGIN = 'paul@lapa.ch';
const ODOO_PASSWORD = 'lapa201180';

const INVOICE_ID = 95619;
const LINE_ID_RICOTTA = 526795;

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

  return sessionMatch[1];
}

async function main() {
  try {
    console.log('🔄 Ripristino prezzo Ricotta a €10.00 per test...');

    const sessionId = await authenticate();

    await callOdoo(sessionId, 'account.move.line', 'write', [
      [LINE_ID_RICOTTA],
      {
        price_unit: 10.00
      }
    ]);

    console.log('✅ Prezzo ripristinato a €10.00');

    const updatedInvoice = await callOdoo(sessionId, 'account.move', 'read', [[INVOICE_ID]], {
      fields: ['amount_total']
    });

    console.log('📊 Nuovo totale fattura: €', updatedInvoice[0].amount_total);
    console.log('🎯 Ora l\'app può testare la correzione automatica!');

  } catch (error) {
    console.error('❌ ERRORE:', error.message);
  }
}

main();
