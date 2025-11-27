/**
 * Script per testare la creazione di un'attività su un lead in Odoo
 * Esegui con: npx ts-node scripts/test-create-activity.ts
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

async function getModelId(uid: number, modelName: string): Promise<number | null> {
  console.log(`\n🔍 Getting model ID for "${modelName}"...`);

  const result = await jsonRpc(`${ODOO_URL}/web/dataset/call_kw/ir.model/search_read`, 'call', {
    model: 'ir.model',
    method: 'search_read',
    args: [[['model', '=', modelName]]],
    kwargs: {
      fields: ['id', 'model', 'name'],
      limit: 1,
      context: { uid }
    }
  });

  if (result.length > 0) {
    console.log(`✅ Model found: ${result[0].name} (ID: ${result[0].id})`);
    return result[0].id;
  }
  console.log('❌ Model not found!');
  return null;
}

async function getActivityTypes(uid: number) {
  console.log('\n📋 Getting activity types...');

  const result = await jsonRpc(`${ODOO_URL}/web/dataset/call_kw/mail.activity.type/search_read`, 'call', {
    model: 'mail.activity.type',
    method: 'search_read',
    args: [[]],
    kwargs: {
      fields: ['id', 'name', 'category'],
      context: { uid }
    }
  });

  // Show only first 10
  console.log('Activity types found (first 10):');
  result.slice(0, 10).forEach((t: any) => console.log(`   - ${t.name} (ID: ${t.id})`));

  return result;
}

async function createActivityOnLead(uid: number, leadId: number, activityTypeId: number, modelId: number) {
  console.log(`\n📅 Creating activity on lead ${leadId}...`);

  // Use res_model_id instead of res_model!
  const activityValues = {
    res_model_id: modelId,  // This is the key fix!
    res_id: leadId,
    summary: 'Test Activity from Script',
    note: 'Nota di test',
    activity_type_id: activityTypeId,
    date_deadline: new Date().toISOString().split('T')[0],
    user_id: uid
  };

  console.log('Activity values:', JSON.stringify(activityValues, null, 2));

  const result = await jsonRpc(`${ODOO_URL}/web/dataset/call_kw/mail.activity/create`, 'call', {
    model: 'mail.activity',
    method: 'create',
    args: [activityValues],
    kwargs: { context: { uid } }
  });

  console.log(`✅ Activity created! ID: ${result}`);
  return result;
}

async function main() {
  try {
    // 1. Authenticate
    const session = await authenticate();
    const uid = session.uid;

    // 2. Get model ID for crm.lead
    const crmLeadModelId = await getModelId(uid, 'crm.lead');
    if (!crmLeadModelId) {
      console.log('Cannot proceed without model ID');
      return;
    }

    // 3. Get activity types and find To Do
    const activityTypes = await getActivityTypes(uid);
    const todoType = activityTypes.find((t: any) =>
      t.name.toLowerCase() === 'to do' ||
      t.name.toLowerCase() === 'todo'
    );

    const activityTypeId = todoType?.id || 4; // To Do is usually ID 4
    console.log(`\nUsing activity type ID: ${activityTypeId}`);

    // 4. Create activity on lead 7790 (Restaurant Linde)
    await createActivityOnLead(uid, 7790, activityTypeId, crmLeadModelId);

    console.log('\n🎉 Test completed successfully!');

  } catch (error) {
    console.error('\n💥 Test failed:', error);
  }
}

main();
