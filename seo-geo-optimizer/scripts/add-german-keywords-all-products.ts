/**
 * Aggiunge keyword tedesche a TUTTI i prodotti pubblicati
 * Keywords: kaufen, bestellen, online, Lieferung Schweiz
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env') });

const ODOO_URL = process.env.ODOO_URL!;
const ODOO_DB = process.env.ODOO_DB!;
const ODOO_USERNAME = process.env.ODOO_USERNAME!;
const ODOO_PASSWORD = process.env.ODOO_PASSWORD!;

// Keywords tedesche da aggiungere
const GERMAN_KEYWORDS = ['kaufen', 'bestellen', 'online', 'Lieferung Schweiz', 'Grosshandel'];

async function main() {
  console.log('='.repeat(70));
  console.log('  AGGIORNAMENTO KEYWORD TEDESCHE - TUTTI I PRODOTTI');
  console.log('='.repeat(70));
  console.log('');

  // Auth
  console.log('1. Connessione a Odoo...');
  const authRes = await fetch(`${ODOO_URL}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', method: 'call',
      params: { db: ODOO_DB, login: ODOO_USERNAME, password: ODOO_PASSWORD },
      id: 1
    })
  });
  const authData = await authRes.json();
  if (authData.error) {
    console.error('Errore autenticazione:', authData.error);
    return;
  }
  const cookies = authRes.headers.get('set-cookie')?.split(',').map(c => c.split(';')[0].trim()).join('; ');
  console.log('   Connesso!');

  // Get ALL published products
  console.log('2. Caricamento prodotti...');
  const res = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookies || '' },
    body: JSON.stringify({
      jsonrpc: '2.0', method: 'call',
      params: {
        model: 'product.template',
        method: 'search_read',
        args: [],
        kwargs: {
          domain: [['is_published', '=', true]],
          fields: ['id', 'name', 'website_meta_title', 'website_meta_description', 'website_meta_keywords'],
          limit: 5000
        }
      },
      id: 2
    })
  });

  const data = await res.json();
  const products = data.result || [];
  console.log('   Trovati ' + products.length + ' prodotti');
  console.log('');

  // Filtra prodotti che NON hanno ancora keyword tedesche
  const productsToUpdate = products.filter((p: any) => {
    const kw = (p.website_meta_keywords || '').toLowerCase();
    const desc = (p.website_meta_description || '').toLowerCase();
    // Se non ha "kaufen" o "bestellen" nelle keywords o description
    return !kw.includes('kaufen') && !desc.includes('kaufen');
  });

  console.log('3. Prodotti da aggiornare: ' + productsToUpdate.length);
  console.log('');

  if (productsToUpdate.length === 0) {
    console.log('Tutti i prodotti hanno gia keyword tedesche!');
    return;
  }

  // Update products in batches
  console.log('4. Inizio aggiornamento...');
  console.log('');

  let updated = 0;
  let errors = 0;
  const batchSize = 50;

  for (let i = 0; i < productsToUpdate.length; i += batchSize) {
    const batch = productsToUpdate.slice(i, i + batchSize);

    for (const p of batch) {
      try {
        // Prepara nuove keywords
        const existingKw = p.website_meta_keywords || '';
        const newKeywords = existingKw
          ? existingKw + ', ' + GERMAN_KEYWORDS.join(', ')
          : GERMAN_KEYWORDS.join(', ');

        // Prepara nuova description (aggiungi frase tedesca se non presente)
        let newDesc = p.website_meta_description || '';
        if (!newDesc.toLowerCase().includes('kaufen') && !newDesc.toLowerCase().includes('bestellen')) {
          // Estrai nome prodotto pulito
          const productName = p.name.split(' ').slice(0, 4).join(' ');
          // Aggiungi frase tedesca alla fine
          if (newDesc.length > 0) {
            // Tronca se troppo lunga per fare spazio
            if (newDesc.length > 120) {
              newDesc = newDesc.substring(0, 117) + '...';
            }
            newDesc = newDesc + ' Jetzt online kaufen!';
          }
        }

        // Update product
        const updateRes = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Cookie': cookies || '' },
          body: JSON.stringify({
            jsonrpc: '2.0', method: 'call',
            params: {
              model: 'product.template',
              method: 'write',
              args: [[p.id], {
                website_meta_keywords: newKeywords,
                website_meta_description: newDesc
              }],
              kwargs: {}
            },
            id: 3
          })
        });

        const updateData = await updateRes.json();
        if (updateData.error) {
          errors++;
          console.log('   Errore ID ' + p.id + ': ' + updateData.error.data?.message);
        } else {
          updated++;
        }
      } catch (err) {
        errors++;
      }
    }

    // Progress
    const progress = Math.min(i + batchSize, productsToUpdate.length);
    const pct = ((progress / productsToUpdate.length) * 100).toFixed(1);
    console.log('   Progresso: ' + progress + '/' + productsToUpdate.length + ' (' + pct + '%) - Aggiornati: ' + updated + ' - Errori: ' + errors);

    // Small delay to avoid overwhelming the server
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('');
  console.log('='.repeat(70));
  console.log('  COMPLETATO!');
  console.log('='.repeat(70));
  console.log('');
  console.log('Prodotti aggiornati: ' + updated);
  console.log('Errori: ' + errors);
  console.log('');
  console.log('Keywords aggiunte: ' + GERMAN_KEYWORDS.join(', '));
  console.log('');
}

main().catch(console.error);
