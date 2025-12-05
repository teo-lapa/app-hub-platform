import { NextRequest, NextResponse } from 'next/server';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';
import { parseAllChatterMessages, ParsedMessage } from '@/lib/utils/chatterParser';

export const dynamic = 'force-dynamic';

/**
 * GET /api/controllo-picking/batch/[batchId]
 *
 * Returns detailed information for a single batch, including all parsed messages and a timeline.
 *
 * Path param:
 * - batchId: number (batch ID)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { batchId: string } }
) {
  try {
    const sessionId = request.cookies.get('odoo_session_id')?.value;

    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Non autenticato - Odoo session non trovata'
      }, { status: 401 });
    }

    const client = createOdooRPCClient(sessionId);
    const batchId = parseInt(params.batchId, 10);

    if (isNaN(batchId)) {
      return NextResponse.json({
        success: false,
        error: 'ID batch non valido'
      }, { status: 400 });
    }

    console.log(`[CONTROLLO-PICKING] Fetching details for batch: ${batchId}`);

    // Get batch information
    const batches = await client.searchRead(
      'stock.picking.batch',
      [['id', '=', batchId]],
      ['id', 'name', 'state', 'scheduled_date'],
      1
    );

    if (batches.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Batch non trovato'
      }, { status: 404 });
    }

    const batch = batches[0];

    // Get chatter messages for this batch
    const messages = await client.searchRead(
      'mail.message',
      [
        ['model', '=', 'stock.picking.batch'],
        ['res_id', '=', batchId],
        ['message_type', 'in', ['comment', 'notification']]
      ],
      ['id', 'body', 'date', 'author_id'],
      200,
      'date asc'
    );

    console.log(`[CONTROLLO-PICKING] Found ${messages.length} messages for batch ${batchId}`);

    // Parse all messages
    const parsedMessages = parseAllChatterMessages(messages);

    // Build timeline from all events
    const timeline: Array<{
      time: string;
      event: string;
      user: string;
      type: string;
      date: Date;
    }> = [];

    // Add prelievi to timeline
    parsedMessages.prelievi.forEach((prelievo) => {
      const time = formatTime(prelievo.data);
      timeline.push({
        time,
        event: `Prelievo ${prelievo.zona}`,
        user: prelievo.operatore,
        type: 'prelievo',
        date: prelievo.data,
      });
    });

    // Add controlli to timeline
    parsedMessages.controlli.forEach((controllo) => {
      const time = formatTime(controllo.data);
      timeline.push({
        time,
        event: `Controllo ${controllo.zona}`,
        user: controllo.operatore,
        type: 'controllo',
        date: controllo.data,
      });
    });

    // Add video to timeline
    parsedMessages.video.forEach((video) => {
      const time = formatTime(video.data);
      timeline.push({
        time,
        event: `Video Controllo (${video.durata})`,
        user: video.operatore,
        type: 'video',
        date: video.data,
      });
    });

    // Add problemi to timeline
    parsedMessages.problemi.forEach((problema) => {
      timeline.push({
        time: '--:--', // Problems don't have a specific time in the parsed data
        event: `${problema.tipoProblema} - ${problema.prodotto}`,
        user: 'Sistema',
        type: 'problema',
        date: new Date(), // Use current date as fallback
      });
    });

    // Sort timeline by date
    timeline.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Remove the date property from timeline (only used for sorting)
    const cleanedTimeline = timeline.map(({ date, ...rest }) => rest);

    return NextResponse.json({
      success: true,
      batch: {
        id: batch.id,
        name: batch.name,
        state: batch.state,
        scheduled_date: batch.scheduled_date || null,
      },
      messages: {
        prelievi: parsedMessages.prelievi,
        controlli: parsedMessages.controlli,
        video: parsedMessages.video,
        problemi: parsedMessages.problemi,
      },
      timeline: cleanedTimeline,
    });

  } catch (error) {
    console.error('[CONTROLLO-PICKING] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore durante il recupero dei dettagli del batch',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Helper function to format time as HH:MM from a Date object
 */
function formatTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}
