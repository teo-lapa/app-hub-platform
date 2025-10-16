import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';
import { normalizeVat, normalizeName, extractKeywords, fuzzyMatchScore } from '@/lib/suppliers/normalization';

export const dynamic = 'force-dynamic';

/**
 * DEBUG ENDPOINT: Search Supplier
 *
 * Questo endpoint ti mostra esattamente cosa succede quando cerchi un fornitore
 */
export async function POST(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
    }

    const body = await request.json();
    const { supplier_name, supplier_vat } = body;

    const debugInfo: any = {
      input: {
        supplier_name,
        supplier_vat
      },
      normalization: {
        normalized_name: normalizeName(supplier_name),
        keywords: extractKeywords(supplier_name),
        normalized_vat: normalizeVat(supplier_vat)
      },
      search_results: {
        by_vat: [],
        by_keywords: [],
        by_normalized_name: [],
        by_original_name: []
      },
      all_suppliers_sample: []
    };

    // Step 1: Cerca per P.IVA se disponibile
    if (supplier_vat) {
      const normalizedInputVat = normalizeVat(supplier_vat);

      const allPartnersWithVat = await callOdoo(cookies, 'res.partner', 'search_read', [
        [['vat', '!=', false], ['supplier_rank', '>', 0]],
        ['id', 'name', 'vat']
      ]);

      const vatMatches = allPartnersWithVat.filter((partner: any) => {
        const partnerVat = normalizeVat(partner.vat);
        return partnerVat === normalizedInputVat;
      });

      debugInfo.search_results.by_vat = vatMatches;
      debugInfo.odoo_suppliers_with_vat_count = allPartnersWithVat.length;
    }

    // Step 2: Cerca per keywords
    const keywords = extractKeywords(supplier_name);
    if (keywords.length > 2) {
      const keywordResults = await callOdoo(cookies, 'res.partner', 'search_read', [
        [['name', 'ilike', keywords], ['supplier_rank', '>', 0]],
        ['id', 'name', 'vat', 'supplier_rank']
      ]);

      debugInfo.search_results.by_keywords = keywordResults.map((p: any) => ({
        ...p,
        similarity_score: fuzzyMatchScore(supplier_name, p.name)
      }));
    }

    // Step 3: Cerca per nome normalizzato
    const normalizedName = normalizeName(supplier_name);
    if (normalizedName.length > 2) {
      const normalizedResults = await callOdoo(cookies, 'res.partner', 'search_read', [
        [['name', 'ilike', normalizedName], ['supplier_rank', '>', 0]],
        ['id', 'name', 'vat', 'supplier_rank']
      ]);

      debugInfo.search_results.by_normalized_name = normalizedResults.map((p: any) => ({
        ...p,
        similarity_score: fuzzyMatchScore(supplier_name, p.name)
      }));
    }

    // Step 4: Cerca per nome originale
    const originalResults = await callOdoo(cookies, 'res.partner', 'search_read', [
      [['name', 'ilike', supplier_name], ['supplier_rank', '>', 0]],
      ['id', 'name', 'vat', 'supplier_rank']
    ]);

    debugInfo.search_results.by_original_name = originalResults.map((p: any) => ({
      ...p,
      similarity_score: fuzzyMatchScore(supplier_name, p.name)
    }));

    // Step 5: Prendi un sample di tutti i fornitori per confronto
    const allSuppliers = await callOdoo(cookies, 'res.partner', 'search_read', [
      [['supplier_rank', '>', 0]],
      ['id', 'name', 'vat', 'supplier_rank']
    ], { limit: 50, order: 'name asc' });

    debugInfo.all_suppliers_sample = allSuppliers;
    debugInfo.total_suppliers_in_odoo = allSuppliers.length;

    // Aggiungi conclusioni
    const hasVatMatch = debugInfo.search_results.by_vat.length > 0;
    const hasKeywordMatch = debugInfo.search_results.by_keywords.length > 0;
    const hasNormalizedMatch = debugInfo.search_results.by_normalized_name.length > 0;
    const hasOriginalMatch = debugInfo.search_results.by_original_name.length > 0;

    debugInfo.conclusion = {
      found: hasVatMatch || hasKeywordMatch || hasNormalizedMatch || hasOriginalMatch,
      best_match_method: hasVatMatch ? 'VAT' : hasKeywordMatch ? 'Keywords' : hasNormalizedMatch ? 'Normalized Name' : hasOriginalMatch ? 'Original Name' : 'None',
      recommendation: hasVatMatch || hasKeywordMatch ? 'Use first result' : hasNormalizedMatch || hasOriginalMatch ? 'Review matches manually' : 'Supplier not found - needs to be created'
    };

    return NextResponse.json({
      success: true,
      debug: debugInfo
    });

  } catch (error: any) {
    console.error('❌ Debug search error:', error);
    return NextResponse.json({
      error: error.message,
      details: error.toString()
    }, { status: 500 });
  }
}
