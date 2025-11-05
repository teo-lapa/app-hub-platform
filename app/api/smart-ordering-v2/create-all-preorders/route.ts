import { NextRequest, NextResponse } from 'next/server';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';
import { sql } from '@vercel/postgres';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/smart-ordering-v2/create-all-preorders
 *
 * Creates sale orders and purchase orders from pre-order assignments in bulk.
 *
 * WORKFLOW:
 * 1. Group assignments by customer → Create sale.order for each customer
 * 2. Group assignments by supplier → Create purchase.order for each supplier
 * 3. Add chatter messages to all created orders
 * 4. Delete processed assignments from database
 * 5. Return summary of created orders
 */

interface ProductAssignment {
  productId: number;
  supplierId: number;
  supplierName: string;
  assignments: Array<{
    customerId: number;
    customerName: string;
    quantity: number;
  }>;
}

interface RequestBody {
  productAssignments: ProductAssignment[];
}

/**
 * Format date for Odoo: 'YYYY-MM-DD HH:MM:SS'
 */
function formatOdooDate(date: Date): string {
  return date.getFullYear() + '-' +
    String(date.getMonth() + 1).padStart(2, '0') + '-' +
    String(date.getDate()).padStart(2, '0') + ' ' +
    String(date.getHours()).padStart(2, '0') + ':' +
    String(date.getMinutes()).padStart(2, '0') + ':' +
    String(date.getSeconds()).padStart(2, '0');
}

/**
 * Get tomorrow's date for orders
 */
function getTomorrowDate(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return formatOdooDate(tomorrow);
}

/**
 * Format Italian date for display
 */
