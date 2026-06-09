import { NextRequest, NextResponse } from 'next/server';
import { callOdooAsAdmin } from '@/lib/silvano/odoo';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * GET /api/silvano/prodotto-info/[id]   (id = product.product)
 * Dettagli "da sito" del prodotto: descrizione e-commerce + specifiche.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (isNaN(id)) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });

    const prods = await callOdooAsAdmin('product.product', 'search_read', [], {
      domain: [['id', '=', id]],
      fields: ['id', 'name', 'default_code', 'barcode', 'product_tmpl_id', 'weight'],
      limit: 1,
      context: { lang: 'it_IT' },
    });
    const p: any = prods?.[0];
    if (!p) return NextResponse.json({ success: false, error: 'Prodotto non trovato' }, { status: 404 });

    const tmplId = p.product_tmpl_id ? p.product_tmpl_id[0] : null;
    const tmpls = tmplId ? await callOdooAsAdmin('product.template', 'search_read', [], {
      domain: [['id', '=', tmplId]],
      fields: ['name', 'description_ecommerce', 'website_description', 'description_sale',
        'weight', 'volume', 'country_of_origin', 'barcode', 'default_code'],
      limit: 1,
      context: { lang: 'it_IT' },
    }) : [];
    const t: any = tmpls?.[0] || {};

    const html = t.description_ecommerce || t.website_description
      || (t.description_sale ? `<p>${String(t.description_sale).replace(/\n/g, '<br/>')}</p>` : '');

    return NextResponse.json({
      success: true,
      info: {
        name: t.name || p.name,
        html: html || '',
        code: p.default_code || t.default_code || '',
        barcode: p.barcode || t.barcode || '',
        weight: t.weight || p.weight || 0,
        volume: t.volume || 0,
        origin: t.country_of_origin ? t.country_of_origin[1] : '',
      },
    });
  } catch (error: any) {
    console.error('💥 [SILVANO/prodotto-info/:id]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
