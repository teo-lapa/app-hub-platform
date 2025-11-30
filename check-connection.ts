// Use TypeScript with ts-node
import { config } from 'dotenv';
import { sql } from '@vercel/postgres';
import * as path from 'path';

// Load environment variables from .env.staging
config({ path: path.join(__dirname, '.env.staging') });

async function checkConnection() {
  try {
    const result = await sql`
      SELECT
        id,
        gmail_address,
        refresh_token IS NOT NULL as has_refresh_token,
        LENGTH(refresh_token) as token_length,
        token_expires_at,
        sync_enabled,
        created_at,
        updated_at
      FROM gmail_connections
      ORDER BY created_at DESC
    `;

    console.log('=== Gmail Connections in Database ===\n');
    if (result.rows.length === 0) {
      console.log('❌ NO Gmail connections found in database!');
    } else {
      console.log(`Found ${result.rows.length} Gmail connection(s):\n`);
      result.rows.forEach((conn, index) => {
        console.log(`[${index + 1}] Connection:`);
        console.log('  ID:', conn.id);
        console.log('  Email:', conn.gmail_address);
        console.log('  Has refresh_token:', conn.has_refresh_token);
        console.log('  Token length:', conn.token_length || 'NULL');
        console.log('  Token expires:', conn.token_expires_at);
        console.log('  Sync enabled:', conn.sync_enabled);
        console.log('  Created:', conn.created_at);
        console.log('  Updated:', conn.updated_at);

        if (!conn.has_refresh_token) {
          console.log('  ⚠️  WARNING: refresh_token is NULL!');
        }
        console.log('');
      });
    }
  } catch (error) {
    console.error('Error querying database:', error);
  }
}

checkConnection();
