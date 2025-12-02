/**
 * Email AI Autonomous Agent
 *
 * Agente autonomo per gestione email:
 * - Processa email nuove automaticamente
 * - Applica regole personalizzate
 * - Genera risposte automatiche (con approvazione opzionale)
 * - Gestisce workflow basati su pattern
 */

import { sql } from '@vercel/postgres';
import { classifyEmail, EmailClassification } from './email-classifier';
import { summarizeEmail } from './email-summarizer';
import { generateReply, EmailReplyDraft } from './reply-generator';
import { generateEmailEmbedding, saveEmailEmbedding, findSimilarEmails } from './embedding-service';

export interface AgentRule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number; // 1-100, higher = more priority

  // Condizioni (AND tra tutti i campi popolati)
  conditions: {
    senderDomains?: string[];      // Match se sender domain è in lista
    senderEmails?: string[];       // Match se sender email è in lista
    subjectContains?: string[];    // Match se subject contiene una keyword
    bodyContains?: string[];       // Match se body contiene una keyword
    categories?: string[];         // Match se AI category è in lista
    urgencyLevels?: string[];      // Match se urgency è in lista
    isClient?: boolean;            // Match se è da cliente
    isSupplier?: boolean;          // Match se è da fornitore
  };

  // Azioni da eseguire (tutte vengono eseguite)
  actions: {
    setUrgency?: 'urgent' | 'important' | 'normal' | 'low';
    markAsSpam?: boolean;
    archive?: boolean;
    addTags?: string[];
    generateReply?: boolean;
    autoReply?: boolean;           // Se true, invia risposta automatica (ATTENZIONE!)
    notifyUser?: boolean;
    customWebhook?: string;        // URL webhook per notifiche esterne
  };
}

export interface AgentConfig {
  connectionId: string;
  enabled: boolean;
  rules: AgentRule[];

  // Impostazioni globali
  autoReplyEnabled: boolean;       // Master switch per auto-reply
  requireApprovalFor: string[];    // Categorie che richiedono approvazione ['urgent', 'client']
  maxAutoRepliesPerDay: number;    // Limite giornaliero auto-reply
  workingHours?: {                 // Auto-reply solo in orari lavorativi
    start: number;                 // 0-23
    end: number;                   // 0-23
    timezone: string;
  };
}

export interface AgentExecutionResult {
  emailId: string;
  gmailMessageId: string;
  rulesMatched: string[];
  actionsExecuted: string[];
  replyGenerated?: EmailReplyDraft;
  autoReplySent: boolean;
  requiresApproval: boolean;
  errors: string[];
}

/**
 * Ottieni configurazione agente per una connessione
 */
export async function getAgentConfig(connectionId: string): Promise<AgentConfig | null> {
  try {
    const result = await sql`
      SELECT
        id,
        auto_classify,
        auto_summarize,
        auto_move_spam,
        auto_draft_reply,
        client_domains,
        supplier_domains,
        urgent_keywords,
        spam_keywords
      FROM gmail_connections
      WHERE id = ${connectionId}
        AND sync_enabled = true
      LIMIT 1
    `;

    if (result.rows.length === 0) return null;

    const conn = result.rows[0];

    // Costruisci config base dalle impostazioni connessione
    const rules: AgentRule[] = [];

    // Regola 1: Client domains -> marca come client + importante
    if (conn.client_domains && Array.isArray(conn.client_domains) && conn.client_domains.length > 0) {
      rules.push({
        id: 'auto-client',
        name: 'Mark Client Emails',
        enabled: true,
        priority: 90,
        conditions: {
          senderDomains: conn.client_domains
        },
        actions: {
          setUrgency: 'important',
          addTags: ['client']
        }
      });
    }

    // Regola 2: Supplier domains -> marca come supplier
    if (conn.supplier_domains && Array.isArray(conn.supplier_domains) && conn.supplier_domains.length > 0) {
      rules.push({
        id: 'auto-supplier',
        name: 'Mark Supplier Emails',
        enabled: true,
        priority: 80,
        conditions: {
          senderDomains: conn.supplier_domains
        },
        actions: {
          addTags: ['supplier']
        }
      });
    }

    // Regola 3: Spam keywords -> marca come spam
    if (conn.auto_move_spam && conn.spam_keywords && Array.isArray(conn.spam_keywords) && conn.spam_keywords.length > 0) {
      rules.push({
        id: 'auto-spam',
        name: 'Auto Move Spam',
        enabled: true,
        priority: 100,
        conditions: {
          subjectContains: conn.spam_keywords
        },
        actions: {
          markAsSpam: true,
          archive: true
        }
      });
    }

    // Regola 4: Urgent keywords -> marca come urgente
    if (conn.urgent_keywords && Array.isArray(conn.urgent_keywords) && conn.urgent_keywords.length > 0) {
      rules.push({
        id: 'auto-urgent',
        name: 'Mark Urgent Emails',
        enabled: true,
        priority: 95,
        conditions: {
          subjectContains: conn.urgent_keywords
        },
        actions: {
          setUrgency: 'urgent',
          notifyUser: true
        }
      });
    }

    // Regola 5: Auto-draft reply per email clienti non-spam
    if (conn.auto_draft_reply) {
      rules.push({
        id: 'auto-draft-client',
        name: 'Auto Draft Client Replies',
        enabled: true,
        priority: 50,
        conditions: {
          isClient: true
        },
        actions: {
          generateReply: true
        }
      });
    }

    return {
      connectionId,
      enabled: conn.auto_classify || conn.auto_summarize || conn.auto_move_spam,
      rules: rules.sort((a, b) => b.priority - a.priority),
      autoReplyEnabled: false, // Default: disabilitato per sicurezza
      requireApprovalFor: ['urgent', 'client'],
      maxAutoRepliesPerDay: 10
    };
  } catch (error: any) {
    console.error('[AGENT] Error loading config:', error.message);
    return null;
  }
}