function formatItalianDate(date: Date): string {
  return date.toLocaleDateString('it-IT', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

export async function POST(request: NextRequest) {
  console.log('\n🎯 [Bulk Pre-Orders] Starting bulk pre-order processing...');

  try {
    // 1. Get session and create RPC client
    const sessionId = request.cookies.get('odoo_session_id')?.value;
    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Session non trovata - Rifare login'
      }, { status: 401 });
    }

    const rpc = createOdooRPCClient(sessionId);

    // 2. Parse request body
    const body: any = await request.json();
    const productAssignments: ProductAssignment[] = body.products || body.productAssignments || [];

    if (!productAssignments || productAssignments.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'products è richiesto e non può essere vuoto'
      }, { status: 400 });
    }

    console.log(`📦 Processing ${productAssignments.length} products with assignments`);

    // 3. Prepare dates
    const tomorrowDate = getTomorrowDate();
    const now = new Date();
    const formattedDate = formatItalianDate(now);

    // 4. GROUP BY CUSTOMER - Collect all products per customer
    const customerOrders = new Map<number, {
      customerName: string;
      products: Array<{
        productId: number;
        quantity: number;
      }>;
    }>();

    for (const prodAssignment of productAssignments) {
      for (const assignment of prodAssignment.assignments) {
        if (!customerOrders.has(assignment.customerId)) {
          customerOrders.set(assignment.customerId, {
            customerName: assignment.customerName,
            products: []
          });
        }

        customerOrders.get(assignment.customerId)!.products.push({
          productId: prodAssignment.productId,
          quantity: assignment.quantity
        });
      }
    }

    console.log(`👥 Found ${customerOrders.size} unique customers`);

    // 5. GROUP BY SUPPLIER - Calculate total quantities per product per supplier
    const supplierOrders = new Map<number, {
      supplierName: string;
      products: Array<{
        productId: number;
        totalQuantity: number;
      }>;
    }>();

    for (const prodAssignment of productAssignments) {
      if (!supplierOrders.has(prodAssignment.supplierId)) {
        supplierOrders.set(prodAssignment.supplierId, {
          supplierName: prodAssignment.supplierName,
          products: []
        });
      }

      // Calculate total quantity needed for this product
      const totalQuantity = prodAssignment.assignments.reduce(
        (sum, assignment) => sum + assignment.quantity,
        0
      );

      supplierOrders.get(prodAssignment.supplierId)!.products.push({
        productId: prodAssignment.productId,
        totalQuantity
      });
    }

    console.log(`🏭 Found ${supplierOrders.size} unique suppliers`);

    // 6. CREATE SALE ORDERS (one per customer)
    const createdSaleOrders: Array<{ orderId: number; customerName: string; itemCount: number }> = [];

    for (const [customerId, orderData] of Array.from(customerOrders.entries())) {
      try {
        console.log(`\n📝 Creating sale.order for customer: ${orderData.customerName} (ID: ${customerId})`);

        // Fetch product details and prepare order lines
        const orderLines: any[] = [];

        for (const product of orderData.products) {
          try {
            const products = await rpc.searchRead(
              'product.product',
              [['id', '=', product.productId]],
              ['name', 'uom_id', 'list_price', 'default_code'],
              1
            );

            if (products && products.length > 0) {
              const productData = products[0];
              orderLines.push([0, 0, {
                product_id: product.productId,
                product_uom_qty: product.quantity,
                product_uom: productData.uom_id[0],
                price_unit: productData.list_price || 0,
                name: productData.name,
                customer_lead: 0
              }]);

              console.log(`  ✅ Added product: ${productData.name} x ${product.quantity}`);
            }
          } catch (productError) {
            console.error(`  ❌ Failed to fetch product ${product.productId}:`, productError);
          }
        }

        if (orderLines.length === 0) {
          console.warn(`  ⚠️ No valid products for customer ${customerId}, skipping...`);
          continue;
        }

        // Create sale.order in draft state (quotation)
        const saleOrderData = {
          partner_id: customerId,
          date_order: tomorrowDate,
          order_line: orderLines,
          note: `📦 Pre-Ordine Generato Automaticamente\nData creazione: ${formattedDate}\n\n🤖 Generato da LAPA Smart Ordering Pre-Ordine`
        };

        const saleOrderId = await rpc.callKw('sale.order', 'create', [saleOrderData], {});
        console.log(`  ✅ Sale order created: ${saleOrderId}`);

        // Add chatter message
        try {
          const chatterMessage = `<p>📦 <strong>Prodotti aggiunti da Pre-Ordine il ${formattedDate}</strong></p>
<ul>
${orderData.products.map(p => `<li>Prodotto ID ${p.productId}: ${p.quantity} unità</li>`).join('\n')}
</ul>
<p><em>🤖 Ordine creato automaticamente dal sistema di Pre-Ordine</em></p>`;

          await rpc.callKw('sale.order', 'message_post', [[saleOrderId]], {
            body: chatterMessage,
            message_type: 'comment',
            subtype_xmlid: 'mail.mt_note'
          });

          console.log(`  📝 Chatter message added to sale.order ${saleOrderId}`);
        } catch (chatterError) {
          console.warn(`  ⚠️ Failed to add chatter message:`, chatterError);
        }

        createdSaleOrders.push({
          orderId: saleOrderId,
          customerName: orderData.customerName,
          itemCount: orderLines.length
        });

      } catch (saleOrderError) {
        console.error(`❌ Failed to create sale.order for customer ${customerId}:`, saleOrderError);
      }
    }

    console.log(`\n✅ Created ${createdSaleOrders.length} sale orders`);

    // 7. CREATE PURCHASE ORDERS (one per supplier)
    const createdPurchaseOrders: Array<{ orderId: number; supplierName: string; itemCount: number }> = [];

    for (const [supplierId, orderData] of Array.from(supplierOrders.entries())) {
      try {
        console.log(`\n📦 Creating purchase.order for supplier: ${orderData.supplierName} (ID: ${supplierId})`);

        // Fetch product details and prepare order lines
        const orderLines: any[] = [];

        for (const product of orderData.products) {
          try {
            const products = await rpc.searchRead(
              'product.product',
              [['id', '=', product.productId]],
              ['name', 'uom_id', 'standard_price', 'list_price', 'default_code'],
              1
            );

            if (products && products.length > 0) {
              const productData = products[0];
              orderLines.push([0, 0, {
                product_id: product.productId,
                product_qty: product.totalQuantity,
                product_uom: productData.uom_id[0],
                price_unit: productData.standard_price || productData.list_price || 0,
                name: productData.name,
                date_planned: tomorrowDate
              }]);

              console.log(`  ✅ Added product: ${productData.name} x ${product.totalQuantity}`);
            }
          } catch (productError) {
            console.error(`  ❌ Failed to fetch product ${product.productId}:`, productError);
          }
        }

        if (orderLines.length === 0) {
          console.warn(`  ⚠️ No valid products for supplier ${supplierId}, skipping...`);
          continue;
        }

        // Create purchase.order in draft state (RFQ)
        const purchaseOrderData = {
          partner_id: supplierId,
          date_order: tomorrowDate,
          order_line: orderLines,
          notes: `📦 Pre-Ordine Generato Automaticamente\nData creazione: ${formattedDate}\n\n🤖 Generato da LAPA Smart Ordering Pre-Ordine`
        };

        const purchaseOrderId = await rpc.callKw('purchase.order', 'create', [purchaseOrderData], {});
        console.log(`  ✅ Purchase order created: ${purchaseOrderId}`);

        // Add chatter message
        try {
          const chatterMessage = `<p>📦 <strong>Prodotti aggiunti da Pre-Ordine il ${formattedDate}</strong></p>
<ul>
${orderData.products.map(p => `<li>Prodotto ID ${p.productId}: ${p.totalQuantity} unità totali</li>`).join('\n')}
</ul>
<p><em>🤖 Ordine creato automaticamente dal sistema di Pre-Ordine</em></p>`;

          await rpc.callKw('purchase.order', 'message_post', [[purchaseOrderId]], {
            body: chatterMessage,
            message_type: 'comment',
            subtype_xmlid: 'mail.mt_note'
          });

          console.log(`  📝 Chatter message added to purchase.order ${purchaseOrderId}`);
        } catch (chatterError) {
          console.warn(`  ⚠️ Failed to add chatter message:`, chatterError);
        }

        createdPurchaseOrders.push({
          orderId: purchaseOrderId,
          supplierName: orderData.supplierName,
          itemCount: orderLines.length
        });

      } catch (purchaseOrderError) {
        console.error(`❌ Failed to create purchase.order for supplier ${supplierId}:`, purchaseOrderError);
      }
    }

    console.log(`\n✅ Created ${createdPurchaseOrders.length} purchase orders`);

    // 8. DELETE PROCESSED ASSIGNMENTS FROM DATABASE
    try {
      const productIds = productAssignments.map(pa => pa.productId);

      if (productIds.length > 0) {
        // Delete all assignments for the processed products (one by one for Vercel Postgres compatibility)
        for (const productId of productIds) {
          await sql`
            DELETE FROM preorder_customer_assignments
            WHERE product_id = ${productId}
          `;
        }

        console.log(`\n🗑️ Deleted assignments for ${productIds.length} products from database`);
      }
    } catch (dbError) {
      console.error('❌ Failed to delete assignments from database:', dbError);
      // Don't fail the entire request if cleanup fails
    }

    // 9. Return summary
    const summary = {
      success: true,
      customerQuotesCreated: createdSaleOrders.length,
      supplierQuotesCreated: createdPurchaseOrders.length,
      created: {
        saleOrders: createdSaleOrders,
        purchaseOrders: createdPurchaseOrders
      },
      summary: {
        totalSaleOrders: createdSaleOrders.length,
        totalPurchaseOrders: createdPurchaseOrders.length,
        totalProducts: productAssignments.length,
        totalCustomers: customerOrders.size,
        totalSuppliers: supplierOrders.size
      }
    };

    console.log('\n🎉 Bulk pre-order processing completed successfully!');
    console.log(`   📊 Summary: ${summary.summary.totalSaleOrders} sale orders, ${summary.summary.totalPurchaseOrders} purchase orders`);

    return NextResponse.json(summary, { status: 201 });

  } catch (error: any) {
    console.error('❌ [Bulk Pre-Orders] Fatal error:', error);

    return NextResponse.json({
      success: false,
      error: error.message || 'Errore durante la creazione dei pre-ordini',
      details: error.toString()
    }, { status: 500 });
  }
}
