// Test script to check time attendance data in the database
// Run with: node test-time-attendance-export.js

const https = require('https');

// Use staging URL
const BASE_URL = 'https://lapa-app-hub-staging.vercel.app';

async function testExport() {
  // Test with company_id=1 and format=json to see the data
  const url = `${BASE_URL}/api/time-attendance/export?company_id=1&format=json`;

  console.log('Testing export API...');
  console.log('URL:', url);

  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          console.log('\n=== EXPORT API RESPONSE ===');
          console.log('Success:', json.success);

          if (json.success && json.data) {
            console.log('Period:', json.data.period);
            console.log('Stats:', json.data.stats);
            console.log('Reports count:', json.data.reports?.length || 0);

            if (json.data.reports?.length > 0) {
              console.log('\nSample report:');
              console.log(JSON.stringify(json.data.reports[0], null, 2));
            } else {
              console.log('\n⚠️  NO DATA FOUND!');
              console.log('This means there are no entries for company_id=1 in the selected period.');
            }
          } else {
            console.log('Error:', json.error);
            console.log('Details:', json.details);
          }
          resolve();
        } catch (e) {
          console.log('Raw response:', data.substring(0, 500));
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// Also test dashboard to see what company_id has data
async function testDashboard() {
  const url = `${BASE_URL}/api/time-attendance/dashboard?company_id=1`;

  console.log('\n\nTesting dashboard API...');
  console.log('URL:', url);

  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          console.log('\n=== DASHBOARD API RESPONSE ===');
          console.log('Success:', json.success);

          if (json.success && json.data) {
            console.log('Employees count:', json.data.employees?.length || 0);
            console.log('Stats:', json.data.stats);

            if (json.data.employees?.length > 0) {
              console.log('\nEmployees found:');
              json.data.employees.forEach(emp => {
                console.log(`  - ${emp.contact_name} (ID: ${emp.contact_id}, company: ${emp.company_id || 'unknown'})`);
              });
            }
          } else {
            console.log('Error:', json.error);
          }
          resolve();
        } catch (e) {
          console.log('Raw response:', data.substring(0, 500));
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// Run tests
(async () => {
  try {
    await testExport();
    await testDashboard();
  } catch (e) {
    console.error('Error:', e);
  }
})();
