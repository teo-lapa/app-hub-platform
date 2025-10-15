/**
 * API: Smart Ordering Data
 * GET /api/smart-ordering/data
 *
 * Ritorna dati analisi con predizioni AI
 */

import { NextResponse } from 'next/server';
import { dataService } from '@/lib/smart-ordering/data-service';
import { predictionEngine } from '@/lib/smart-ordering/prediction-engine';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    console.log('📊 API /api/smart-ordering/data chiamata');

    // Carica dati
    const data = await dataService.loadData();

    // Genera predizioni per tutti i prodotti
    const predictions = predictionEngine.predictBatch(data.products);

    // Converti predictions map to object
    const predictionsObj: Record<number, any> = {};
    predictions.forEach((prediction, productId) => {
      predictionsObj[productId] = prediction;
    });

    // Get KPI summary
    const kpi = await dataService.getKPISummary();

    return NextResponse.json({
      success: true,
      data: {
        products: data.products,
        predictions: predictionsObj,
        suppliers: data.suppliers,
        kpi,
        lastUpdate: data.lastUpdate
      }
    });
  } catch (error: any) {
    console.error('❌ Errore API smart-ordering/data:', error);

    return NextResponse.json({
      success: false,
      error: error.message || 'Errore caricamento dati'
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'refresh') {
      // Refresh da Odoo
      await dataService.refreshFromOdoo();
      await dataService.clearCache();

      const data = await dataService.loadData(true);

      return NextResponse.json({
        success: true,
        message: 'Dati aggiornati da Odoo',
        data: {
          lastUpdate: data.lastUpdate,
          productsCount: data.products.length
        }
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Azione non valida'
    }, { status: 400 });
  } catch (error: any) {
    console.error('❌ Errore POST smart-ordering/data:', error);

    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
