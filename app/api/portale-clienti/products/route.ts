import { NextRequest, NextResponse } from 'next/server';
import { callOdooAsAdmin } from '@/lib/odoo/admin-session';
import { sql } from '@vercel/postgres';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

/**
 * GET /api/portale-clienti/products
 *
 * Fetches products from Odoo with search, filters, and pagination using admin session
 *
 * Query params:
 * - q: search query (searches name and default_code)
 * - category: category ID filter
 * - availability: 'in_stock' | 'all'
 * - sort: 'name' | 'price_asc' | 'price_desc'
 * - purchased: 'true' | 'false' - filter only previously purchased products (requires auth)
 * - page: page number (default: 1)
 * - limit: items per page (default: 50)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    const categoryId = searchParams.get('category');
    const availability = searchParams.get('availability') || 'all';
    const sort = searchParams.get('sort') || 'name';
    const purchased = searchParams.get('purchased') === 'true';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    // CRITICAL: Frontend can force-block intelligent sorting
    const blockIntelligentSort = searchParams.get('blockIntelligentSort') === 'true';

    console.log('📦 [PRODUCTS-API] Fetching products:', {
      query,
      queryLength: query.length,
      queryEmpty: query === '',
      categoryId,
      availability,
      sort,
      purchased,
      page,
      limit
    });

    // CRITICAL: Log when manual search is active
    if (query && query.length > 0) {
      console.log('🔎 [PRODUCTS-API] ⚠️ MANUAL SEARCH ACTIVE - Intelligent sorting MUST be disabled!');
      console.log('🔎 [PRODUCTS-API] Search query:', `"${query}"`);
    }

    // Get partnerId and language from JWT (for purchased filter and translations)
    let partnerId: number | null = null;
    let userLang: string = 'it_IT'; // Default to Italian

    // Always try to get user language if authenticated
    const token = request.cookies.get('token')?.value;

    if (token) {
      // Decode JWT to get customer email
      const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
      let decoded: any;

      try {
        decoded = jwt.verify(token, jwtSecret);
        console.log('✅ [PRODUCTS-API] JWT decoded:', decoded.email);

        // Get partner info including language
        const userPartners = await callOdooAsAdmin(
          'res.partner',
          'search_read',
          [],
          {
            domain: [['email', '=', decoded.email]],
            fields: ['id', 'lang'],
            limit: 1
          }
        );

        if (userPartners && userPartners.length > 0) {
          partnerId = userPartners[0].id;
          userLang = userPartners[0].lang || 'it_IT';
          console.log('✅ [PRODUCTS-API] Partner identified:', { partnerId, lang: userLang });
        }
      } catch (jwtError: any) {
        console.warn('⚠️ [PRODUCTS-API] JWT verification failed, using default lang:', jwtError.message);
        // Continue without authentication - use default language
      }
    }

    // Check if purchased filter requires authentication
    if (purchased && !partnerId) {
      console.warn('⚠️ [PRODUCTS-API] Purchased filter requires authentication');
      return NextResponse.json(
        { error: 'Il filtro "prodotti acquistati" richiede autenticazione' },
        { status: 401 }
      );
    }

    // Build domain for Odoo search
    const domain: any[] = [
      ['sale_ok', '=', true],
      ['active', '=', true],
    ];

    // Add search filter
    if (query) {
      domain.push('|');
      domain.push(['name', 'ilike', query]);
      domain.push(['default_code', 'ilike', query]);
    }

    // Add category filter
    if (categoryId && categoryId !== 'all') {
      domain.push(['categ_id', '=', parseInt(categoryId)]);
    }

    // Add availability filter
    if (availability === 'in_stock') {
      domain.push(['qty_available', '>', 0]);
    }

    // Add "purchased products" filter
    if (purchased && partnerId) {
      console.log('🔍 [PRODUCTS-API] Filtering purchased products for partner:', partnerId);

      try {
        // Step 1: Find all confirmed orders for this partner
        const orders = await callOdooAsAdmin(
          'sale.order',
          'search_read',
          [],
          {
            domain: [
              ['partner_id', '=', partnerId],
              ['state', 'in', ['sale', 'done']]
            ],
            fields: ['id'],
          }
        );

        const orderIds = orders.map((o: any) => o.id);
        console.log(`📋 [PRODUCTS-API] Found ${orderIds.length} confirmed orders`);

        if (orderIds.length > 0) {
          // Step 2: Find all order lines from these orders
          const orderLines = await callOdooAsAdmin(
            'sale.order.line',
            'search_read',
            [],
            {
              domain: [['order_id', 'in', orderIds]],
              fields: ['product_id'],
            }
          );

          // Step 3: Extract unique product IDs
          const purchasedProductIds = Array.from(
            new Set(
              orderLines
                .map((line: any) => line.product_id?.[0])
                .filter((id: any) => id !== undefined && id !== null)
            )
          );

          console.log(`✅ [PRODUCTS-API] Found ${purchasedProductIds.length} unique purchased products`);

          if (purchasedProductIds.length > 0) {
            // Add to domain: only show products that were purchased
            domain.push(['id', 'in', purchasedProductIds]);
          } else {
            // No purchased products - return empty result set
            domain.push(['id', '=', -1]); // Impossible condition
          }
        } else {
          // No orders - return empty result set
          domain.push(['id', '=', -1]); // Impossible condition
        }
      } catch (purchaseFilterError: any) {
        console.error('❌ [PRODUCTS-API] Error filtering purchased products:', purchaseFilterError);
        // Don't fail the whole request, just skip the filter
      }
    }

    // Determine if we use intelligent sorting (default) or manual sort
    // IMPORTANT: Disable intelligent sorting when user is searching manually
    // CRITICAL: Also disable if frontend explicitly blocked it (hasSearched flag)
    const useIntelligentSort = sort === 'name'
      && partnerId !== null
      && !query
      && categoryId === 'all'
      && !purchased
      && !blockIntelligentSort; // FORCE BLOCK if frontend says so

    console.log('🎯 [PRODUCTS-API] Intelligent sorting decision:', {
      useIntelligentSort,
      reasons: {
        sortIsName: sort === 'name',
        hasPartnerId: partnerId !== null,
        noQuery: !query,
        categoryAll: categoryId === 'all',
        noPurchased: !purchased,
        notBlocked: !blockIntelligentSort
      },
      actualValues: { sort, partnerId, query, categoryId, purchased, blockIntelligentSort }
    });

    if (blockIntelligentSort) {
      console.log('🚫 [PRODUCTS-API] Intelligent sorting FORCE-BLOCKED by frontend (user has searched)');
    }

    let order = 'name ASC'; // Fallback for non-intelligent sorting
    if (sort === 'price_asc') {
      order = 'list_price ASC';
    } else if (sort === 'price_desc') {
      order = 'list_price DESC';
    }

    // Get total count for pagination (before fetching products)
    const totalCount = await callOdooAsAdmin(
      'product.product',
      'search_count',
      [],
      { domain }
    );

    console.log(`📊 [PRODUCTS-API] Total products matching filters: ${totalCount}`);

    let transformedProducts: any[] = [];

    if (useIntelligentSort) {
      console.log('🧠 [PRODUCTS-API] Using INTELLIGENT sorting based on customer history');

      // CRITICAL CHECK: This should NEVER happen with an active search
      if (query && query.length > 0) {
        console.error('🚨 [PRODUCTS-API] CRITICAL BUG: Intelligent sorting activated WITH ACTIVE SEARCH!');
        console.error('🚨 [PRODUCTS-API] This is a bug! Query:', `"${query}"`);
        console.error('🚨 [PRODUCTS-API] useIntelligentSort should be FALSE!');
      }

      // Step 1: Fetch ALL products without limit (we'll paginate after sorting)
      const allProducts = await callOdooAsAdmin(
        'product.product',
        'search_read',
        [],
        {
          domain,
          fields: [
            'id',
            'name',
            'default_code',
            'list_price',
            'qty_available',
            'image_256',
            'categ_id',
            'uom_id',
            'description_sale',
            'barcode',
          ],
          context: { lang: userLang },
        }
      );

      console.log(`✅ [PRODUCTS-API] Loaded ${allProducts.length} products for intelligent sorting`);

      // Step 2: Fetch ranking scores from cache for this partner
      const productIds = allProducts.map((p: any) => p.id);

      const rankingData = await sql`
        SELECT
          odoo_product_id,
          customer_score,
          global_score
        FROM product_ranking_cache
        WHERE odoo_partner_id = ${partnerId}
          AND odoo_product_id = ANY(${productIds})
      `;

      // Create score map for fast lookup
      const scoreMap = new Map<number, { customer: number; global: number }>();
      rankingData.rows.forEach((row: any) => {
        scoreMap.set(row.odoo_product_id, {
          customer: parseFloat(row.customer_score) || 0,
          global: parseFloat(row.global_score) || 0,
        });
      });

      console.log(`📊 [PRODUCTS-API] Found scores for ${scoreMap.size} products`);

      // Step 3: Transform and add scores to products
      const productsWithScores = allProducts.map((p: any) => {
        const scores = scoreMap.get(p.id) || { customer: 0, global: 0 };

        return {
          id: p.id,
          name: p.name,
          code: p.default_code || null,
          price: p.list_price || 0,
          originalPrice: p.list_price || 0,
          hasCustomPrice: false,
          quantity: p.qty_available || 0,
          available: (p.qty_available || 0) > 0,
          image: p.image_256
            ? `data:image/jpeg;base64,${p.image_256}`
            : '/placeholder-product.png',
          category: p.categ_id
            ? { id: p.categ_id[0], name: p.categ_id[1] }
            : null,
          unit: p.uom_id ? p.uom_id[1] : 'Pz',
          description: p.description_sale || null,
          barcode: p.barcode || null,
          // Scores for sorting
          _customerScore: scores.customer,
          _globalScore: scores.global,
        };
      });

      // Step 4: 3-LEVEL INTELLIGENT SORT
      // Level 1: Products customer has purchased (customer_score > 0) sorted by customer_score DESC
      // Level 2: Products customer hasn't purchased but are global best sellers (global_score > 0) sorted by global_score DESC
      // Level 3: Other products sorted alphabetically by name
      productsWithScores.sort((a: any, b: any) => {
        const aHasCustomerScore = a._customerScore > 0;
        const bHasCustomerScore = b._customerScore > 0;
        const aHasGlobalScore = a._globalScore > 0;
        const bHasGlobalScore = b._globalScore > 0;

        // Level 1: Customer's products first
        if (aHasCustomerScore && !bHasCustomerScore) return -1;
        if (!aHasCustomerScore && bHasCustomerScore) return 1;

        if (aHasCustomerScore && bHasCustomerScore) {
          // Both have customer scores - sort by customer_score DESC
          return b._customerScore - a._customerScore;
        }

        // Level 2: Global best sellers (only for products customer hasn't purchased)
        if (aHasGlobalScore && !bHasGlobalScore) return -1;
        if (!aHasGlobalScore && bHasGlobalScore) return 1;

        if (aHasGlobalScore && bHasGlobalScore) {
          // Both have global scores - sort by global_score DESC
          return b._globalScore - a._globalScore;
        }

        // Level 3: Alphabetical for products with no scores
        return a.name.localeCompare(b.name);
      });

      console.log('✅ [PRODUCTS-API] Products sorted using 3-level intelligent algorithm');

      // Step 5: Paginate the sorted results
      const startIndex = offset;
      const endIndex = offset + limit;
      transformedProducts = productsWithScores.slice(startIndex, endIndex);

      // Remove score fields from final output
      transformedProducts = transformedProducts.map(({ _customerScore, _globalScore, ...product }) => product);

      console.log(`✅ [PRODUCTS-API] Returning page ${page}: products ${startIndex + 1}-${Math.min(endIndex, productsWithScores.length)} of ${productsWithScores.length}`);

    } else {
      // Standard sorting (price or alphabetical for non-authenticated users OR manual search)
      console.log(`📦 [PRODUCTS-API] Using STANDARD sorting: ${order}`);

      if (query && query.length > 0) {
        console.log(`✅ [PRODUCTS-API] Correct! Manual search active, using standard Odoo search with query: "${query}"`);
      }

      const products = await callOdooAsAdmin(
        'product.product',
        'search_read',
        [],
        {
          domain,
          fields: [
            'id',
            'name',
            'default_code',
            'list_price',
            'qty_available',
            'image_256',
            'categ_id',
            'uom_id',
            'description_sale',
            'barcode',
          ],
          limit,
          offset,
          order,
          context: { lang: userLang },
        }
      );

      console.log(`✅ [PRODUCTS-API] Loaded ${products.length} products in language: ${userLang}`);

      // Transform Odoo data to frontend format
      transformedProducts = products.map((p: any) => ({
        id: p.id,
        name: p.name,
        code: p.default_code || null,
        price: p.list_price || 0,
        originalPrice: p.list_price || 0,
        hasCustomPrice: false,
        quantity: p.qty_available || 0,
        available: (p.qty_available || 0) > 0,
        image: p.image_256
          ? `data:image/jpeg;base64,${p.image_256}`
          : '/placeholder-product.png',
        category: p.categ_id
          ? { id: p.categ_id[0], name: p.categ_id[1] }
          : null,
        unit: p.uom_id ? p.uom_id[1] : 'Pz',
        description: p.description_sale || null,
        barcode: p.barcode || null,
      }));
    }

    const totalPages = Math.ceil(totalCount / limit);
    const hasMore = page < totalPages;

    return NextResponse.json({
      products: transformedProducts,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages,
        hasMore,
      },
    });

  } catch (error: any) {
    console.error('❌ [PRODUCTS-API] Error:', error);
    return NextResponse.json(
      { error: 'Errore nel caricamento prodotti', details: error.message },
      { status: 500 }
    );
  }
}
