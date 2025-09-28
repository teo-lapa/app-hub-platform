import { NextRequest, NextResponse } from 'next/server';
import { getOdooClient } from '@/lib/odoo/client';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { product_id, name, company_id, expiration_date } = body;

    if (!product_id || !name) {
      return NextResponse.json(
        { error: 'Campi obbligatori mancanti' },
        { status: 400 }
      );
    }

    const odoo = await getOdooClient();

    // Crea il lotto in Odoo
    const lotId = await odoo.create('stock.lot', [{
      product_id,
      name,
      company_id: company_id || 1,
      ...(expiration_date && { expiration_date })
    }]);

    return NextResponse.json({
      id: lotId,
      success: true
    });

  } catch (error: any) {
    console.error('Errore creazione lotto:', error);
    return NextResponse.json(
      { error: error.message || 'Errore creazione lotto' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get('product_id');

    if (!productId) {
      return NextResponse.json(
        { error: 'product_id richiesto' },
        { status: 400 }
      );
    }

    const odoo = await getOdooClient();

    // Cerca lotti per prodotto
    const lots = await odoo.searchRead(
      'stock.lot',
      [['product_id', '=', parseInt(productId)]],
      ['id', 'name', 'expiration_date', 'product_qty']
    );

    return NextResponse.json({ lots });

  } catch (error: any) {
    console.error('Errore ricerca lotti:', error);
    return NextResponse.json(
      { error: error.message || 'Errore ricerca lotti' },
      { status: 500 }
    );
  }
}