import { NextRequest, NextResponse } from 'next/server';
import { callOdoo } from '@/lib/odoo-auth';

// Type definitions
interface OdooMany2One {
  0: number;
  1: string;
}

interface StockMove {
  id: number;
  name: string;
  product_uom_qty: number;
  quantity: number;
  location_id: OdooMany2One;
  location_dest_id: OdooMany2One;
  date: string;
  origin: string | false;
  reference: string | false;
  state: string;
  picking_id: OdooMany2One | false;
  create_uid: OdooMany2One | false;
}

interface PurchaseOrderLine {
  id: number;
  order_id: OdooMany2One;
  product_qty: number;
  qty_received: number;
  state: string;
}

interface PurchaseOrder {
  id: number;
  name: string;
  partner_id: OdooMany2One;
}

interface SaleOrderLine {
  id: number;
  order_id: OdooMany2One;
  product_uom_qty: number;
  qty_delivered: number;
  state: string;
  discount: number;
}

interface SaleOrder {
  id: number;
  name: string;
  partner_id: OdooMany2One;
}

interface MovementAnalysis {
  type: 'purchase' | 'sale' | 'gift' | 'adjustment_in' | 'adjustment_out' | 'scrap' | 'internal' | 'return_supplier' | 'return_customer' | 'unknown';
  date: string;
  quantity: number;
  direction: 'in' | 'out' | 'neutral';
  description: string;
  reference: string | null;
  from: string;
  to: string;
  user: string | null;
  impact: number; // +/- change to inventory
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const productId = parseInt(searchParams.get('productId') || '0');

  if (!productId) {
    return NextResponse.json({ success: false, error: 'productId is required' }, { status: 400 });
  }

