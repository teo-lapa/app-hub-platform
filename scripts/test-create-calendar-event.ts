/**
 * Script per testare la creazione di un evento calendario su un partner in Odoo
 * Esegui con: npx ts-node scripts/test-create-calendar-event.ts
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
  if (sessionCookie) {
    headers['Cookie'] = sessionCookie;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: method,
      params: params,
      id: Date.now()
    })
  });

  // Capture session cookie
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) {
    const match = setCookie.match(/session_id=([^;]+)/);
    if (match) {
      sessionCookie = `session_id=${match[1]}`;
    }
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(JSON.stringify(data.error, null, 2));
  }
  return data.result;
}

async function authenticate() {
  console.log('🔐 Authenticating to Odoo...');

  const result = await jsonRpc(`${ODOO_URL}/web/session/authenticate`, 'call', {
    db: ODOO_DB,
    login: ODOO_USERNAME,
    password: ODOO_PASSWORD
  });

  console.log(`✅ Authenticated as: ${result.name} (UID: ${result.uid})`);
  return result;
}

async function getPartnerInfo(uid: number, partnerId: number) {
  console.log(`\n🔍 Getting partner info for ID ${partnerId}...`);

  const result = await jsonRpc(`${ODOO_URL}/web/dataset/call_kw/res.partner/search_read`, 'call', {
    model: 'res.partner',
    method: 'search_read',
    args: [[['id', '=', partnerId]]],
    kwargs: {
      fields: ['id', 'name', 'email', 'phone'],
      limit: 1,
      context: { uid }
    }
  });

  if (result.length > 0) {
    console.log(`✅ Partner found: ${result[0].name}`);
    return result[0];
  }
  console.log('❌ Partner not found!');
  return null;
}

async function createCalendarEvent(uid: number, partnerId: number, partnerName: string) {
  console.log(`\n📅 Creating calendar event for partner ${partnerId} (${partnerName})...`);

  // Create datetime strings
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().split('T')[0];
  const startDateTime = `${dateStr} 14:00:00`;
  const stopDateTime = `${dateStr} 15:00:00`;

  const calendarEventValues = {
    name: `Appuntamento - ${partnerName}`,
    start: startDateTime,
    stop: stopDateTime,
    description: 'Test calendar event from script',
    user_id: uid,
    partner_ids: [[6, 0, [partnerId]]], // Many2many command to add partner as attendee
  };

  console.log('Calendar event values:', JSON.stringify(calendarEventValues, null, 2));

  const result = await jsonRpc(`${ODOO_URL}/web/dataset/call_kw/calendar.event/create`, 'call', {
    model: 'calendar.event',
    method: 'create',
    args: [calendarEventValues],
    kwargs: { context: { uid } }
  });

  console.log(`✅ Calendar event created! ID: ${result}`);
  return result;
}

async function main() {
  try {
    // 1. Authenticate
    const session = await authenticate();
    const uid = session.uid;

    // 2. Test with a known partner ID (you can change this)
    // Let's first find a partner to test with
    console.log('\n🔍 Finding a test partner...');
    const partners = await jsonRpc(`${ODOO_URL}/web/dataset/call_kw/res.partner/search_read`, 'call', {
      model: 'res.partner',
      method: 'search_read',
      args: [[['is_company', '=', true], ['customer_rank', '>', 0]]],
      kwargs: {
        fields: ['id', 'name'],
        limit: 5,
        context: { uid }
      }
    });

    console.log('Found partners:');
    partners.forEach((p: any) => console.log(`   - ${p.name} (ID: ${p.id})`));

    if (partners.length > 0) {
      const testPartner = partners[0];
      console.log(`\nUsing partner: ${testPartner.name} (ID: ${testPartner.id})`);

      // 3. Create calendar event
      await createCalendarEvent(uid, testPartner.id, testPartner.name);
    }

    console.log('\n🎉 Test completed successfully!');

  } catch (error) {
    console.error('\n💥 Test failed:', error);
  }
}

main();
