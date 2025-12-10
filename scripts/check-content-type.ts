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
    console.log(`✅ Authenticated!\n`);

    const articleId = 89;

    console.log(`📖 Reading article ID ${articleId}...`);
    const posts = await read('blog.post', [articleId], ['id', 'name', 'content'], {});

    console.log('\n📊 Content Analysis:');
    console.log('  Type of content:', typeof posts[0].content);
    console.log('  Content value:', posts[0].content);
    console.log('  Is Array?:', Array.isArray(posts[0].content));
    console.log('  Constructor:', posts[0].content?.constructor?.name);

    if (posts[0].content && typeof posts[0].content === 'object') {
      console.log('  Object keys:', Object.keys(posts[0].content));
      console.log('  Object values:', Object.values(posts[0].content));
    }

    console.log('\n📝 Full post object:');
    console.log(JSON.stringify(posts[0], null, 2));

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main();
