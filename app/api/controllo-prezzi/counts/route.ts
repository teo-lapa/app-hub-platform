import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession } from '@/lib/odoo-auth';

/**
 * GET /api/controllo-prezzi/counts
 *
 * Ritorna i conteggi dei prodotti per ogni categoria di prezzo
 * Chiama aggregate API e mappa i risultati
 */
export async function GET(request: NextRequest) {
  try {
    console.log(`🔢 [COUNTS-API] Fetching counts...`);

    // Get Odoo session
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      return NextResponse.json(
        { success: false, error: 'Sessione non valida' },
        { status: 401 }
      );
    }

    // Call aggregate API, block-requests API and main-pricelists API in parallel
    console.log(`🔄 [COUNTS-API] Calling aggregate, block-requests and pricelists APIs...`);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.url.split('/api')[0];
    const aggregateUrl = `${baseUrl}/api/controllo-prezzi/aggregate`;
    const blockRequestsUrl = `${baseUrl}/api/controllo-prezzi/block-requests`;
    const pricelistsUrl = `${baseUrl}/api/controllo-prezzi/main-pricelists`;

    const [aggregateResponse, blockRequestsResponse, pricelistsResponse] = await Promise.all([
      fetch(aggregateUrl, {
        method: 'GET',
        headers: { cookie: cookieHeader || '' },
        cache: 'no-store'
      }),
      fetch(blockRequestsUrl, {
        method: 'GET',
        headers: { cookie: cookieHeader || '' },
        cache: 'no-store'
      }),
      fetch(pricelistsUrl, {
        method: 'GET',
        headers: { cookie: cookieHeader || '' },
        cache: 'no-store'
      })
    ]);

    const aggregateData = await aggregateResponse.json();
    const blockRequestsData = await blockRequestsResponse.json();
    const pricelistsData = await pricelistsResponse.json();

    if (!aggregateData.success) {
      throw new Error('Failed to fetch aggregate data');
    }

    const { stats } = aggregateData;
    const blockRequestsCount = blockRequestsData.success ? blockRequestsData.requests.length : 0;

    // Get products without rules count
    let setupPricelistsCount = 0;
    if (pricelistsData.success && pricelistsData.pricelists.length > 0) {
      const pricelistIds = pricelistsData.pricelists.map((p: any) => p.id).join(',');
      const productsWithoutRulesUrl = `${baseUrl}/api/controllo-prezzi/products-without-rules?pricelistIds=${pricelistIds}&filter=without`;

      const productsWithoutRulesResponse = await fetch(productsWithoutRulesUrl, {
        method: 'GET',
        headers: { cookie: cookieHeader || '' },
        cache: 'no-store'
      });

      const productsWithoutRulesData = await productsWithoutRulesResponse.json();
      setupPricelistsCount = productsWithoutRulesData.success ? productsWithoutRulesData.count : 0;
    }

    // Map to expected format
    const counts = {
      byCategory: {
        below_critical: stats.sotto_pc || 0,
        critical_to_avg: stats.tra_pc_medio || 0,
        above_avg: stats.sopra_medio || 0,
        blocked: blockRequestsCount,
        all: stats.total_products || 0,
        setup_pricelists: setupPricelistsCount
      }
    };

    console.log(`✅ [COUNTS-API] Counts:`, counts.byCategory);

    return NextResponse.json({
      success: true,
      counts,
      timestamp: aggregateData.timestamp
    });

  } catch (error: any) {
    console.error('❌ [COUNTS-API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore nel caricamento dei conteggi'
      },
      { status: 500 }
    );
  }
}
