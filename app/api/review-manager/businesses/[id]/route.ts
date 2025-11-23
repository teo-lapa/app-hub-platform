/**
 * API: Review Manager - Single Business
 * GET /api/review-manager/businesses/[id] - Dettaglio business
 * PUT /api/review-manager/businesses/[id] - Aggiorna business
 * DELETE /api/review-manager/businesses/[id] - Elimina business
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getBusinessById,
  updateBusiness,
  deleteBusiness,
  getBusinessPlatforms,
  getBusinessMetrics,
  getReviews
} from '@/lib/review-manager/db-service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Dettaglio business con piattaforme e metriche
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const businessId = parseInt(id);

    if (isNaN(businessId)) {
      return NextResponse.json(
        { success: false, error: 'ID non valido' },
        { status: 400 }
      );
    }

    const business = await getBusinessById(businessId);
    if (!business) {
      return NextResponse.json(
        { success: false, error: 'Business non trovato' },
        { status: 404 }
      );
    }

    // Recupera dati aggiuntivi
    const [platforms, metrics, reviewsData] = await Promise.all([
      getBusinessPlatforms(businessId),
      getBusinessMetrics(businessId),
      getReviews(businessId, { status: 'pending', pageSize: 5 })
    ]);

    return NextResponse.json({
      success: true,
      data: {
        ...business,
        platforms,
        metrics,
        pendingReviews: reviewsData.reviews,
        pendingCount: reviewsData.total
      }
    });
  } catch (error) {
    console.error('Errore GET business:', error);
    return NextResponse.json(
      { success: false, error: 'Errore nel recupero del business' },
      { status: 500 }
    );
  }
}

// PUT - Aggiorna business
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const businessId = parseInt(id);

    if (isNaN(businessId)) {
      return NextResponse.json(
        { success: false, error: 'ID non valido' },
        { status: 400 }
      );
    }

    const body = await request.json();

    const updated = await updateBusiness(businessId, {
      name: body.name,
      ownerName: body.ownerName,
      ownerEmail: body.ownerEmail,
      ownerPhone: body.ownerPhone,
      address: body.address,
      city: body.city,
      logoUrl: body.logoUrl,
      responseMode: body.responseMode,
      responseTone: body.responseTone,
      responseLanguages: body.responseLanguages,
      subscriptionPlan: body.subscriptionPlan
    });

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Business non trovato' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Business aggiornato con successo'
    });
  } catch (error) {
    console.error('Errore PUT business:', error);
    return NextResponse.json(
      { success: false, error: 'Errore nell\'aggiornamento del business' },
      { status: 500 }
    );
  }
}

// DELETE - Elimina business (soft delete)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const businessId = parseInt(id);

    if (isNaN(businessId)) {
      return NextResponse.json(
        { success: false, error: 'ID non valido' },
        { status: 400 }
      );
    }

    const deleted = await deleteBusiness(businessId);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Business non trovato' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Business eliminato con successo'
    });
  } catch (error) {
    console.error('Errore DELETE business:', error);
    return NextResponse.json(
      { success: false, error: 'Errore nell\'eliminazione del business' },
      { status: 500 }
    );
  }
}
