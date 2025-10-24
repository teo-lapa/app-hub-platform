import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';
import { cookies } from 'next/headers';

/**
 * GET /api/portale-clienti/categories
 *
 * Fetches product categories from Odoo
 */
export async function GET(request: NextRequest) {
  try {
    console.log('📂 [CATEGORIES-API] Fetching categories from Odoo');

    // Get Odoo session from cookies
    const cookieStore = await cookies();
    const userCookies = cookieStore.toString();
    const { cookies: odooCookies } = await getOdooSession(userCookies);

    // Fetch categories with product count
    const categories = await callOdoo(
      odooCookies,
      'product.category',
      'search_read',
      [],
      {
        domain: [],
        fields: ['id', 'name', 'parent_id', 'product_count'],
        order: 'name ASC',
        limit: 100,
      }
    );

    // Format categories for frontend
    const formattedCategories = categories.map((category: any) => ({
      id: category.id,
      name: category.name,
      parentId: category.parent_id ? category.parent_id[0] : null,
      parentName: category.parent_id ? category.parent_id[1] : null,
      productCount: category.product_count || 0,
    }));

    console.log(`✅ [CATEGORIES-API] Fetched ${formattedCategories.length} categories`);

    return NextResponse.json({
      categories: formattedCategories,
    });

  } catch (error: any) {
    console.error('❌ [CATEGORIES-API] Error:', error);
    return NextResponse.json(
      { error: 'Errore nel caricamento categorie', details: error.message },
      { status: 500 }
    );
  }
}
