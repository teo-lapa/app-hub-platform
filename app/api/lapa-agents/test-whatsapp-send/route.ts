/**
 * Test endpoint to verify WhatsApp message sending
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOdooClient } from '@/lib/odoo-client';

export async function POST(request: NextRequest) {
  console.log('[TEST-WHATSAPP] Starting test...');

  // Debug: log environment variables (masked)
  console.log('[TEST-WHATSAPP] Env check:', {
    ODOO_URL: process.env.NEXT_PUBLIC_ODOO_URL ? 'SET' : 'NOT SET',
    ODOO_DB: process.env.ODOO_DB ? 'SET' : 'NOT SET',
    ODOO_USERNAME: process.env.ODOO_USERNAME ? 'SET' : 'NOT SET',
    ODOO_ADMIN_EMAIL: process.env.ODOO_ADMIN_EMAIL ? 'SET' : 'NOT SET',
    ODOO_PASSWORD: process.env.ODOO_PASSWORD ? 'SET' : 'NOT SET',
    ODOO_ADMIN_PASSWORD: process.env.ODOO_ADMIN_PASSWORD ? 'SET' : 'NOT SET',
  });

  try {
    const body = await request.json();
    const mobileNumber = body.mobile_number || '+41763730491';
    const message = body.message || `Test message at ${new Date().toISOString()}`;

    console.log('[TEST-WHATSAPP] Test params:', { mobileNumber, messageLength: message.length });

    // Get Odoo client
    console.log('[TEST-WHATSAPP] Getting Odoo client...');
    const odoo = await getOdooClient();
    console.log('[TEST-WHATSAPP] Odoo client obtained:', !!odoo);

    if (!odoo) {
      throw new Error('Failed to get Odoo client');
    }

    // Find channel
    const phoneLast9 = mobileNumber.replace(/\D/g, '').slice(-9);
    console.log('[TEST-WHATSAPP] Searching for channel with phone:', phoneLast9);

    const channels = await odoo.searchRead(
      'discuss.channel',
      [
        ['channel_type', '=', 'whatsapp'],
        ['whatsapp_number', 'ilike', phoneLast9]
      ],
      ['id', 'name'],
      1
    );

    console.log('[TEST-WHATSAPP] Channels found:', JSON.stringify(channels));

    if (channels.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No channel found for ' + mobileNumber
      });
    }

    const channelId = channels[0].id;
    console.log('[TEST-WHATSAPP] Posting to channel:', channelId);

    // Post message
    const result = await odoo.call(
      'discuss.channel',
      'message_post',
      [[channelId]],
      {
        body: message,
        message_type: 'whatsapp_message'
      }
    );

    console.log('[TEST-WHATSAPP] message_post result:', result);

    return NextResponse.json({
      success: true,
      channelId,
      messagePostResult: result,
      testMessage: message
    });

  } catch (error: any) {
    console.error('[TEST-WHATSAPP] Error:', error.message);
    console.error('[TEST-WHATSAPP] Stack:', error.stack);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    info: 'POST to test WhatsApp sending',
    params: {
      mobile_number: 'optional - defaults to +41763730491',
      message: 'optional - defaults to test message with timestamp'
    }
  });
}
