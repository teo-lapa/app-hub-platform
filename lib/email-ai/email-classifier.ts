/**
 * Email AI Classifier
 *
 * Classifica email con AI per:
 * - Urgency level (urgent/important/normal/low)
 * - Email type (client/supplier/spam/newsletter)
 * - Category (sales/support/invoice/order/delivery/marketing)
 * - Keywords extraction
 */

import { GoogleGenAI } from '@google/genai';

export interface EmailClassification {
  urgencyLevel: 'urgent' | 'important' | 'normal' | 'low';
  isSpam: boolean;
  isClient: boolean;
  isSupplier: boolean;
  isInternal: boolean;

  emailCategory:
    | 'sales'
    | 'support'
    | 'invoice'
    | 'order'
    | 'delivery'
    | 'marketing'
    | 'newsletter'
    | 'notification'
    | 'other';

  sentiment: 'positive' | 'neutral' | 'negative' | 'urgent';
  keywords: string[];
  confidence: number; // 0-100
  reasoning: string; // Spiegazione breve della classificazione
}

const isDev = process.env.NODE_ENV === 'development';

/**
 * Classifica email con AI
 */
export async function classifyEmail(params: {
  subject: string;
  bodyText: string;
  senderEmail: string;
  senderName?: string;
  senderDomain: string;

  // Opzionale: configurazione custom utente
  clientDomains?: string[];
  supplierDomains?: string[];
  urgentKeywords?: string[];
  spamKeywords?: string[];
}): Promise<EmailClassification> {
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const ai = new GoogleGenAI({ apiKey });

    // Truncate body se troppo lungo (max 2000 chars per Gemini)
    const bodyPreview = params.bodyText.substring(0, 2000);

    // Costruisci contesto custom se fornito
    let customContext = '';
    if (params.clientDomains && params.clientDomains.length > 0) {
      customContext += `\nKNOWN CLIENT DOMAINS: ${params.clientDomains.join(', ')}`;
    }
    if (params.supplierDomains && params.supplierDomains.length > 0) {
      customContext += `\nKNOWN SUPPLIER DOMAINS: ${params.supplierDomains.join(', ')}`;
    }
    if (params.urgentKeywords && params.urgentKeywords.length > 0) {
      customContext += `\nURGENT KEYWORDS: ${params.urgentKeywords.join(', ')}`;
    }

    const prompt = `You are an expert email classifier for a business inbox management system.

ANALYZE THIS EMAIL:

FROM: ${params.senderName || params.senderEmail} <${params.senderEmail}>
DOMAIN: ${params.senderDomain}
SUBJECT: "${params.subject}"

BODY (preview):
${bodyPreview}
${customContext}

TASK:
Classify this email comprehensively for intelligent triage.

RETURN JSON (no markdown):
{
  "urgencyLevel": "urgent|important|normal|low",
  "isSpam": true|false,
  "isClient": true|false,
  "isSupplier": true|false,
  "isInternal": true|false,
  "emailCategory": "sales|support|invoice|order|delivery|marketing|newsletter|notification|other",
  "sentiment": "positive|neutral|negative|urgent",
  "keywords": ["keyword1", "keyword2", ...],
  "confidence": <0-100>,
  "reasoning": "<brief explanation>"
}

CLASSIFICATION RULES:

**URGENCY LEVEL**:
- "urgent": Immediate action required (payment deadlines, legal notices, customer complaints, system failures)
- "important": Needs attention soon (client inquiries, supplier quotes, meeting requests)
- "normal": Regular business emails
- "low": FYI, newsletters, automated notifications

**SPAM DETECTION**:
- Marketing emails from unknown senders
- Generic promotional content
- Suspicious links or attachments mentions
- Common spam patterns

**EMAIL TYPE**:
- isClient: Email from existing or potential customers
- isSupplier: Email from vendors, suppliers, service providers
- isInternal: Email from company domain or known team members

**EMAIL CATEGORY**:
- sales: Sales inquiries, quotes, proposals
- support: Customer support, help requests, issues
- invoice: Invoices, billing, payment requests
- order: Purchase orders, order confirmations, deliveries
- delivery: Shipping notifications, logistics
- marketing: Promotional emails, offers, campaigns
- newsletter: Newsletters, updates
- notification: Automated system notifications
- other: Doesn't fit above categories

**SENTIMENT**:
- positive: Happy customer, positive feedback, approval
- neutral: Informational, neutral tone
- negative: Complaints, issues, problems
- urgent: Time-sensitive, demanding, critical

**KEYWORDS**: Extract 3-5 most important keywords/phrases from subject and body

**CONFIDENCE**: How confident you are in this classification (0-100)

**REASONING**: Brief 1-sentence explanation of your classification

Be strict with spam detection but avoid false positives for legitimate business emails.
Prioritize urgency correctly - real urgency vs fake urgency (marketing).`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ text: prompt }]
    });

    const textResponse = response.text || '';

    // Clean JSON response
    const cleanJson = textResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    if (isDev) {
      console.log('[EMAIL-CLASSIFIER] Classification complete:', {
        urgency: parsed.urgencyLevel,
        isSpam: parsed.isSpam,
        category: parsed.emailCategory,
        confidence: parsed.confidence
      });
    }

    // Additional validation: se dominio è in clientDomains, forza isClient = true
    let isClient = parsed.isClient || false;
    let isSupplier = parsed.isSupplier || false;

    if (params.clientDomains?.includes(params.senderDomain)) {
      isClient = true;
      if (isDev) console.log('[EMAIL-CLASSIFIER] Domain match: forcing isClient = true');
    }

    if (params.supplierDomains?.includes(params.senderDomain)) {
      isSupplier = true;
      if (isDev) console.log('[EMAIL-CLASSIFIER] Domain match: forcing isSupplier = true');
    }

    return {
      urgencyLevel: parsed.urgencyLevel || 'normal',
      isSpam: parsed.isSpam || false,
      isClient,
      isSupplier,
      isInternal: parsed.isInternal || false,
      emailCategory: parsed.emailCategory || 'other',
      sentiment: parsed.sentiment || 'neutral',
      keywords: parsed.keywords || [],
      confidence: parseFloat(parsed.confidence || 70),
      reasoning: parsed.reasoning || 'AI classification'
    };
  } catch (error: any) {
    console.error('[EMAIL-CLASSIFIER] Classification failed:', error.message);

    // Fallback: classificazione basica usando regex
    const isSpamKeyword = (text: string) => {
      const spamKeywords = params.spamKeywords || [
        'offerta',
        'promozione',
        'sconto',
        'gratis',
        'newsletter',
        'unsubscribe',
        'click here',
        'limited time'
      ];
      const lowerText = text.toLowerCase();
      return spamKeywords.some(kw => lowerText.includes(kw.toLowerCase()));
    };

    const isUrgentKeyword = (text: string) => {
      const urgentKeywords = params.urgentKeywords || [
        'urgente',
        'immediate',
        'scadenza',
        'deadline',
        'fattura',
        'invoice',
        'pagamento',
        'payment',
        'problema',
        'issue'
      ];
      const lowerText = text.toLowerCase();
      return urgentKeywords.some(kw => lowerText.includes(kw.toLowerCase()));
    };

    const subjectAndBody = `${params.subject} ${params.bodyText}`.toLowerCase();
    const isSpam = isSpamKeyword(subjectAndBody);
    const isUrgent = isUrgentKeyword(subjectAndBody);

    // Return fallback classification
    return {
      urgencyLevel: isUrgent ? 'important' : 'normal',
      isSpam,
      isClient: params.clientDomains?.includes(params.senderDomain) || false,
      isSupplier: params.supplierDomains?.includes(params.senderDomain) || false,
      isInternal: false,
      emailCategory: 'other',
      sentiment: 'neutral',
      keywords: [],
      confidence: 40, // Bassa confidence per fallback
      reasoning: 'Fallback classification (AI unavailable)'
    };
  }
}

