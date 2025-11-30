import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { GmailClient } from '@/lib/email-ai/gmail-client';
import { classifyEmail } from '@/lib/email-ai/email-classifier';
import { summarizeEmail } from '@/lib/email-ai/email-summarizer';
import { generateEmailEmbedding, saveEmailEmbedding } from '@/lib/email-ai/embedding-service';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minuti per processare batch di email

/**
 * POST /api/email-ai/fetch-emails
 * Fetch nuove email da Gmail, classifica con AI e salva in database
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      connectionId,
      maxResults = 10,
      query = 'is:unread' // Default: solo email non lette
    } = body;

    if (!connectionId) {
      return NextResponse.json({ error: 'connectionId required' }, { status: 400 });
    }

    console.log(`[FETCH-EMAILS] Starting fetch for connection ${connectionId}`);

    // ========== STEP 1: OTTIENI CONNESSIONE GMAIL ==========
    const connectionResult = await sql`
      SELECT
        id,
        user_id,
        gmail_address,
        auto_classify,
        auto_summarize,
        auto_move_spam,
        client_domains,
        supplier_domains,
        urgent_keywords,
        spam_keywords
      FROM gmail_connections
      WHERE id = ${connectionId}
        AND sync_enabled = true
      LIMIT 1
    `;

    if (connectionResult.rows.length === 0) {
      return NextResponse.json({ error: 'Gmail connection not found or disabled' }, { status: 404 });
    }

    const connection = connectionResult.rows[0];
    console.log(`[FETCH-EMAILS] Connected to Gmail: ${connection.gmail_address}`);

    // ========== STEP 2: INIZIALIZZA GMAIL CLIENT ==========
    const gmailClient = await GmailClient.fromConnectionId(connectionId);

    // ========== STEP 3: FETCH MESSAGGI ==========
    const { messages: messageIds } = await gmailClient.listMessages({
      maxResults,
      query
    });

    console.log(`[FETCH-EMAILS] Found ${messageIds.length} messages`);

    if (messageIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No new emails to process',
        processed: 0
      });
    }

    // ========== STEP 4: PROCESSA OGNI MESSAGGIO ==========
    const processed: string[] = [];
    const errors: string[] = [];

    for (const messageId of messageIds) {
      try {
        // Verifica se già processato
        const existing = await sql`
          SELECT id FROM email_messages
          WHERE gmail_message_id = ${messageId}
          LIMIT 1
        `;

        if (existing.rows.length > 0) {
          console.log(`[FETCH-EMAILS] Message ${messageId} already processed, skipping`);
          continue;
        }

        // Fetch dettagli email
        const message = await gmailClient.getMessage(messageId);

        // Extract sender domain
        const senderDomain = message.from.email.split('@')[1]?.toLowerCase() || '';

        // ========== AI CLASSIFICATION ==========
        let classification;
        let summary;

        if (connection.auto_classify) {
          classification = await classifyEmail({
            subject: message.subject,
            bodyText: message.bodyText || message.snippet,
            senderEmail: message.from.email,
            senderName: message.from.name,
            senderDomain,
            clientDomains: connection.client_domains || [],
            supplierDomains: connection.supplier_domains || [],
            urgentKeywords: connection.urgent_keywords || [],
            spamKeywords: connection.spam_keywords || []
          });

          console.log(`[FETCH-EMAILS] Classified ${messageId}: ${classification.urgencyLevel}, spam=${classification.isSpam}`);
        } else {
          // Default classification
          classification = {
            urgencyLevel: 'normal',
            isSpam: false,
            isClient: false,
            isSupplier: false,
            isInternal: false,
            emailCategory: 'other',
            sentiment: 'neutral',
            keywords: [],
            confidence: 0,
            reasoning: 'Auto-classification disabled'
          };
        }

        // ========== AI SUMMARIZATION ==========
        if (connection.auto_summarize && !classification.isSpam) {
          summary = await summarizeEmail({
            subject: message.subject,
            bodyText: message.bodyText || message.snippet,
            senderEmail: message.from.email,
            senderName: message.from.name
          });

          console.log(`[FETCH-EMAILS] Summarized ${messageId}`);
        }

        // ========== SAVE TO DATABASE ==========
        const insertResult = await sql`
          INSERT INTO email_messages (
            connection_id,
            gmail_message_id,
            gmail_thread_id,
            gmail_label_ids,
            sender_email,
            sender_name,
            sender_domain,
            recipient_email,
            subject,
            body_text,
            body_html,
            snippet,
            has_attachments,
            attachments,
            received_date,
            is_read,
            is_starred,
            urgency_level,
            is_spam,
            is_client,
            is_supplier,
            ai_summary,
            ai_sentiment,
            ai_confidence,
            ai_keywords,
            email_category,
            processed_at,
            created_at
          ) VALUES (
            ${connectionId},
            ${message.id},
            ${message.threadId},
            ${JSON.stringify(message.labelIds)}::text[],
            ${message.from.email},
            ${message.from.name || null},
            ${senderDomain},
            ${message.to[0] || connection.gmail_address},
            ${message.subject},
            ${message.bodyText || null},
            ${message.bodyHtml || null},
            ${message.snippet},
            ${message.hasAttachments},
            ${JSON.stringify(message.attachments)}::jsonb,
            ${message.date.toISOString()},
            ${message.isRead},
            ${message.isStarred},
            ${classification.urgencyLevel},
            ${classification.isSpam},
            ${classification.isClient},
            ${classification.isSupplier},
            ${summary?.summary || null},
            ${classification.sentiment},
            ${classification.confidence},
            ${JSON.stringify(classification.keywords)}::text[],
            ${classification.emailCategory},
            NOW(),
            NOW()
          )
          RETURNING id
        `;

        const emailId = insertResult.rows[0].id;
        console.log(`[FETCH-EMAILS] Saved email ${emailId} to database`);

        // ========== GENERATE & SAVE EMBEDDING ==========
        if (!classification.isSpam) {
          try {
            const embedding = await generateEmailEmbedding({
              subject: message.subject,
              bodyText: message.bodyText || message.snippet,
              senderEmail: message.from.email
            });

            await saveEmailEmbedding({
              emailId,
              embedding,
              senderDomain,
              urgencyLevel: classification.urgencyLevel,
              emailCategory: classification.emailCategory,
              isClient: classification.isClient,
              isSupplier: classification.isSupplier,
              wasReplied: false
            });

            console.log(`[FETCH-EMAILS] Generated embedding for ${emailId}`);
          } catch (embError: any) {
            console.error(`[FETCH-EMAILS] Embedding failed for ${emailId}:`, embError.message);
            // Non bloccare il processo se embedding fallisce
          }
        }

        // ========== AUTO MOVE TO SPAM ==========
        if (connection.auto_move_spam && classification.isSpam) {
          try {
            await gmailClient.moveToSpam(messageId);
            await sql`
              UPDATE email_messages
              SET moved_to_spam = true, moved_to_folder = 'SPAM'
              WHERE id = ${emailId}
            `;
            console.log(`[FETCH-EMAILS] Auto-moved ${emailId} to SPAM`);
          } catch (spamError: any) {
            console.error(`[FETCH-EMAILS] Failed to move to spam:`, spamError.message);
          }
        }

        processed.push(messageId);
      } catch (msgError: any) {
        console.error(`[FETCH-EMAILS] Error processing message ${messageId}:`, msgError.message);
        errors.push(`${messageId}: ${msgError.message}`);
      }
    }

    // ========== UPDATE LAST SYNC ==========
    await sql`
      UPDATE gmail_connections
      SET last_sync_date = NOW(),
          updated_at = NOW()
      WHERE id = ${connectionId}
    `;

    console.log(`[FETCH-EMAILS] ✅ Processed ${processed.length}/${messageIds.length} emails`);

    return NextResponse.json({
      success: true,
      processed: processed.length,
      total: messageIds.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error: any) {
    console.error('[FETCH-EMAILS] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch emails', details: error.message },
      { status: 500 }
    );
  }
}
