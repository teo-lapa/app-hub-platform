import fetch from 'node-fetch';

const ODOO_CONFIG = {
  url: 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com',
  db: 'lapadevadmin-lapa-v2-main-7268478',
  username: 'paul@lapa.ch',
  password: 'lapa201180'
};

let sessionId: string = '';

async function authenticate(): Promise<any> {
  const response = await fetch(`${ODOO_CONFIG.url}/web/session/authenticate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        db: ODOO_CONFIG.db,
        login: ODOO_CONFIG.username,
        password: ODOO_CONFIG.password
      },
      id: Date.now()
    })
  });

  const data: any = await response.json();
  const cookies = response.headers.get('set-cookie');

  if (cookies) {
    const sessionMatch = cookies.match(/session_id=([^;]+)/);
    if (sessionMatch) {
      sessionId = sessionMatch[1];
    }
  }

  return data.result;
}

async function searchRecords(model: string, domain: any[] = [], fields: string[] = ['id', 'name']) {
  const response = await fetch(`${ODOO_CONFIG.url}/web/dataset/call_kw/${model}/search_read`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `session_id=${sessionId}`
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model: model,
        domain: domain,
        fields: fields,
        kwargs: {
          limit: 20
        }
      },
      id: Date.now()
    })
  });

  const data: any = await response.json();
  return data;
}

async function main() {
  try {
    console.log('🔐 Authenticating with Odoo...');
    const authResult = await authenticate();
    console.log('✅ Authentication result:', JSON.stringify(authResult, null, 2));
    console.log('Session ID:', sessionId);

    console.log('\n📊 Testing access to different models...\n');

    // Test blog.post
    console.log('1️⃣ Testing blog.post model:');
    const blogResult = await searchRecords('blog.post');
    if (blogResult.error) {
      console.log('❌ Error:', blogResult.error.message);
    } else {
      console.log('✅ Success! Found', blogResult.result?.length || 0, 'records');
      if (blogResult.result && blogResult.result.length > 0) {
        console.log('   First record:', blogResult.result[0]);
      }
    }

    // Test with specific IDs
    console.log('\n2️⃣ Testing blog.post with specific IDs (75-89):');
    const specificResult = await searchRecords('blog.post', [['id', 'in', [75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89]]]);
    if (specificResult.error) {
      console.log('❌ Error:', specificResult.error.message);
    } else {
      console.log('✅ Success! Found', specificResult.result?.length || 0, 'records');
      if (specificResult.result && specificResult.result.length > 0) {
        specificResult.result.forEach((r: any) => console.log(`   - ID ${r.id}: ${r.name}`));
      }
    }

    // Test blog.blog
    console.log('\n3️⃣ Testing blog.blog model:');
    const blogBlogResult = await searchRecords('blog.blog');
    if (blogBlogResult.error) {
      console.log('❌ Error:', blogBlogResult.error.message);
    } else {
      console.log('✅ Success! Found', blogBlogResult.result?.length || 0, 'blogs');
      if (blogBlogResult.result && blogBlogResult.result.length > 0) {
        blogBlogResult.result.forEach((r: any) => console.log(`   - Blog ID ${r.id}: ${r.name}`));
      }
    }

    // Test res.partner
    console.log('\n4️⃣ Testing res.partner model (sanity check):');
    const partnerResult = await searchRecords('res.partner', [], ['id', 'name', 'email']);
    if (partnerResult.error) {
      console.log('❌ Error:', partnerResult.error.message);
    } else {
      console.log('✅ Success! Found', partnerResult.result?.length || 0, 'partners');
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

main();
