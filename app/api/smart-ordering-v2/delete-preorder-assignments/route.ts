import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

/**
 * DELETE /api/smart-ordering-v2/delete-preorder-assignments
 *
 * Elimina tutte le assegnazioni pre-ordine per uno specifico fornitore
 * o per specifici product_id.
 *
 * Body:
 * - productIds: number[] - Lista di product_id da eliminare
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { productIds } = body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'productIds è richiesto e deve essere un array non vuoto'
      }, { status: 400 });
    }

    console.log(`🗑️ Eliminazione assegnazioni per ${productIds.length} prodotti...`);

    let totalDeleted = 0;
    const errors: string[] = [];

    for (const productId of productIds) {
      try {
        const result = await sql`
          DELETE FROM preorder_customer_assignments
          WHERE product_id = ${productId}
        `;
        const deleted = result.rowCount || 0;
        totalDeleted += deleted;
        console.log(`  ✅ Prodotto ${productId}: ${deleted} record eliminati`);
      } catch (err: any) {
        console.error(`  ❌ Errore eliminazione prodotto ${productId}:`, err);
        errors.push(`Prodotto ${productId}: ${err.message}`);
      }
    }

    if (errors.length > 0 && totalDeleted === 0) {
      return NextResponse.json({
        success: false,
        error: 'Nessun record eliminato',
        details: errors
      }, { status: 500 });
    }

    console.log(`✅ Totale eliminati: ${totalDeleted} record`);

    return NextResponse.json({
      success: true,
      deletedCount: totalDeleted,
      productIds: productIds.length,
      warnings: errors.length > 0 ? errors : undefined
    });

  } catch (error: any) {
    console.error('❌ Errore eliminazione assegnazioni:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Errore durante eliminazione'
    }, { status: 500 });
  }
}
