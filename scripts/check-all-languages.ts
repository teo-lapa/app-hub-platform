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

    console.log(`📖 Testing different language contexts for article ${articleId}:\n`);

    // No language context
    console.log('1️⃣ No language context (default):');
    const default_lang = await read('blog.post', [articleId], ['id', 'name', 'content'], {});
    console.log(`   Content length: ${default_lang[0].content?.length || 0} characters`);
    if (default_lang[0].content && default_lang[0].content.length > 10) {
      console.log(`   Preview: ${default_lang[0].content.substring(0, 150)}...`);
    } else {
      console.log(`   Content: ${default_lang[0].content}`);
    }

    // Italian
    console.log('\n2️⃣ Italian (it_IT):');
    const italian = await read('blog.post', [articleId], ['id', 'name', 'content'], { lang: 'it_IT' });
    console.log(`   Content length: ${italian[0].content?.length || 0} characters`);
    console.log(`   Content: ${italian[0].content}`);

    // French
    console.log('\n3️⃣ French (fr_CH):');
    const french = await read('blog.post', [articleId], ['id', 'name', 'content'], { lang: 'fr_CH' });
    console.log(`   Content length: ${french[0].content?.length || 0} characters`);
    console.log(`   Content: ${french[0].content}`);

    // English
    console.log('\n4️⃣ English (en_US):');
    const english = await read('blog.post', [articleId], ['id', 'name', 'content'], { lang: 'en_US' });
    console.log(`   Content length: ${english[0].content?.length || 0} characters`);
    if (english[0].content && english[0].content.length > 10) {
      console.log(`   Preview: ${english[0].content.substring(0, 150)}...`);
    } else {
      console.log(`   Content: ${english[0].content}`);
    }

    // German
    console.log('\n5️⃣ German (de_DE):');
    const german = await read('blog.post', [articleId], ['id', 'name', 'content'], { lang: 'de_DE' });
    console.log(`   Content length: ${german[0].content?.length || 0} characters`);
    if (german[0].content && german[0].content.length > 10) {
      console.log(`   Preview: ${german[0].content.substring(0, 150)}...`);
    } else {
      console.log(`   Content: ${german[0].content}`);
    }

    console.log('\n📊 Summary:');
    console.log(`  Default: ${default_lang[0].content?.length || 0} chars`);
    console.log(`  Italian: ${italian[0].content?.length || 0} chars`);
    console.log(`  French: ${french[0].content?.length || 0} chars`);
    console.log(`  English: ${english[0].content?.length || 0} chars`);
    console.log(`  German: ${german[0].content?.length || 0} chars`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main();
