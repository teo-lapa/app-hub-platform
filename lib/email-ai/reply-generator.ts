/**
 * Email Reply Generator
 *
 * Genera bozze di risposta intelligenti basate sul contesto dell'email
 */

import { GoogleGenAI } from '@google/genai';

export interface EmailReplyDraft {
  draftReply: string; // Bozza risposta completa
  tone: 'professional' | 'friendly' | 'formal' | 'apologetic' | 'assertive';
  suggestions: string[]; // Suggerimenti alternativi/miglioramenti
  confidence: number; // 0-100 quanto è confident la reply
}

const isDev = process.env.NODE_ENV === 'development';

/**
 * Genera bozza di risposta per un'email
 */
export async function generateReply(params: {
  subject: string;
  bodyText: string;
  senderEmail: string;
  senderName?: string;
  emailCategory?: string;
  userContext?: {
    userName?: string;
    companyName?: string;
    signature?: string;
  };
}): Promise<EmailReplyDraft> {
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const ai = new GoogleGenAI({ apiKey });

    // Truncate body se troppo lungo
    const bodyPreview = params.bodyText.substring(0, 3000);

    // User context
    const userName = params.userContext?.userName || 'Team';
    const companyName = params.userContext?.companyName || '';
    const signature = params.userContext?.signature || '';

    const prompt = `You are an expert email assistant specialized in drafting professional business replies.

ORIGINAL EMAIL TO REPLY TO:

FROM: ${params.senderName || params.senderEmail}
SUBJECT: "${params.subject}"
${params.emailCategory ? `CATEGORY: ${params.emailCategory}` : ''}

BODY:
${bodyPreview}

TASK:
Draft a professional, concise reply to this email.

CONTEXT:
- Reply on behalf of: ${userName}${companyName ? ` (${companyName})` : ''}
- Tone should match the email category and sender's tone
- Be helpful, professional, and actionable

RETURN JSON (no markdown):
{
  "draftReply": "<complete email reply>",
  "tone": "professional|friendly|formal|apologetic|assertive",
  "suggestions": ["<alternative phrase 1>", "<alternative phrase 2>", ...],
  "confidence": <0-100>
}

GUIDELINES:

**DRAFT REPLY**:
- Start with appropriate greeting (Hi [Name], Dear [Name], etc.)
- Address all key points from original email
- Be concise (max 150 words)
- Include clear next steps or call to action
- End with professional sign-off
- ${signature ? `Do NOT include signature (will be added automatically)` : 'Include brief sign-off'}

**TONE**:
- "professional": Standard business tone
- "friendly": Warm but still professional
- "formal": Very formal (legal, complaints)
- "apologetic": When addressing issues/delays
- "assertive": When setting boundaries/deadlines

**SUGGESTIONS**:
- Provide 2-3 alternative phrasings for key sentences
- Suggest improvements or additional points to consider

**CONFIDENCE**:
- High (80-100): Straightforward request/confirmation
- Medium (50-79): Needs clarification or more context
- Low (0-49): Complex issue requiring human review

EXAMPLES:

Original: "Can you send me the invoice for last month's order?"
Reply: "Hi [Name],

Of course! I've attached the invoice for your order #[NUMBER] from last month. The total is [AMOUNT] and payment is due by [DATE].

Let me know if you need anything else!

Best regards,
[Your Name]"
Tone: friendly
Confidence: 90

Original: "We're very disappointed with the delayed delivery. This is unacceptable."
Reply: "Dear [Name],

I sincerely apologize for the delivery delay. I understand your frustration and this is not the service we aim to provide.

I've immediately escalated this to our logistics team and will personally ensure your order is prioritized for delivery by [DATE]. I'll keep you updated every step of the way.

Again, my apologies for this inconvenience.

Regards,
[Your Name]"
Tone: apologetic
Confidence: 85`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ text: prompt }]
    });

    const textResponse = response.text || '';

    // Clean JSON response
    const cleanJson = textResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    if (isDev) {
      console.log('[REPLY-GENERATOR] Reply draft generated:', {
        tone: parsed.tone,
        confidence: parsed.confidence,
        length: parsed.draftReply?.length
      });
    }

    // Add signature if provided
    let draftReply = parsed.draftReply || 'Unable to generate reply draft';
    if (signature && !draftReply.includes(signature)) {
      draftReply += `\n\n${signature}`;
    }

    return {
      draftReply,
      tone: parsed.tone || 'professional',
      suggestions: parsed.suggestions || [],
      confidence: parseFloat(parsed.confidence || 60)
    };
  } catch (error: any) {
    console.error('[REPLY-GENERATOR] Reply generation failed:', error.message);

    // Fallback: generic reply template
    const senderNameShort = params.senderName?.split(' ')[0] || 'there';

    return {
      draftReply: `Hi ${senderNameShort},

Thank you for your email regarding "${params.subject}".

I've received your message and will review the details carefully. I'll get back to you shortly with a detailed response.

Best regards`,
      tone: 'professional',
      suggestions: [
        'Consider adding specific timeline for response',
        'Acknowledge specific points from their email',
        'Provide immediate next steps if possible'
      ],
      confidence: 40 // Bassa confidence per fallback
    };
  }
}