  try {
    // Get product info
    const products = await callOdoo(
      null,
      'product.product',
      'search_read',
      [
        [['id', '=', productId]],
        ['id', 'name', 'qty_available', 'virtual_available', 'incoming_qty', 'outgoing_qty']
      ],
      {}
    ) as Array<{ id: number; name: string; qty_available: number; virtual_available: number; incoming_qty: number; outgoing_qty: number }>;

    if (!products || products.length === 0) {
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    }

    const product = products[0];

    // Get ALL stock movements (no limit for complete analysis)
    const allMoves = await callOdoo(
      null,
      'stock.move',
      'search_read',
      [
        [['product_id', '=', productId], ['state', '=', 'done']],
        ['id', 'name', 'product_uom_qty', 'quantity', 'location_id', 'location_dest_id', 'date', 'origin', 'reference', 'state', 'picking_id', 'create_uid']
      ],
      { order: 'date asc' }
    ) as StockMove[];

    // Get purchase orders info
    const purchaseLines = await callOdoo(
      null,
      'purchase.order.line',
      'search_read',
      [
        [['product_id', '=', productId]],
        ['id', 'order_id', 'product_qty', 'qty_received', 'state']
      ],
      {}
    ) as PurchaseOrderLine[];

    const purchaseOrderIds = Array.from(new Set((purchaseLines || []).map(l => l.order_id[0])));
    const purchaseOrders = purchaseOrderIds.length > 0 ? await callOdoo(
      null,
      'purchase.order',
      'search_read',
      [
        [['id', 'in', purchaseOrderIds]],
        ['id', 'name', 'partner_id']
      ],
      {}
    ) as PurchaseOrder[] : [];
    const poMap = new Map(purchaseOrders.map(po => [po.id, po]));

    // Get sale orders info
    const saleLines = await callOdoo(
      null,
      'sale.order.line',
      'search_read',
      [
        [['product_id', '=', productId]],
        ['id', 'order_id', 'product_uom_qty', 'qty_delivered', 'state', 'discount']
      ],
      {}
    ) as SaleOrderLine[];

    const saleOrderIds = Array.from(new Set((saleLines || []).map(l => l.order_id[0])));
    const saleOrders = saleOrderIds.length > 0 ? await callOdoo(
      null,
      'sale.order',
      'search_read',
      [
        [['id', 'in', saleOrderIds]],
        ['id', 'name', 'partner_id']
      ],
      {}
    ) as SaleOrder[] : [];
    const soMap = new Map(saleOrders.map(so => [so.id, so]));

    // Create a map of gift orders (100% discount)
    const giftOrderNames = new Set(
      (saleLines || [])
        .filter(l => l.discount === 100)
        .map(l => {
          const so = soMap.get(l.order_id[0]);
          return so ? so.name : null;
        })
        .filter(Boolean)
    );

    // Analyze each movement
    const analyzedMovements: MovementAnalysis[] = [];

    // Counters for analysis
    let totalIn = 0;
    let totalOut = 0;
    let purchaseIn = 0;
    let saleOut = 0;
    let giftOut = 0;
    let adjustmentIn = 0;
    let adjustmentOut = 0;
    let returnToSupplier = 0;
    let returnFromCustomer = 0;
    let internalTransfers = 0;
    let scrapOut = 0;
    let unknownIn = 0;
    let unknownOut = 0;

    for (const move of (allMoves || [])) {
      const fromLoc = move.location_id[1];
      const toLoc = move.location_dest_id[1];
      const qty = move.quantity;
      const origin = move.origin || move.reference || '';
      const user = move.create_uid ? move.create_uid[1] : null;

      let analysis: MovementAnalysis;

      // Determine movement type
      if (fromLoc.includes('Vendor') || fromLoc.includes('Supplier')) {
        // Purchase from supplier
        purchaseIn += qty;
        totalIn += qty;
        analysis = {
          type: 'purchase',
          date: move.date,
          quantity: qty,
          direction: 'in',
          description: `Acquisto da fornitore`,
          reference: origin || null,
          from: fromLoc,
          to: toLoc,
          user,
          impact: qty
        };
      } else if (toLoc.includes('Vendor') || toLoc.includes('Supplier')) {
        // Return to supplier
        returnToSupplier += qty;
        totalOut += qty;
        analysis = {
          type: 'return_supplier',
          date: move.date,
          quantity: qty,
          direction: 'out',
          description: `Reso a fornitore`,
          reference: origin || null,
          from: fromLoc,
          to: toLoc,
          user,
          impact: -qty
        };
      } else if (toLoc.includes('Customer')) {
        // Check if it's a gift or regular sale
        const isGift = giftOrderNames.has(origin);
        if (isGift) {
          giftOut += qty;
          analysis = {
            type: 'gift',
            date: move.date,
            quantity: qty,
            direction: 'out',
            description: `Omaggio a cliente`,
            reference: origin || null,
            from: fromLoc,
            to: toLoc,
            user,
            impact: -qty
          };
        } else {
          saleOut += qty;
          analysis = {
            type: 'sale',
            date: move.date,
            quantity: qty,
            direction: 'out',
            description: `Vendita a cliente`,
            reference: origin || null,
            from: fromLoc,
            to: toLoc,
            user,
            impact: -qty
          };
        }
        totalOut += qty;
      } else if (fromLoc.includes('Customer')) {
        // Return from customer
        returnFromCustomer += qty;
        totalIn += qty;
        analysis = {
          type: 'return_customer',
          date: move.date,
          quantity: qty,
          direction: 'in',
          description: `Reso da cliente`,
          reference: origin || null,
          from: fromLoc,
          to: toLoc,
          user,
          impact: qty
        };
      } else if (toLoc.includes('Inventory adjustment') || toLoc.includes('Virtual Locations/Inventory')) {
        // Adjustment OUT (reducing inventory)
        adjustmentOut += qty;
        totalOut += qty;
        analysis = {
          type: 'adjustment_out',
          date: move.date,
          quantity: qty,
          direction: 'out',
          description: `Rettifica inventario (DIMINUZIONE)`,
          reference: origin || null,
          from: fromLoc,
          to: toLoc,
          user,
          impact: -qty
        };
      } else if (fromLoc.includes('Inventory adjustment') || fromLoc.includes('Virtual Locations/Inventory')) {
        // Adjustment IN (increasing inventory)
        adjustmentIn += qty;
        totalIn += qty;
        analysis = {
          type: 'adjustment_in',
          date: move.date,
          quantity: qty,
          direction: 'in',
          description: `Rettifica inventario (AUMENTO)`,
          reference: origin || null,
          from: fromLoc,
          to: toLoc,
          user,
          impact: qty
        };
      } else if (toLoc.includes('Scrap')) {
        // Scrap
        scrapOut += qty;
        totalOut += qty;
        analysis = {
          type: 'scrap',
          date: move.date,
          quantity: qty,
          direction: 'out',
          description: `Scarto`,
          reference: origin || null,
          from: fromLoc,
          to: toLoc,
          user,
          impact: -qty
        };
      } else if ((fromLoc.includes('WH/') || fromLoc.includes('Stock')) && (toLoc.includes('WH/') || toLoc.includes('Stock'))) {
        // Internal transfer - no impact
        internalTransfers += qty;
        analysis = {
          type: 'internal',
          date: move.date,
          quantity: qty,
          direction: 'neutral',
          description: `Trasferimento interno`,
          reference: origin || null,
          from: fromLoc,
          to: toLoc,
          user,
          impact: 0
        };
      } else {
        // Unknown movement
        const isInternalDest = toLoc.includes('WH/') || toLoc.includes('Stock') || toLoc.includes('Deposito');
        if (isInternalDest) {
          unknownIn += qty;
          totalIn += qty;
          analysis = {
            type: 'unknown',
            date: move.date,
            quantity: qty,
            direction: 'in',
            description: `Movimento non classificato (entrata)`,
            reference: origin || null,
            from: fromLoc,
            to: toLoc,
            user,
            impact: qty
          };
        } else {
          unknownOut += qty;
          totalOut += qty;
          analysis = {
            type: 'unknown',
            date: move.date,
            quantity: qty,
            direction: 'out',
            description: `Movimento non classificato (uscita)`,
            reference: origin || null,
            from: fromLoc,
            to: toLoc,
            user,
            impact: -qty
          };
        }
      }

      analyzedMovements.push(analysis);
    }

    // Calculate theoretical stock from movements
    const theoreticalFromMoves = analyzedMovements.reduce((sum, m) => sum + m.impact, 0);

    // Calculate from purchase/sale docs
    const purchasedFromDocs = (purchaseLines || [])
      .filter(l => ['purchase', 'done'].includes(l.state))
      .reduce((sum, l) => sum + l.qty_received, 0);

    const soldFromDocs = (saleLines || [])
      .filter(l => ['sale', 'done'].includes(l.state))
      .reduce((sum, l) => sum + l.qty_delivered, 0);

    const giftsFromDocs = (saleLines || [])
      .filter(l => l.discount === 100 && ['sale', 'done'].includes(l.state))
      .reduce((sum, l) => sum + l.qty_delivered, 0);

    // Analysis results
    const discrepancy = product.qty_available - theoreticalFromMoves;

    // Generate detective findings
    const findings: Array<{ severity: 'info' | 'warning' | 'error'; message: string; details?: string }> = [];

    // Check for discrepancy
    if (Math.abs(discrepancy) > 0.5) {
      findings.push({
        severity: discrepancy > 0 ? 'warning' : 'error',
        message: discrepancy > 0
          ? `Giacenza reale SUPERIORE di ${discrepancy.toFixed(1)} unita`
          : `Giacenza reale INFERIORE di ${Math.abs(discrepancy).toFixed(1)} unita`,
        details: 'La giacenza reale non corrisponde alla somma dei movimenti registrati.'
      });
    }

    // Check for returns to supplier
    if (returnToSupplier > 0) {
      findings.push({
        severity: 'info',
        message: `${returnToSupplier} unita restituite a fornitori`,
        details: 'Questi prodotti sono stati restituiti ai fornitori e non sono più in giacenza.'
      });
    }

    // Check for customer returns
    if (returnFromCustomer > 0) {
      findings.push({
        severity: 'info',
        message: `${returnFromCustomer} unita rientrate da clienti`,
        details: 'Resi da clienti che hanno aumentato la giacenza.'
      });
    }

    // Check for large adjustments
    if (adjustmentOut > adjustmentIn + 10) {
      findings.push({
        severity: 'warning',
        message: `Rettifiche negative significative: -${(adjustmentOut - adjustmentIn).toFixed(1)} unita`,
        details: 'Sono state fatte rettifiche inventario che hanno ridotto la giacenza. Potrebbero indicare perdite, errori o furto.'
      });
    }

    // Check for unknown movements
    if (unknownIn > 0 || unknownOut > 0) {
      findings.push({
        severity: 'warning',
        message: `Movimenti non classificati: +${unknownIn} / -${unknownOut}`,
        details: 'Ci sono movimenti che non sono stati riconosciuti come acquisti, vendite o rettifiche.'
      });
    }

    // Check for gifts
    if (giftOut > 0) {
      findings.push({
        severity: 'info',
        message: `${giftOut} unita date in omaggio`,
        details: 'Prodotti consegnati senza addebito (sconto 100%).'
      });
    }

    // Check for scraps
    if (scrapOut > 0) {
      findings.push({
        severity: 'warning',
        message: `${scrapOut} unita scartate`,
        details: 'Prodotti scartati per danneggiamento o scadenza.'
      });
    }

    // Summary calculation
    const summary = {
      totalMovements: allMoves?.length || 0,

      // Entrate
      entries: {
        total: totalIn,
        purchases: purchaseIn,
        adjustments: adjustmentIn,
        customerReturns: returnFromCustomer,
        unknown: unknownIn
      },

      // Uscite
      exits: {
        total: totalOut,
        sales: saleOut,
        gifts: giftOut,
        adjustments: adjustmentOut,
        supplierReturns: returnToSupplier,
        scraps: scrapOut,
        unknown: unknownOut
      },

      // Trasferimenti
      internal: internalTransfers,

      // Calcoli
      theoreticalStock: theoreticalFromMoves,
      realStock: product.qty_available,
      discrepancy,

      // Confronto con documenti
      docsComparison: {
        purchasedFromDocs,
        purchasedFromMoves: purchaseIn,
        soldFromDocs,
        soldFromMoves: saleOut,
        giftsFromDocs,
        giftsFromMoves: giftOut
      }
    };

    // Group movements by type for timeline
    const movementsByType = analyzedMovements.reduce((acc, m) => {
      if (!acc[m.type]) acc[m.type] = [];
      acc[m.type].push(m);
      return acc;
    }, {} as Record<string, MovementAnalysis[]>);

    // Get recent adjustments with user info
    const recentAdjustments = analyzedMovements
      .filter(m => m.type === 'adjustment_in' || m.type === 'adjustment_out')
      .slice(-20);

    return NextResponse.json({
      success: true,
      product: {
        id: product.id,
        name: product.name,
        currentStock: product.qty_available,
        virtualStock: product.virtual_available,
        incoming: product.incoming_qty,
        outgoing: product.outgoing_qty
      },
      summary,
      findings,
      movementsByType: {
        purchase: movementsByType.purchase || [],
        sale: movementsByType.sale || [],
        gift: movementsByType.gift || [],
        adjustment_in: movementsByType.adjustment_in || [],
        adjustment_out: movementsByType.adjustment_out || [],
        scrap: movementsByType.scrap || [],
        internal: movementsByType.internal || [],
        return_supplier: movementsByType.return_supplier || [],
        return_customer: movementsByType.return_customer || [],
        unknown: movementsByType.unknown || []
      },
      recentAdjustments,
      timeline: analyzedMovements.slice(-100).reverse()
    });

  } catch (error) {
    console.error('Detective mode error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to analyze product'
    }, { status: 500 });
  }
}
