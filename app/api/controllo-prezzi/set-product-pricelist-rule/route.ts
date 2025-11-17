import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { callOdoo } from '@/lib/odoo-auth';

/**
 * POST /api/controllo-prezzi/set-product-pricelist-rule
 *
 * Crea o aggiorna una regola di prezzo (pricelist item) per un prodotto
 * con uno sconto percentuale sul prezzo base
 */
export async function POST(request: NextRequest) {
  try {
    const { productId, pricelistId, discountPercent } = await request.json();

    if (!productId || !pricelistId) {
      return NextResponse.json({
        success: false,
        error: 'productId e pricelistId sono richiesti'
      }, { status: 400 });
    }

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('odoo_session_id');

    if (!sessionCookie?.value) {
      return NextResponse.json({
        success: false,
        error: 'Sessione non valida'
      }, { status: 401 });
    }

    const sessionId = sessionCookie.value;
    const cookieHeader = `session_id=${sessionId}`;

    console.log(`💰 Impostazione regola di prezzo: Prodotto ${productId}, Listino ${pricelistId}, Sconto ${discountPercent}%`);

    // STEP 1: Cerca se esiste già una regola per questo prodotto e listino
    const existingItems = await callOdoo(
      cookieHeader,
      'product.pricelist.item',
      'search_read',
      [],
      {
        domain: [
          ['pricelist_id', '=', pricelistId],
          ['product_id', '=', productId],
          ['applied_on', '=', '0_product_variant']
        ],
        fields: ['id', 'compute_price', 'percent_price', 'fixed_price'],
        limit: 1
      }
    );

    // STEP 2: Se esiste, aggiorna. Altrimenti crea.
    if (existingItems && existingItems.length > 0) {
      // UPDATE
      const itemId = existingItems[0].id;
      console.log(`🔄 Aggiornamento regola esistente ${itemId}`);

      await callOdoo(
        cookieHeader,
        'product.pricelist.item',
        'write',
        [[itemId], {
          compute_price: 'percentage', // Sconto percentuale
          percent_price: discountPercent, // La percentuale di sconto (positivo = sconto, negativo = aumento)
        }]
      );

      console.log(`✅ Regola ${itemId} aggiornata: ${discountPercent}% sconto`);

      return NextResponse.json({
        success: true,
        action: 'updated',
        itemId: itemId,
        discountPercent
      });

    } else {
      // CREATE
      console.log(`➕ Creazione nuova regola`);

      const itemId = await callOdoo(
        cookieHeader,
        'product.pricelist.item',
        'create',
        [{
          pricelist_id: pricelistId,
          product_id: productId,
          applied_on: '0_product_variant', // Applicato al singolo prodotto
          compute_price: 'percentage', // Sconto percentuale
          percent_price: discountPercent, // La percentuale
          min_quantity: 1
        }]
      );

      console.log(`✅ Nuova regola creata con ID ${itemId}: ${discountPercent}% sconto`);

      return NextResponse.json({
        success: true,
        action: 'created',
        itemId: itemId,
        discountPercent
      });
    }

  } catch (error: any) {
    console.error('❌ Errore impostazione regola prezzo:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Errore durante l\'impostazione della regola'
    }, { status: 500 });
  }
}

/**
 * DELETE /api/controllo-prezzi/set-product-pricelist-rule
 *
 * Elimina una regola di prezzo per un prodotto e listino
 */
export async function DELETE(request: NextRequest) {
  try {
    const { productId, pricelistId } = await request.json();

    if (!productId || !pricelistId) {
      return NextResponse.json({
        success: false,
        error: 'productId e pricelistId sono richiesti'
      }, { status: 400 });
    }

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('odoo_session_id');

    if (!sessionCookie?.value) {
      return NextResponse.json({
        success: false,
        error: 'Sessione non valida'
      }, { status: 401 });
    }

    const sessionId = sessionCookie.value;
    const cookieHeader = `session_id=${sessionId}`;

    console.log(`🗑️ Eliminazione regola: Prodotto ${productId}, Listino ${pricelistId}`);

    // Cerca la regola
    const existingItems = await callOdoo(
      cookieHeader,
      'product.pricelist.item',
      'search_read',
      [],
      {
        domain: [
          ['pricelist_id', '=', pricelistId],
          ['product_id', '=', productId],
          ['applied_on', '=', '0_product_variant']
        ],
        fields: ['id'],
        limit: 1
      }
    );

    if (!existingItems || existingItems.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Regola non trovata'
      }, { status: 404 });
    }

    // Elimina
    const itemId = existingItems[0].id;
    await callOdoo(
      cookieHeader,
      'product.pricelist.item',
      'unlink',
      [[itemId]]
    );

    console.log(`✅ Regola ${itemId} eliminata`);

    return NextResponse.json({
      success: true,
      itemId
    });

  } catch (error: any) {
    console.error('❌ Errore eliminazione regola:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Errore durante l\'eliminazione della regola'
    }, { status: 500 });
  }
}