/**
 * Valuta se una regola matcha un'email
 */
function evaluateRule(
  rule: AgentRule,
  email: {
    senderEmail: string;
    senderDomain: string;
    subject: string;
    bodyText: string;
    classification: EmailClassification;
  }
): boolean {
  const { conditions } = rule;

  // Sender domains
  if (conditions.senderDomains && conditions.senderDomains.length > 0) {
    if (!conditions.senderDomains.some(d => email.senderDomain.toLowerCase().includes(d.toLowerCase()))) {
      return false;
    }
  }

  // Sender emails
  if (conditions.senderEmails && conditions.senderEmails.length > 0) {
    if (!conditions.senderEmails.some(e => email.senderEmail.toLowerCase() === e.toLowerCase())) {
      return false;
    }
  }

  // Subject contains
  if (conditions.subjectContains && conditions.subjectContains.length > 0) {
    const subjectLower = email.subject.toLowerCase();
    if (!conditions.subjectContains.some(kw => subjectLower.includes(kw.toLowerCase()))) {
      return false;
    }
  }

  // Body contains
  if (conditions.bodyContains && conditions.bodyContains.length > 0) {
    const bodyLower = email.bodyText.toLowerCase();
    if (!conditions.bodyContains.some(kw => bodyLower.includes(kw.toLowerCase()))) {
      return false;
    }
  }

  // Categories
  if (conditions.categories && conditions.categories.length > 0) {
    if (!conditions.categories.includes(email.classification.emailCategory)) {
      return false;
    }
  }

  // Urgency levels
  if (conditions.urgencyLevels && conditions.urgencyLevels.length > 0) {
    if (!conditions.urgencyLevels.includes(email.classification.urgencyLevel)) {
      return false;
    }
  }

  // Is client
  if (conditions.isClient !== undefined && conditions.isClient !== email.classification.isClient) {
    return false;
  }

  // Is supplier
  if (conditions.isSupplier !== undefined && conditions.isSupplier !== email.classification.isSupplier) {
    return false;
  }

  return true;
}

/**
 * Esegui agent su una singola email
 */
