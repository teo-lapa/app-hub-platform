import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { GmailClient } from '@/lib/email-ai/gmail-client';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/email-ai/sync
 * Sincronizza lo stato delle email dal database con Gmail
 * - Verifica se email sono ancora in INBOX
 * - Controlla se è stata data una risposta (thread con nuovi messaggi)
 * - Aggiorna stato read/starred
 * - Rimuove email archiviate/eliminate
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { connectionId } = body;

    if (!connectionId) {
      return NextResponse.json({ error: 'connectionId required' }, { status: 400 });
    }

    console.log(`[SYNC] Starting sync for connection ${connectionId}`);

    // Inizializza Gmail client
    let gmailClient;
    try {
      gmailClient = await GmailClient.fromConnectionId(connectionId);
    } catch (clientError: any) {
      console.error('[SYNC] Failed to initialize Gmail client:', clientError.message);
      if (clientError.message.includes('refresh token') ||
          clientError.message.includes('invalid_grant')) {
        return NextResponse.json({
          error: 'Gmail token expired',
          requiresReauth: true
        }, { status: 401 });
      }
      throw clientError;
    }

    // Ottieni email dal database (non archiviate, non spam)
    const dbEmails = await sql`
      SELECT
        id,
        gmail_message_id,
        gmail_thread_id,
        is_read,
        is_starred,
        archived_at
      FROM email_messages
      WHERE connection_id = ${connectionId}
        AND archived_at IS NULL
        AND is_spam = false
      ORDER BY received_date DESC
      LIMIT 200
    `;

    if (dbEmails.rows.length === 0) {
      return NextResponse.json({
        success: true,
        synced: 0,
        removed: 0,
        replied: 0,
        message: 'No emails to sync'
      });
    }

    console.log(`[SYNC] Checking ${dbEmails.rows.length} emails`);

    const stats = {
      synced: 0,
      removed: 0,
      replied: 0,
      updated: 0,
      errors: 0
    };

    // Processa ogni email
    for (const dbEmail of dbEmails.rows) {
      try {
        // Ottieni stato attuale da Gmail
        let gmailMessage;
        try {
          gmailMessage = await gmailClient.getMessage(dbEmail.gmail_message_id);
        } catch (e: any) {
          // Email non trovata su Gmail (eliminata o in spam)
          if (e.message?.includes('404') || e.message?.includes('Not Found')) {
            console.log(`[SYNC] Email ${dbEmail.id} not found on Gmail, archiving`);
            await sql`
              UPDATE email_messages
              SET archived_at = NOW(), updated_at = NOW()
              WHERE id = ${dbEmail.id}
            `;
            stats.removed++;
            continue;
          }
          throw e;
        }

        // Check se ancora in INBOX
        const isInInbox = gmailMessage.labelIds.includes('INBOX');

        // Se non è più in INBOX, archivia nel database
        if (!isInInbox) {
          console.log(`[SYNC] Email ${dbEmail.id} no longer in INBOX, archiving`);
          await sql`
            UPDATE email_messages
            SET archived_at = NOW(), updated_at = NOW()
            WHERE id = ${dbEmail.id}
          `;
          stats.removed++;
          continue;
        }

        // Check se è stata data risposta (controlla thread per messaggi SENT)
        const hasReplied = await checkIfReplied(gmailClient, dbEmail.gmail_thread_id, dbEmail.gmail_message_id);

        if (hasReplied) {
          console.log(`[SYNC] Email ${dbEmail.id} has been replied to, archiving`);
          await sql`
            UPDATE email_messages
            SET
              archived_at = NOW(),
              reply_detected = true,
              updated_at = NOW()
            WHERE id = ${dbEmail.id}
          `;
          stats.replied++;
          stats.removed++;
          continue;
        }

        // Aggiorna stato read/starred se cambiato
        const gmailIsRead = gmailMessage.isRead;
        const gmailIsStarred = gmailMessage.isStarred;

        if (dbEmail.is_read !== gmailIsRead || dbEmail.is_starred !== gmailIsStarred) {
          await sql`
            UPDATE email_messages
            SET
              is_read = ${gmailIsRead},
              is_starred = ${gmailIsStarred},
              updated_at = NOW()
            WHERE id = ${dbEmail.id}
          `;
          stats.updated++;
        }

        stats.synced++;
      } catch (emailError: any) {
        console.error(`[SYNC] Error syncing email ${dbEmail.id}:`, emailError.message);
        stats.errors++;
      }
    }

    console.log(`[SYNC] ✅ Completed: synced=${stats.synced}, removed=${stats.removed}, replied=${stats.replied}, updated=${stats.updated}`);

    return NextResponse.json({
      success: true,
      ...stats
    });
  } catch (error: any) {
    console.error('[SYNC] Error:', error);
    return NextResponse.json(
      { error: 'Failed to sync emails', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Controlla se è stata data una risposta guardando il thread
 */
async function checkIfReplied(
  gmailClient: GmailClient,
  threadId: string,
  originalMessageId: string
): Promise<boolean> {
  try {
    // Ottieni tutti i messaggi nel thread
    const gmail = (gmailClient as any).gmail;
    const response = await gmail.users.threads.get({
      userId: 'me',
      id: threadId,
      format: 'metadata',
      metadataHeaders: ['From']
    });

    const messages = response.data.messages || [];

    // Se ci sono più messaggi nel thread oltre all'originale
    if (messages.length <= 1) {
      return false;
    }

    // Ottieni l'indirizzo email dell'utente
    const profile = await gmailClient.getProfile();
    const userEmail = profile.emailAddress.toLowerCase();

    // Cerca messaggi SENT dall'utente dopo l'originale
    for (const msg of messages) {
      // Salta il messaggio originale
      if (msg.id === originalMessageId) continue;

      // Check se ha label SENT (= inviato dall'utente)
      const labelIds = msg.labelIds || [];
      if (labelIds.includes('SENT')) {
        // Verifica che sia stato inviato dall'utente
        const fromHeader = msg.payload?.headers?.find(
          (h: any) => h.name?.toLowerCase() === 'from'
        );
        if (fromHeader?.value?.toLowerCase().includes(userEmail)) {
          return true;
        }
      }
    }

    return false;
  } catch (e: any) {
    console.error('[SYNC] Error checking thread:', e.message);
    return false;
  }
}
