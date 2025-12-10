import fetch from 'node-fetch';

const ODOO_CONFIG = {
  url: 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com',
  db: 'lapadevadmin-lapa-v2-main-7268478',
  username: 'paul@lapa.ch',
  password: 'lapa201180'
};

let sessionId: string = '';

async function authenticate(): Promise<string> {
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
      return sessionMatch[1];
    }
  }

  throw new Error('Authentication failed');
}

async function checkBlogPosts() {
  const response = await fetch(`${ODOO_CONFIG.url}/web/dataset/call_kw/blog.post/search_read`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `session_id=${sessionId}`
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model: 'blog.post',
        domain: [],
        fields: ['id', 'name', 'website_published'],
        kwargs: {
          context: { lang: 'it_IT' },
          limit: 100,
          order: 'id asc'
        }
      },
      id: Date.now()
    })
  });

  const data: any = await response.json();
  return data.result || [];
}

async function main() {
  try {
    console.log('🔐 Authenticating with Odoo...');
    sessionId = await authenticate();
    console.log('✅ Authentication successful!\n');

    console.log('📚 Fetching all blog posts...');
    const posts = await checkBlogPosts();

    console.log(`\n✅ Found ${posts.length} blog posts:\n`);

    posts.forEach((post: any, index: number) => {
      console.log(`${index + 1}. ID: ${post.id} - "${post.name}" (Published: ${post.website_published})`);
    });

    console.log(`\n📊 Post IDs range from ${posts[0]?.id || 'N/A'} to ${posts[posts.length - 1]?.id || 'N/A'}`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main();