export async function processEmailWithAgent(
  emailId: string,
  config: AgentConfig
): Promise<AgentExecutionResult> {
  const result: AgentExecutionResult = {
    emailId,
    gmailMessageId: '',
    rulesMatched: [],
    actionsExecuted: [],
    autoReplySent: false,
    requiresApproval: false,
    errors: []
  };

  try {
    // Ottieni email dal database
    const emailResult = await sql`
      SELECT
        id,
        gmail_message_id,
        sender_email,
        sender_name,
        sender_domain,
        subject,
        body_text,
        snippet,
        urgency_level,
        is_spam,
        is_client,
        is_supplier,
        email_category,
        ai_sentiment
      FROM email_messages
      WHERE id = ${emailId}
      LIMIT 1
    `;

    if (emailResult.rows.length === 0) {
      result.errors.push('Email not found');
      return result;
    }

    const email = emailResult.rows[0];
    result.gmailMessageId = email.gmail_message_id;

    // Costruisci classificazione corrente
    const classification: EmailClassification = {
      urgencyLevel: email.urgency_level || 'normal',
      isSpam: email.is_spam || false,
      isClient: email.is_client || false,
      isSupplier: email.is_supplier || false,
      isInternal: false,
      emailCategory: email.email_category || 'other',
      sentiment: email.ai_sentiment || 'neutral',
      keywords: [],
      confidence: 70,
      reasoning: 'Existing classification'
    };

    // Valuta ogni regola
    for (const rule of config.rules) {
      if (!rule.enabled) continue;

      const matches = evaluateRule(rule, {
        senderEmail: email.sender_email,
        senderDomain: email.sender_domain || '',
        subject: email.subject || '',
        bodyText: email.body_text || email.snippet || '',
        classification
      });

      if (matches) {
        result.rulesMatched.push(rule.id);
        console.log(`[AGENT] Rule matched: ${rule.name} for email ${emailId}`);

        // Esegui azioni
        const { actions } = rule;

        // Set urgency
        if (actions.setUrgency) {
          await sql`
            UPDATE email_messages
            SET urgency_level = ${actions.setUrgency}, updated_at = NOW()
            WHERE id = ${emailId}
          `;
          result.actionsExecuted.push(`setUrgency:${actions.setUrgency}`);
        }

        // Mark as spam
        if (actions.markAsSpam) {
          await sql`
            UPDATE email_messages
            SET is_spam = true, updated_at = NOW()
            WHERE id = ${emailId}
          `;
          result.actionsExecuted.push('markAsSpam');
        }

        // Archive
        if (actions.archive) {
          await sql`
            UPDATE email_messages
            SET archived_at = NOW(), updated_at = NOW()
            WHERE id = ${emailId}
          `;
          result.actionsExecuted.push('archive');
        }

        // Add tags
        if (actions.addTags && actions.addTags.length > 0) {
          for (const tag of actions.addTags) {
            await sql`
              UPDATE email_messages
              SET user_tags = array_append(COALESCE(user_tags, ARRAY[]::text[]), ${tag}),
                  updated_at = NOW()
              WHERE id = ${emailId}
                AND NOT (${tag} = ANY(COALESCE(user_tags, ARRAY[]::text[])))
            `;
          }
          result.actionsExecuted.push(`addTags:${actions.addTags.join(',')}`);
        }

        // Generate reply
        if (actions.generateReply) {
          try {
            const reply = await generateReply({
              subject: email.subject || '',
              bodyText: email.body_text || email.snippet || '',
              senderEmail: email.sender_email,
              senderName: email.sender_name,
              emailCategory: email.email_category
            });

            await sql`
              UPDATE email_messages
              SET ai_draft_reply = ${reply.draftReply}, updated_at = NOW()
              WHERE id = ${emailId}
            `;

            result.replyGenerated = reply;
            result.actionsExecuted.push('generateReply');

            // Check if requires approval
            if (config.requireApprovalFor.includes(email.urgency_level) ||
                (email.is_client && config.requireApprovalFor.includes('client'))) {
              result.requiresApproval = true;
            }
          } catch (replyError: any) {
            result.errors.push(`Reply generation failed: ${replyError.message}`);
          }
        }

        // Auto reply (PERICOLOSO - solo se abilitato e configurato)
        if (actions.autoReply && config.autoReplyEnabled) {
          // TODO: Implementare invio email via Gmail API
          // Per ora, log warning
          console.warn(`[AGENT] Auto-reply requested but not implemented for safety`);
          result.requiresApproval = true;
        }
      }
    }

    console.log(`[AGENT] Processed email ${emailId}: ${result.rulesMatched.length} rules matched, ${result.actionsExecuted.length} actions executed`);

  } catch (error: any) {
    console.error(`[AGENT] Error processing email ${emailId}:`, error.message);
    result.errors.push(error.message);
  }

  return result;
}

/**
 * Processa batch di email con agent
 */
export async function processBatchWithAgent(
  emailIds: string[],
  connectionId: string
): Promise<AgentExecutionResult[]> {
  const config = await getAgentConfig(connectionId);

  if (!config || !config.enabled) {
    console.log(`[AGENT] Agent disabled or not configured for connection ${connectionId}`);
    return [];
  }

  const results: AgentExecutionResult[] = [];

  for (const emailId of emailIds) {
    const result = await processEmailWithAgent(emailId, config);
    results.push(result);
  }

  return results;
}

/**
 * Ottieni statistiche agent per una connessione
 */
export async function getAgentStats(connectionId: string): Promise<{
  totalProcessed: number;
  rulesTriggered: Record<string, number>;
  actionsExecuted: Record<string, number>;
  repliesGenerated: number;
  autoRepliesSent: number;
  requiresApproval: number;
}> {
  // Per ora, statistiche basiche dal database
  const result = await sql`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE ai_draft_reply IS NOT NULL) as replies_generated,
      COUNT(*) FILTER (WHERE urgency_level = 'urgent') as urgent_count,
      COUNT(*) FILTER (WHERE is_spam = true) as spam_count,
      COUNT(*) FILTER (WHERE is_client = true) as client_count
    FROM email_messages
    WHERE connection_id = ${connectionId}
      AND processed_at IS NOT NULL
  `;

  const stats = result.rows[0];

  return {
    totalProcessed: parseInt(stats.total) || 0,
    rulesTriggered: {
      'auto-urgent': parseInt(stats.urgent_count) || 0,
      'auto-spam': parseInt(stats.spam_count) || 0,
      'auto-client': parseInt(stats.client_count) || 0
    },
    actionsExecuted: {
      classified: parseInt(stats.total) || 0,
      repliesGenerated: parseInt(stats.replies_generated) || 0
    },
    repliesGenerated: parseInt(stats.replies_generated) || 0,
    autoRepliesSent: 0, // Non implementato
    requiresApproval: 0
  };
}
