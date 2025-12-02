import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import {
  getAgentConfig,
  processEmailWithAgent,
  processBatchWithAgent,
  getAgentStats
} from '@/lib/email-ai/autonomous-agent';

export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * GET /api/email-ai/agent
 * Ottieni configurazione e statistiche agent
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const connectionId = searchParams.get('connectionId');
    const action = searchParams.get('action') || 'config'; // config | stats

    if (!connectionId) {
      return NextResponse.json({ error: 'connectionId required' }, { status: 400 });
    }

    if (action === 'stats') {
      const stats = await getAgentStats(connectionId);
      return NextResponse.json({
        success: true,
        stats
      });
    }

    // Default: ritorna config
    const config = await getAgentConfig(connectionId);

    if (!config) {
      return NextResponse.json({ error: 'Agent config not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      config
    });
  } catch (error: any) {
    console.error('[AGENT-API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get agent config', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/email-ai/agent
 * Esegui agent su email specifiche o in batch
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      connectionId,
      emailId,        // Singola email
      emailIds,       // Batch di email
      processAll      // Se true, processa tutte le email non processate
    } = body;

    if (!connectionId) {
      return NextResponse.json({ error: 'connectionId required' }, { status: 400 });
    }

    console.log(`[AGENT-API] Running agent for connection ${connectionId}`);

    const config = await getAgentConfig(connectionId);

    if (!config || !config.enabled) {
      return NextResponse.json({
        success: false,
        message: 'Agent is disabled or not configured',
        processed: 0
      });
    }

    let idsToProcess: string[] = [];

    if (emailId) {
      idsToProcess = [emailId];
    } else if (emailIds && Array.isArray(emailIds)) {
      idsToProcess = emailIds;
    } else if (processAll) {
      // Ottieni email non ancora processate dall'agent (ultime 100)
      const unprocessedResult = await sql`
        SELECT id FROM email_messages
        WHERE connection_id = ${connectionId}
          AND is_spam = false
          AND archived_at IS NULL
        ORDER BY received_date DESC
        LIMIT 100
      `;
      idsToProcess = unprocessedResult.rows.map(r => r.id);
    } else {
      return NextResponse.json({ error: 'emailId, emailIds, or processAll required' }, { status: 400 });
    }

    if (idsToProcess.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No emails to process',
        processed: 0
      });
    }

    console.log(`[AGENT-API] Processing ${idsToProcess.length} emails`);

    const results = await processBatchWithAgent(idsToProcess, connectionId);

    const summary = {
      total: results.length,
      rulesMatched: results.filter(r => r.rulesMatched.length > 0).length,
      repliesGenerated: results.filter(r => r.replyGenerated).length,
      requiresApproval: results.filter(r => r.requiresApproval).length,
      errors: results.filter(r => r.errors.length > 0).length
    };

    console.log(`[AGENT-API] ✅ Completed: ${summary.total} processed, ${summary.rulesMatched} matched rules`);

    return NextResponse.json({
      success: true,
      processed: results.length,
      summary,
      results: results.slice(0, 10) // Limita dettagli per response size
    });
  } catch (error: any) {
    console.error('[AGENT-API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to run agent', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/email-ai/agent
 * Aggiorna configurazione agent (regole custom)
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      connectionId,
      autoReplyEnabled,
      requireApprovalFor,
      maxAutoRepliesPerDay,
      workingHours,
      customRules // Array di regole custom
    } = body;

    if (!connectionId) {
      return NextResponse.json({ error: 'connectionId required' }, { status: 400 });
    }

    // Per ora, le regole custom possono essere salvate in un campo JSONB
    // Potrebbe essere necessario aggiungere una colonna al database

    console.log(`[AGENT-API] Updating agent config for ${connectionId}`);

    // Aggiorna impostazioni auto-reply nella connessione
    if (autoReplyEnabled !== undefined) {
      await sql`
        UPDATE gmail_connections
        SET auto_draft_reply = ${autoReplyEnabled}, updated_at = NOW()
        WHERE id = ${connectionId}
      `;
    }

    return NextResponse.json({
      success: true,
      message: 'Agent configuration updated'
    });
  } catch (error: any) {
    console.error('[AGENT-API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update agent config', details: error.message },
      { status: 500 }
    );
  }
}
