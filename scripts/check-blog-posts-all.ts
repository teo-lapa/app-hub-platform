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

async function searchBlogPosts(domain: any[] = []) {
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
        domain: domain,
        fields: ['id', 'name', 'website_published', 'create_date'],
        kwargs: {
          limit: 200,
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

    console.log('📚 Fetching ALL blog posts (no language filter)...');
    const allPosts = await searchBlogPosts();

    console.log(`\n✅ Found ${allPosts.length} total blog posts:\n`);

    if (allPosts.length > 0) {
      allPosts.forEach((post: any, index: number) => {
        console.log(`${index + 1}. ID: ${post.id} - "${post.name}"`);
      });

      console.log(`\n📊 Post IDs range from ${allPosts[0]?.id} to ${allPosts[allPosts.length - 1]?.id}`);

      // Check specifically for IDs 75-89
      console.log('\n🔍 Checking for requested IDs (75-89):');
      const requestedIds = Array.from({ length: 15 }, (_, i) => 75 + i);
      const foundIds = allPosts.filter((p: any) => requestedIds.includes(p.id));

      if (foundIds.length > 0) {
        console.log(`✅ Found ${foundIds.length} posts in the requested range:`);
        foundIds.forEach((p: any) => console.log(`   - ID ${p.id}: ${p.name}`));
      } else {
        console.log('❌ None of the requested IDs (75-89) were found');
      }

      // Show posts around ID 75-89 if they exist
      const nearbyPosts = allPosts.filter((p: any) => p.id >= 70 && p.id <= 95);
      if (nearbyPosts.length > 0) {
        console.log('\n📍 Posts with IDs near 75-89:');
        nearbyPosts.forEach((p: any) => console.log(`   - ID ${p.id}: ${p.name}`));
      }
    } else {
      console.log('❌ No blog posts found in the database!');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main();
