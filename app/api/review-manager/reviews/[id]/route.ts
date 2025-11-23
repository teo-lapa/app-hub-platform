/**
 * API: Review Manager - Single Review Actions
 * GET /api/review-manager/reviews/[id] - Dettaglio recensione
 * PUT /api/review-manager/reviews/[id] - Aggiorna stato/risposta
 * DELETE /api/review-manager/reviews/[id] - Elimina recensione
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import {
  updateAiResponse,
  approveResponse,
  markAsPublished,
  markAsFailed,
  rejectReview,
  getBusinessById
} from '@/lib/review-manager/db-service';
import { generateResponse, analyzeSentiment } from '@/lib/review-manager/ai-service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Dettaglio recensione
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const reviewId = parseInt(id);

    if (isNaN(reviewId)) {
      return NextResponse.json(
        { success: false, error: 'ID non valido' },
        { status: 400 }
      );
    }

    const result = await sql`
      SELECT r.*, b.name as business_name, b.response_tone, b.response_languages
      FROM rm_reviews r
      JOIN rm_businesses b ON b.id = r.business_id
      WHERE r.id = ${reviewId}
    `;

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Recensione non trovata' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Errore GET review:', error);
    return NextResponse.json(
      { success: false, error: 'Errore nel recupero della recensione' },
      { status: 500 }
    );
  }
}

// PUT - Aggiorna stato/risposta
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const reviewId = parseInt(id);

    if (isNaN(reviewId)) {
      return NextResponse.json(
        { success: false, error: 'ID non valido' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { action, finalResponse } = body;

    let review;

    switch (action) {
      case 'generate_ai':
        // Genera risposta AI
        const reviewData = await sql`
          SELECT r.*, b.name as business_name, b.response_tone, b.response_languages
          FROM rm_reviews r
          JOIN rm_businesses b ON b.id = r.business_id
          WHERE r.id = ${reviewId}
        `;

        if (reviewData.rows.length === 0) {
          return NextResponse.json(
            { success: false, error: 'Recensione non trovata' },
            { status: 404 }
          );
        }

        const row = reviewData.rows[0];
        const business = await getBusinessById(row.business_id);

        if (!business) {
          return NextResponse.json(
            { success: false, error: 'Business non trovato' },
            { status: 404 }
          );
        }

        const aiResult = await generateResponse(
          {
            reviewerName: row.reviewer_name || 'Cliente',
            rating: row.rating || 3,
            content: row.content || '',
            language: row.language || 'it',
            platform: row.platform
          },
          {
            businessName: business.name,
            responseTone: business.responseTone,
            responseLanguages: business.responseLanguages
          }
        );

        review = await updateAiResponse(reviewId, aiResult.response, {
          score: aiResult.sentiment.score,
          label: aiResult.sentiment.label,
          topics: aiResult.sentiment.keyTopics
        });

        return NextResponse.json({
          success: true,
          data: review,
          aiResponse: aiResult,
          message: 'Risposta AI generata con successo'
        });

      case 'approve':
        // Approva risposta
        review = await approveResponse(reviewId, finalResponse);
        return NextResponse.json({
          success: true,
          data: review,
          message: 'Risposta approvata'
        });

      case 'publish':
        // Segna come pubblicata (dopo pubblicazione su piattaforma)
        review = await markAsPublished(reviewId);
        return NextResponse.json({
          success: true,
          data: review,
          message: 'Risposta pubblicata'
        });

      case 'reject':
        // Rifiuta/ignora recensione
        review = await rejectReview(reviewId);
        return NextResponse.json({
          success: true,
          data: review,
          message: 'Recensione ignorata'
        });

      case 'fail':
        // Segna pubblicazione fallita
        review = await markAsFailed(reviewId, body.error || 'Errore pubblicazione');
        return NextResponse.json({
          success: true,
          data: review,
          message: 'Errore registrato'
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Azione non riconosciuta' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Errore PUT review:', error);
    return NextResponse.json(
      { success: false, error: 'Errore nell\'aggiornamento della recensione' },
      { status: 500 }
    );
  }
}

// PATCH - Aggiornamento rapido stato
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const reviewId = parseInt(id);

    if (isNaN(reviewId)) {
      return NextResponse.json(
        { success: false, error: 'ID non valido' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { status } = body;

    if (!status || !['pending', 'ai_generated', 'approved', 'published', 'ignored'].includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Status non valido' },
        { status: 400 }
      );
    }

    const result = await sql`
      UPDATE rm_reviews
      SET status = ${status}, updated_at = NOW()
      WHERE id = ${reviewId}
      RETURNING *
    `;

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Recensione non trovata' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Errore PATCH review:', error);
    return NextResponse.json(
      { success: false, error: 'Errore nell\'aggiornamento' },
      { status: 500 }
    );
  }
}

// DELETE - Elimina recensione
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const reviewId = parseInt(id);

    if (isNaN(reviewId)) {
      return NextResponse.json(
        { success: false, error: 'ID non valido' },
        { status: 400 }
      );
    }

    const result = await sql`
      DELETE FROM rm_reviews WHERE id = ${reviewId}
    `;

    if (result.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Recensione non trovata' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Recensione eliminata'
    });
  } catch (error) {
    console.error('Errore DELETE review:', error);
    return NextResponse.json(
      { success: false, error: 'Errore nell\'eliminazione della recensione' },
      { status: 500 }
    );
  }
}
