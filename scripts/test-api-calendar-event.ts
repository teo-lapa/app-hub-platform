/**
 * Test script to verify calendar event creation for partners
 * Simulates exactly what the API does
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

async function testCalendarCreation(uid: number, partnerId: number, partnerName: string) {
  console.log(`\n========================================`);
  console.log(`Testing calendar event creation for: ${partnerName} (ID: ${partnerId})`);
  console.log(`========================================\n`);

  // Simulating exactly what the API does
  const body: any = {
    partner_id: partnerId,
    date: '2025-11-29',
    time: '14:00',
    note: 'Test from script'
  };

  const isLead = !!body.lead_id;
  const resModel = isLead ? 'crm.lead' : 'res.partner';
  const resId = isLead ? body.lead_id : body.partner_id;

  console.log(`📅 Creating appointment for ${resModel} ${resId}`);
  console.log(`isLead: ${isLead}`);
  console.log(`body.partner_id: ${body.partner_id}`);

  // Get partner name
  let recordName = '';
  try {
    const records = await jsonRpc(`${ODOO_URL}/web/dataset/call_kw/res.partner/search_read`, 'call', {
      model: 'res.partner',
      method: 'search_read',
      args: [[['id', '=', resId]]],
      kwargs: { fields: ['name'], limit: 1, context: { uid } }
    });
    recordName = records[0]?.name || '';
    console.log(`✅ Found partner name: ${recordName}`);
  } catch (e) {
    console.warn('⚠️ Cannot get record name:', e);
  }

  // Create datetime strings
  const startDateTime = `${body.date} ${body.time}:00`;
  const [hours, minutes] = body.time.split(':').map(Number);
  const endHours = hours + 1;
  const endTime = `${endHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  const stopDateTime = `${body.date} ${endTime}:00`;

  const calendarEventValues: any = {
    name: recordName ? `Appuntamento - ${recordName}` : `Appuntamento - ${body.date} alle ${body.time}`,
    start: startDateTime,
    stop: stopDateTime,
    description: body.note || '',
    user_id: uid,
  };

  // This is the key part - adding partner_ids for contacts
  console.log(`\n📋 Partner check: isLead=${isLead}, body.partner_id=${body.partner_id}, type=${typeof body.partner_id}`);

  if (!isLead && body.partner_id) {
    calendarEventValues.partner_ids = [[6, 0, [body.partner_id]]];
    console.log(`✅ Added partner_ids for contact: ${body.partner_id}`);
  } else if (!isLead) {
    console.log(`⚠️ Partner ID missing! Cannot add attendee for contact.`);
  }

  console.log('\n📅 Calendar event values:', JSON.stringify(calendarEventValues, null, 2));

  // Create calendar event
  try {
    const calendarEventId = await jsonRpc(`${ODOO_URL}/web/dataset/call_kw/calendar.event/create`, 'call', {
      model: 'calendar.event',
      method: 'create',
      args: [calendarEventValues],
      kwargs: { context: { uid } }
    });
    console.log(`\n✅ Calendar event created! ID: ${calendarEventId}`);
    return calendarEventId;
  } catch (error) {
    console.error('\n❌ CALENDAR EVENT CREATION FAILED:', error);
    throw error;
  }
}

async function main() {
  try {
    const session = await authenticate();
    const uid = session.uid;

    // Test with WINE FACTORY (ID: 1219 from the logs)
    await testCalendarCreation(uid, 1219, 'WINE FACTORY BY CATONE & LI CAVOLI');

    console.log('\n🎉 Test completed successfully!');
  } catch (error) {
    console.error('\n💥 Test failed:', error);
  }
}

main();
