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

async function read(model: string, ids: number[], fields: string[], context: any = {}): Promise<any[]> {
  const records = await xmlrpcCall(objectClient, 'execute_kw', [
    ODOO_CONFIG.db,
    uid,
    ODOO_CONFIG.password,
    model,
    'read',
    [ids],
    { fields: fields, context: context }
  ]);
  return records;
}

async function main() {
  try {
    console.log('🔐 Authenticating...');
    uid = await authenticate();
    console.log(`✅ Authenticated! User ID: ${uid}\n`);

    // Read one article in both Italian and French
    const articleId = 89;

    console.log(`📖 Reading article ID ${articleId} in Italian (it_IT)...`);
    const italian = await read('blog.post', [articleId], ['id', 'name', 'content'], { lang: 'it_IT' });
    console.log(`\nITALIAN VERSION:`);
    console.log(`Title: ${italian[0].name}`);
    console.log(`Content preview: ${italian[0].content?.substring(0, 300)}...\n`);

    console.log(`📖 Reading article ID ${articleId} in French (fr_CH)...`);
    const french = await read('blog.post', [articleId], ['id', 'name', 'content'], { lang: 'fr_CH' });
    console.log(`\nFRENCH VERSION:`);
    console.log(`Title: ${french[0].name}`);
    console.log(`Content preview: ${french[0].content?.substring(0, 300)}...\n`);

    // Check if the content is actually different
    if (italian[0].content === french[0].content) {
      console.log('⚠️  WARNING: Italian and French content are identical!');
      console.log('   This suggests the translation may not have worked properly.');
    } else {
      console.log('✅ Content is different between languages - translation successful!');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main();
