import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/controllo-prezzi/reject-block
 *
 * Rejects a price block request by marking the activity as done
 * and posting the rejection reason as a message in the activity chatter.
 *
 * Input: { activityId: number, reason: string }
 *
 * Actions:
 * 1. Mark activity as done with rejection feedback
 * 2. Post rejection reason as message in activity chatter
 *
 * Returns: { success: true, message: "..." }
 */

interface RejectBlockRequest {
  activityId: number;
  reason: string;
}

export async function POST(request: NextRequest) {
  try {
    console.log('🚫 [REJECT-BLOCK] Starting rejection process...');

    // Get user session
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      console.error('❌ [REJECT-BLOCK] No valid user session');
      return NextResponse.json(
        { success: false, error: 'Sessione non valida' },
        { status: 401 }
      );
    }

    // Parse request body
    const body: RejectBlockRequest = await request.json();
    const { activityId, reason } = body;

    // Validate input
    if (!activityId || typeof activityId !== 'number') {
      console.error('❌ [REJECT-BLOCK] Invalid activityId:', activityId);
      return NextResponse.json(
        { success: false, error: 'activityId mancante o non valido' },
        { status: 400 }
      );
    }

    if (!reason || typeof reason !== 'string' || reason.trim() === '') {
      console.error('❌ [REJECT-BLOCK] Invalid reason:', reason);
      return NextResponse.json(
        { success: false, error: 'reason mancante o non valido' },
        { status: 400 }
      );
    }

    console.log(`📋 [REJECT-BLOCK] Activity ID: ${activityId}`);
    console.log(`💬 [REJECT-BLOCK] Rejection reason: ${reason}`);

    // First, get the activity details to find the related record
    console.log('🔍 [REJECT-BLOCK] Fetching activity details...');
    const activities = await callOdoo(
      cookies,
      'mail.activity',
      'search_read',
      [],
      {
        domain: [['id', '=', activityId]],
        fields: ['id', 'res_model', 'res_id', 'res_name', 'summary'],
        limit: 1
      }
    );

    if (!activities || activities.length === 0) {
      console.error('❌ [REJECT-BLOCK] Activity not found');
      return NextResponse.json(
        { success: false, error: 'Attività non trovata' },
        { status: 404 }
      );
    }

    const activity = activities[0];
    console.log(`✅ [REJECT-BLOCK] Activity found: ${activity.summary} for ${activity.res_name}`);

    // Mark activity as done with rejection feedback
    console.log('🔄 [REJECT-BLOCK] Marking activity as done...');
    const rejectionFeedback = `❌ RIFIUTATO: ${reason}`;

    await callOdoo(
      cookies,
      'mail.activity',
      'action_feedback',
      [[activityId]],
      {
        feedback: rejectionFeedback
      }
    );

    console.log('✅ [REJECT-BLOCK] Activity marked as done with rejection');

    // Post rejection reason as a message in the chatter
    console.log('💬 [REJECT-BLOCK] Posting rejection message to chatter...');

    const messageHtml = `
      <div style="border-left: 4px solid #ef4444; padding-left: 12px; margin: 8px 0;">
        <strong style="color: #ef4444;">🚫 RICHIESTA BLOCCO PREZZO RIFIUTATA</strong><br/>
        <strong>Motivo:</strong> ${reason}<br/>
        <strong>Data:</strong> ${new Date().toLocaleString('it-IT')}<br/>
        <strong>Utente:</strong> UID ${uid}
      </div>
    `;

    const messageId = await callOdoo(
      cookies,
      'mail.message',
      'create',
      [{
        body: messageHtml,
        model: activity.res_model,
        res_id: activity.res_id,
        message_type: 'comment',
        subtype_id: 1 // Note subtype
      }]
    );

    console.log(`✅ [REJECT-BLOCK] Message posted to chatter (ID: ${messageId})`);

    return NextResponse.json({
      success: true,
      message: 'Richiesta di blocco prezzo rifiutata con successo',
      activityId,
      messageId,
      reason,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('💥 [REJECT-BLOCK] Error:', error);
    console.error('💥 [REJECT-BLOCK] Stack trace:', error.stack);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore durante il rifiuto del blocco prezzo',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
