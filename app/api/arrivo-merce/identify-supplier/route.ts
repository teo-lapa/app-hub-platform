import { NextRequest, NextResponse } from 'next/server';
import Fuse from 'fuse.js';
import { callOdoo, getOdooSession } from '@/lib/odoo-auth';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * NORMALIZE VAT NUMBER
 * Removes spaces, dashes, and country prefixes (IT, CHE-, etc.)
 * Examples:
 * - "IT00895100709" -> "00895100709"
 * - "CHE-105.968.205 MWST" -> "105968205"
 * - "CHE-105.968.205" -> "105968205"
 */
function normalizeVat(vat: string | null | undefined): string {
  if (!vat) return '';

  return vat
    .toUpperCase()
    .replace(/^IT/i, '')           // Remove IT prefix
    .replace(/^CHE-?/i, '')        // Remove CHE or CHE- prefix
    .replace(/\s+/g, '')           // Remove spaces
    .replace(/-/g, '')             // Remove dashes
    .replace(/\./g, '')            // Remove dots
    .replace(/MWST$/i, '')         // Remove MWST suffix
    .trim();
}

/**
 * NORMALIZE NAME
 * Case insensitive, removes extra spaces
 */
function normalizeName(name: string | null | undefined): string {
  if (!name) return '';
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * IDENTIFY SUPPLIER API
 *
 * Receives invoice data and identifies the supplier in Odoo
 *
 * INPUT:
 * - supplier_vat: VAT from invoice
 * - supplier_name: Name from invoice
 * - document_number: Optional document number
 * - document_date: Optional document date
 *
 * OUTPUT:
 * - match_type: "exact_vat" | "multiple_vat" | "fuzzy_name" | "no_match"
 * - confidence: 0-100
 * - suppliers: Array of matched suppliers
 * - suggested_action: "use_first" | "ask_user" | "create_new"
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { supplier_vat, supplier_name, document_number, document_date } = body;

    console.log('🔍 [IDENTIFY-SUPPLIER] Input:', {
      supplier_vat,
      supplier_name,
      document_number,
      document_date
    });

    // Validate input
    if (!supplier_vat && !supplier_name) {
      return NextResponse.json({
        error: 'Fornire almeno supplier_vat o supplier_name'
      }, { status: 400 });
    }

    // Get Odoo session
    const userCookies = request.headers.get('cookie') || undefined;
    const { cookies } = await getOdooSession(userCookies);

    // STEP 1: EXACT VAT MATCH
    if (supplier_vat) {
      console.log('📋 [STEP 1] Searching by VAT...');

      const normalizedInputVat = normalizeVat(supplier_vat);
      console.log('📋 Normalized input VAT:', normalizedInputVat);

      // Search in res.partner
      const partners = await callOdoo(
        cookies,
        'res.partner',
        'search_read',
        [[['vat', '!=', false], ['supplier_rank', '>', 0]]],
        {
          fields: ['id', 'name', 'vat', 'country_id']
        }
      );

      console.log(`📋 Found ${partners.length} suppliers with VAT in Odoo`);

      // Filter by normalized VAT
      const exactMatches = partners.filter((partner: any) => {
        const partnerVat = normalizeVat(partner.vat);
        return partnerVat === normalizedInputVat;
      });

      console.log(`📋 Exact VAT matches: ${exactMatches.length}`);

      if (exactMatches.length === 1) {
        // Single exact match - CONFIDENCE 100%
        const match = exactMatches[0];
        console.log('✅ [STEP 1] Single exact VAT match found!');

        return NextResponse.json({
          match_type: 'exact_vat',
          confidence: 100,
          suppliers: [
            {
              id: match.id,
              name: match.name,
              vat: match.vat,
              match_score: 1.0
            }
          ],
          suggested_action: 'use_first'
        });
      }

      if (exactMatches.length > 1) {
        // Multiple matches with same VAT - CONFIDENCE 80%
        console.log('⚠️ [STEP 1] Multiple VAT matches found');

        return NextResponse.json({
          match_type: 'multiple_vat',
          confidence: 80,
          suppliers: exactMatches.map((match: any) => ({
            id: match.id,
            name: match.name,
            vat: match.vat,
            match_score: 0.8
          })),
          suggested_action: 'ask_user'
        });
      }

      console.log('❌ [STEP 1] No exact VAT match, proceeding to STEP 2...');
    }

    // STEP 2: FUZZY NAME MATCH
    if (supplier_name) {
      console.log('🔤 [STEP 2] Fuzzy matching by name...');

      // Load active suppliers from JSON
      const suppliersJsonPath = path.join(process.cwd(), '..', 'active-suppliers-6months.json');

      let activeSuppliers: any[] = [];

      if (fs.existsSync(suppliersJsonPath)) {
        const jsonData = JSON.parse(fs.readFileSync(suppliersJsonPath, 'utf-8'));
        activeSuppliers = jsonData.suppliers || [];
        console.log(`🔤 Loaded ${activeSuppliers.length} active suppliers from JSON`);
      } else {
        console.warn('⚠️ [STEP 2] active-suppliers-6months.json not found, fetching from Odoo...');

        // Fallback: fetch from Odoo
        activeSuppliers = await callOdoo(
          cookies,
          'res.partner',
          'search_read',
          [[['supplier_rank', '>', 0]]],
          {
            fields: ['id', 'name', 'vat', 'country_id'],
            limit: 500
          }
        );
      }

      // Configure Fuse.js for fuzzy search
      const fuse = new Fuse(activeSuppliers, {
        keys: ['name'],
        threshold: 0.4, // 60% similarity threshold (lower = stricter)
        includeScore: true,
        minMatchCharLength: 3
      });

      const normalizedInputName = normalizeName(supplier_name);
      console.log('🔤 Searching for:', normalizedInputName);

      const fuzzyResults = fuse.search(normalizedInputName);
      console.log(`🔤 Fuzzy search returned ${fuzzyResults.length} results`);

      if (fuzzyResults.length > 0) {
        // Get top 3 matches
        const topMatches = fuzzyResults.slice(0, 3).map((result: any) => {
          const score = 1 - (result.score || 0); // Convert distance to similarity
          const confidence = Math.round(score * 100);

          return {
            id: result.item.id,
            name: result.item.name,
            vat: result.item.vat,
            match_score: parseFloat(score.toFixed(2)),
            confidence
          };
        });

        const bestMatch = topMatches[0];
        console.log(`✅ [STEP 2] Found ${topMatches.length} fuzzy matches, best: ${bestMatch.confidence}%`);

        // If best match is > 80%, suggest use_first
        const suggestedAction = bestMatch.confidence > 80 ? 'use_first' : 'ask_user';

        return NextResponse.json({
          match_type: 'fuzzy_name',
          confidence: bestMatch.confidence,
          suppliers: topMatches,
          suggested_action: suggestedAction
        });
      }

      console.log('❌ [STEP 2] No fuzzy matches found');
    }

    // STEP 3: NO MATCH
    console.log('❌ [STEP 3] No matches found');

    return NextResponse.json({
      match_type: 'no_match',
      confidence: 0,
      suppliers: [],
      suggested_action: 'create_new'
    });

  } catch (error: any) {
    console.error('❌ [IDENTIFY-SUPPLIER] Error:', error);
    return NextResponse.json({
      error: error.message || 'Errore durante l\'identificazione del fornitore',
      details: error.toString()
    }, { status: 500 });
  }
}
