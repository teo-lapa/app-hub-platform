import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';
import { getUserLang } from '@/lib/odoo/user-lang';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * SEARCH PRODUCTS IN ODOO DATABASE
 *
 * Endpoint per cercare prodotti nel database Odoo
 * Ricerca per: nome, codice articolo, EAN, descrizione
 *
 * INPUT:
 * - query: stringa di ricerca
 * - limit: numero massimo risultati (default 20)
 *
 * OUTPUT:
 * - products: array di prodotti trovati
 */
export async function POST(request: NextRequest) {
  try {
    const userCookies = request.headers.get('cookie') || undefined;
    const { cookies, uid } = await getOdooSession(userCookies);

    if (!uid) {
      return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
    }

    const body = await request.json();
    const { query, limit = 20 } = body;

    if (!query || query.trim().length === 0) {
      return NextResponse.json({ error: 'Query di ricerca mancante' }, { status: 400 });
    }

    console.log('🔍 [SEARCH-PRODUCTS] Ricerca:', query);

    // Ricerca prodotti in Odoo
    // Cerca in: nome, codice, EAN, descrizione
    // Cerca in ENTRAMBE le lingue (italiano e inglese) per trovare nomi tradotti
    const searchDomain = [
      '|', '|', '|',
      ['name', 'ilike', query],
      ['default_code', 'ilike', query],
      ['barcode', 'ilike', query],
      ['description', 'ilike', query]
    ];

    const searchFields = [
      'id',
      'name',
      'display_name',
      'default_code',
      'barcode',
      'description',
      'list_price',
      'standard_price',
      'uom_id',
      'categ_id',
      'image_128'
    ];

    // Search in both user's language and English in parallel
    const userLang = getUserLang();
    const [productsUserLang, productsEn] = await Promise.all([
      callOdoo(cookies, 'product.product', 'search_read', [searchDomain], {
        fields: searchFields, limit, order: 'name asc', context: { lang: userLang }
      }),
      callOdoo(cookies, 'product.product', 'search_read', [searchDomain], {
        fields: searchFields, limit, order: 'name asc', context: { lang: 'en_US' }
      }),
    ]);

    // Merge and deduplicate by product ID (user's language results take priority)
    const seenIds = new Set<number>();
    const products: any[] = [];
    for (const p of [...(productsUserLang || []), ...(productsEn || [])]) {
      if (!seenIds.has(p.id)) {
        seenIds.add(p.id);
        products.push(p);
      }
    }

    console.log(`✅ [SEARCH-PRODUCTS] Trovati ${products.length} prodotti`);

    return NextResponse.json({
      success: true,
      products: products.map((p: any) => ({
        id: p.id,
        name: p.display_name || p.name,
        code: p.default_code || '',
        barcode: p.barcode || '',
        description: p.description || '',
        price: p.list_price || 0,
        cost: p.standard_price || 0,
        uom: p.uom_id ? p.uom_id[1] : '',
        category: p.categ_id ? p.categ_id[1] : '',
        image: p.image_128 || null
      }))
    });

  } catch (error: any) {
    console.error('❌ [SEARCH-PRODUCTS] Error:', error);
    return NextResponse.json({
      error: error.message || 'Errore durante la ricerca dei prodotti',
      details: error.toString()
    }, { status: 500 });
  }
}
