/**
 * Script per testare la creazione di un appuntamento completo per un partner
 * (come fa l'API create-appointment)
 * Esegui con: npx ts-node scripts/test-partner-appointment.ts
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

async function getModelId(uid: number, modelName: string): Promise<number | null> {
  console.log(`\n🔍 Getting model ID for "${modelName}"...`);
  const result = await jsonRpc(`${ODOO_URL}/web/dataset/call_kw/ir.model/search_read`, 'call', {
    model: 'ir.model',
    method: 'search_read',
    args: [[['model', '=', modelName]]],
    kwargs: { fields: ['id', 'model', 'name'], limit: 1, context: { uid } }
  });
  if (result.length > 0) {
    console.log(`✅ Model found: ${result[0].name} (ID: ${result[0].id})`);
    return result[0].id;
  }
  return null;
}

async function getMeetingActivityType(uid: number): Promise<number | null> {
  console.log('\n📋 Getting activity types...');
  const result = await jsonRpc(`${ODOO_URL}/web/dataset/call_kw/mail.activity.type/search_read`, 'call', {
    model: 'mail.activity.type',
    method: 'search_read',
    args: [[]],
    kwargs: { fields: ['id', 'name'], context: { uid } }
  });

  console.log('Activity types:');
  result.slice(0, 10).forEach((t: any) => console.log(`   - ${t.name} (ID: ${t.id})`));

  // Find Meeting type
  const meetingType = result.find((t: any) =>
    ['meeting', 'riunione', 'appuntamento'].some(k => t.name.toLowerCase().includes(k))
  );

  if (meetingType) {
    console.log(`\n✅ Using Meeting type: ${meetingType.name} (ID: ${meetingType.id})`);
    return meetingType.id;
  }
  return result[0]?.id || null;
}

async function createAppointmentForPartner(uid: number, partnerId: number, partnerName: string) {
  console.log(`\n========================================`);
  console.log(`Creating appointment for PARTNER: ${partnerName} (ID: ${partnerId})`);
  console.log(`========================================`);

  // 1. Get model ID for res.partner
  const resPartnerModelId = await getModelId(uid, 'res.partner');
  if (!resPartnerModelId) {
    throw new Error('Cannot find res.partner model');
  }

  // 2. Get meeting activity type
  const meetingTypeId = await getMeetingActivityType(uid);

  // 3. Create datetime strings
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().split('T')[0];
  const timeStr = '14:00';
  const startDateTime = `${dateStr} ${timeStr}:00`;
  const stopDateTime = `${dateStr} 15:00:00`;

  // 4. Create mail.activity (same as for leads)
  console.log('\n📅 Creating mail.activity...');
  const activityValues = {
    res_model_id: resPartnerModelId,
    res_id: partnerId,
    summary: `Appuntamento - ${dateStr} alle ${timeStr}`,
    note: `Ora: ${timeStr}\n\nTest appointment from script`,
    activity_type_id: meetingTypeId,
    date_deadline: dateStr,
    user_id: uid
  };
  console.log('Activity values:', JSON.stringify(activityValues, null, 2));

  const activityId = await jsonRpc(`${ODOO_URL}/web/dataset/call_kw/mail.activity/create`, 'call', {
    model: 'mail.activity',
    method: 'create',
    args: [activityValues],
    kwargs: { context: { uid } }
  });
  console.log(`✅ Activity created! ID: ${activityId}`);

  // 5. Create calendar.event
  console.log('\n📅 Creating calendar.event...');
  const calendarEventValues = {
    name: `Appuntamento - ${partnerName}`,
    start: startDateTime,
    stop: stopDateTime,
    description: 'Test appointment from script',
    user_id: uid,
    partner_ids: [[6, 0, [partnerId]]], // Add partner as attendee
  };
  console.log('Calendar event values:', JSON.stringify(calendarEventValues, null, 2));

  const calendarEventId = await jsonRpc(`${ODOO_URL}/web/dataset/call_kw/calendar.event/create`, 'call', {
    model: 'calendar.event',
    method: 'create',
    args: [calendarEventValues],
    kwargs: { context: { uid } }
  });
  console.log(`✅ Calendar event created! ID: ${calendarEventId}`);

  return { activityId, calendarEventId };
}

async function main() {
  try {
    const session = await authenticate();
    const uid = session.uid;

    // Find jirrolle Hygieneartikel or another partner
    console.log('\n🔍 Finding jirrolle Hygieneartikel...');
    let partners = await jsonRpc(`${ODOO_URL}/web/dataset/call_kw/res.partner/search_read`, 'call', {
      model: 'res.partner',
      method: 'search_read',
      args: [[['name', 'ilike', 'jirrolle']]],
      kwargs: { fields: ['id', 'name'], limit: 5, context: { uid } }
    });

    if (partners.length === 0) {
      console.log('jirrolle not found, using first customer...');
      partners = await jsonRpc(`${ODOO_URL}/web/dataset/call_kw/res.partner/search_read`, 'call', {
        model: 'res.partner',
        method: 'search_read',
        args: [[['is_company', '=', true], ['customer_rank', '>', 0]]],
        kwargs: { fields: ['id', 'name'], limit: 1, context: { uid } }
      });
    }

    if (partners.length > 0) {
      const partner = partners[0];
      console.log(`\n✅ Found partner: ${partner.name} (ID: ${partner.id})`);

      await createAppointmentForPartner(uid, partner.id, partner.name);
      console.log('\n🎉 Test completed successfully!');
    } else {
      console.log('❌ No partners found');
    }

  } catch (error) {
    console.error('\n💥 Test failed:', error);
  }
}

main();
