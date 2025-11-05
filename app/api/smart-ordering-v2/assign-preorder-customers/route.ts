import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

/**
 * POST /api/smart-ordering-v2/assign-preorder-customers
 *
 * Salva le assegnazioni di clienti per un prodotto pre-ordine
 */
export async function POST(request: NextRequest) {
  try {
    const { productId, customerId, quantity, assignments } = await request.json();

    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'productId è richiesto' },
        { status: 400 }
      );
    }

    // Supporta sia il formato array che il formato singolo per backward compatibility
    let assignmentsArray: Array<{customer_id: number, quantity: number}> = [];

    if (assignments !== undefined && assignments !== null) {
      // Nuovo formato array: { productId, assignments: [{customer_id, quantity}] }
      // Può essere anche array vuoto per cancellare tutte le assegnazioni
      assignmentsArray = assignments;
      console.log(`📦 Ricevuto formato array con ${assignments.length} assignments per prodotto ${productId}`);
    } else if (customerId && quantity) {
      // Vecchio formato singolo: { productId, customerId, quantity }
      assignmentsArray = [{ customer_id: customerId, quantity }];
      console.log(`📦 Ricevuto formato singolo (backward compatibility) per prodotto ${productId}`);
    } else {
      return NextResponse.json(
        { success: false, error: 'Formato richiesta non valido: specificare assignments array o customerId/quantity' },
        { status: 400 }
      );
    }

    // 1. Delete existing assignments for this product
    await sql`
      DELETE FROM preorder_customer_assignments
      WHERE product_id = ${productId}
    `;
    console.log(`🗑️ Eliminate assegnazioni esistenti per prodotto ${productId}`);

    // 2. Insert new assignments con validazione
    let validAssignments = 0;
    for (const assignment of assignmentsArray) {
      // Validazione: customer_id e quantity devono essere > 0
      if (assignment.customer_id > 0 && assignment.quantity > 0) {
        await sql`
          INSERT INTO preorder_customer_assignments (product_id, customer_id, quantity)
          VALUES (${productId}, ${assignment.customer_id}, ${assignment.quantity})
        `;
        validAssignments++;
      } else {
        console.warn(`⚠️ Skipped invalid assignment: customer_id=${assignment.customer_id}, quantity=${assignment.quantity}`);
      }
    }

    console.log(`✅ Salvate ${validAssignments} assegnazioni valide per prodotto ${productId}`);

    return NextResponse.json({
      success: true,
      productId,
      assignmentsCount: validAssignments
    });

  } catch (error: any) {
    console.error('❌ Errore durante il salvataggio delle assegnazioni:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
