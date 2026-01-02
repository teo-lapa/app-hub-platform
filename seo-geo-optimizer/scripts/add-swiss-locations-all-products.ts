/**
 * Aggiunge keyword geografiche svizzere a TUTTI i prodotti
 * Svizzera tedesca + Ticino (20 località)
 * AGGIUNGE alle keyword esistenti, NON sostituisce
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

// 20 località: Svizzera tedesca + Ticino
const SWISS_LOCATIONS = [
  'Zürich', 'Bern', 'Basel', 'Luzern', 'St. Gallen',
  'Winterthur', 'Zug', 'Thurgau', 'Aargau', 'Schaffhausen',
  'Schwyz', 'Solothurn', 'Glarus', 'Chur', 'Graubünden',
  'Lugano', 'Ticino', 'Bellinzona', 'Locarno', 'Mendrisio'
];

async function main() {
  console.log('');
  console.log('='.repeat(70));
  console.log('  AGGIUNTA KEYWORD GEOGRAFICHE SVIZZERE - TUTTI I PRODOTTI');
  console.log('='.repeat(70));
  console.log('');
  console.log('Località da aggiungere (' + SWISS_LOCATIONS.length + '):');
  console.log(SWISS_LOCATIONS.join(', '));
  console.log('');

  // 1. Auth
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
  const cookies = authRes.headers.get('set-cookie')?.split(',').map(c => c.split(';')[0].trim()).join('; ');
  console.log('   Connesso!');

  // 2. Get all published products
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
          fields: ['id', 'name', 'website_meta_keywords'],
          limit: 5000
        }
      },
      id: 2
    })
  });

  const data = await res.json();
  const products = data.result || [];
  console.log('   Trovati ' + products.length + ' prodotti');

  // 3. Filter products that don't have ALL location keywords
  const toUpdate = products.filter((p: any) => {
    const kw = (p.website_meta_keywords || '').toLowerCase();
    // Check if at least one location is missing
    return SWISS_LOCATIONS.some(loc => !kw.includes(loc.toLowerCase()));
  });

  console.log('');
  console.log('3. Prodotti da aggiornare: ' + toUpdate.length);
  console.log('');
  console.log('4. Inizio aggiornamento...');
  console.log('');

  let updated = 0;
  let errors = 0;

  for (let i = 0; i < toUpdate.length; i++) {
    const product = toUpdate[i];
    const existingKw = product.website_meta_keywords || '';
    const existingLower = existingKw.toLowerCase();

    // Add only missing locations
    const newLocations = SWISS_LOCATIONS.filter(loc => !existingLower.includes(loc.toLowerCase()));

    if (newLocations.length === 0) continue;

    // Append new locations to existing keywords
    const newKeywords = existingKw
      ? existingKw + ', ' + newLocations.join(', ')
      : newLocations.join(', ');

    try {
      const updateRes = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': cookies || '' },
        body: JSON.stringify({
          jsonrpc: '2.0', method: 'call',
          params: {
            model: 'product.template',
            method: 'write',
            args: [[product.id], { website_meta_keywords: newKeywords }],
            kwargs: {}
          },
          id: 3 + i
        })
      });

      const updateData = await updateRes.json();
      if (updateData.result) {
        updated++;
      } else {
        errors++;
        console.log('   ERRORE: ' + product.name);
      }
    } catch (e) {
      errors++;
      console.log('   ERRORE: ' + product.name + ' - ' + e);
    }

    // Progress every 50
    if ((i + 1) % 50 === 0 || i === toUpdate.length - 1) {
      const pct = ((i + 1) / toUpdate.length * 100).toFixed(1);
      console.log('   Progresso: ' + (i + 1) + '/' + toUpdate.length + ' (' + pct + '%) - Aggiornati: ' + updated + ' - Errori: ' + errors);
    }
  }

  console.log('');
  console.log('='.repeat(70));
  console.log('  COMPLETATO!');
  console.log('='.repeat(70));
  console.log('');
  console.log('Prodotti aggiornati: ' + updated);
  console.log('Errori: ' + errors);
  console.log('');
  console.log('Località aggiunte: ' + SWISS_LOCATIONS.join(', '));
  console.log('');
}

main();
