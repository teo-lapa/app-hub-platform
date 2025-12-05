import { NextRequest, NextResponse } from 'next/server';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';
import { sql } from '@vercel/postgres';

/**
 * GET /api/smart-ordering-v2/pre-orders-summary
 *
 * Carica tutti i prodotti PRE-ORDINE con clienti assegnati,
 * raggruppati per fornitore con statistiche aggregate.
 */
export async function GET(request: NextRequest) {
  try {
    // Get session
    const sessionId = request.cookies.get('odoo_session_id')?.value;
    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Session non trovata - Rifare login'
      }, { status: 401 });
    }

    const rpc = createOdooRPCClient(sessionId);

    // 1. Carica tutte le assegnazioni dal database (escludendo quelle già ordinate)
    let assignmentsResult;
    try {
      assignmentsResult = await sql`
        SELECT
          product_id,
          customer_id,
          quantity,
          notes,
          created_at
        FROM preorder_customer_assignments
        WHERE is_ordered = FALSE OR is_ordered IS NULL
        ORDER BY product_id, customer_id
      `;
    } catch (error) {
      console.warn('⚠️ Errore caricamento assegnazioni (tabella potrebbe non esistere):', error);
      return NextResponse.json({
        success: true,
        preOrderSuppliers: [],
        message: 'Nessuna assegnazione trovata (tabella non esistente o vuota)'
      });
    }

    if (assignmentsResult.rows.length === 0) {
      return NextResponse.json({
        success: true,
        preOrderSuppliers: [],
        message: 'Nessuna assegnazione pre-ordine trovata'
      });
    }

    console.log(`📦 Trovate ${assignmentsResult.rows.length} assegnazioni nel database`);

    // 2. Raggruppa assegnazioni per product_id
    const assignmentsByProduct = new Map<number, any[]>();
    const allProductIds = new Set<number>();

    for (const row of assignmentsResult.rows) {
      const productId = row.product_id;
      allProductIds.add(productId);

      if (!assignmentsByProduct.has(productId)) {
        assignmentsByProduct.set(productId, []);
      }

      assignmentsByProduct.get(productId)!.push({
        customerId: row.customer_id,
        quantity: parseFloat(row.quantity),
        notes: row.notes,
        createdAt: row.created_at
      });
    }

    console.log(`📦 Prodotti unici con assegnazioni: ${allProductIds.size}`);

    // 3. Carica info prodotti da Odoo
    const productIds = Array.from(allProductIds);
    const products = await rpc.searchRead(
      'product.product',
      [
        ['id', 'in', productIds],
        ['active', '=', true]
      ],
      [
        'id',
        'name',
        'display_name',
        'default_code',
        'seller_ids',
        'product_tmpl_id',
        'lst_price',
        'uom_id'
      ]
    );

    console.log(`🔍 Caricati ${products.length} prodotti da Odoo`);

    // 4. Carica info fornitori
    const supplierIds = new Set<number>();
    products.forEach((product: any) => {
      if (product.seller_ids && product.seller_ids.length > 0) {
        supplierIds.add(product.seller_ids[0]); // Main supplier
      }
    });

    const suppliers = await rpc.searchRead(
      'product.supplierinfo',
      [['id', 'in', Array.from(supplierIds)]],
      ['id', 'partner_id', 'delay', 'price']
    );

    const supplierMap = new Map();
    for (const seller of suppliers) {
      if (seller.partner_id && seller.partner_id.length > 0) {
        const partnerId = seller.partner_id[0];
        const partnerName = seller.partner_id[1];
        supplierMap.set(seller.id, {
          id: partnerId,
          name: partnerName,
          delay: seller.delay || 7,
          price: seller.price || 0
        });
      }
    }

    // 5. Carica nomi clienti da Odoo
    const allCustomerIds = new Set<number>();
    assignmentsResult.rows.forEach(row => {
      allCustomerIds.add(row.customer_id);
    });

    const customers = await rpc.searchRead(
      'res.partner',
      [['id', 'in', Array.from(allCustomerIds)]],
      ['id', 'name', 'display_name']
    );

    const customerMap = new Map();
    customers.forEach((customer: any) => {
      customerMap.set(customer.id, customer.display_name || customer.name);
    });

    console.log(`👥 Caricati ${customers.length} clienti da Odoo`);

    // 6. Raggruppa prodotti per fornitore
    interface SupplierSummary {
      supplierId: number;
      supplierName: string;
      products: any[];
      totalProducts: number;
      totalCustomers: number;
      totalQuantity: number;
      estimatedValue: number;
    }

    const supplierGroups = new Map<number, SupplierSummary>();

    for (const product of products) {
      const mainSupplierId = product.seller_ids && product.seller_ids.length > 0
        ? product.seller_ids[0]
        : 0;

      const supplier = mainSupplierId ? supplierMap.get(mainSupplierId) : null;
      const supplierId = supplier ? supplier.id : 0;
      const supplierName = supplier ? supplier.name : 'Nessun fornitore';

      // Crea gruppo se non esiste
      if (!supplierGroups.has(supplierId)) {
        supplierGroups.set(supplierId, {
          supplierId,
          supplierName,
          products: [],
          totalProducts: 0,
          totalCustomers: 0,
          totalQuantity: 0,
          estimatedValue: 0
        });
      }

      const group = supplierGroups.get(supplierId)!;

      // Carica assegnazioni per questo prodotto
      const productAssignments = assignmentsByProduct.get(product.id) || [];

      // Calcola totali per questo prodotto
      const totalQuantity = productAssignments.reduce((sum, a) => sum + a.quantity, 0);
      const customerCount = new Set(productAssignments.map(a => a.customerId)).size;

      // Formatta assegnazioni con nomi clienti
      const assignments = productAssignments.map(a => ({
        customerId: a.customerId,
        customerName: customerMap.get(a.customerId) || `Cliente ${a.customerId}`,
        quantity: a.quantity,
        notes: a.notes
      }));

      // Aggiungi prodotto al gruppo
      group.products.push({
        productId: product.id,
        productName: product.display_name || product.name,
        productCode: product.default_code || '',
        unitPrice: product.lst_price || 0,
        uom: product.uom_id ? product.uom_id[1] : 'PZ',
        totalQuantity,
        customerCount,
        assignments,
        estimatedValue: totalQuantity * (product.lst_price || 0)
      });

      // Aggiorna totali del gruppo
      group.totalQuantity += totalQuantity;

      // Aggiorna clienti unici del gruppo
      const uniqueCustomers = new Set<number>();
      group.products.forEach(p => {
        p.assignments.forEach((a: any) => uniqueCustomers.add(a.customerId));
      });
      group.totalCustomers = uniqueCustomers.size;

      // Aggiorna valore stimato
      group.estimatedValue += totalQuantity * (product.lst_price || 0);
    }

    // Aggiorna totalProducts per ogni gruppo
    supplierGroups.forEach(group => {
      group.totalProducts = group.products.length;
    });

    // 7. Converti in array e ordina per valore stimato decrescente
    const preOrderSuppliers = Array.from(supplierGroups.values())
      .sort((a, b) => b.estimatedValue - a.estimatedValue);

    console.log(`✅ Raggruppati in ${preOrderSuppliers.length} fornitori`);

    // 8. Calcola statistiche globali
    const totalStats = {
      totalSuppliers: preOrderSuppliers.length,
      totalProducts: Array.from(allProductIds).length,
      totalCustomers: customers.length,
      totalAssignments: assignmentsResult.rows.length,
      totalQuantity: preOrderSuppliers.reduce((sum, s) => sum + s.totalQuantity, 0),
      totalEstimatedValue: preOrderSuppliers.reduce((sum, s) => sum + s.estimatedValue, 0)
    };

    return NextResponse.json({
      success: true,
      preOrderSuppliers,
      stats: totalStats,
      generatedAt: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Error loading pre-orders summary:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
