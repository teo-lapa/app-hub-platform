/**
 * Find Users - Laura Torrescu e Gregorio Bucolieri
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env') });

const ODOO_URL = process.env.ODOO_URL || 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = process.env.ODOO_DB || 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_USERNAME = process.env.ODOO_USERNAME || 'paul@lapa.ch';
const ODOO_PASSWORD = process.env.ODOO_PASSWORD || 'lapa201180';

async function main() {
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

  const data = await response.json();
  const cookies = response.headers.get('set-cookie')?.split(',').map(c => c.split(';')[0].trim()).join('; ') || `session_id=${data.result.session_id}`;

  // Cerca utenti
  const usersResp = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookies },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model: 'res.users',
        method: 'search_read',
        args: [],
        kwargs: {
          domain: ['|', ['name', 'ilike', 'laura'], ['name', 'ilike', 'gregorio']],
          fields: ['id', 'name', 'login', 'email', 'partner_id'],
          limit: 20
        }
      },
      id: Date.now()
    })
  });

  const usersData = await usersResp.json();
  console.log('👥 Utenti trovati:\n');

  for (const user of usersData.result || []) {
    console.log(`   ID: ${user.id}`);
    console.log(`   Nome: ${user.name}`);
    console.log(`   Login: ${user.login}`);
    console.log(`   Email: ${user.email || 'N/A'}`);
    console.log(`   Partner ID: ${user.partner_id?.[0]}`);
    console.log('');
  }

  // Cerca anche per Bucolieri/Torrescu
  const users2Resp = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookies },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model: 'res.users',
        method: 'search_read',
        args: [],
        kwargs: {
          domain: ['|', ['name', 'ilike', 'torrescu'], ['name', 'ilike', 'bucolieri']],
          fields: ['id', 'name', 'login', 'email', 'partner_id'],
          limit: 20
        }
      },
      id: Date.now()
    })
  });

  const users2Data = await users2Resp.json();
  if (users2Data.result?.length > 0) {
    console.log('Ricerca per cognome:\n');
    for (const user of users2Data.result) {
      console.log(`   ID: ${user.id} - ${user.name} (${user.login})`);
    }
  }
}

main();
