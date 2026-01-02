/**
 * API Endpoint: Handle Incoming WhatsApp Messages
 *
 * POST /api/lapa-agents/whatsapp-incoming
 *
 * Receives WhatsApp messages from Odoo webhook automation,
 * processes them with AI agents, and sends response back via WhatsApp.
 *
 * Supports Odoo native webhook format:
 * { id, body, mobile_number, message_type, wa_account_id, mail_message_id }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrchestrator } from '@/lib/lapa-agents/orchestrator';
import { getOdooClient } from '@/lib/odoo-client';
import { addMessageToConversation, loadConversation } from '@/lib/lapa-agents/conversation-store';

// Odoo native webhook format
interface OdooWebhookPayload {
  _model?: string;
  _name?: string;
  id: number;
  body?: string;          // HTML content
  mobile_number?: string;
  message_type?: string;  // 'inbound' | 'outbound'
  wa_account_id?: number;
  mail_message_id?: number;
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json();

    console.log('[WHATSAPP-INCOMING] Received raw:', JSON.stringify(rawBody).substring(0, 200));

    // Parse Odoo webhook format
    const odooPayload = rawBody as OdooWebhookPayload;

    // Only process inbound messages (from customers to us)
    if (odooPayload.message_type && odooPayload.message_type !== 'inbound') {
      console.log('[WHATSAPP-INCOMING] Skipping outbound message');
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'outbound message'
      });
    }

    // Extract and clean message content (remove HTML tags)
    const messageBody = odooPayload.body || '';
    const cleanMessage = messageBody.replace(/<[^>]*>/g, '').trim();

    const mobileNumber = odooPayload.mobile_number || '';
    const waAccountId = odooPayload.wa_account_id;
    const messageId = odooPayload.id;

    console.log('[WHATSAPP-INCOMING] Parsed:', {
      messageId,
      from: mobileNumber,
      message: cleanMessage?.substring(0, 50) + '...',
      messageType: odooPayload.message_type
    });

    // Validate required fields
    if (!cleanMessage || !mobileNumber) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: body and mobile_number'
      }, { status: 400 });
    }

    // Create session ID based on phone number
    const sessionId = `whatsapp-${mobileNumber.replace(/[\+\s]/g, '')}`;

    // Look up partner info from Odoo if mail_message_id is provided
    let customerId: number | undefined;
    let customerName: string | undefined;
    let customerType: 'b2b' | 'b2c' | 'anonymous' = 'anonymous';

    if (odooPayload.mail_message_id) {
      try {
        const odoo = await getOdooClient();
        if (odoo) {
          // Get author info from mail.message
          const messages = await odoo.searchRead(
            'mail.message',
            [['id', '=', odooPayload.mail_message_id]],
            ['author_id'],
            1
          );
          if (messages.length > 0 && messages[0].author_id) {
            customerId = messages[0].author_id[0];
            customerName = messages[0].author_id[1];

            // Get partner details to determine B2B/B2C
            const partners = await odoo.searchRead(
              'res.partner',
              [['id', '=', customerId]],
              ['is_company', 'parent_id'],
              1
            );
            if (partners.length > 0) {
              if (partners[0].is_company || partners[0].parent_id) {
                customerType = 'b2b';
              } else {
                customerType = 'b2c';
              }
            }
          }
        }
      } catch (lookupError) {
        console.warn('[WHATSAPP-INCOMING] Partner lookup failed:', lookupError);
      }
    }

    // Create conversation ID for storage
    const conversationId = customerId
      ? `customer-${customerId}`
      : sessionId;

    // Save incoming message to conversation store
    await addMessageToConversation(conversationId, {
      role: 'user',
      content: cleanMessage,
      timestamp: new Date(),
      channel: 'whatsapp',
    }, {
      customerId,
      customerName,
      customerType
    });

    // Load conversation history
    let conversationHistory: { role: 'user' | 'assistant'; content: string; timestamp: Date; agentId?: string }[] = [];
    try {
      const storedConversation = await loadConversation(conversationId);
      if (storedConversation && storedConversation.messages.length > 0) {
        conversationHistory = storedConversation.messages;
        console.log(`[WHATSAPP-INCOMING] Loaded ${conversationHistory.length} messages from history`);
      }
    } catch (loadError) {
      console.warn('[WHATSAPP-INCOMING] Error loading conversation:', loadError);
    }

    // Get Odoo client and create orchestrator
    const odooClient = await getOdooClient();
    if (!odooClient) {
      throw new Error('Failed to connect to Odoo');
    }
    const orchestrator = getOrchestrator(odooClient);

    // Process with AI agents
    const response = await orchestrator.processMessage(
      cleanMessage,
      conversationId,
      {
        customerType,
        customerId,
        customerName,
        conversationHistory,
        metadata: {
          language: 'it',
          source: 'whatsapp'
        }
      }
    );

    console.log('[WHATSAPP-INCOMING] AI Response:', {
      agentId: response.agentId,
      messageLength: response.message?.length,
      requiresHuman: response.requiresHumanEscalation
    });

    // Save AI response to conversation store
    await addMessageToConversation(conversationId, {
      role: 'assistant',
      content: response.message,
      timestamp: new Date(),
      agentId: response.agentId,
      channel: 'whatsapp',
      data: response.data
    }, {
      customerId,
      customerName,
      customerType
    });

    // Send response back via WhatsApp
    if (response.message && waAccountId) {
      try {
        await sendWhatsAppResponse(
          mobileNumber,
          response.message,
          waAccountId,
          messageId
        );
        console.log('[WHATSAPP-INCOMING] Response sent successfully');
      } catch (sendError) {
        console.error('[WHATSAPP-INCOMING] Failed to send response:', sendError);
        // Don't fail the whole request if sending fails
      }
    }

    // Handle escalation if needed
    if (response.requiresHumanEscalation) {
      try {
        await createEscalationTicket(
          mobileNumber,
          cleanMessage,
          response.message,
          customerId,
          customerName
        );
        console.log('[WHATSAPP-INCOMING] Escalation ticket created');
      } catch (escError) {
        console.error('[WHATSAPP-INCOMING] Failed to create escalation ticket:', escError);
      }
    }

    return NextResponse.json({
      success: true,
      response: {
        message: response.message,
        agentId: response.agentId,
        requiresHumanEscalation: response.requiresHumanEscalation
      }
    });

  } catch (error: any) {
    console.error('[WHATSAPP-INCOMING] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * Send WhatsApp response using Odoo
 */
