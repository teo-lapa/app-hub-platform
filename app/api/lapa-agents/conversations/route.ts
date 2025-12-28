/**
 * API per ottenere le conversazioni salvate
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRecentConversations, getConversationsByAgent, loadConversation } from '@/lib/lapa-agents/conversation-store';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    const sessionId = searchParams.get('sessionId');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Se specificato un sessionId, ritorna quella conversazione
    if (sessionId) {
      const conversation = await loadConversation(sessionId);
      return NextResponse.json({
        success: true,
        conversation
      });
    }

    // Se specificato un agentId, filtra per agente
    if (agentId) {
      const conversations = await getConversationsByAgent(agentId, limit);
      return NextResponse.json({
        success: true,
        conversations,
        count: conversations.length
      });
    }

    // Altrimenti ritorna le conversazioni recenti
    const conversations = await getRecentConversations(limit);
    return NextResponse.json({
      success: true,
      conversations,
      count: conversations.length
    });

  } catch (error) {
    console.error('❌ Error fetching conversations:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
