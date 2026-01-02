/**
 * API Endpoint: Handle Incoming WhatsApp Messages
 *
 * POST /api/lapa-agents/whatsapp-incoming
 *
 * Receives WhatsApp messages from Odoo automation,
 * processes them with AI agents, and sends response back via WhatsApp.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrchestrator } from '@/lib/lapa-agents/orchestrator';
import { getOdooClient } from '@/lib/odoo-client';
import { addMessageToConversation, loadConversation } from '@/lib/lapa-agents/conversation-store';

interface WhatsAppIncomingRequest {
  whatsapp_message_id: number;
  mobile_number: string;
  message: string;
  partner_id?: number;
  partner_name?: string;
  customer_type?: 'b2b' | 'b2c' | 'anonymous';
  wa_account_id?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: WhatsAppIncomingRequest = await request.json();

    console.log('[WHATSAPP-INCOMING] Received:', {
      messageId: body.whatsapp_message_id,
      from: body.mobile_number,
      message: body.message?.substring(0, 50) + '...',
      partner: body.partner_name
    });

    // Validate required fields
    if (!body.message || !body.mobile_number) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: message and mobile_number'
      }, { status: 400 });
    }

    // Create session ID based on phone number
    const sessionId = `whatsapp-${body.mobile_number.replace(/\+/g, '')}`;

    // Determine customer type
    const customerType = body.customer_type || 'anonymous';
    const customerId = body.partner_id;
    const customerName = body.partner_name;

    // Create conversation ID for storage
    const conversationId = customerId
      ? `customer-${customerId}`
      : sessionId;

    // Save incoming message to conversation store
    await addMessageToConversation(conversationId, {
      role: 'user',
      content: body.message,
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
      body.message,
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
    if (response.message && body.wa_account_id) {
      try {
        await sendWhatsAppResponse(
          body.mobile_number,
          response.message,
          body.wa_account_id,
          body.whatsapp_message_id
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
          body.mobile_number,
          body.message,
          response.message,
          body.partner_id,
          body.partner_name
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
