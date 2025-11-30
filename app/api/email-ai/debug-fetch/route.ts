import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { GmailClient } from '@/lib/email-ai/gmail-client';

export const runtime = 'nodejs';

/**
 * GET /api/email-ai/debug-fetch?connectionId=xxx
 * Debug endpoint to test email fetching step by step
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const connectionId = searchParams.get('connectionId');

  if (!connectionId) {
    return NextResponse.json({ error: 'connectionId required' }, { status: 400 });
  }

  const debug: any = {
    step: '',
    connectionId,
    timestamp: new Date().toISOString(),
    errors: []
  };

  try {
    // STEP 1: Check connection exists
    debug.step = 'Checking connection in database';
    const connectionResult = await sql`
      SELECT
        id,
        user_id,
        gmail_address,
        refresh_token IS NOT NULL as has_refresh_token,
        token_expires_at,
        sync_enabled
      FROM gmail_connections
      WHERE id = ${connectionId}
      LIMIT 1
    `;

    if (connectionResult.rows.length === 0) {
      debug.errors.push('Connection not found in database');
      return NextResponse.json(debug, { status: 404 });
    }

    const connection = connectionResult.rows[0];
    debug.connection = {
      id: connection.id,
      email: connection.gmail_address,
      has_refresh_token: connection.has_refresh_token,
      token_expires_at: connection.token_expires_at,
      sync_enabled: connection.sync_enabled
    };

    if (!connection.has_refresh_token) {
      debug.errors.push('No refresh_token found - user must re-authorize');
      return NextResponse.json(debug, { status: 500 });
    }

    // STEP 2: Initialize Gmail client
    debug.step = 'Initializing Gmail client';
    try {
      const gmailClient = await GmailClient.fromConnectionId(connectionId);
      debug.gmailClient = 'Initialized successfully';

      // STEP 3: Try to fetch messages
      debug.step = 'Fetching message IDs from Gmail';
      const messageIds = await gmailClient.listMessages({ maxResults: 1, query: 'is:unread' });
      debug.messageCount = messageIds.length;

      if (messageIds.length > 0) {
        // STEP 4: Try to fetch one message details
        debug.step = 'Fetching first message details';
        const firstMessage = await gmailClient.getMessage(messageIds[0]);
        debug.firstMessage = {
          id: firstMessage.id,
          subject: firstMessage.subject,
          from: firstMessage.from,
          snippet: firstMessage.snippet?.substring(0, 100)
        };
      }

      debug.step = 'Success!';
      debug.success = true;

    } catch (gmailError: any) {
      debug.errors.push({
        step: debug.step,
        error: gmailError.message,
        stack: gmailError.stack
      });
      return NextResponse.json(debug, { status: 500 });
    }

    return NextResponse.json(debug);

  } catch (error: any) {
    debug.errors.push({
      step: debug.step,
      error: error.message,
      stack: error.stack
    });
    return NextResponse.json(debug, { status: 500 });
  }
}
