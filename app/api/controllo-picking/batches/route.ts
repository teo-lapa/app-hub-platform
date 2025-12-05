import { NextRequest, NextResponse } from 'next/server';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';
import { parseAllChatterMessages } from '@/lib/utils/chatterParser';

export const dynamic = 'force-dynamic';

/**
 * GET /api/controllo-picking/batches
 *
 * Returns a list of batches for a given date with aggregated statistics.
 *
 * Query params:
 * - date: YYYY-MM-DD format (e.g., 2025-12-05)
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
    const date = searchParams.get('date');

    if (!date) {
      return NextResponse.json({
        success: false,
        error: 'Parametro date richiesto (formato: YYYY-MM-DD)'
      }, { status: 400 });
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return NextResponse.json({
        success: false,
        error: 'Formato data non valido. Usare YYYY-MM-DD'
      }, { status: 400 });
    }

    console.log(`[CONTROLLO-PICKING] Fetching batches for date: ${date}`);

    // Search for batches scheduled on the given date
    // Only show 'done' (completed) and 'in_progress' (being worked on) batches
    // Exclude 'draft', 'cancel' and other states
    const batches = await client.searchRead(
      'stock.picking.batch',
      [
        ['scheduled_date', '=', date],
        ['state', 'in', ['done', 'in_progress']]
      ],
      ['id', 'name', 'state', 'scheduled_date', 'picking_ids', 'move_line_ids'],
      0,
      'name asc'
    );

    console.log(`[CONTROLLO-PICKING] Found ${batches.length} batches`);

    // Process each batch to get statistics from chatter messages
    const batchesWithStats = await Promise.all(
      batches.map(async (batch: any) => {
        try {
          // Get picking count
          const picking_count = batch.picking_ids ?
            (Array.isArray(batch.picking_ids) ? batch.picking_ids.length : 0) : 0;

          // Get move line count
          const move_line_count = batch.move_line_ids ?
            (Array.isArray(batch.move_line_ids) ? batch.move_line_ids.length : 0) : 0;

          // Get chatter messages for this batch
          const messages = await client.searchRead(
            'mail.message',
            [
              ['model', '=', 'stock.picking.batch'],
              ['res_id', '=', batch.id],
              ['message_type', 'in', ['comment', 'notification']]
            ],
            ['id', 'body', 'date', 'author_id'],
            100,
            'date asc'
          );

          // Parse the messages
          const parsedMessages = parseAllChatterMessages(messages);

          // Extract unique operators from all message types
          const operatoriSet = new Set<string>();
          parsedMessages.prelievi.forEach((p) => {
            if (p.operatore) operatoriSet.add(p.operatore);
          });
          parsedMessages.controlli.forEach((c) => {
            if (c.operatore) operatoriSet.add(c.operatore);
          });
          parsedMessages.video.forEach((v) => {
            if (v.operatore) operatoriSet.add(v.operatore);
          });
          const operatori = Array.from(operatoriSet);

          // Calculate total time in minutes from prelievi
          let tempo_totale_minuti = 0;
          parsedMessages.prelievi.forEach((p) => {
            if (p.tempoTotale) {
              // Parse tempo format like "2h 15m" or "45m"
              const hoursMatch = p.tempoTotale.match(/(\d+)h/);
              const minutesMatch = p.tempoTotale.match(/(\d+)m/);
              const hours = hoursMatch ? parseInt(hoursMatch[1]) : 0;
              const minutes = minutesMatch ? parseInt(minutesMatch[1]) : 0;
              tempo_totale_minuti += hours * 60 + minutes;
            }
          });

          // Calculate total problems (from problemi messages + errors in controlli)
          const problemi_from_controlli = parsedMessages.controlli.reduce(
            (acc, c) => acc + (c.errori?.length || 0), 0
          );
          const problemi_count = parsedMessages.problemi.length + problemi_from_controlli;

          return {
            id: batch.id,
            name: batch.name,
            state: batch.state,
            scheduled_date: batch.scheduled_date || date,
            picking_count,
            move_line_count,
            stats: {
              prelievi_count: parsedMessages.prelievi.length,
              controlli_count: parsedMessages.controlli.length,
              video_count: parsedMessages.video.length,
              problemi_count,
              operatori,
              tempo_totale_minuti,
            },
          };
        } catch (error) {
          console.error(`[CONTROLLO-PICKING] Error processing batch ${batch.id}:`, error);
          // Return batch with empty stats on error
          return {
            id: batch.id,
            name: batch.name,
            state: batch.state,
            scheduled_date: batch.scheduled_date || date,
            picking_count: 0,
            move_line_count: 0,
            stats: {
              prelievi_count: 0,
              controlli_count: 0,
              video_count: 0,
              problemi_count: 0,
              operatori: [],
              tempo_totale_minuti: 0,
            },
          };
        }
      })
    );

    return NextResponse.json({
      success: true,
      batches: batchesWithStats,
    });

  } catch (error) {
    console.error('[CONTROLLO-PICKING] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore durante il recupero dei batch',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
