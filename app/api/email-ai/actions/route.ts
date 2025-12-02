import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { GmailClient } from '@/lib/email-ai/gmail-client';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/email-ai/actions
 * Esegue azioni rapide su email: archive, mark read/unread, star, move, tag
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      connectionId,
      emailId,       // UUID dell'email nel nostro DB
      gmailMessageId, // ID Gmail per operazioni API
      action,        // 'archive' | 'markRead' | 'markUnread' | 'star' | 'unstar' | 'moveToSpam' | 'addTag' | 'removeTag' | 'markImportant'
      tagName,       // Per azioni addTag/removeTag
      batchEmailIds  // Per azioni batch su multiple email
    } = body;

    if (!connectionId) {
      return NextResponse.json({ error: 'connectionId required' }, { status: 400 });
    }

    if (!action) {
      return NextResponse.json({ error: 'action required' }, { status: 400 });
    }

    // Per azioni singole
    if (!emailId && !batchEmailIds) {
      return NextResponse.json({ error: 'emailId or batchEmailIds required' }, { status: 400 });
    }

    console.log(`[EMAIL-ACTIONS] Action: ${action} for connection ${connectionId}`);

    // Inizializza Gmail client per operazioni Gmail API
    let gmailClient: GmailClient | null = null;

    try {
      gmailClient = await GmailClient.fromConnectionId(connectionId);
    } catch (clientError: any) {
      console.warn('[EMAIL-ACTIONS] Gmail client not available:', clientError.message);
      // Continua comunque per azioni solo DB
    }

    const emailIds = batchEmailIds || [emailId];
    const results: Array<{ emailId: string; success: boolean; error?: string }> = [];

    for (const currentEmailId of emailIds) {
      try {
        // Ottieni gmail_message_id se non fornito
        let currentGmailMessageId = gmailMessageId;
        if (!currentGmailMessageId) {
          const emailResult = await sql`
            SELECT gmail_message_id FROM email_messages
            WHERE id = ${currentEmailId}
            LIMIT 1
          `;
          if (emailResult.rows.length > 0) {
            currentGmailMessageId = emailResult.rows[0].gmail_message_id;
          }
        }

        switch (action) {
          case 'archive':
            // Archivia su Gmail (rimuove da INBOX)
            if (gmailClient && currentGmailMessageId) {
              await gmailClient.archive(currentGmailMessageId);
            }
            // Aggiorna DB
            await sql`
              UPDATE email_messages
              SET archived_at = NOW(), updated_at = NOW()
              WHERE id = ${currentEmailId}
            `;
            break;

          case 'markRead':
            // Marca come letto su Gmail
            if (gmailClient && currentGmailMessageId) {
              await gmailClient.markAsRead(currentGmailMessageId);
            }
            // Aggiorna DB
            await sql`
              UPDATE email_messages
              SET is_read = true, updated_at = NOW()
              WHERE id = ${currentEmailId}
            `;
            break;

          case 'markUnread':
            // Marca come non letto su Gmail
            if (gmailClient && currentGmailMessageId) {
              await gmailClient.markAsUnread(currentGmailMessageId);
            }
            // Aggiorna DB
            await sql`
              UPDATE email_messages
              SET is_read = false, updated_at = NOW()
              WHERE id = ${currentEmailId}
            `;
            break;

          case 'star':
            // Aggiungi stella su Gmail
            if (gmailClient && currentGmailMessageId) {
              await gmailClient.toggleStar(currentGmailMessageId, true);
            }
            // Aggiorna DB
            await sql`
              UPDATE email_messages
              SET is_starred = true, updated_at = NOW()
              WHERE id = ${currentEmailId}
            `;
            break;

          case 'unstar':
            // Rimuovi stella su Gmail
            if (gmailClient && currentGmailMessageId) {
              await gmailClient.toggleStar(currentGmailMessageId, false);
            }
            // Aggiorna DB
            await sql`
              UPDATE email_messages
              SET is_starred = false, updated_at = NOW()
              WHERE id = ${currentEmailId}
            `;
            break;

          case 'moveToSpam':
            // Sposta in spam su Gmail
            if (gmailClient && currentGmailMessageId) {
              await gmailClient.moveToSpam(currentGmailMessageId);
            }
            // Aggiorna DB
            await sql`
              UPDATE email_messages
              SET is_spam = true, moved_to_spam = true, moved_to_folder = 'SPAM', updated_at = NOW()
              WHERE id = ${currentEmailId}
            `;
            break;

          case 'markImportant':
            // Aggiorna DB - marca come importante dall'utente
            await sql`
              UPDATE email_messages
              SET user_marked_important = true, updated_at = NOW()
              WHERE id = ${currentEmailId}
            `;
            break;

          case 'unmarkImportant':
            // Aggiorna DB - rimuovi marca importante
            await sql`
              UPDATE email_messages
              SET user_marked_important = false, updated_at = NOW()
              WHERE id = ${currentEmailId}
            `;
            break;

          case 'addTag':
            if (!tagName) {
              throw new Error('tagName required for addTag action');
            }
            // Aggiungi tag all'array user_tags
            await sql`
              UPDATE email_messages
              SET user_tags = array_append(COALESCE(user_tags, ARRAY[]::text[]), ${tagName}),
                  updated_at = NOW()
              WHERE id = ${currentEmailId}
                AND NOT (${tagName} = ANY(COALESCE(user_tags, ARRAY[]::text[])))
            `;
            break;

          case 'removeTag':
            if (!tagName) {
              throw new Error('tagName required for removeTag action');
            }
            // Rimuovi tag dall'array user_tags
            await sql`
              UPDATE email_messages
              SET user_tags = array_remove(COALESCE(user_tags, ARRAY[]::text[]), ${tagName}),
                  updated_at = NOW()
              WHERE id = ${currentEmailId}
            `;
            break;

          case 'setUrgency':
            const { urgencyLevel } = body;
            if (!urgencyLevel || !['urgent', 'important', 'normal', 'low'].includes(urgencyLevel)) {
              throw new Error('Valid urgencyLevel required');
            }
            await sql`
              UPDATE email_messages
              SET urgency_level = ${urgencyLevel}, updated_at = NOW()
              WHERE id = ${currentEmailId}
            `;
            break;

          default:
            throw new Error(`Unknown action: ${action}`);
        }

        results.push({ emailId: currentEmailId, success: true });
      } catch (actionError: any) {
        console.error(`[EMAIL-ACTIONS] Error for email ${currentEmailId}:`, actionError.message);
        results.push({ emailId: currentEmailId, success: false, error: actionError.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`[EMAIL-ACTIONS] ✅ Completed: ${successCount} success, ${failCount} failed`);

    return NextResponse.json({
      success: failCount === 0,
      action,
      results,
      summary: {
        total: results.length,
        success: successCount,
        failed: failCount
      }
    });
  } catch (error: any) {
    console.error('[EMAIL-ACTIONS] Error:', error);
    return NextResponse.json(
      { error: 'Failed to execute action', details: error.message },
      { status: 500 }
    );
  }
}
