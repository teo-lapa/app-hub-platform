/**
 * API Enhanced: Suppliers con Lead Time REALI
 *
 * Versione SMART che usa cache per evitare timeout
 */

import { NextRequest, NextResponse } from 'next/server';
import { leadTimeAnalyzer } from '@/lib/smart-ordering/lead-time-analyzer';

export const maxDuration = 60;

// Cache in memoria (valida 1 ora)
const cache = new Map<number, {
  data: any;
  timestamp: number;
}>();

const CACHE_DURATION = 60 * 60 * 1000; // 1 ora

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const supplierId = searchParams.get('supplierId');
    const forceRefresh = searchParams.get('refresh') === 'true';

    // Se richiesto singolo fornitore, analizza solo quello
    if (supplierId) {
      return await analyzeSingleSupplier(parseInt(supplierId), forceRefresh);
    }

    // Altrimenti ritorna dati base (veloci) + cache se disponibile
    return await getSuppliersWithCache();

  } catch (error: any) {
    console.error('❌ Errore API suppliers-enhanced:', error);
    return NextResponse.json(
      { error: error.message || 'Errore interno' },
      { status: 500 }
    );
  }
}

async function analyzeSingleSupplier(supplierId: number, forceRefresh: boolean) {
  console.log(`🔍 Analisi fornitore ${supplierId}...`);

  // Check cache
  if (!forceRefresh && cache.has(supplierId)) {
    const cached = cache.get(supplierId)!;
    if (Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log(`✅ Da cache (${Math.round((Date.now() - cached.timestamp) / 1000)}s fa)`);
      return NextResponse.json({
        success: true,
        ...cached.data,
        fromCache: true
      });
    }
  }

  try {
    // Analizza fornitore
    const analysis = await leadTimeAnalyzer.analyzeSupplier(supplierId, 6);
    const recommended = leadTimeAnalyzer.getRecommendedLeadTime(analysis);

    const result = {
      analysis,
      recommended,
      analyzedAt: new Date().toISOString()
    };

    // Salva in cache
    cache.set(supplierId, {
      data: result,
      timestamp: Date.now()
    });

    console.log(`✅ Fornitore ${supplierId} analizzato e cached`);

    return NextResponse.json({
      success: true,
      ...result,
      fromCache: false
    });

  } catch (error: any) {
    console.error(`❌ Errore analisi fornitore ${supplierId}:`, error);

    // Ritorna dati default se errore
    return NextResponse.json({
      success: true,
      analysis: {
        supplierId,
        supplierName: 'Unknown',
        medianLeadTime: 7, // Default
        avgLeadTime: 7,
        minLeadTime: 5,
        maxLeadTime: 10,
        reliabilityScore: 50,
        onTimeRate: 80,
        sampleSize: 0
      },
      recommended: {
        recommended: 7,
        conservative: 10,
        optimistic: 5
      },
      error: error.message,
      isDefault: true
    });
  }
}

async function getSuppliersWithCache() {
  console.log('📋 Lista fornitori con cache lead time...');

  // Carica lista base fornitori (veloce!)
  const { searchReadOdoo } = await import('@/lib/odoo/odoo-helper');

  const partners = await searchReadOdoo(
    'res.partner',
    [['supplier_rank', '>', 0]],
    ['name', 'supplier_rank'],
    50
  );

  // Per ogni fornitore, aggiungi lead time da cache se disponibile
  const suppliers = partners.map((p: any) => {
    const cached = cache.get(p.id);

    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return {
        id: p.id,
        name: p.name,
        leadTime: cached.data.analysis.medianLeadTime,
        reliability: cached.data.analysis.reliabilityScore,
        onTimeRate: cached.data.analysis.onTimeRate,
        analyzed: true,
        analyzedAt: new Date(cached.timestamp).toISOString()
      };
    }

    return {
      id: p.id,
      name: p.name,
      leadTime: 7, // Default
      reliability: null,
      onTimeRate: null,
      analyzed: false
    };
  });

  return NextResponse.json({
    success: true,
    suppliers,
    totalSuppliers: suppliers.length,
    analyzedCount: suppliers.filter((s: any) => s.analyzed).length,
    cacheInfo: {
      size: cache.size,
      entries: Array.from(cache.keys())
    }
  });
}

// Endpoint per pulire cache
export async function DELETE() {
  cache.clear();
  return NextResponse.json({
    success: true,
    message: 'Cache cleared'
  });
}
