import { NextRequest, NextResponse } from 'next/server';
import { callOdooAsAdmin } from '@/lib/silvano/odoo';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * GET /api/silvano/categorie
 * Categorie prodotto (reparti) per la tendina del catalogo, in italiano.
 */
export async function GET(_request: NextRequest) {
  try {
    const cats = await callOdooAsAdmin('product.category', 'search_read', [], {
      fields: ['id', 'complete_name', 'name', 'parent_id'],
      order: 'complete_name asc',
      limit: 300,
      context: { lang: 'it_IT' },
    });

    const categorie = cats.map((c: any) => ({
      id: c.id,
      name: c.complete_name || c.name,
    }));

    return NextResponse.json({ success: true, count: categorie.length, categorie });
  } catch (error: any) {
    console.error('💥 [SILVANO/categorie]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
