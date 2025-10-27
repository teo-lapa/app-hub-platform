import { NextResponse } from 'next/server';
import { callOdooAsAdmin } from '@/lib/odoo/admin-session';

/**
 * GET /api/portale-clienti/categories
 *
 * Fetches product categories from Odoo using admin session
 */
export async function GET() {
  try {
    console.log('📂 [CATEGORIES-API] Fetching categories from Odoo');

    // Fetch categories with product count using admin session
    const categories = await callOdooAsAdmin(
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
