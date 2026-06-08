import { NextRequest, NextResponse } from 'next/server';
import { callOdooAsAdmin } from '@/lib/silvano/odoo';

export const dynamic = 'force-dynamic';
export const maxDuration = 90;

/**
 * GET /api/silvano/prodotti-cliente/[id]
 * Prodotti già acquistati dal cliente (storico righe ordine), per riacquisto rapido.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (isNaN(id)) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });

    const lines = await callOdooAsAdmin('sale.order.line', 'search_read', [], {
      domain: [
        ['order_partner_id', 'child_of', id],
        ['state', 'in', ['sale', 'done']],
        ['product_id', '!=', false],
      ],
      fields: ['product_id', 'product_uom_qty', 'price_unit', 'create_date'],
      order: 'create_date desc',
      limit: 600,
    });

    // Aggrega per prodotto: ultimo prezzo, n. acquisti, qty totale
    const map = new Map<number, { id: number; name: string; lastPrice: number; lastDate: string; orders: number; totalQty: number }>();
    for (const l of lines) {
      const pid = l.product_id[0];
      const cur = map.get(pid);
      if (cur) {
        cur.orders += 1;
        cur.totalQty += l.product_uom_qty || 0;
      } else {
        map.set(pid, {
          id: pid,
          name: l.product_id[1],
          lastPrice: l.price_unit || 0,
          lastDate: l.create_date || '',
          orders: 1,
          totalQty: l.product_uom_qty || 0,
        });
      }
    }

    const prodotti = Array.from(map.values()).sort((a, b) => b.orders - a.orders);
    return NextResponse.json({ success: true, count: prodotti.length, prodotti });
  } catch (error: any) {
    console.error('💥 [SILVANO/prodotti-cliente/:id]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