async function sendWhatsAppResponse(
  mobileNumber: string,
  message: string,
  waAccountId: number,
  originalMessageId: number
): Promise<void> {
  const odoo = await getOdooClient();
  if (!odoo) {
    throw new Error('Failed to connect to Odoo');
  }

  // Format phone number (remove + if present)
  const formattedPhone = mobileNumber.replace(/^\+/, '');

  // Truncate message if too long (WhatsApp limit is ~4096 chars)
  const truncatedMessage = message.length > 4000
    ? message.substring(0, 3997) + '...'
    : message;

  // Create a WhatsApp message using Odoo's whatsapp.message model
  // This sends a free-form text message (not using templates)
  try {
    // Method 1: Try creating whatsapp.message directly
    await odoo.create('whatsapp.message', [{
      mobile_number: formattedPhone,
      body: truncatedMessage,
      message_type: 'outbound',
      wa_account_id: waAccountId,
      state: 'pending'
    }]);
  } catch (createError) {
    console.error('[WHATSAPP-INCOMING] Direct create failed, trying composer:', createError);

    // Method 2: Try using discuss.channel to post message
    try {
      // Find the discuss channel for this phone number
      const channels = await odoo.searchRead(
        'discuss.channel',
        [
          ['channel_type', '=', 'whatsapp'],
          ['whatsapp_number', 'ilike', formattedPhone.slice(-9)] // Match last 9 digits
        ],
        ['id'],
        1
      );

      if (channels.length > 0) {
        // Post message to the channel
        await odoo.call(
          'discuss.channel',
          'message_post',
          [[channels[0].id]],
          {
            body: truncatedMessage,
            message_type: 'whatsapp_message'
          }
        );
      } else {
        console.warn('[WHATSAPP-INCOMING] No channel found for', formattedPhone);
      }
    } catch (channelError) {
      console.error('[WHATSAPP-INCOMING] Channel post also failed:', channelError);
      throw channelError;
    }
  }
}

/**
 * Create escalation ticket in Odoo Helpdesk
 */
async function createEscalationTicket(
  mobileNumber: string,
  originalMessage: string,
  aiResponse: string,
  partnerId?: number,
  partnerName?: string
): Promise<void> {
  const odoo = await getOdooClient();
  if (!odoo) {
    throw new Error('Failed to connect to Odoo');
  }

  // Find default helpdesk team
  const teams = await odoo.searchRead(
    'helpdesk.team',
    [],
    ['id', 'name'],
    1
  );

  const teamId = teams.length > 0 ? teams[0].id : 1;

  await odoo.create('helpdesk.ticket', [{
    name: `WhatsApp Escalation: ${partnerName || mobileNumber}`,
    partner_id: partnerId || false,
    team_id: teamId,
    description: `
📱 **Escalation da WhatsApp**

**Numero:** ${mobileNumber}
**Cliente:** ${partnerName || 'Non identificato'}

---

**Messaggio originale:**
${originalMessage}

---

**Risposta AI:**
${aiResponse}

---

_Questo ticket è stato creato automaticamente perché l'AI ha richiesto intervento umano._
    `.trim()
  }]);
}

export async function GET() {
  return NextResponse.json({
    info: 'POST endpoint for receiving WhatsApp messages from Odoo',
    expectedPayload: {
      whatsapp_message_id: 'number - ID of the WhatsApp message in Odoo',
      mobile_number: 'string - Phone number of the sender',
      message: 'string - Message content',
      partner_id: 'number (optional) - Odoo partner ID',
      partner_name: 'string (optional) - Partner name',
      customer_type: 'string (optional) - b2b, b2c, or anonymous',
      wa_account_id: 'number (optional) - WhatsApp account ID for sending response'
    }
  });
}
