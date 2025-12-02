import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { summarizeEmail } from '@/lib/email-ai/email-summarizer';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for batch processing

/**
 * POST /api/email-ai/regenerate-summaries
 * Regenerate AI summaries in a specific language
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { connectionId, language = 'en', emailIds } = body;

    if (!connectionId) {
      return NextResponse.json({ error: 'connectionId required' }, { status: 400 });
    }

    console.log(`[REGENERATE] Starting regeneration in ${language} for connection ${connectionId}`);

    // Get emails to regenerate (either specific ones or all non-archived)
    let emails;
    if (emailIds && Array.isArray(emailIds) && emailIds.length > 0) {
      // Regenerate specific emails - convert array to PostgreSQL array format
      const emailIdsArray = `{${emailIds.join(',')}}`;
      emails = await sql`
        SELECT id, subject, body_text, snippet, sender_email, sender_name
        FROM email_messages
        WHERE connection_id = ${connectionId}
          AND id = ANY(${emailIdsArray}::uuid[])
          AND is_spam = false
      `;
    } else {
      // Regenerate all non-archived emails (limit to 50 to avoid timeout)
      emails = await sql`
        SELECT id, subject, body_text, snippet, sender_email, sender_name
        FROM email_messages
        WHERE connection_id = ${connectionId}
          AND archived_at IS NULL
          AND is_spam = false
        ORDER BY received_date DESC
        LIMIT 50
      `;
    }

    if (emails.rows.length === 0) {
      return NextResponse.json({
        success: true,
        regenerated: 0,
        message: 'No emails to regenerate'
      });
    }

    console.log(`[REGENERATE] Found ${emails.rows.length} emails to regenerate`);

    let regenerated = 0;
    let errors = 0;

    for (const email of emails.rows) {
      try {
        const summary = await summarizeEmail({
          subject: email.subject || '',
          bodyText: email.body_text || email.snippet || '',
          senderEmail: email.sender_email,
          senderName: email.sender_name,
          language: language as 'it' | 'en' | 'de'
        });

        await sql`
          UPDATE email_messages
          SET ai_summary = ${summary.summary},
              updated_at = NOW()
          WHERE id = ${email.id}
        `;

        regenerated++;
        console.log(`[REGENERATE] Regenerated summary for ${email.id}`);
      } catch (error: any) {
        console.error(`[REGENERATE] Error for ${email.id}:`, error.message);
        errors++;
      }
    }

    console.log(`[REGENERATE] ✅ Completed: regenerated=${regenerated}, errors=${errors}`);

    return NextResponse.json({
      success: true,
      regenerated,
      errors,
      language
    });
  } catch (error: any) {
    console.error('[REGENERATE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to regenerate summaries', details: error.message },
      { status: 500 }
    );
  }
}
