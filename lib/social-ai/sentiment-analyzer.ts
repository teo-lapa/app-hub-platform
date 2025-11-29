/**
 * Sentiment Analysis & Engagement Prediction Service
 *
 * Analyzes generated copy before posting to predict:
 * - Sentiment score (positive/neutral/negative)
 * - Predicted engagement rate
 * - Quality score
 * - Suggested improvements
 */

import { GoogleGenAI } from '@google/genai';

export interface SentimentAnalysis {
  sentiment: 'positive' | 'neutral' | 'negative';
  sentimentScore: number; // -1 to 1 (-1 = very negative, 1 = very positive)
  predictedEngagement: number; // 0-100% estimated engagement rate
  qualityScore: number; // 0-100 overall quality score
  strengths: string[]; // What's good about this copy
  improvements: string[]; // Suggested improvements
  recommendation: 'ready_to_post' | 'needs_improvement' | 'regenerate';
}

const isDev = process.env.NODE_ENV === 'development';

/**
 * Analyze sentiment and predict engagement for social post copy
 */
export async function analyzeSentiment(params: {
  caption: string;
  hashtags: string[];
  cta: string;
  platform: string;
  tone: string;
  productName?: string;
}): Promise<SentimentAnalysis> {
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `You are a social media marketing expert specialized in sentiment analysis and engagement prediction.

ANALYZE THIS ${params.platform.toUpperCase()} POST:

Caption: "${params.caption}"
Hashtags: ${params.hashtags.join(' ')}
CTA: "${params.cta}"
Tone: ${params.tone}
${params.productName ? `Product: ${params.productName}` : ''}

TASK:
Analyze the post and provide a comprehensive sentiment and engagement prediction.

RETURN JSON (no markdown):
{
  "sentiment": "positive|neutral|negative",
  "sentimentScore": <number from -1 to 1>,
  "predictedEngagement": <estimated engagement rate 0-100%>,
  "qualityScore": <overall quality 0-100>,
  "strengths": [<array of 2-3 strong points>],
  "improvements": [<array of 1-3 suggestions, empty if perfect>],
  "recommendation": "ready_to_post|needs_improvement|regenerate"
}

EVALUATION CRITERIA:
1. **Sentiment**: Emotional tone (positive/negative/neutral)
2. **Predicted Engagement**: Based on:
   - Caption clarity and appeal
   - Hashtag relevance and popularity
   - CTA effectiveness
   - Emoji usage (appropriate for tone)
   - Length (optimal for platform)
   - Call-to-action strength
3. **Quality Score**: Overall post quality
4. **Strengths**: What works well
5. **Improvements**: Actionable suggestions (only if needed)
6. **Recommendation**:
   - "ready_to_post": Excellent, post immediately
   - "needs_improvement": Good but can be better
   - "regenerate": Poor quality, generate new version

Be strict but constructive. Focus on social media best practices.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ text: prompt }]
    });

    const textResponse = response.text || '';

    // Clean JSON response
    const cleanJson = textResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    if (isDev) {
      console.log('[SENTIMENT] Analysis complete:', {
        sentiment: parsed.sentiment,
        score: parsed.sentimentScore,
        predictedEngagement: parsed.predictedEngagement,
        recommendation: parsed.recommendation
      });
    }

    return {
      sentiment: parsed.sentiment || 'neutral',
      sentimentScore: parseFloat(parsed.sentimentScore || 0),
      predictedEngagement: parseFloat(parsed.predictedEngagement || 0),
      qualityScore: parseFloat(parsed.qualityScore || 50),
      strengths: parsed.strengths || [],
      improvements: parsed.improvements || [],
      recommendation: parsed.recommendation || 'needs_improvement'
    };

  } catch (error: any) {
    console.error('[SENTIMENT] Analysis failed:', error.message);

    // Return neutral fallback instead of throwing
    return {
      sentiment: 'neutral',
      sentimentScore: 0,
      predictedEngagement: 50,
      qualityScore: 50,
      strengths: [],
      improvements: ['Unable to analyze - please review manually'],
      recommendation: 'needs_improvement'
    };
  }
}

/**
 * Batch analyze multiple copy variants (for A/B testing)
 */
export async function analyzeVariants(
  variants: Array<{
    caption: string;
    hashtags: string[];
    cta: string;
  }>,
  platform: string,
  tone: string
): Promise<Array<SentimentAnalysis & { variant: number }>> {
  const analyses = await Promise.all(
    variants.map(async (variant, index) => {
      const analysis = await analyzeSentiment({
        caption: variant.caption,
        hashtags: variant.hashtags,
        cta: variant.cta,
        platform,
        tone
      });

      return {
        ...analysis,
        variant: index + 1
      };
    })
  );

  // Sort by predicted engagement (best first)
  return analyses.sort((a, b) => b.predictedEngagement - a.predictedEngagement);
}

/**
 * Get sentiment emoji for UI display
 */
export function getSentimentEmoji(sentiment: SentimentAnalysis['sentiment']): string {
  const emojis = {
    positive: '😊',
    neutral: '😐',
    negative: '😞'
  };
  return emojis[sentiment] || '😐';
}

/**
 * Get recommendation color for UI
 */
export function getRecommendationColor(recommendation: SentimentAnalysis['recommendation']): string {
  const colors = {
    ready_to_post: 'text-green-400',
    needs_improvement: 'text-yellow-400',
    regenerate: 'text-red-400'
  };
  return colors[recommendation] || 'text-gray-400';
}

/**
 * Get engagement prediction level
 */
export function getEngagementLevel(predictedEngagement: number): {
  label: string;
  color: string;
  emoji: string;
} {
  if (predictedEngagement >= 7) {
    return {
      label: 'Excellent',
      color: 'text-green-400',
      emoji: '🔥'
    };
  } else if (predictedEngagement >= 5) {
    return {
      label: 'Good',
      color: 'text-blue-400',
      emoji: '👍'
    };
  } else if (predictedEngagement >= 3) {
    return {
      label: 'Average',
      color: 'text-yellow-400',
      emoji: '😐'
    };
  } else {
    return {
      label: 'Poor',
      color: 'text-red-400',
      emoji: '⚠️'
    };
  }
}
