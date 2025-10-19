/**
 * Quick API Test with Timeout
 */

async function quickTest() {
  const url = 'http://localhost:3004/api/maestro/avatars';
  console.log(`Testing: ${url}`);
  console.log('Starting at:', new Date().toISOString());

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

  try {
    const response = await fetch(url, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    console.log('Status:', response.status);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));

    const text = await response.text();
    console.log('Response length:', text.length);
    console.log('First 1000 chars:', text.substring(0, 1000));

    // Try to parse as JSON
    try {
      const data = JSON.parse(text);
      console.log('\nParsed JSON:');
      console.log('- Has avatars?', 'avatars' in data);
      console.log('- Has error?', 'error' in data);
      if (data.avatars) {
        console.log('- Avatar count:', data.avatars.length);
        if (data.avatars.length > 0) {
          console.log('- First avatar:', {
            id: data.avatars[0].id,
            name: data.avatars[0].name,
            health_score: data.avatars[0].health_score
          });
        }
      }
      if (data.error) {
        console.log('- Error:', data.error);
      }
    } catch (e) {
      console.log('Not valid JSON');
    }

  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.error('❌ Request timed out after 5 seconds');
    } else {
      console.error('❌ Error:', error.message);
    }
  }
}

quickTest();
