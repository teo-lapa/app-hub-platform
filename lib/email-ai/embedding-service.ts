/**
 * Embedding Service for Email AI Monitor
 *
 * Generates embeddings for emails using OpenAI API
 * and stores them in pgvector for RAG similarity search
 */

import { sql } from '@vercel/postgres';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Generate embedding for an email
 * Combines subject + body into a single text
 */
export async function generateEmailEmbedding(emailContent: {
  subject: string;
  bodyText: string;
  senderEmail?: string;
}): Promise<number[]> {
  try {
    // Combine subject + body (truncate body a 1500 chars max)
    const bodyPreview = emailContent.bodyText.substring(0, 1500);

    const textToEmbed = [
      emailContent.subject,
      bodyPreview,
      emailContent.senderEmail || ''
    ]
      .filter(Boolean)
      .join(' ')
      .trim();

    // Generate embedding using OpenAI text-embedding-3-small (1536 dimensions)
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: textToEmbed,
      encoding_format: 'float'
    });

    return response.data[0].embedding;
  } catch (error: any) {
    console.error('[EMAIL-EMBEDDING] Failed to generate embedding:', error.message);
    throw new Error(`Embedding generation failed: ${error.message}`);
  }
}

/**
 * Save email embedding to database
 */
export async function saveEmailEmbedding(params: {
  emailId: string;
  embedding: number[];
  senderDomain: string;
  urgencyLevel: string;
  emailCategory?: string;
  isClient: boolean;
  isSupplier: boolean;
  wasReplied?: boolean;
}): Promise<void> {
  try {
    // Convert embedding array to pgvector format string
    const embeddingVector = `[${params.embedding.join(',')}]`;

    await sql`
      INSERT INTO email_embeddings (
        email_id,
        embedding,
        sender_domain,
        urgency_level,
        email_category,
        is_client,
        is_supplier,
        was_replied,
        created_at
      ) VALUES (
        ${params.emailId},
        ${embeddingVector}::vector,
        ${params.senderDomain},
        ${params.urgencyLevel},
        ${params.emailCategory || null},
        ${params.isClient},
        ${params.isSupplier},
        ${params.wasReplied || false},
        NOW()
      )
      ON CONFLICT (email_id)
      DO UPDATE SET
        embedding = ${embeddingVector}::vector,
        sender_domain = ${params.senderDomain},
        urgency_level = ${params.urgencyLevel}
    `;

    console.log(`[EMAIL-EMBEDDING] ✓ Saved embedding for email ${params.emailId}`);
  } catch (error: any) {
    console.error('[EMAIL-EMBEDDING] Failed to save embedding:', error.message);
    throw new Error(`Failed to save embedding: ${error.message}`);
  }
}

/**
 * Find similar emails using vector similarity search
 * Useful per trovare email simili già gestite e suggerire risposte
 */
export async function findSimilarEmails(params: {
  queryEmbedding: number[];
  matchThreshold?: number; // Default 0.75 (75% similarity)
  matchCount?: number; // Default 5
  filterClient?: boolean;
  filterSupplier?: boolean;
  filterCategory?: string;
  onlyReplied?: boolean; // Solo email che hanno già ricevuto risposta
}): Promise<
  Array<{
    emailId: string;
    similarity: number;
    senderEmail: string;
    subject: string;
    aiSummary: string | null;
    aiDraftReply: string | null;
    urgencyLevel: string;
    emailCategory: string | null;
  }>
> {
  try {
    const embeddingVector = `[${params.queryEmbedding.join(',')}]`;
    const matchThreshold = params.matchThreshold || 0.75;
    const matchCount = params.matchCount || 5;

    // Usa la funzione find_similar_emails definita nel schema SQL
    const result = await sql`
      SELECT
        em.id as email_id,
        1 - (ee.embedding <=> ${embeddingVector}::vector) as similarity,
        em.sender_email,
        em.subject,
        em.ai_summary,
        em.ai_draft_reply,
        em.urgency_level,
        em.email_category
      FROM email_embeddings ee
      JOIN email_messages em ON ee.email_id = em.id
      WHERE
        em.is_spam = false
        AND (${params.filterClient === undefined} OR ee.is_client = ${params.filterClient})
        AND (${params.filterSupplier === undefined} OR ee.is_supplier = ${params.filterSupplier})
        AND (${params.filterCategory === undefined} OR ee.email_category = ${params.filterCategory})
        AND (${params.onlyReplied === false} OR ee.was_replied = true)
        AND 1 - (ee.embedding <=> ${embeddingVector}::vector) > ${matchThreshold}
      ORDER BY
        similarity DESC,
        ee.reply_quality_score DESC NULLS LAST
      LIMIT ${matchCount}
    `;

    console.log(`[EMAIL-EMBEDDING] ✓ Found ${result.rows.length} similar emails`);

    return result.rows.map(row => ({
      emailId: row.email_id,
      similarity: parseFloat(row.similarity),
      senderEmail: row.sender_email,
      subject: row.subject,
      aiSummary: row.ai_summary,
      aiDraftReply: row.ai_draft_reply,
      urgencyLevel: row.urgency_level,
      emailCategory: row.email_category
    }));
  } catch (error: any) {
    console.error('[EMAIL-EMBEDDING] Failed to find similar emails:', error.message);
    return [];
  }
}

/**
 * Batch generate embeddings for multiple emails
 */
export async function generateBatchEmbeddings(
  emails: Array<{
    id: string;
    subject: string;
    bodyText: string;
    senderEmail: string;
  }>
): Promise<Array<{ emailId: string; embedding: number[] }>> {
  const results = await Promise.all(
    emails.map(async email => {
      const embedding = await generateEmailEmbedding({
        subject: email.subject,
        bodyText: email.bodyText,
        senderEmail: email.senderEmail
      });

      return {
        emailId: email.id,
        embedding
      };
    })
  );

  return results;
}

/**
 * Update reply quality score (quando utente dà feedback sulla risposta suggerita)
 */
export async function updateReplyQualityScore(params: {
  emailId: string;
  qualityScore: number; // 0-100
  wasReplied: boolean;
}): Promise<void> {
  try {
    await sql`
      UPDATE email_embeddings
      SET
        reply_quality_score = ${params.qualityScore},
        was_replied = ${params.wasReplied}
      WHERE email_id = ${params.emailId}
    `;

    console.log(`[EMAIL-EMBEDDING] ✓ Updated reply quality score for email ${params.emailId}`);
  } catch (error: any) {
    console.error('[EMAIL-EMBEDDING] Failed to update quality score:', error.message);
  }
}
