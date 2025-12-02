import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export const runtime = 'nodejs';

/**
 * GET /api/email-ai/settings
 * Ottieni impostazioni classificazione email per una connessione
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const connectionId = searchParams.get('connectionId');

    if (!connectionId) {
      return NextResponse.json({ error: 'connectionId required' }, { status: 400 });
    }

    console.log(`[EMAIL-SETTINGS] Fetching settings for connection ${connectionId}`);

    const result = await sql`
      SELECT
        id,
        user_id,
        gmail_address,
        auto_classify,
        auto_summarize,
        auto_move_spam,
        auto_draft_reply,
        client_domains,
        supplier_domains,
        urgent_keywords,
        spam_keywords,
        notify_urgent,
        notify_clients,
        notification_email,
        sync_enabled,
        sync_frequency,
        last_sync_date,
        created_at,
        updated_at
      FROM gmail_connections
      WHERE id = ${connectionId}
      LIMIT 1
    `;

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    const settings = result.rows[0];

    return NextResponse.json({
      success: true,
      settings: {
        ...settings,
        // Parse JSONB fields
        client_domains: settings.client_domains || [],
        supplier_domains: settings.supplier_domains || [],
        urgent_keywords: settings.urgent_keywords || ['urgente', 'fattura', 'pagamento', 'scadenza'],
        spam_keywords: settings.spam_keywords || ['offerta', 'promozione', 'sconto', 'newsletter']
      }
    });
  } catch (error: any) {
    console.error('[EMAIL-SETTINGS] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/email-ai/settings
 * Aggiorna impostazioni classificazione email
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      connectionId,
      clientDomains,
      supplierDomains,
      urgentKeywords,
      spamKeywords,
      autoClassify,
      autoSummarize,
      autoMoveSpam,
      autoDraftReply,
      notifyUrgent,
      notifyClients,
      notificationEmail,
      syncFrequency
    } = body;

    if (!connectionId) {
      return NextResponse.json({ error: 'connectionId required' }, { status: 400 });
    }

    console.log(`[EMAIL-SETTINGS] Updating settings for connection ${connectionId}`);

    // Build update query dynamically based on provided fields
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (clientDomains !== undefined) {
      updates.push(`client_domains = $${paramIndex}::jsonb`);
      values.push(JSON.stringify(clientDomains));
      paramIndex++;
    }

    if (supplierDomains !== undefined) {
      updates.push(`supplier_domains = $${paramIndex}::jsonb`);
      values.push(JSON.stringify(supplierDomains));
      paramIndex++;
    }

    if (urgentKeywords !== undefined) {
      updates.push(`urgent_keywords = $${paramIndex}::jsonb`);
      values.push(JSON.stringify(urgentKeywords));
      paramIndex++;
    }

    if (spamKeywords !== undefined) {
      updates.push(`spam_keywords = $${paramIndex}::jsonb`);
      values.push(JSON.stringify(spamKeywords));
      paramIndex++;
    }

    if (autoClassify !== undefined) {
      updates.push(`auto_classify = $${paramIndex}`);
      values.push(autoClassify);
      paramIndex++;
    }

    if (autoSummarize !== undefined) {
      updates.push(`auto_summarize = $${paramIndex}`);
      values.push(autoSummarize);
      paramIndex++;
    }

    if (autoMoveSpam !== undefined) {
      updates.push(`auto_move_spam = $${paramIndex}`);
      values.push(autoMoveSpam);
      paramIndex++;
    }

    if (autoDraftReply !== undefined) {
      updates.push(`auto_draft_reply = $${paramIndex}`);
      values.push(autoDraftReply);
      paramIndex++;
    }

    if (notifyUrgent !== undefined) {
      updates.push(`notify_urgent = $${paramIndex}`);
      values.push(notifyUrgent);
      paramIndex++;
    }

    if (notifyClients !== undefined) {
      updates.push(`notify_clients = $${paramIndex}`);
      values.push(notifyClients);
      paramIndex++;
    }

    if (notificationEmail !== undefined) {
      updates.push(`notification_email = $${paramIndex}`);
      values.push(notificationEmail);
      paramIndex++;
    }

    if (syncFrequency !== undefined) {
      updates.push(`sync_frequency = $${paramIndex}`);
      values.push(syncFrequency);
      paramIndex++;
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    // Add connectionId as last parameter
    values.push(connectionId);

    const updateQuery = `
      UPDATE gmail_connections
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
      RETURNING id, gmail_address, updated_at
    `;

    const result = await sql.query(updateQuery, values);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    console.log(`[EMAIL-SETTINGS] ✅ Settings updated for ${result.rows[0].gmail_address}`);

    return NextResponse.json({
      success: true,
      message: 'Settings updated successfully',
      updated: result.rows[0]
    });
  } catch (error: any) {
    console.error('[EMAIL-SETTINGS] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update settings', details: error.message },
      { status: 500 }
    );
  }
}
