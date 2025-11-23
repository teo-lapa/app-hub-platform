/**
 * API: Review Manager - Businesses (Clienti)
 * GET /api/review-manager/businesses - Lista tutti i business
 * POST /api/review-manager/businesses - Crea nuovo business
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getAllBusinesses,
  createBusiness,
  getBusinessMetrics
} from '@/lib/review-manager/db-service';
import { CreateBusinessInput } from '@/lib/review-manager/types';

// GET - Lista tutti i business
export async function GET() {
  try {
    const businesses = await getAllBusinesses();

    // Aggiungi metriche per ogni business
    const businessesWithMetrics = await Promise.all(
      businesses.map(async (business) => {
        const metrics = await getBusinessMetrics(business.id);
        return {
          ...business,
          metrics: metrics || {
            totalReviews: 0,
            averageRating: null,
            pendingCount: 0
          }
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: businessesWithMetrics
    });
  } catch (error) {
    console.error('Errore GET businesses:', error);
    return NextResponse.json(
      { success: false, error: 'Errore nel recupero dei business' },
      { status: 500 }
    );
  }
}

// POST - Crea nuovo business
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validazione
    if (!body.name) {
      return NextResponse.json(
        { success: false, error: 'Nome business obbligatorio' },
        { status: 400 }
      );
    }

    const input: CreateBusinessInput = {
      name: body.name,
      slug: body.slug,
      ownerName: body.ownerName,
      ownerEmail: body.ownerEmail,
      ownerPhone: body.ownerPhone,
      address: body.address,
      city: body.city,
      country: body.country || 'IT',
      logoUrl: body.logoUrl,
      responseMode: body.responseMode || 'manual',
      responseTone: body.responseTone || 'friendly',
      responseLanguages: body.responseLanguages || ['IT'],
      subscriptionPlan: body.subscriptionPlan || 'basic'
    };

    const business = await createBusiness(input);

    return NextResponse.json({
      success: true,
      data: business,
      message: 'Business creato con successo'
    });
  } catch (error) {
    console.error('Errore POST business:', error);

    // Gestisci errore slug duplicato
    if (error instanceof Error && error.message.includes('duplicate')) {
      return NextResponse.json(
        { success: false, error: 'Esiste già un business con questo nome/slug' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Errore nella creazione del business' },
      { status: 500 }
    );
  }
}
