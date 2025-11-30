/**
 * Client-safe helper functions for Sentiment Analysis UI
 * These functions can be imported in 'use client' components
 */

export type SentimentType = 'positive' | 'neutral' | 'negative';
export type RecommendationType = 'ready_to_post' | 'needs_improvement' | 'regenerate';

/**
 * Get emoji for sentiment
 */
export function getSentimentEmoji(sentiment: SentimentType): string {
  switch (sentiment) {
    case 'positive':
      return '😊';
    case 'neutral':
      return '😐';
    case 'negative':
      return '😞';
    default:
      return '😐';
  }
}

/**
 * Get color class for recommendation badge
 */
export function getRecommendationColor(recommendation: RecommendationType): string {
  switch (recommendation) {
    case 'ready_to_post':
      return 'text-green-400';
    case 'needs_improvement':
      return 'text-yellow-400';
    case 'regenerate':
      return 'text-red-400';
    default:
      return 'text-gray-400';
  }
}

/**
 * Get engagement level with emoji and color
 */
export function getEngagementLevel(predictedEngagement: number): {
  label: string;
  emoji: string;
  color: string;
} {
  if (predictedEngagement >= 8.0) {
    return { label: 'Excellent', emoji: '🔥', color: 'text-green-400' };
  } else if (predictedEngagement >= 5.0) {
    return { label: 'Good', emoji: '👍', color: 'text-blue-400' };
  } else if (predictedEngagement >= 3.0) {
    return { label: 'Average', emoji: '👌', color: 'text-yellow-400' };
  } else {
    return { label: 'Poor', emoji: '📉', color: 'text-red-400' };
  }
}
