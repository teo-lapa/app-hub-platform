/**
 * API: Review Manager - Reviews
 * GET /api/review-manager/reviews - Lista recensioni con filtri
 * POST /api/review-manager/reviews - Crea recensione manuale
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import {
  getReviews,
  getPendingReviews,
  upsertReview
} from '@/lib/review-manager/db-service';
import { Platform, CreateReviewInput } from '@/lib/review-manager/types';

// GET - Lista recensioni con filtri
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const businessId = searchParams.get('businessId');
    const platform = searchParams.get('platform') as Platform | null;
    const status = searchParams.get('status');
    const minRating = searchParams.get('minRating');
    const maxRating = searchParams.get('maxRating');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    // Se non c'è businessId, ritorna le pending di tutti
    if (!businessId) {
      const pendingReviews = await getPendingReviews(50);
      return NextResponse.json({
        success: true,
        data: pendingReviews,
        pagination: {
          page: 1,
          pageSize: 50,
          total: pendingReviews.length,
          totalPages: 1
        }
      });
    }

    const result = await getReviews(parseInt(businessId), {
      platform: platform || undefined,
      status: status as 'pending' | 'ai_generated' | 'approved' | 'published' | 'rejected' | 'failed' | undefined,
      minRating: minRating ? parseInt(minRating) : undefined,
      maxRating: maxRating ? parseInt(maxRating) : undefined,
      page,
      pageSize
    });

    return NextResponse.json({
      success: true,
      data: result.reviews,
      pagination: {
        page,
        pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / pageSize)
      }
    });
  } catch (error) {
    console.error('Errore GET reviews:', error);
    return NextResponse.json(
      { success: false, error: 'Errore nel recupero delle recensioni' },
      { status: 500 }
    );
  }
}

// POST - Crea recensione manuale (per test o import)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validazione
    if (!body.businessId || !body.platform) {
      return NextResponse.json(
        { success: false, error: 'businessId e platform sono obbligatori' },
        { status: 400 }
      );
    }

    const input: CreateReviewInput = {
      businessId: body.businessId,
      platform: body.platform,
      platformReviewId: body.platformReviewId || `manual-${Date.now()}`,
      platformUrl: body.platformUrl,
      reviewerName: body.reviewerName || 'Anonimo',
      reviewerProfileUrl: body.reviewerProfileUrl,
      reviewerPhotoUrl: body.reviewerPhotoUrl,
      reviewerIsLocalGuide: body.reviewerIsLocalGuide,
      rating: body.rating,
      title: body.title,
      content: body.content,
      language: body.language || 'it',
      reviewDate: body.reviewDate ? new Date(body.reviewDate) : new Date(),
      rawData: body.rawData
    };

    const review = await upsertReview(input);

    return NextResponse.json({
      success: true,
      data: review,
      message: 'Recensione creata con successo'
    });
  } catch (error) {
    console.error('Errore POST review:', error);
    return NextResponse.json(
      { success: false, error: 'Errore nella creazione della recensione' },
      { status: 500 }
    );
  }
}
