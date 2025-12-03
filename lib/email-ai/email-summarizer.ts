/**
 * Email AI Summarizer
 *
 * Genera riassunti intelligenti delle email per triage rapido
 */

import { GoogleGenAI } from '@google/genai';

export interface EmailSummary {
  summary: string; // Riassunto conciso (1-3 frasi)
  actionItems: string[]; // Azioni richieste
  keyPoints: string[]; // Punti chiave
  suggestedPriority: 'high' | 'medium' | 'low';
  estimatedReadTime: number; // Minuti
}

const isDev = process.env.NODE_ENV === 'development';

/**
 * Genera riassunto intelligente di un'email
 */
export async function summarizeEmail(params: {
  subject: string;
  bodyText: string;
  senderEmail: string;
  senderName?: string;
  language?: 'it' | 'en' | 'de'; // Language for the summary
}): Promise<EmailSummary> {
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const ai = new GoogleGenAI({ apiKey });

    // Truncate body se troppo lungo (max 3000 chars)
    const bodyPreview = params.bodyText.substring(0, 3000);
    const wordCount = params.bodyText.split(/\s+/).length;
    const estimatedReadTime = Math.max(1, Math.ceil(wordCount / 200)); // 200 words/min

    // Language instructions
    const languageMap = {
      it: 'Respond ONLY in Italian (Italiano). All text must be in Italian.',
      en: 'Respond ONLY in English. All text must be in English.',
      de: 'Respond ONLY in German (Deutsch). All text must be in German.'
    };
    const languageInstruction = languageMap[params.language || 'en'];

    const prompt = `You are an expert email assistant specialized in creating concise, actionable summaries.

IMPORTANT LANGUAGE REQUIREMENT: ${languageInstruction}

SUMMARIZE THIS EMAIL:

FROM: ${params.senderName || params.senderEmail}
SUBJECT: "${params.subject}"

BODY:
${bodyPreview}

TASK:
Create a concise, actionable summary that helps the recipient quickly understand and act on this email.

RETURN JSON (no markdown):
{
  "summary": "<1-3 sentences capturing the essence>",
  "actionItems": ["<action 1>", "<action 2>", ...],
  "keyPoints": ["<key point 1>", "<key point 2>", ...],
  "suggestedPriority": "high|medium|low"
}

GUIDELINES:

**SUMMARY**:
- Max 3 sentences
- Focus on: WHO wants WHAT and WHY
- Use active voice
- Highlight deadlines if present

**ACTION ITEMS**:
- List concrete actions required (if any)
- Be specific and actionable
- Include deadlines if mentioned
- Empty array if no actions needed

**KEY POINTS**:
- Extract 2-5 most important facts/details
- Numbers, dates, names, specific requests
- Skip generic pleasantries

**SUGGESTED PRIORITY**:
- "high": Urgent deadlines, important clients, critical issues
- "medium": Regular business needs, non-urgent requests
- "low": FYI, informational, no action required

Examples:

Email: "Hi, the invoice for project XYZ is overdue. Please pay by Friday or we'll suspend service."
Summary: "Supplier requesting immediate payment for project XYZ invoice. Payment due by Friday to avoid service suspension."
Action Items: ["Review and approve XYZ invoice", "Process payment before Friday"]
Key Points: ["Project: XYZ", "Deadline: Friday", "Consequence: Service suspension"]
Priority: "high"

Email: "Just wanted to share our latest newsletter with product updates and industry news."
Summary: "Marketing newsletter with product updates and industry news. No action required."
Action Items: []
Key Points: ["Product updates available", "Industry news included"]
Priority: "low"`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ text: prompt }]
    });

    const textResponse = response.text || '';

    // Clean JSON response
    const cleanJson = textResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    if (isDev) {
      console.log('[EMAIL-SUMMARIZER] Summary generated:', {
        summary: parsed.summary.substring(0, 100),
        actionItems: parsed.actionItems.length,
        priority: parsed.suggestedPriority
      });
    }

    return {
      summary: parsed.summary || 'Unable to generate summary',
      actionItems: parsed.actionItems || [],
      keyPoints: parsed.keyPoints || [],
      suggestedPriority: parsed.suggestedPriority || 'medium',
      estimatedReadTime
    };
  } catch (error: any) {
    console.error('[EMAIL-SUMMARIZER] Summarization failed:', error.message);

    // Fallback: summary basato su subject + snippet del body
    const bodySnippet = params.bodyText.substring(0, 150).trim();
    const fallbackSummary = `${params.subject}. ${bodySnippet}${params.bodyText.length > 150 ? '...' : ''}`;

    return {
      summary: fallbackSummary,
      actionItems: [],
      keyPoints: [params.subject],
      suggestedPriority: 'medium',
      estimatedReadTime: Math.max(1, Math.ceil(params.bodyText.split(/\s+/).length / 200))
    };
  }
}

/**
 * Batch summarize multiple email
 */
export async function summarizeBatch(
  emails: Array<{
    id: string;
    subject: string;
    bodyText: string;
    senderEmail: string;
    senderName?: string;
  }>
): Promise<Array<EmailSummary & { emailId: string }>> {
  const summaries = await Promise.all(
    emails.map(async email => {
      const summary = await summarizeEmail({
        subject: email.subject,
        bodyText: email.bodyText,
        senderEmail: email.senderEmail,
        senderName: email.senderName
      });

      return {
        ...summary,
        emailId: email.id
      };
    })
  );

  return summaries;
}

/**
 * Get priority color for UI
 */
export function getPriorityColor(priority: EmailSummary['suggestedPriority']): string {
  const colors = {
    high: 'text-red-500 bg-red-50',
    medium: 'text-yellow-500 bg-yellow-50',
    low: 'text-green-500 bg-green-50'
  };
  return colors[priority] || colors.medium;
}

/**
 * Get priority icon
 */
export function getPriorityIcon(priority: EmailSummary['suggestedPriority']): string {
  const icons = {
    high: '🔴',
    medium: '🟡',
    low: '🟢'
  };
  return icons[priority] || icons.medium;
}
