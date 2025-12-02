import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { GmailClient } from '@/lib/email-ai/gmail-client';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * POST /api/email-ai/send
 * Invia email tramite Gmail API
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      connectionId,
      emailId,          // ID email originale (per risposta)
      to,               // Destinatario
      subject,          // Oggetto
      body: emailBody,  // Corpo email
      isReply           // Se true, è una risposta (threading)
    } = body;

    if (!connectionId) {
      return NextResponse.json({ error: 'connectionId required' }, { status: 400 });
    }

    if (!to || !subject || !emailBody) {
      return NextResponse.json({ error: 'to, subject, and body required' }, { status: 400 });
    }

    console.log(`[SEND-EMAIL] Sending email to ${to} (reply: ${isReply})`);

    // Inizializza Gmail client
    const gmailClient = await GmailClient.fromConnectionId(connectionId);

    let threadId: string | undefined;
    let inReplyTo: string | undefined;
    let references: string | undefined;

    // Se è una risposta, ottieni info per threading
    if (isReply && emailId) {
      const emailResult = await sql`
        SELECT gmail_message_id, thread_id
        FROM email_messages
        WHERE id = ${emailId}
        LIMIT 1
      `;

      if (emailResult.rows.length > 0) {
        const originalEmail = emailResult.rows[0];
        threadId = originalEmail.thread_id;

        // Ottieni Message-ID per In-Reply-To header
        if (originalEmail.gmail_message_id) {
          try {
            inReplyTo = await gmailClient.getMessageIdHeader(originalEmail.gmail_message_id);
            references = inReplyTo; // Per email semplici, references = inReplyTo
          } catch (e) {
            console.warn('[SEND-EMAIL] Could not get Message-ID header:', e);
          }
        }
      }
    }

    // Invia email
    const result = await gmailClient.sendEmail({
      to,
      subject: isReply && !subject.toLowerCase().startsWith('re:') ? `Re: ${subject}` : subject,
      body: emailBody,
      inReplyTo,
      references,
      threadId
    });

    console.log(`[SEND-EMAIL] ✅ Email sent successfully, id: ${result.id}`);

    // Se era una risposta, aggiorna il record nel database
    if (emailId) {
      await sql`
        UPDATE email_messages
        SET
          reply_sent = true,
          reply_sent_at = NOW(),
          reply_message_id = ${result.id},
          updated_at = NOW()
        WHERE id = ${emailId}
      `;
    }

    return NextResponse.json({
      success: true,
      messageId: result.id,
      threadId: result.threadId
    });
  } catch (error: any) {
    console.error('[SEND-EMAIL] Error:', error);
    return NextResponse.json(
      { error: 'Failed to send email', details: error.message },
      { status: 500 }
    );
  }
}