/**
 * Batch classifica multiple email
 */
export async function classifyBatch(
  emails: Array<{
    id: string;
    subject: string;
    bodyText: string;
    senderEmail: string;
    senderDomain: string;
  }>,
  customConfig?: {
    clientDomains?: string[];
    supplierDomains?: string[];
    urgentKeywords?: string[];
    spamKeywords?: string[];
  }
): Promise<Array<EmailClassification & { emailId: string }>> {
  const classifications = await Promise.all(
    emails.map(async email => {
      const classification = await classifyEmail({
        subject: email.subject,
        bodyText: email.bodyText,
        senderEmail: email.senderEmail,
        senderDomain: email.senderDomain,
        ...customConfig
      });

      return {
        ...classification,
        emailId: email.id
      };
    })
  );

  return classifications;
}

/**
 * Get urgency color for UI
 */
export function getUrgencyColor(urgencyLevel: EmailClassification['urgencyLevel']): string {
  const colors = {
    urgent: 'text-red-500 bg-red-50',
    important: 'text-orange-500 bg-orange-50',
    normal: 'text-blue-500 bg-blue-50',
    low: 'text-gray-500 bg-gray-50'
  };
  return colors[urgencyLevel] || colors.normal;
}

/**
 * Get category icon for UI
 */
export function getCategoryIcon(category: EmailClassification['emailCategory']): string {
  const icons = {
    sales: '💼',
    support: '🆘',
    invoice: '💸',
    order: '📦',
    delivery: '🚚',
    marketing: '📢',
    newsletter: '📰',
    notification: '🔔',
    other: '📧'
  };
  return icons[category] || icons.other;
}

/**
 * Get sentiment emoji
 */
export function getSentimentEmoji(sentiment: EmailClassification['sentiment']): string {
  const emojis = {
    positive: '😊',
    neutral: '😐',
    negative: '😞',
    urgent: '⚡'
  };
  return emojis[sentiment] || emojis.neutral;
}
