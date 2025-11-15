import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/controllo-prezzi/approve-block
 *
 * Approves a price block request by marking the activity as done
 * and optionally creating a pricelist item for the customer with the approved price.
 *
 * Input: { activityId: number, feedback?: string }
 *
 * Actions:
 * 1. Mark activity as done using Odoo's action_feedback() method
 * 2. Optionally create pricelist item for customer with approved price (if needed)
 *
 * Returns: { success: true, message: "..." }
 */

interface ApproveBlockRequest {
  activityId: number;
  feedback?: string;
}

export async function POST(request: NextRequest) {
  try {
    console.log('✅ [APPROVE-BLOCK] Starting approval process...');

    // Get user session
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      console.error('❌ [APPROVE-BLOCK] No valid user session');
      return NextResponse.json(
        { success: false, error: 'Sessione non valida' },
        { status: 401 }
      );
    }

    // Parse request body
    const body: ApproveBlockRequest = await request.json();
    const { activityId, feedback } = body;

    // Validate input
    if (!activityId || typeof activityId !== 'number') {
      console.error('❌ [APPROVE-BLOCK] Invalid activityId:', activityId);
      return NextResponse.json(
        { success: false, error: 'activityId mancante o non valido' },
        { status: 400 }
      );
    }

    console.log(`📋 [APPROVE-BLOCK] Activity ID: ${activityId}`);
    console.log(`💬 [APPROVE-BLOCK] Feedback: ${feedback || 'Prezzo bloccato approvato'}`);

    // Mark activity as done with feedback
    console.log('🔄 [APPROVE-BLOCK] Marking activity as done...');
    await callOdoo(
      cookies,
      'mail.activity',
      'action_feedback',
      [[activityId]],
      {
        feedback: feedback || 'Prezzo bloccato approvato'
      }
    );

    console.log('✅ [APPROVE-BLOCK] Activity marked as done successfully');

    // TODO: Optionally create pricelist item for customer with approved price
    // This would require:
    // 1. Getting the order and product info from the activity
    // 2. Getting the customer's pricelist
    // 3. Creating a fixed price item in the pricelist
    // For now, this is left as a future enhancement

    return NextResponse.json({
      success: true,
      message: 'Richiesta di blocco prezzo approvata con successo',
      activityId,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('💥 [APPROVE-BLOCK] Error:', error);
    console.error('💥 [APPROVE-BLOCK] Stack trace:', error.stack);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore durante l\'approvazione del blocco prezzo',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
