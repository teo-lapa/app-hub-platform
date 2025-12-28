/**
 * ELIMINA ARTICOLI DUPLICATI
 * Elimina solo i doppioni identificati, mantiene quelli con traduzioni
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
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║            ELIMINAZIONE ARTICOLI DUPLICATI                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log('🔐 Autenticazione...');
  await authenticate();
  console.log('✅\n');

  // Lista completa degli ID da eliminare (solo i doppioni vecchi)
  const idsToDelete = [
    287, 288, 289, 290, 291, 292, 293, 294, 295, 296, 298, 299,
    300, 301, 303, 304, 305, 306, 307, 309, 313, 314, 315, 316,
    317, 318, 319, 321, 326, 328, 331, 332, 333, 334, 335, 337,
    338, 407, 409, 411, 412, 413, 415, 416
  ];

  console.log(`🗑️  Elimino ${idsToDelete.length} articoli duplicati...\n`);
  console.log('⚠️  MANTENGO gli articoli più recenti con traduzioni funzionanti\n');

  const results: any[] = [];
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < idsToDelete.length; i++) {
    const postId = idsToDelete[i];

    try {
      // Get article name first
      const post = await callOdoo('blog.post', 'read', [[postId], ['name']], {
        context: { lang: 'it_IT' }
      });

      const articleName = post && post.length > 0 ? post[0].name : 'Unknown';

      // Delete
      await callOdoo('blog.post', 'unlink', [[postId]], {});

      successCount++;
      results.push({ id: postId, status: 'deleted', name: articleName });

      console.log(`[${i + 1}/${idsToDelete.length}] ✅ Eliminato ID ${postId}: ${articleName.substring(0, 60)}...`);

      // Small delay to not overload
      await new Promise(r => setTimeout(r, 300));

    } catch (e: any) {
      errorCount++;
      const errorMsg = e.message.includes('non esiste') ? 'Già eliminato' : e.message;
      results.push({ id: postId, status: 'error', error: errorMsg });

      console.log(`[${i + 1}/${idsToDelete.length}] ⚠️  ID ${postId}: ${errorMsg}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('📊 RIEPILOGO ELIMINAZIONE');
  console.log('='.repeat(70));
  console.log(`✅ Eliminati con successo: ${successCount}/${idsToDelete.length}`);
  console.log(`⚠️  Errori/Già eliminati: ${errorCount}/${idsToDelete.length}`);
  console.log('');

  if (errorCount > 0) {
    console.log('Articoli con errori:');
    results.filter(r => r.status === 'error').forEach(r => {
      console.log(`   ID ${r.id}: ${r.error}`);
    });
    console.log('');
  }

  console.log('🎉 ELIMINAZIONE COMPLETATA!\n');
  console.log('📝 Articoli rimanenti: articoli unici con traduzioni funzionanti\n');
}

main().catch(console.error);
