/**
 * API Admin per aggiornare gli avatar dei clienti
 * Uso: POST /api/lapa-agents/admin/update-avatar
 * Body: { customerId, avatar: {...} }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMemoryService, CustomerAvatar } from '@/lib/lapa-agents/memory/conversation-memory';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerId, avatar, action, note, followup } = body;

    if (!customerId) {
      return NextResponse.json({ success: false, error: 'customerId required' }, { status: 400 });
    }

    const memoryService = getMemoryService();

    // Azione specifica
    if (action === 'addNote' && note) {
      const result = await memoryService.addPersonalNote(customerId, note);
      return NextResponse.json({ success: result, action: 'addNote' });
    }

    if (action === 'addFollowup' && followup) {
      const result = await memoryService.addFollowup(customerId, followup);
      return NextResponse.json({ success: result, action: 'addFollowup' });
    }

    if (action === 'completeFollowup' && followup) {
      const result = await memoryService.markFollowupDone(customerId, followup);
      return NextResponse.json({ success: result, action: 'completeFollowup' });
    }

    // Aggiorna avatar completo
    if (avatar) {
      const result = await memoryService.updateAvatar(customerId, avatar);
      return NextResponse.json({
        success: result !== null,
        avatar: result?.avatar
      });
    }

    return NextResponse.json({ success: false, error: 'No action or avatar provided' }, { status: 400 });

  } catch (error) {
    console.error('❌ Error updating avatar:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = parseInt(searchParams.get('customerId') || '0');

    if (!customerId) {
      return NextResponse.json({ success: false, error: 'customerId required' }, { status: 400 });
    }

    const memoryService = getMemoryService();
    const avatar = await memoryService.getAvatar(customerId);

    return NextResponse.json({
      success: true,
      customerId,
      avatar
    });

  } catch (error) {
    console.error('❌ Error getting avatar:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
