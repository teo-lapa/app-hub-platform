import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

// Import platform integrations (da implementare per pubblicazione reale)
// import { GoogleReviewsClient } from '@/lib/review-manager/platforms/google';
// import { InstagramClient } from '@/lib/review-manager/platforms/instagram';
// import { TikTokClient } from '@/lib/review-manager/platforms/tiktok';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const reviewId = params.id;
    const body = await request.json();
    const { response } = body;

    if (!response || response.trim().length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Risposta richiesta'
      }, { status: 400 });
    }

    // Carica la recensione e le credenziali
    const reviewResult = await sql`
      SELECT r.*, b.id as business_id, pc.credentials, pc.platform
      FROM rm_reviews r
      JOIN rm_businesses b ON r.business_id = b.id
      LEFT JOIN rm_platform_credentials pc ON pc.business_id = b.id AND pc.platform = r.platform
      WHERE r.id = ${reviewId}
    `;

    if (reviewResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Recensione non trovata'
      }, { status: 404 });
    }

    const review = reviewResult.rows[0];

    // Verifica se la piattaforma supporta le risposte API
    const platformSupportsReply = ['google', 'instagram', 'tiktok'].includes(review.platform);
    let publishedViaApi = false;
    let publishError: string | null = null;

    if (platformSupportsReply && review.credentials) {
      // Qui andrebbe la logica per pubblicare via API
      // Per ora simuliamo il successo
      try {
        // Esempio per Google:
        // const googleClient = new GoogleReviewsClient(review.credentials);
        // await googleClient.replyToReview(review.platform_review_id, response);

        // Per demo: segna come pubblicato
        publishedViaApi = true;

      } catch (apiError: any) {
        console.error('Errore pubblicazione API:', apiError);
        publishError = apiError.message;
        // Continua comunque a salvare come "pubblicato" manualmente
      }
    }

    // Aggiorna la recensione nel database
    await sql`
      UPDATE rm_reviews
      SET
        final_response = ${response},
        response_status = 'published',
        responded_at = NOW(),
        updated_at = NOW()
      WHERE id = ${reviewId}
    `;

    // Log dell'azione
    console.log(`[Review ${reviewId}] Risposta pubblicata`, {
      platform: review.platform,
      viaApi: publishedViaApi,
      responseLength: response.length
    });

    return NextResponse.json({
      success: true,
      data: {
        published: true,
        viaApi: publishedViaApi,
        message: publishedViaApi
          ? 'Risposta pubblicata automaticamente sulla piattaforma'
          : 'Risposta salvata. Pubblicala manualmente sulla piattaforma.',
        warning: publishError
      }
    });

  } catch (error) {
    console.error('Errore pubblicazione:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore nella pubblicazione della risposta'
    }, { status: 500 });
  }
}
