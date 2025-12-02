import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { generateReply, generateQuickReply } from '@/lib/email-ai/reply-generator';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/email-ai/generate-reply
 * Genera bozza di risposta AI per un'email
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      emailId,
      connectionId,
      quickReplyType, // Se fornito, usa template rapido invece di AI
      userContext     // Opzionale: { userName, companyName, signature }
    } = body;

    if (!emailId) {
      return NextResponse.json({ error: 'emailId required' }, { status: 400 });
    }

    console.log(`[GENERATE-REPLY] Generating reply for email ${emailId}`);

    // Ottieni dettagli email
    const emailResult = await sql`
      SELECT
        id,
        connection_id,
        sender_email,
        sender_name,
        subject,
        body_text,
        snippet,
        email_category,
        urgency_level
      FROM email_messages
      WHERE id = ${emailId}
      LIMIT 1
    `;

    if (emailResult.rows.length === 0) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }

    const email = emailResult.rows[0];

    // Se richiesto quick reply, usa template
    if (quickReplyType) {
      const quickReply = await generateQuickReply(
        quickReplyType as any,
        email.sender_name?.split(' ')[0] || undefined
      );

      console.log(`[GENERATE-REPLY] Generated quick reply: ${quickReplyType}`);

      return NextResponse.json({
        success: true,
        reply: {
          draftReply: quickReply,
          tone: 'professional',
          suggestions: [],
          confidence: 85,
          isQuickReply: true,
          quickReplyType
        }
      });
    }

    // Genera risposta AI
    const reply = await generateReply({
      subject: email.subject || '',
      bodyText: email.body_text || email.snippet || '',
      senderEmail: email.sender_email,
      senderName: email.sender_name,
      emailCategory: email.email_category,
      userContext
    });

    console.log(`[GENERATE-REPLY] ✅ AI reply generated (confidence: ${reply.confidence})`);

    // Salva bozza nel database
    await sql`
      UPDATE email_messages
      SET ai_draft_reply = ${reply.draftReply},
          updated_at = NOW()
      WHERE id = ${emailId}
    `;

    return NextResponse.json({
      success: true,
      reply: {
        ...reply,
        isQuickReply: false
      }
    });
  } catch (error: any) {
    console.error('[GENERATE-REPLY] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate reply', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/email-ai/generate-reply
 * Ottieni bozza di risposta salvata
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const emailId = searchParams.get('emailId');

    if (!emailId) {
      return NextResponse.json({ error: 'emailId required' }, { status: 400 });
    }

    const result = await sql`
      SELECT
        id,
        subject,
        sender_email,
        sender_name,
        ai_draft_reply
      FROM email_messages
      WHERE id = ${emailId}
      LIMIT 1
    `;

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }

    const email = result.rows[0];

    return NextResponse.json({
      success: true,
      emailId,
      subject: email.subject,
      recipient: {
        email: email.sender_email,
        name: email.sender_name
      },
      draftReply: email.ai_draft_reply
    });
  } catch (error: any) {
    console.error('[GENERATE-REPLY] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get reply', details: error.message },
      { status: 500 }
    );
  }
}
