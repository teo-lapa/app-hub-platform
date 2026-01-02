/**
 * API Endpoint: Setup Odoo Webhook for WhatsApp AI Integration
 *
 * POST /api/lapa-agents/setup-whatsapp-webhook
 *
 * Creates an Automated Action in Odoo that automatically calls
 * the AI agents when a new WhatsApp message arrives.
 */

import { NextResponse } from 'next/server';
import { getOdooClient } from '@/lib/odoo-client';

export async function POST(request: Request) {
  try {
    console.log('[SETUP-WHATSAPP] Setting up Odoo automated action for WhatsApp AI...');

    const odoo = await getOdooClient();
    if (!odoo) {
      return NextResponse.json(
        { success: false, error: 'Failed to connect to Odoo' },
        { status: 500 }
      );
    }

    // Get the webhook URL from environment or request
    const { searchParams } = new URL(request.url);
    let webhookUrl = searchParams.get('webhook_url');

    if (!webhookUrl) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
                      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` :
                      'http://localhost:3000';
      webhookUrl = `${baseUrl}/api/lapa-agents/whatsapp-incoming`;
    }

    console.log('[SETUP-WHATSAPP] Webhook URL:', webhookUrl);

    // Python code that will be executed by Odoo when a new WhatsApp message arrives
    const pythonCode = `
# Automated Action: LAPA AI WhatsApp Integration
# Sends incoming WhatsApp messages to AI agents for processing
import requests
import json
import re

# Only process inbound messages (from customers)
if record.message_type == 'inbound':
    try:
        mobile_number = record.mobile_number or ''
        body = record.body or ''

        # Remove HTML tags from body
        body_text = re.sub('<[^<]+?>', '', body).strip()

        if body_text:
            # Get partner info from mail.message
            partner_id = None
            partner_name = None
            customer_type = 'anonymous'

            if record.mail_message_id and record.mail_message_id.author_id:
                author = record.mail_message_id.author_id
                partner_id = author.id
                partner_name = author.name
                # Determine customer type
                if author.is_company:
                    customer_type = 'b2b'
                elif author.parent_id:
                    customer_type = 'b2b'
                else:
                    customer_type = 'b2c'

            # Prepare payload for AI agents
            payload = {
                'whatsapp_message_id': record.id,
                'mobile_number': mobile_number,
                'message': body_text,
                'partner_id': partner_id,
                'partner_name': partner_name,
                'customer_type': customer_type,
                'wa_account_id': record.wa_account_id.id if record.wa_account_id else None
            }

            # Call the AI agents webhook
            try:
                response = requests.post(
                    '${webhookUrl}',
                    json=payload,
                    timeout=30,
                    headers={'Content-Type': 'application/json'}
                )
                if response.status_code == 200:
                    result = response.json()
                    if result.get('success'):
                        # Log that AI responded
                        record.message_post(body='[LAPA AI] Messaggio processato')
            except Exception as e:
                # Log error but don't fail
                record.message_post(body='[LAPA AI Error] ' + str(e)[:200])

    except Exception as e:
        # Log but don't fail the message processing
        pass
`;

    // Check if automated action already exists
    const existingActions = await odoo.searchRead(
      'base.automation',
      [['name', '=', 'LAPA AI - WhatsApp Integration']],
      ['id'],
      1
    );

    let actionId: number | number[];

    // Get whatsapp.message model ID
    const waMessageModel = await odoo.searchRead(
      'ir.model',
      [['model', '=', 'whatsapp.message']],
      ['id'],
      1
    );

    if (waMessageModel.length === 0) {
      return NextResponse.json(
        { success: false, error: 'whatsapp.message model not found in Odoo' },
        { status: 500 }
      );
    }

    if (existingActions.length > 0) {
      // Update existing action
      actionId = existingActions[0].id;
      await odoo.write('base.automation', [actionId as number], {
        code: pythonCode,
        active: true
      });
      console.log('[SETUP-WHATSAPP] Updated existing automated action:', actionId);
    } else {
      // Create new automated action
      const createResult = await odoo.create('base.automation', {
        name: 'LAPA AI - WhatsApp Integration',
        model_id: waMessageModel[0].id,
        trigger: 'on_create',  // Trigger when new message is created
        state: 'code',
        code: pythonCode,
        active: true
      } as any);
      actionId = Array.isArray(createResult) ? createResult[0] : createResult;
      console.log('[SETUP-WHATSAPP] Created new automated action:', actionId);
    }

    return NextResponse.json({
      success: true,
      message: 'WhatsApp AI integration configured successfully',
      webhookUrl,
      actionId
    });

  } catch (error: any) {
    console.error('[SETUP-WHATSAPP] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    info: 'POST to this endpoint to setup Odoo automated actions for WhatsApp AI integration',
    params: {
      webhook_url: 'Optional - URL to call (defaults to current app URL + /api/lapa-agents/whatsapp-incoming)'
    }
  });
}
