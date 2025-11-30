import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export const runtime = 'nodejs';

/**
 * GET /api/email-ai/inbox
 * Ottieni lista email processate con filtri
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Query parameters
    const connectionId = searchParams.get('connectionId');
    const filter = searchParams.get('filter') || 'all'; // all, urgent, important, unread, spam, client, supplier
    const category = searchParams.get('category'); // sales, support, invoice, etc.
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!connectionId) {
      return NextResponse.json({ error: 'connectionId required' }, { status: 400 });
    }

    console.log(`[INBOX] Fetching emails for connection ${connectionId}, filter=${filter}`);

    // Build WHERE clause based on filters with parameterized queries
    let whereConditions: string[] = ['connection_id = $1'];
    const queryParams: any[] = [connectionId];

    switch (filter) {
      case 'urgent':
        whereConditions.push("urgency_level = 'urgent'");
        whereConditions.push('is_spam = false');
        break;
      case 'important':
        whereConditions.push("urgency_level IN ('urgent', 'important')");
        whereConditions.push('is_spam = false');
        break;
      case 'unread':
        whereConditions.push('is_read = false');
        whereConditions.push('is_spam = false');
        break;
      case 'spam':
        whereConditions.push('is_spam = true');
        break;
      case 'client':
        whereConditions.push('is_client = true');
        whereConditions.push('is_spam = false');
        break;
      case 'supplier':
        whereConditions.push('is_supplier = true');
        whereConditions.push('is_spam = false');
        break;
      case 'all':
      default:
        whereConditions.push('is_spam = false');
        break;
    }

    if (category) {
      queryParams.push(category);
      whereConditions.push(`email_category = $${queryParams.length}`);
    }

    const whereClause = whereConditions.join(' AND ');

    // Add limit and offset to params
    queryParams.push(limit);
    const limitParam = `$${queryParams.length}`;
    queryParams.push(offset);
    const offsetParam = `$${queryParams.length}`;

    // Fetch emails with parameterized query
    const result = await sql.query(
      `SELECT
        id,
        gmail_message_id,
        gmail_thread_id,
        sender_email,
        sender_name,
        sender_domain,
        subject,
        snippet,
        ai_summary,
        urgency_level,
        is_spam,
        is_client,
        is_supplier,
        is_read,
        is_starred,
        email_category,
        ai_sentiment,
        ai_keywords,
        ai_confidence,
        has_attachments,
        received_date,
        processed_at,
        moved_to_spam,
        user_marked_important,
        user_tags
      FROM email_messages
      WHERE ${whereClause}
      ORDER BY received_date DESC
      LIMIT ${limitParam}
      OFFSET ${offsetParam}`,
      queryParams
    );

    // Fetch total count with same WHERE conditions (excluding limit/offset)
    const countResult = await sql.query(
      `SELECT COUNT(*) as total
      FROM email_messages
      WHERE ${whereClause}`,
      queryParams.slice(0, category ? 2 : 1) // Only connectionId and optionally category
    );

    const total = parseInt(countResult.rows[0]?.total || '0');

    console.log(`[INBOX] Found ${result.rows.length} emails (total: ${total})`);

    return NextResponse.json({
      success: true,
      emails: result.rows,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + result.rows.length < total
      }
    });
  } catch (error: any) {
    console.error('[INBOX] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch inbox', details: error.message },
      { status: 500 }
    );
  }
}
