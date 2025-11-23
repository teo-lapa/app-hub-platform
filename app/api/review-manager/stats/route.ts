import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');

    if (!businessId) {
      return NextResponse.json({
        success: false,
        error: 'businessId richiesto'
      }, { status: 400 });
    }

    // Statistiche totali
    const totalResult = await sql`
      SELECT COUNT(*) as total FROM rm_reviews WHERE business_id = ${businessId}
    `;

    // Recensioni pending (da rispondere)
    const pendingResult = await sql`
      SELECT COUNT(*) as pending FROM rm_reviews
      WHERE business_id = ${businessId}
        AND response_status IN ('pending', 'ai_generated', 'approved')
    `;

    // Rating medio (solo per recensioni con rating)
    const ratingResult = await sql`
      SELECT AVG(rating) as avg_rating FROM rm_reviews
      WHERE business_id = ${businessId} AND rating IS NOT NULL
    `;

    // Conteggio per sentiment
    const sentimentResult = await sql`
      SELECT
        SUM(CASE WHEN sentiment_label = 'positive' THEN 1 ELSE 0 END) as positive,
        SUM(CASE WHEN sentiment_label = 'negative' THEN 1 ELSE 0 END) as negative,
        SUM(CASE WHEN sentiment_label = 'neutral' OR sentiment_label IS NULL THEN 1 ELSE 0 END) as neutral
      FROM rm_reviews
      WHERE business_id = ${businessId}
    `;

    return NextResponse.json({
      success: true,
      data: {
        total: parseInt(totalResult.rows[0]?.total || '0'),
        pending: parseInt(pendingResult.rows[0]?.pending || '0'),
        averageRating: parseFloat(ratingResult.rows[0]?.avg_rating || '0') || 0,
        positiveCount: parseInt(sentimentResult.rows[0]?.positive || '0'),
        negativeCount: parseInt(sentimentResult.rows[0]?.negative || '0'),
        neutralCount: parseInt(sentimentResult.rows[0]?.neutral || '0')
      }
    });

  } catch (error) {
    console.error('Errore stats:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore nel calcolo delle statistiche'
    }, { status: 500 });
  }
}