/**
 * Genera risposta rapida basata su template per email comuni
 */
export async function generateQuickReply(
  replyType:
    | 'acknowledge' // Confermo ricezione, rispondo presto
    | 'thank_you' // Grazie per l'email
    | 'schedule_meeting' // Programmiamo una call
    | 'more_info' // Ho bisogno di più info
    | 'will_investigate', // Sto investigando il problema
  recipientName?: string
): Promise<string> {
  const name = recipientName || 'there';

  const templates = {
    acknowledge: `Hi ${name},

Thank you for your email. I've received your message and will review it carefully. I'll get back to you within 24 hours with a detailed response.

Best regards`,

    thank_you: `Hi ${name},

Thank you so much for reaching out! I really appreciate your message.

Best regards`,

    schedule_meeting: `Hi ${name},

Thanks for your email! I'd love to discuss this further. Would you be available for a quick call this week?

Here are a few time slots that work for me:
- [Day 1] at [Time]
- [Day 2] at [Time]
- [Day 3] at [Time]

Let me know what works best for you.

Best regards`,

    more_info: `Hi ${name},

Thanks for reaching out! To better assist you, could you please provide some additional information:

- [Question 1]
- [Question 2]

This will help me give you the most accurate response.

Best regards`,

    will_investigate: `Hi ${name},

Thank you for bringing this to my attention. I'm currently investigating the issue and will have an update for you shortly.

I appreciate your patience.

Best regards`
  };

  return templates[replyType] || templates.acknowledge;
}

/**
 * Get tone color for UI
 */
export function getToneColor(tone: EmailReplyDraft['tone']): string {
  const colors = {
    professional: 'text-blue-500',
    friendly: 'text-green-500',
    formal: 'text-purple-500',
    apologetic: 'text-orange-500',
    assertive: 'text-red-500'
  };
  return colors[tone] || colors.professional;
}

/**
 * Get tone icon
 */
export function getToneIcon(tone: EmailReplyDraft['tone']): string {
  const icons = {
    professional: '💼',
    friendly: '😊',
    formal: '🎩',
    apologetic: '🙏',
    assertive: '💪'
  };
  return icons[tone] || icons.professional;
}

/**
 * Get confidence label
 */
export function getConfidenceLabel(confidence: number): {
  label: string;
  color: string;
} {
  if (confidence >= 80) {
    return {
      label: 'High Confidence',
      color: 'text-green-500'
    };
  } else if (confidence >= 50) {
    return {
      label: 'Medium Confidence',
      color: 'text-yellow-500'
    };
  } else {
    return {
      label: 'Low Confidence - Review Needed',
      color: 'text-red-500'
    };
  }
}
