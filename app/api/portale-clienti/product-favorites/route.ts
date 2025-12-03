import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

/**
 * GET /api/portale-clienti/product-favorites
 *
 * Recupera la lista dei prodotti preferiti del cliente
 * Returns: Array di product_id
 */
export async function GET(request: NextRequest) {
  try {
    // Extract and verify JWT token
    const token = request.cookies.get('token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Autenticazione richiesta' },
        { status: 401 }
      );
    }

    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    let decoded: any;

    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch (jwtError: any) {
      return NextResponse.json(
        { success: false, error: 'Token non valido' },
        { status: 401 }
      );
    }

    const customerEmail = decoded.email;

    // Get favorites from database
    const result = await sql`
      SELECT product_id
      FROM product_favorites
      WHERE customer_email = ${customerEmail}
      ORDER BY created_at DESC
    `;

    const favoriteIds = result.rows.map(row => row.product_id);

    return NextResponse.json({
      success: true,
      favorites: favoriteIds
    });

  } catch (error: any) {
    console.error('❌ [FAVORITES-API] Errore GET:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Errore server' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/portale-clienti/product-favorites
 *
 * Toggle preferito: aggiunge se non esiste, rimuove se esiste
 * Body: { productId: number }
 */
export async function POST(request: NextRequest) {
  try {
    // Extract and verify JWT token
    const token = request.cookies.get('token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Autenticazione richiesta' },
        { status: 401 }
      );
    }

    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    let decoded: any;

    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch (jwtError: any) {
      return NextResponse.json(
        { success: false, error: 'Token non valido' },
        { status: 401 }
      );
    }

    const customerEmail = decoded.email;
    const { productId } = await request.json();

    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'productId richiesto' },
        { status: 400 }
      );
    }

    // Check if favorite exists
    const existing = await sql`
      SELECT id FROM product_favorites
      WHERE customer_email = ${customerEmail} AND product_id = ${productId}
    `;

    let action: 'added' | 'removed';

    if (existing.rows.length > 0) {
      // Remove favorite
      await sql`
        DELETE FROM product_favorites
        WHERE customer_email = ${customerEmail} AND product_id = ${productId}
      `;
      action = 'removed';
    } else {
      // Add favorite
      await sql`
        INSERT INTO product_favorites (customer_email, product_id)
        VALUES (${customerEmail}, ${productId})
      `;
      action = 'added';
    }

    // Get updated favorites list
    const result = await sql`
      SELECT product_id
      FROM product_favorites
      WHERE customer_email = ${customerEmail}
      ORDER BY created_at DESC
    `;

    const favoriteIds = result.rows.map(row => row.product_id);

    return NextResponse.json({
      success: true,
      action,
      productId,
      favorites: favoriteIds
    });

  } catch (error: any) {
    console.error('❌ [FAVORITES-API] Errore POST:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Errore server' },
      { status: 500 }
    );
  }
}
