/**
 * Check recent calendar events in Odoo
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

const ODOO_URL = process.env.ODOO_URL || process.env.NEXT_PUBLIC_ODOO_URL || 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = process.env.ODOO_DB || 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_USERNAME = process.env.ODOO_USERNAME || 'paul@lapa.ch';
const ODOO_PASSWORD = process.env.ODOO_PASSWORD || 'lapa201180';

let sessionCookie = '';

async function jsonRpc(url: string, method: string, params: any) {
  const headers: any = { 'Content-Type': 'application/json' };
  if (sessionCookie) headers['Cookie'] = sessionCookie;

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id: Date.now() })
  });

  const setCookie = response.headers.get('set-cookie');
  if (setCookie) {
    const match = setCookie.match(/session_id=([^;]+)/);
    if (match) sessionCookie = `session_id=${match[1]}`;
  }

  const data = await response.json();
  if (data.error) throw new Error(JSON.stringify(data.error, null, 2));
  return data.result;
}

async function main() {
  // Authenticate
  console.log('🔐 Authenticating...');
  const session = await jsonRpc(`${ODOO_URL}/web/session/authenticate`, 'call', {
    db: ODOO_DB, login: ODOO_USERNAME, password: ODOO_PASSWORD
  });
  console.log(`✅ Logged in as: ${session.name} (UID: ${session.uid})`);

  // Search for recent calendar events with 'Appuntamento' in name
  console.log('\n📅 Searching for recent Appuntamento events...\n');
  const events = await jsonRpc(`${ODOO_URL}/web/dataset/call_kw/calendar.event/search_read`, 'call', {
    model: 'calendar.event',
    method: 'search_read',
    args: [[['name', 'ilike', 'Appuntamento'], ['start', '>=', '2025-11-27 00:00:00']]],
    kwargs: {
      fields: ['id', 'name', 'start', 'stop', 'user_id', 'partner_ids', 'create_uid', 'create_date', 'active'],
      limit: 20,
      order: 'create_date desc',
      context: { uid: session.uid }
    }
  });

  console.log(`Found ${events.length} events:\n`);
  events.forEach((e: any) => {
    console.log(`📌 ID: ${e.id} | ${e.name}`);
    console.log(`   Start: ${e.start} | Stop: ${e.stop}`);
    console.log(`   User (owner): ${e.user_id ? e.user_id[1] : 'N/A'} (ID: ${e.user_id ? e.user_id[0] : 'N/A'})`);
    console.log(`   Created by: ${e.create_uid ? e.create_uid[1] : 'N/A'}`);
    console.log(`   Partner IDs: ${JSON.stringify(e.partner_ids)}`);
    console.log(`   Active: ${e.active}`);
    console.log('');
  });

  // Also search for PicnChic specifically
  console.log('\n🔍 Searching for PicnChic events...\n');
  const picnchicEvents = await jsonRpc(`${ODOO_URL}/web/dataset/call_kw/calendar.event/search_read`, 'call', {
    model: 'calendar.event',
    method: 'search_read',
    args: [[['name', 'ilike', 'PicnChic']]],
    kwargs: {
      fields: ['id', 'name', 'start', 'stop', 'user_id', 'partner_ids', 'create_uid', 'create_date', 'active'],
      limit: 10,
      order: 'create_date desc',
      context: { uid: session.uid }
    }
  });

  console.log(`Found ${picnchicEvents.length} PicnChic events:\n`);
  picnchicEvents.forEach((e: any) => {
    console.log(`📌 ID: ${e.id} | ${e.name}`);
    console.log(`   Start: ${e.start} | Stop: ${e.stop}`);
    console.log(`   User (owner): ${e.user_id ? e.user_id[1] : 'N/A'} (ID: ${e.user_id ? e.user_id[0] : 'N/A'})`);
    console.log(`   Active: ${e.active}`);
    console.log('');
  });
}

main().catch(console.error);
