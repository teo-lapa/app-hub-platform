/**
 * Script di debug per controllare lo stato della connessione Gmail
 * Uso: node --loader ts-node/esm scripts/debug-gmail-connection.ts
 */

import { sql } from '@vercel/postgres';

async function debugGmailConnection() {
  try {
    console.log('🔍 Checking Gmail connections...\n');

    // Get all active Gmail connections
    const result = await sql`
      SELECT
        id,
        gmail_address,
        LENGTH(access_token) as access_token_len,
        LENGTH(refresh_token) as refresh_token_len,
        token_expires_at,
        sync_enabled,
        created_at,
        updated_at
      FROM gmail_connections
      WHERE sync_enabled = true
      ORDER BY updated_at DESC
      LIMIT 5
    `;

    if (result.rows.length === 0) {
      console.log('❌ No active Gmail connections found');
      return;
    }

    console.log(`✅ Found ${result.rows.length} active connection(s):\n`);

    for (const conn of result.rows) {
      const tokenExpiry = new Date(conn.token_expires_at);
      const now = new Date();
      const isExpired = tokenExpiry < now;
      const minutesUntilExpiry = Math.round((tokenExpiry.getTime() - now.getTime()) / 60000);

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📧 Gmail: ${conn.gmail_address}`);
      console.log(`🆔 ID: ${conn.id}`);
      console.log(`🔑 Access Token Length: ${conn.access_token_len} chars`);
      console.log(`🔄 Refresh Token Length: ${conn.refresh_token_len || 'NULL ❌'} chars`);
      console.log(`⏰ Token Expires: ${tokenExpiry.toISOString()}`);
      console.log(`📊 Status: ${isExpired ? '🔴 EXPIRED' : '🟢 VALID'}`);

      if (!isExpired) {
        console.log(`⏳ Expires in: ${minutesUntilExpiry} minutes`);
      }

      if (!conn.refresh_token_len) {
        console.log('⚠️  WARNING: NO REFRESH TOKEN - Cannot auto-refresh!');
        console.log('💡 Solution: User must disconnect and reconnect Gmail');
      }

      console.log(`📅 Created: ${new Date(conn.created_at).toLocaleString('it-IT')}`);
      console.log(`🔄 Updated: ${new Date(conn.updated_at).toLocaleString('it-IT')}`);
      console.log('');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Check for connections without refresh_token
    const noRefreshToken = result.rows.filter(r => !r.refresh_token_len);
    if (noRefreshToken.length > 0) {
      console.log('🚨 CRITICAL ISSUE FOUND:');
      console.log(`   ${noRefreshToken.length} connection(s) missing refresh_token`);
      console.log('   These connections will fail when access_token expires!');
      console.log('\n📝 ACTION REQUIRED:');
      console.log('   1. User must click "Disconnetti" in Email AI Monitor');
      console.log('   2. User must click "Connetti Gmail" again');
      console.log('   3. New OAuth flow with prompt=consent will provide refresh_token');
    } else {
      console.log('✅ All connections have valid refresh_token');
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

debugGmailConnection()
  .then(() => {
    console.log('\n✅ Debug complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Debug failed:', error);
    process.exit(1);
  });
