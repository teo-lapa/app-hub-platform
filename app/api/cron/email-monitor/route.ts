import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { GmailClient } from '@/lib/email-ai/gmail-client';
import { classifyEmail } from '@/lib/email-ai/email-classifier';
import { summarizeEmail } from '@/lib/email-ai/email-summarizer';
import { generateEmailEmbedding, saveEmailEmbedding } from '@/lib/email-ai/embedding-service';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minuti

/**
 * GET /api/cron/email-monitor
 * Cron job mattutino: fetch e processa nuove email per tutte le connessioni attive
 *
 * Setup Vercel Cron:
 * vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/email-monitor",
 *     "schedule": "0 8 * * *"  // Ogni giorno alle 8:00 AM
 *   }]
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // ========== SECURITY: VERIFY CRON SECRET ==========
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.error('[EMAIL-MONITOR-CRON] Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[EMAIL-MONITOR-CRON] 🌅 Starting morning email check...');

    // ========== STEP 1: GET ALL ACTIVE CONNECTIONS ==========
    const connectionsResult = await sql`
      SELECT
        id,
        gmail_address,
        user_name,
        auto_classify,
        auto_summarize,
        auto_move_spam,
        client_domains,
        supplier_domains,
        urgent_keywords,
        spam_keywords
      FROM gmail_connections
      WHERE sync_enabled = true
      ORDER BY last_sync_date ASC NULLS FIRST
    `;

    const connections = connectionsResult.rows;
    console.log(`[EMAIL-MONITOR-CRON] Found ${connections.length} active connections`);

    if (connections.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active Gmail connections to monitor'
      });
    }

    // ========== STEP 2: PROCESS EACH CONNECTION ==========
    const results: Array<{
      connectionId: string;
      gmailAddress: string;
      processed: number;
      urgent: number;
      errors: number;
    }> = [];

    for (const connection of connections) {
      try {
        console.log(`[EMAIL-MONITOR-CRON] Processing ${connection.gmail_address}...`);

        // Initialize Gmail client
        const gmailClient = await GmailClient.fromConnectionId(connection.id);

        // Fetch unread messages (max 20 per connection per run)
        const { messages: messageIds } = await gmailClient.listMessages({
          maxResults: 20,
          query: 'is:unread'
        });

        console.log(`[EMAIL-MONITOR-CRON] Found ${messageIds.length} unread messages for ${connection.gmail_address}`);

        let processedCount = 0;
        let urgentCount = 0;
        let errorCount = 0;

        for (const messageId of messageIds) {
          try {
            // Check if already processed
            const existing = await sql`
              SELECT id FROM email_messages
              WHERE gmail_message_id = ${messageId}
              LIMIT 1
            `;

            if (existing.rows.length > 0) {
              continue;
            }

            // Fetch message details
            const message = await gmailClient.getMessage(messageId);
            const senderDomain = message.from.email.split('@')[1]?.toLowerCase() || '';

            // AI Classification
            const classification = connection.auto_classify
              ? await classifyEmail({
                  subject: message.subject,
                  bodyText: message.bodyText || message.snippet,
                  senderEmail: message.from.email,
                  senderName: message.from.name,
                  senderDomain,
                  clientDomains: connection.client_domains || [],
                  supplierDomains: connection.supplier_domains || [],
                  urgentKeywords: connection.urgent_keywords || [],
                  spamKeywords: connection.spam_keywords || []
                })
              : {
                  urgencyLevel: 'normal' as const,
                  isSpam: false,
                  isClient: false,
                  isSupplier: false,
                  isInternal: false,
                  emailCategory: 'other' as const,
                  sentiment: 'neutral' as const,
                  keywords: [],
                  confidence: 0,
                  reasoning: 'Auto-classification disabled'
                };

            // Count urgent emails
            if (classification.urgencyLevel === 'urgent') {
              urgentCount++;
            }

            // AI Summarization
            const summary =
              connection.auto_summarize && !classification.isSpam
                ? await summarizeEmail({
                    subject: message.subject,
                    bodyText: message.bodyText || message.snippet,
                    senderEmail: message.from.email,
                    senderName: message.from.name
                  })
                : null;

            // Save to database
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
                processed_at
              ) VALUES (
                ${connection.id},
                ${message.id},
                ${message.threadId},
                ${JSON.stringify(message.labelIds)},
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
                ${JSON.stringify(classification.keywords)},
                ${classification.emailCategory},
                NOW()
              )
              RETURNING id
            `;

            const emailId = insertResult.rows[0].id;

            // Generate embedding (skip spam)
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
                  isSupplier: classification.isSupplier
                });
              } catch (embError) {
                // Non-critical, continua
                console.warn(`[EMAIL-MONITOR-CRON] Embedding failed for ${emailId}`);
              }
            }

            // Auto-move spam
            if (connection.auto_move_spam && classification.isSpam) {
              try {
                await gmailClient.moveToSpam(messageId);
                await sql`
                  UPDATE email_messages
                  SET moved_to_spam = true, moved_to_folder = 'SPAM'
                  WHERE id = ${emailId}
                `;
              } catch (spamError) {
                console.warn(`[EMAIL-MONITOR-CRON] Failed to move spam: ${emailId}`);
              }
            }

            processedCount++;
          } catch (msgError: any) {
            console.error(`[EMAIL-MONITOR-CRON] Error processing message ${messageId}:`, msgError.message);
            errorCount++;
          }
        }

        // Update last sync date
        await sql`
          UPDATE gmail_connections
          SET last_sync_date = NOW(),
              updated_at = NOW()
          WHERE id = ${connection.id}
        `;

        results.push({
          connectionId: connection.id,
          gmailAddress: connection.gmail_address,
          processed: processedCount,
          urgent: urgentCount,
          errors: errorCount
        });

        console.log(`[EMAIL-MONITOR-CRON] ✅ ${connection.gmail_address}: processed ${processedCount}, urgent ${urgentCount}`);
      } catch (connError: any) {
        console.error(`[EMAIL-MONITOR-CRON] Error processing connection ${connection.id}:`, connError.message);
        results.push({
          connectionId: connection.id,
          gmailAddress: connection.gmail_address,
          processed: 0,
          urgent: 0,
          errors: 1
        });
      }
    }

    // ========== SUMMARY ==========
    const totalProcessed = results.reduce((sum, r) => sum + r.processed, 0);
    const totalUrgent = results.reduce((sum, r) => sum + r.urgent, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);

    console.log(`[EMAIL-MONITOR-CRON] 🎉 Morning check complete!`);
    console.log(`[EMAIL-MONITOR-CRON] Total processed: ${totalProcessed}, Urgent: ${totalUrgent}, Errors: ${totalErrors}`);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        connectionsProcessed: connections.length,
        totalEmails: totalProcessed,
        urgentEmails: totalUrgent,
        errors: totalErrors
      },
      details: results
    });
  } catch (error: any) {
    console.error('[EMAIL-MONITOR-CRON] Fatal error:', error);
    return NextResponse.json(
      { error: 'Cron job failed', details: error.message },
      { status: 500 }
    );
  }
}
