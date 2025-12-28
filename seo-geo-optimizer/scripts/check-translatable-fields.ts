/**
 * Check which fields are translatable in blog.post model
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_USERNAME = 'paul@lapa.ch';
const ODOO_PASSWORD = 'lapa201180';

let cookies = '';

async function authenticate(): Promise<number> {
  const response = await fetch(`${ODOO_URL}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { db: ODOO_DB, login: ODOO_USERNAME, password: ODOO_PASSWORD },
      id: Date.now()
    })
  });
  const cookieHeader = response.headers.get('set-cookie');
  if (cookieHeader) {
    cookies = cookieHeader.split(',').map(c => c.split(';')[0].trim()).join('; ');
  }
  const data = await response.json();
  if (!data.result?.uid) throw new Error('Auth failed');
  return data.result.uid;
}

async function callOdoo(model: string, method: string, args: any[], kwargs: any = {}): Promise<any> {
  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookies },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { model, method, args, kwargs },
      id: Date.now()
    })
  });
  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.data?.message || data.error.message || JSON.stringify(data.error));
  }
  return data.result;
}

async function main() {
  console.log('🔐 Autenticazione...\n');
  await authenticate();

  console.log('📋 Recupero informazioni sui campi del modello blog.post...\n');

  try {
    const fields = await callOdoo('blog.post', 'fields_get', [], {
      attributes: ['string', 'type', 'translate']
    });

    console.log('Campi traducibili:\n');
    for (const [fieldName, fieldInfo] of Object.entries(fields as any)) {
      if (fieldInfo.translate) {
        console.log(`✅ ${fieldName}: ${fieldInfo.string} (${fieldInfo.type})`);
      }
    }

    console.log('\n\nCampi NON traducibili importanti:\n');
    const importantFields = ['content', 'body', 'description'];
    for (const fieldName of importantFields) {
      const fieldInfo = (fields as any)[fieldName];
      if (fieldInfo) {
        console.log(`❌ ${fieldName}: ${fieldInfo.string} (${fieldInfo.type}) - translate: ${fieldInfo.translate || false}`);
      }
    }

  } catch (e: any) {
    console.error('Errore:', e.message);
  }
}

main().catch(console.error);
