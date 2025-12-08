import { NextRequest, NextResponse } from 'next/server';
import { db } from '@vercel/postgres';

/**
 * POST /api/smart-ordering-v2/assign-preorder-customers
 *
 * Salva le assegnazioni di clienti per un prodotto pre-ordine
 * Usa una transazione per garantire atomicità (o salva tutto o niente)
 */
export async function POST(request: NextRequest) {
  const client = await db.connect();

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

    // Filtra assegnazioni valide prima della transazione
    const validAssignmentsArray = assignmentsArray.filter(
      a => a.customer_id > 0 && a.quantity > 0
    );

    const skippedCount = assignmentsArray.length - validAssignmentsArray.length;
    if (skippedCount > 0) {
      console.warn(`⚠️ Skipped ${skippedCount} invalid assignments (customer_id o quantity <= 0)`);
    }

    // Usa una transazione con client dedicato per garantire atomicità
    // IMPORTANTE: Con Vercel Postgres, le transazioni richiedono una connessione dedicata
    try {
      await client.sql`BEGIN`;

      // 1. Delete existing assignments for this product
      await client.sql`
        DELETE FROM preorder_customer_assignments
        WHERE product_id = ${productId}
      `;
      console.log(`🗑️ Eliminate assegnazioni esistenti per prodotto ${productId}`);

      // 2. Insert new assignments
      for (const assignment of validAssignmentsArray) {
        await client.sql`
          INSERT INTO preorder_customer_assignments (product_id, customer_id, quantity)
          VALUES (${productId}, ${assignment.customer_id}, ${assignment.quantity})
        `;
      }

      // 3. Commit della transazione - tutto ok
      await client.sql`COMMIT`;
      console.log(`✅ Salvate ${validAssignmentsArray.length} assegnazioni valide per prodotto ${productId}`);

      // Verifica immediata che i dati siano stati salvati
      const verifyResult = await client.sql`
        SELECT COUNT(*) as count FROM preorder_customer_assignments
        WHERE product_id = ${productId}
      `;
      console.log(`🔍 Verifica: ${verifyResult.rows[0].count} assegnazioni nel DB per prodotto ${productId}`);

      return NextResponse.json({
        success: true,
        productId,
        assignmentsCount: validAssignmentsArray.length,
        verified: parseInt(verifyResult.rows[0].count)
      });

    } catch (transactionError: any) {
      // Rollback in caso di errore - ripristina i dati precedenti
      await client.sql`ROLLBACK`;
      console.error('❌ Errore durante la transazione, rollback eseguito:', transactionError);
      throw transactionError;
    }

  } catch (error: any) {
    console.error('❌ Errore durante il salvataggio delle assegnazioni:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  } finally {
    // Rilascia sempre la connessione
    client.release();
  }
}
