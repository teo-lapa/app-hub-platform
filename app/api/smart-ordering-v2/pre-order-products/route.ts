import { NextRequest, NextResponse } from 'next/server';
import { createOdooRPC } from '@/lib/odoo-rpc';
import { sql } from '@vercel/postgres';

/**
 * GET /api/smart-ordering-v2/pre-order-products
 *
 * Carica tutti i prodotti che hanno il tag "PRE-ORDINE"
 */
export async function GET(request: NextRequest) {
  try {
    const rpc = await createOdooRPC();

    // 1. Carica il tag "PRE-ORDINE"
    const tags = await rpc.searchRead(
      'product.tag',
      [['name', 'ilike', 'PRE-ORDINE']],
      ['id', 'name'],
      1
    );

    if (tags.length === 0) {
      return NextResponse.json({
        success: true,
        products: [],
        message: 'Tag PRE-ORDINE non trovato'
      });
    }

    const preOrderTagId = tags[0].id;

    // 2. Carica tutti i prodotti con questo tag
    const products = await rpc.searchRead(
      'product.product',
      [
        ['tag_ids', 'in', [preOrderTagId]],
        ['active', '=', true]
      ],
      [
        'id',
        'name',
        'default_code',
        'qty_available',
        'uom_id',
        'seller_ids',
        'tag_ids'
      ]
    );

    // 3. Carica informazioni fornitori
    const supplierIds = new Set<number>();
    products.forEach((product: any) => {
      if (product.seller_ids && product.seller_ids.length > 0) {
        supplierIds.add(product.seller_ids[0]); // Main supplier
      }
    });

    const suppliers = await rpc.searchRead(
      'product.supplierinfo',
      [['id', 'in', Array.from(supplierIds)]],
      ['id', 'partner_id', 'delay']
    );

    const supplierMap = new Map();
    for (const seller of suppliers) {
      if (seller.partner_id && seller.partner_id.length > 0) {
        const partnerId = seller.partner_id[0];
        const partnerName = seller.partner_id[1];
        supplierMap.set(seller.id, {
          id: partnerId,
          name: partnerName,
          delay: seller.delay || 3
        });
      }
    }

    // 4. Carica assegnazioni clienti dal database
    const productIds = products.map((p: any) => p.id);
    const assignmentsResult = await sql`
      SELECT product_id, customer_id, quantity
      FROM preorder_customer_assignments
      WHERE product_id = ANY(${productIds})
    `;

    // Raggruppa per product_id
    const assignmentsByProduct = new Map<number, any[]>();
    assignmentsResult.rows.forEach((row: any) => {
      if (!assignmentsByProduct.has(row.product_id)) {
        assignmentsByProduct.set(row.product_id, []);
      }
      assignmentsByProduct.get(row.product_id)!.push({
        customer_id: row.customer_id,
        customer_name: '', // Verrà caricato dal frontend
        quantity: parseFloat(row.quantity)
      });
    });

    // 5. Formatta i prodotti
    const formattedProducts = products.map((product: any) => {
      const mainSupplierId = product.seller_ids && product.seller_ids.length > 0 ? product.seller_ids[0] : null;
      const supplier = mainSupplierId ? supplierMap.get(mainSupplierId) : null;

      return {
        id: product.id,
        name: product.name,
        image_url: `https://lapadevadmin-lapa-v2-staging-2406-24586501.dev.odoo.com/web/image/product.product/${product.id}/image_128`,
        stock: product.qty_available || 0,
        uom: product.uom_id ? product.uom_id[1] : 'PZ',
        supplier_name: supplier ? supplier.name : 'Nessun fornitore',
        supplier_id: supplier ? supplier.id : null,
        hasPreOrderTag: product.tag_ids && product.tag_ids.includes(preOrderTagId),
        assigned_customers: assignmentsByProduct.get(product.id) || []
      };
    });

    return NextResponse.json({
      success: true,
      products: formattedProducts,
      totalCount: formattedProducts.length
    });

  } catch (error: any) {
    console.error('❌ Error loading pre-order products:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
