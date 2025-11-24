import { NextRequest, NextResponse } from 'next/server';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';

export const dynamic = 'force-dynamic';

/**
 * GET /api/sales-radar/get-chatter
 *
 * Recupera i messaggi del chatter per un lead o partner
 *
 * Query params:
 * - model: 'crm.lead' | 'res.partner'
 * - id: number (record ID)
 */
export async function GET(request: NextRequest) {
  try {
    const sessionId = request.cookies.get('odoo_session_id')?.value;

    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Non autenticato - Odoo session non trovata'
      }, { status: 401 });
    }

    const client = createOdooRPCClient(sessionId);

    const searchParams = request.nextUrl.searchParams;
    const model = searchParams.get('model');
    const idStr = searchParams.get('id');

    if (!model || !idStr) {
      return NextResponse.json({
        success: false,
        error: 'Parametri model e id richiesti'
      }, { status: 400 });
    }

    const recordId = parseInt(idStr, 10);
    if (isNaN(recordId)) {
      return NextResponse.json({
        success: false,
        error: 'ID non valido'
      }, { status: 400 });
    }

    // Validate model
    if (!['crm.lead', 'res.partner'].includes(model)) {
      return NextResponse.json({
        success: false,
        error: 'Model deve essere crm.lead o res.partner'
      }, { status: 400 });
    }

    console.log(`[GET-CHATTER] Fetching chatter for ${model} ID: ${recordId}`);

    // 1. Get the record info
    const records = await client.callKw(
      model,
      'search_read',
      [[['id', '=', recordId]]],
      {
        fields: ['id', 'name', 'phone', 'email', 'street', 'city', 'create_date', 'write_date'],
        limit: 1,
        context: { active_test: false }
      }
    );

    if (records.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Record non trovato'
      }, { status: 404 });
    }

    const record = records[0];

    // 2. Get chatter messages for this record
    const messages = await client.searchRead(
      'mail.message',
      [
        ['model', '=', model],
        ['res_id', '=', recordId],
        ['message_type', 'in', ['comment', 'notification']]
      ],
      ['id', 'body', 'date', 'author_id', 'message_type', 'subtype_id'],
      50, // Limit to 50 messages
      0,
      'date desc'
    );

    console.log(`[GET-CHATTER] Found ${messages.length} messages`);

    // 3. Format messages
    const formattedMessages = messages.map((msg: any) => {
      // Extract text from HTML body
      let textBody = msg.body || '';
      // Remove HTML tags for preview
      const textPreview = textBody
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim();

      return {
        id: msg.id,
        body: msg.body,
        textPreview: textPreview.substring(0, 200) + (textPreview.length > 200 ? '...' : ''),
        date: msg.date,
        authorId: msg.author_id?.[0],
        authorName: msg.author_id?.[1] || 'Sistema',
        messageType: msg.message_type,
        isSalesRadar: textBody.includes('FEEDBACK SALES RADAR')
      };
    });

    // 4. Get additional info based on model
    let additionalInfo: any = {};

    if (model === 'crm.lead') {
      // Get lead-specific info
      const leadInfo = await client.callKw(
        'crm.lead',
        'search_read',
        [[['id', '=', recordId]]],
        {
          fields: ['description', 'partner_latitude', 'partner_longitude', 'website', 'tag_ids', 'stage_id', 'probability'],
          limit: 1,
          context: { active_test: false }
        }
      );
      if (leadInfo.length > 0) {
        additionalInfo = {
          description: leadInfo[0].description,
          latitude: leadInfo[0].partner_latitude,
          longitude: leadInfo[0].partner_longitude,
          website: leadInfo[0].website,
          stage: leadInfo[0].stage_id?.[1],
          probability: leadInfo[0].probability
        };
      }
    } else {
      // Get partner-specific info
      const partnerInfo = await client.callKw(
        'res.partner',
        'search_read',
        [[['id', '=', recordId]]],
        {
          fields: ['comment', 'website', 'customer_rank', 'supplier_rank', 'category_id'],
          limit: 1,
          context: { active_test: false }
        }
      );
      if (partnerInfo.length > 0) {
        additionalInfo = {
          comment: partnerInfo[0].comment,
          website: partnerInfo[0].website,
          customerRank: partnerInfo[0].customer_rank,
          supplierRank: partnerInfo[0].supplier_rank
        };
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        record: {
          id: record.id,
          name: record.name,
          phone: record.phone,
          email: record.email,
          street: record.street,
          city: record.city,
          createDate: record.create_date,
          writeDate: record.write_date,
          ...additionalInfo
        },
        messages: formattedMessages,
        totalMessages: messages.length,
        salesRadarMessages: formattedMessages.filter((m: any) => m.isSalesRadar).length
      }
    });

  } catch (error) {
    console.error('[GET-CHATTER] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore durante il recupero dei messaggi',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
