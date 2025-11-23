import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

// API per aggiungere recensioni di test
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { businessId } = body;

    if (!businessId) {
      return NextResponse.json({
        success: false,
        error: 'businessId richiesto'
      }, { status: 400 });
    }

    // Aggiungi alcune recensioni di test
    const testReviews = [
      {
        platform: 'google',
        platform_review_id: 'test-google-001',
        author_name: 'Marco Rossi',
        author_image_url: null,
        rating: 5,
        content: 'Cibo eccellente! Il risotto ai funghi porcini era divino. Servizio impeccabile e atmosfera accogliente. Torneremo sicuramente!',
        review_date: new Date().toISOString(),
        language: 'it',
        status: 'pending',
        sentiment: 'positive'
      },
      {
        platform: 'instagram',
        platform_review_id: 'test-insta-001',
        author_name: 'foodie_giulia',
        author_image_url: null,
        rating: null,
        content: 'WOW 😍 Questa pasta è incredibile! @lapa_zurich avete conquistato il mio cuore ❤️ #italianfood #zurichfood',
        review_date: new Date().toISOString(),
        language: 'it',
        status: 'pending',
        sentiment: 'positive'
      },
      {
        platform: 'google',
        platform_review_id: 'test-google-002',
        author_name: 'Thomas Müller',
        author_image_url: null,
        rating: 2,
        content: 'Leider mussten wir 40 Minuten auf unser Essen warten. Die Pizza war dann auch nur lauwarm. Schade, denn das Ambiente ist eigentlich schön.',
        review_date: new Date().toISOString(),
        language: 'de',
        status: 'pending',
        sentiment: 'negative'
      },
      {
        platform: 'facebook',
        platform_review_id: 'test-fb-001',
        author_name: 'Anna Bianchi',
        author_image_url: null,
        rating: 4,
        content: 'Ottimo ristorante italiano nel cuore di Zurigo. Prezzi un po\' alti ma la qualità si sente. Consiglio la tagliata!',
        review_date: new Date().toISOString(),
        language: 'it',
        status: 'pending',
        sentiment: 'positive'
      }
    ];

    const insertedIds: number[] = [];

    for (const review of testReviews) {
      const result = await sql`
        INSERT INTO rm_reviews (
          business_id,
          platform,
          platform_review_id,
          reviewer_name,
          reviewer_photo_url,
          rating,
          content,
          review_date,
          language,
          response_status,
          sentiment_label
        ) VALUES (
          ${businessId},
          ${review.platform},
          ${review.platform_review_id},
          ${review.author_name},
          ${review.author_image_url},
          ${review.rating},
          ${review.content},
          ${review.review_date},
          ${review.language},
          ${review.status},
          ${review.sentiment}
        )
        ON CONFLICT (business_id, platform, platform_review_id) DO NOTHING
        RETURNING id
      `;

      if (result.rows.length > 0) {
        insertedIds.push(result.rows[0].id);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        inserted: insertedIds.length,
        ids: insertedIds
      },
      message: `${insertedIds.length} recensioni di test aggiunte`
    });

  } catch (error) {
    console.error('Errore add-test-review:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore nell\'aggiunta delle recensioni'
    }, { status: 500 });
  }
}
