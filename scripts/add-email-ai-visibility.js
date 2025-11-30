/**
 * Script per aggiungere Email AI Monitor al sistema di visibilità
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://staging.hub.lapa.ch';

async function addEmailAIVisibility() {
  console.log('🚀 Adding Email AI Monitor to visibility system...');

  try {
    const response = await fetch(`${BASE_URL}/api/apps/visibility`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        'email-ai-1': {
          visible: true,
          visibilityGroup: 'all',
          excludedUsers: [],
          excludedCustomers: [],
          developmentStatus: 'pronta'
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    const result = await response.json();
    console.log('✅ Email AI Monitor visibility added successfully:', result);
  } catch (error) {
    console.error('❌ Error adding Email AI Monitor visibility:', error);
    process.exit(1);
  }
}

addEmailAIVisibility();
