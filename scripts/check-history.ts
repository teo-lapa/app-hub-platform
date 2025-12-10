import * as xmlrpc from 'xmlrpc';

const ODOO_CONFIG = {
  url: 'lapadevadmin-lapa-v2-main-7268478.dev.odoo.com',
  db: 'lapadevadmin-lapa-v2-main-7268478',
  username: 'paul@lapa.ch',
  password: 'lapa201180',
  port: 443
};

let uid: number = 0;

const commonClient = xmlrpc.createSecureClient({
  host: ODOO_CONFIG.url,
  port: ODOO_CONFIG.port,
  path: '/xmlrpc/2/common'
});

const objectClient = xmlrpc.createSecureClient({
  host: ODOO_CONFIG.url,
  port: ODOO_CONFIG.port,
  path: '/xmlrpc/2/object'
});

function xmlrpcCall(client: any, method: string, params: any[]): Promise<any> {
  return new Promise((resolve, reject) => {
    client.methodCall(method, params, (error: any, value: any) => {
      if (error) {
        reject(error);
      } else {
        resolve(value);
      }
    });
  });
}

async function authenticate(): Promise<number> {
  const uid = await xmlrpcCall(commonClient, 'authenticate', [
    ODOO_CONFIG.db,
    ODOO_CONFIG.username,
    ODOO_CONFIG.password,
    {}
  ]);
  return uid;
}

async function searchRead(model: string, domain: any[], fields: string[], limit: number = 10): Promise<any[]> {
  const records = await xmlrpcCall(objectClient, 'execute_kw', [
    ODOO_CONFIG.db,
    uid,
    ODOO_CONFIG.password,
    model,
    'search_read',
    [domain],
    { fields: fields, limit: limit, order: 'id desc' }
  ]);
  return records;
}

async function main() {
  try {
    console.log('🔐 Authenticating...');
    uid = await authenticate();
    console.log(`✅ Authenticated!\n`);

    const articleId = 89;

    console.log(`🔍 Checking for history/audit logs for article ${articleId}...\n`);

    // Check mail.message (Odoo's tracking system)
    console.log('1️⃣ Checking mail.message for blog.post changes:');
    try {
      const messages = await searchRead(
        'mail.message',
        [['model', '=', 'blog.post'], ['res_id', '=', articleId]],
        ['id', 'date', 'body', 'author_id', 'tracking_value_ids'],
        20
      );
      console.log(`   Found ${messages.length} messages`);
      messages.forEach((msg, i) => {
        console.log(`   ${i + 1}. Date: ${msg.date}, Author: ${msg.author_id}, Tracking: ${msg.tracking_value_ids}`);
        if (msg.body && msg.body.length < 200) {
          console.log(`      Body: ${msg.body}`);
        }
      });
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
    }

    // Check auditlog.log if available
    console.log('\n2️⃣ Checking auditlog.log (if module is installed):');
    try {
      const auditlogs = await searchRead(
        'auditlog.log',
        [['model_id.model', '=', 'blog.post'], ['res_id', '=', articleId]],
        ['id', 'create_date', 'method', 'user_id', 'line_ids'],
        20
      );
      console.log(`   Found ${auditlogs.length} audit logs`);
      auditlogs.forEach((log, i) => {
        console.log(`   ${i + 1}. Date: ${log.create_date}, Method: ${log.method}, User: ${log.user_id}`);
      });
    } catch (error: any) {
      console.log(`   ⚠️  Auditlog module not installed or not accessible`);
    }

    // Check ir.attachment for possible backups
    console.log('\n3️⃣ Checking attachments:');
    try {
      const attachments = await searchRead(
        'ir.attachment',
        [['res_model', '=', 'blog.post'], ['res_id', '=', articleId]],
        ['id', 'name', 'datas_fname', 'create_date'],
        10
      );
      console.log(`   Found ${attachments.length} attachments`);
      attachments.forEach((att, i) => {
        console.log(`   ${i + 1}. Name: ${att.name}, File: ${att.datas_fname}, Date: ${att.create_date}`);
      });
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
    }

    console.log('\n💡 Suggestions:');
    console.log('   - Check if Odoo has database backups');
    console.log('   - Contact Odoo support if this is a production instance');
    console.log('   - Check if the website has a cached version of the blog posts');
    console.log('   - Look for content in any staging/development environments');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main();
