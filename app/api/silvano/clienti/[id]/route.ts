import { NextRequest, NextResponse } from 'next/server';
import { callOdooAsAdmin } from '@/lib/silvano/odoo';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * GET /api/silvano/clienti/[id]
 * Contatti e indirizzi di consegna del cliente (per il picker leggero del catalogo).
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (isNaN(id)) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });

    const children = await callOdooAsAdmin('res.partner', 'search_read', [], {
      domain: [['parent_id', '=', id], ['active', '=', true]],
      fields: ['id', 'name', 'type', 'street', 'city', 'zip'],
      order: 'type asc, name asc',
    });

    const contatti = (children as any[])
      .filter((c) => c.type === 'contact' || c.type === 'other')
      .map((c) => ({ id: c.id, name: c.name || '(senza nome)' }));

    const consegne = (children as any[])
      .filter((c) => c.type === 'delivery')
      .map((c) => ({
        id: c.id,
        name: c.name || 'Indirizzo di consegna',
        address: [c.street, [c.zip, c.city].filter(Boolean).join(' ')].filter(Boolean).join(', '),
      }));

    return NextResponse.json({ success: true, contatti, consegne });
  } catch (error: any) {
    console.error('💥 [SILVANO/clienti/:id]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
