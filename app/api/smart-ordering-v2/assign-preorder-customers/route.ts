import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

/**
 * POST /api/smart-ordering-v2/assign-preorder-customers
 *
 * Salva le assegnazioni di clienti per un prodotto pre-ordine
 */
export async function POST(request: NextRequest) {
  try {
    const { productId, assignments } = await request.json();

    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'productId è richiesto' },
        { status: 400 }
      );
    }

    // 1. Delete existing assignments for this product
    await sql`
      DELETE FROM preorder_customer_assignments
      WHERE product_id = ${productId}
    `;

    // 2. Insert new assignments
    if (assignments && assignments.length > 0) {
      for (const assignment of assignments) {
        await sql`
          INSERT INTO preorder_customer_assignments (product_id, customer_id, quantity)
          VALUES (${productId}, ${assignment.customer_id}, ${assignment.quantity})
        `;
      }
    }

    console.log(`✅ Updated ${assignments?.length || 0} customer assignments for product ${productId}`);

    return NextResponse.json({
      success: true,
      productId,
      assignmentsCount: assignments?.length || 0
    });

  } catch (error: any) {
    console.error('❌ Error saving customer assignments:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
