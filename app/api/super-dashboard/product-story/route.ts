import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdooApi } from '@/lib/odoo-auth';

// Type definitions
interface OdooMany2One {
  0: number;
  1: string;
}

interface ProductInfo {
  id: number;
  name: string;
  default_code: string | false;
  barcode: string | false;
  categ_id: OdooMany2One | false;
  qty_available: number;
  virtual_available: number;
  incoming_qty: number;
  outgoing_qty: number;
  list_price: number;
  standard_price: number;
  image_128: string | false;
  seller_ids: number[];
}

interface PurchaseOrderLine {
  id: number;
  order_id: OdooMany2One;
  product_qty: number;
  qty_received: number;
  price_unit: number;
  price_subtotal: number;
  date_planned: string;
  state: string;
}

interface PurchaseOrder {
  id: number;
  name: string;
  partner_id: OdooMany2One;
  date_order: string;
  state: string;
}

interface SaleOrderLine {
  id: number;
  order_id: OdooMany2One;
  product_uom_qty: number;
  qty_delivered: number;
  qty_invoiced: number;
  price_unit: number;
  price_subtotal: number;
  discount: number;
  margin: number;
  margin_percent: number;
  purchase_price: number;
  state: string;
}

interface SaleOrder {
  id: number;
  name: string;
  partner_id: OdooMany2One;
  date_order: string;
  state: string;
}

interface StockMove {
  id: number;
  product_uom_qty: number;
  quantity: number;
  location_id: OdooMany2One;
  location_dest_id: OdooMany2One;
  date: string;
  origin: string | false;
  reference: string | false;
  state: string;
  picking_id: OdooMany2One | false;
}

interface StockQuant {
  id: number;
  location_id: OdooMany2One;
  quantity: number;
  reserved_quantity: number;
  lot_id: OdooMany2One | false;
}

interface StockLot {
  id: number;
  name: string;
  product_qty: number;
  expiration_date: string | false;
}

interface StockScrap {
  id: number;
  product_id: OdooMany2One;
  scrap_qty: number;
  date_done: string;
  origin: string | false;
}

interface SupplierInfo {
  id: number;
  partner_id: OdooMany2One;
  price: number;
  min_qty: number;
  delay: number;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const productId = parseInt(searchParams.get('productId') || '0');
  const dateFrom = searchParams.get('dateFrom') || null;
  const dateTo = searchParams.get('dateTo') || null;

  if (!productId) {
    return NextResponse.json({ success: false, error: 'productId is required' }, { status: 400 });
  }

  try {
    const session = await getOdooSession();
    if (!session?.session_id) {
      return NextResponse.json({ success: false, error: 'Odoo authentication failed' }, { status: 401 });
    }

    // Build date domain filter
    const dateDomain: unknown[] = [];
    if (dateFrom) dateDomain.push(['date_order', '>=', dateFrom]);
    if (dateTo) dateDomain.push(['date_order', '<=', dateTo]);

    // 1. Get product info
    const productResult = await callOdooApi<ProductInfo[]>(session.session_id, {
      model: 'product.product',
      method: 'search_read',
      args: [
        [['id', '=', productId]],
        ['id', 'name', 'default_code', 'barcode', 'categ_id', 'qty_available', 'virtual_available',
          'incoming_qty', 'outgoing_qty', 'list_price', 'standard_price', 'image_128', 'seller_ids']
      ],
      kwargs: {}
    });

    if (!productResult || productResult.length === 0) {
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    }

    const product = productResult[0];

    // 2. Get supplier info
    const supplierInfos = await callOdooApi<SupplierInfo[]>(session.session_id, {
      model: 'product.supplierinfo',
      method: 'search_read',
      args: [
        [['id', 'in', product.seller_ids]],
        ['id', 'partner_id', 'price', 'min_qty', 'delay']
      ],
      kwargs: {}
    });

    // 3. Get purchase order lines
    const purchaseLinesDomain: unknown[] = [['product_id', '=', productId]];
    if (dateFrom) purchaseLinesDomain.push(['order_id.date_order', '>=', dateFrom]);
    if (dateTo) purchaseLinesDomain.push(['order_id.date_order', '<=', dateTo]);

    const purchaseLines = await callOdooApi<PurchaseOrderLine[]>(session.session_id, {
      model: 'purchase.order.line',
      method: 'search_read',
      args: [
        purchaseLinesDomain,
        ['id', 'order_id', 'product_qty', 'qty_received', 'price_unit', 'price_subtotal', 'date_planned', 'state']
      ],
      kwargs: { order: 'id desc', limit: 100 }
    });

    // Get purchase order details
    const purchaseOrderIds = [...new Set(purchaseLines.map(l => l.order_id[0]))];
    const purchaseOrders = purchaseOrderIds.length > 0 ? await callOdooApi<PurchaseOrder[]>(session.session_id, {
      model: 'purchase.order',
      method: 'search_read',
      args: [
        [['id', 'in', purchaseOrderIds]],
        ['id', 'name', 'partner_id', 'date_order', 'state']
      ],
      kwargs: {}
    }) : [];

    // 4. Get sale order lines
    const saleLinesDomain: unknown[] = [['product_id', '=', productId]];
    if (dateFrom) saleLinesDomain.push(['order_id.date_order', '>=', dateFrom]);
    if (dateTo) saleLinesDomain.push(['order_id.date_order', '<=', dateTo]);

    const saleLines = await callOdooApi<SaleOrderLine[]>(session.session_id, {
      model: 'sale.order.line',
      method: 'search_read',
      args: [
        saleLinesDomain,
        ['id', 'order_id', 'product_uom_qty', 'qty_delivered', 'qty_invoiced', 'price_unit',
          'price_subtotal', 'discount', 'margin', 'margin_percent', 'purchase_price', 'state']
      ],
      kwargs: { order: 'id desc', limit: 200 }
    });

    // Get sale order details
    const saleOrderIds = [...new Set(saleLines.map(l => l.order_id[0]))];
    const saleOrders = saleOrderIds.length > 0 ? await callOdooApi<SaleOrder[]>(session.session_id, {
      model: 'sale.order',
      method: 'search_read',
      args: [
        [['id', 'in', saleOrderIds]],
        ['id', 'name', 'partner_id', 'date_order', 'state']
      ],
      kwargs: {}
    }) : [];

    // 5. Get stock movements
    const moveDomain: unknown[] = [['product_id', '=', productId], ['state', '=', 'done']];
    if (dateFrom) moveDomain.push(['date', '>=', dateFrom]);
    if (dateTo) moveDomain.push(['date', '<=', dateTo]);

    const stockMoves = await callOdooApi<StockMove[]>(session.session_id, {
      model: 'stock.move',
      method: 'search_read',
      args: [
        moveDomain,
        ['id', 'product_uom_qty', 'quantity', 'location_id', 'location_dest_id', 'date', 'origin', 'reference', 'state', 'picking_id']
      ],
      kwargs: { order: 'date desc', limit: 100 }
    });

    // 6. Get stock quants (current inventory by location)
    const stockQuants = await callOdooApi<StockQuant[]>(session.session_id, {
      model: 'stock.quant',
      method: 'search_read',
      args: [
        [['product_id', '=', productId], ['quantity', '!=', 0], ['location_id.usage', '=', 'internal']],
        ['id', 'location_id', 'quantity', 'reserved_quantity', 'lot_id']
      ],
      kwargs: {}
    });

    // 7. Get lots
    const stockLots = await callOdooApi<StockLot[]>(session.session_id, {
      model: 'stock.lot',
      method: 'search_read',
      args: [
        [['product_id', '=', productId]],
        ['id', 'name', 'product_qty', 'expiration_date']
      ],
      kwargs: { order: 'expiration_date asc', limit: 50 }
    });

    // 8. Get scraps
    const scrapDomain: unknown[] = [['product_id', '=', productId], ['state', '=', 'done']];
    if (dateFrom) scrapDomain.push(['date_done', '>=', dateFrom]);
    if (dateTo) scrapDomain.push(['date_done', '<=', dateTo]);

    const scraps = await callOdooApi<StockScrap[]>(session.session_id, {
      model: 'stock.scrap',
      method: 'search_read',
      args: [
        scrapDomain,
        ['id', 'product_id', 'scrap_qty', 'date_done', 'origin']
      ],
      kwargs: {}
    });

    // Process data for response

    // Aggregate purchases by supplier
    const purchaseOrderMap = new Map(purchaseOrders.map(po => [po.id, po]));
    const supplierPurchases = new Map<number, {
      supplierId: number;
      supplierName: string;
      totalQty: number;
      totalReceived: number;
      totalValue: number;
      avgPrice: number;
      lastPurchase: string;
      orders: Array<{ orderName: string; date: string; qty: number; received: number; price: number; state: string }>;
    }>();

    for (const line of purchaseLines) {
      const order = purchaseOrderMap.get(line.order_id[0]);
      if (!order) continue;

      const supplierId = order.partner_id[0];
      const existing = supplierPurchases.get(supplierId) || {
        supplierId,
        supplierName: order.partner_id[1],
        totalQty: 0,
        totalReceived: 0,
        totalValue: 0,
        avgPrice: 0,
        lastPurchase: '',
        orders: []
      };

      existing.totalQty += line.product_qty;
      existing.totalReceived += line.qty_received;
      existing.totalValue += line.price_subtotal;
      if (!existing.lastPurchase || order.date_order > existing.lastPurchase) {
        existing.lastPurchase = order.date_order;
      }
      existing.orders.push({
        orderName: order.name,
        date: order.date_order,
        qty: line.product_qty,
        received: line.qty_received,
        price: line.price_unit,
        state: line.state
      });

      supplierPurchases.set(supplierId, existing);
    }

    // Calculate average price for each supplier
    for (const [, data] of supplierPurchases) {
      data.avgPrice = data.totalQty > 0 ? data.totalValue / data.totalQty : 0;
    }

    // Aggregate sales by customer
    const saleOrderMap = new Map(saleOrders.map(so => [so.id, so]));
    const customerSales = new Map<number, {
      customerId: number;
      customerName: string;
      totalQty: number;
      totalDelivered: number;
      totalRevenue: number;
      totalMargin: number;
      avgPrice: number;
      avgMarginPercent: number;
      lastSale: string;
      orders: Array<{ orderName: string; date: string; qty: number; delivered: number; price: number; discount: number; margin: number; state: string }>;
    }>();

    // Track gifts (100% discount)
    const gifts: Array<{ orderName: string; customerName: string; date: string; qty: number; value: number }> = [];

    for (const line of saleLines) {
      const order = saleOrderMap.get(line.order_id[0]);
      if (!order) continue;

      // Check if this is a gift (100% discount)
      if (line.discount === 100) {
        gifts.push({
          orderName: order.name,
          customerName: order.partner_id[1],
          date: order.date_order,
          qty: line.qty_delivered || line.product_uom_qty,
          value: line.price_unit * (line.qty_delivered || line.product_uom_qty)
        });
      }

      const customerId = order.partner_id[0];
      const existing = customerSales.get(customerId) || {
        customerId,
        customerName: order.partner_id[1],
        totalQty: 0,
        totalDelivered: 0,
        totalRevenue: 0,
        totalMargin: 0,
        avgPrice: 0,
        avgMarginPercent: 0,
        lastSale: '',
        orders: []
      };

      existing.totalQty += line.product_uom_qty;
      existing.totalDelivered += line.qty_delivered;
      existing.totalRevenue += line.price_subtotal;
      existing.totalMargin += line.margin || 0;
      if (!existing.lastSale || order.date_order > existing.lastSale) {
        existing.lastSale = order.date_order;
      }
      existing.orders.push({
        orderName: order.name,
        date: order.date_order,
        qty: line.product_uom_qty,
        delivered: line.qty_delivered,
        price: line.price_unit,
        discount: line.discount,
        margin: line.margin || 0,
        state: line.state
      });

      customerSales.set(customerId, existing);
    }

    // Calculate averages for each customer
    for (const [, data] of customerSales) {
      data.avgPrice = data.totalQty > 0 ? data.totalRevenue / data.totalQty : 0;
      data.avgMarginPercent = data.totalRevenue > 0 ? (data.totalMargin / data.totalRevenue) * 100 : 0;
    }

    // Calculate inventory discrepancy
    const totalPurchased = purchaseLines
      .filter(l => ['purchase', 'done'].includes(l.state))
      .reduce((sum, l) => sum + l.qty_received, 0);

    const totalSold = saleLines
      .filter(l => ['sale', 'done'].includes(l.state))
      .reduce((sum, l) => sum + l.qty_delivered, 0);

    const totalGifts = gifts.reduce((sum, g) => sum + g.qty, 0);
    const totalScrapped = scraps.reduce((sum, s) => sum + s.scrap_qty, 0);

    // Count inventory adjustments from stock moves
    const inventoryAdjustments = stockMoves.filter(m =>
      m.location_id[1].includes('Inventory adjustment') ||
      m.location_dest_id[1].includes('Inventory adjustment')
    );
    const totalAdjustments = inventoryAdjustments.reduce((sum, m) => {
      if (m.location_dest_id[1].includes('Inventory adjustment')) {
        return sum - m.quantity; // Moving TO adjustment = decrease
      } else {
        return sum + m.quantity; // Moving FROM adjustment = increase
      }
    }, 0);

    const theoreticalStock = totalPurchased - totalSold - totalScrapped + totalAdjustments;
    const currentStock = product.qty_available;
    const discrepancy = currentStock - theoreticalStock;

    // Process movements for timeline
    const movements = stockMoves.map(m => {
      let type: 'in' | 'out' | 'internal' | 'adjustment' = 'internal';
      if (m.location_id[1].includes('Vendor') || m.location_id[1].includes('Supplier')) {
        type = 'in';
      } else if (m.location_dest_id[1].includes('Customer')) {
        type = 'out';
      } else if (m.location_id[1].includes('Inventory adjustment') || m.location_dest_id[1].includes('Inventory adjustment')) {
        type = 'adjustment';
      }

      return {
        id: m.id,
        date: m.date,
        quantity: m.quantity,
        type,
        from: m.location_id[1],
        to: m.location_dest_id[1],
        origin: m.origin || m.reference || null,
        picking: m.picking_id ? m.picking_id[1] : null
      };
    });

    // Calculate profitability
    const totalRevenue = Array.from(customerSales.values()).reduce((sum, c) => sum + c.totalRevenue, 0);
    const totalMargin = Array.from(customerSales.values()).reduce((sum, c) => sum + c.totalMargin, 0);
    const totalCost = totalRevenue - totalMargin;

    // Format response
    const response = {
      success: true,
      product: {
        id: product.id,
        name: product.name,
        code: product.default_code || null,
        barcode: product.barcode || null,
        category: product.categ_id ? product.categ_id[1] : null,
        image: product.image_128 || null,
        prices: {
          list: product.list_price,
          cost: product.standard_price
        },
        stock: {
          available: product.qty_available,
          virtual: product.virtual_available,
          incoming: product.incoming_qty,
          outgoing: product.outgoing_qty
        }
      },
      suppliers: {
        list: Array.from(supplierPurchases.values()).sort((a, b) =>
          new Date(b.lastPurchase).getTime() - new Date(a.lastPurchase).getTime()
        ),
        info: supplierInfos.map(s => ({
          id: s.id,
          supplierId: s.partner_id[0],
          supplierName: s.partner_id[1],
          price: s.price,
          minQty: s.min_qty,
          leadTime: s.delay
        })),
        totals: {
          totalQty: totalPurchased,
          totalValue: Array.from(supplierPurchases.values()).reduce((sum, s) => sum + s.totalValue, 0),
          supplierCount: supplierPurchases.size
        }
      },
      sales: {
        customers: Array.from(customerSales.values()).sort((a, b) =>
          b.totalRevenue - a.totalRevenue
        ),
        totals: {
          totalQty: totalSold,
          totalRevenue,
          customerCount: customerSales.size
        }
      },
      gifts: {
        list: gifts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
        totalQty: totalGifts,
        totalValue: gifts.reduce((sum, g) => sum + g.value, 0)
      },
      inventory: {
        currentStock,
        theoreticalStock,
        discrepancy,
        discrepancyPercent: theoreticalStock > 0 ? (discrepancy / theoreticalStock) * 100 : 0,
        breakdown: {
          purchased: totalPurchased,
          sold: totalSold,
          gifts: totalGifts,
          scrapped: totalScrapped,
          adjustments: totalAdjustments
        },
        locations: stockQuants.map(q => ({
          location: q.location_id[1],
          quantity: q.quantity,
          reserved: q.reserved_quantity,
          lot: q.lot_id ? q.lot_id[1] : null
        })),
        scraps: scraps.map(s => ({
          date: s.date_done,
          qty: s.scrap_qty,
          origin: s.origin || null
        }))
      },
      movements: movements.slice(0, 50),
      profitability: {
        totalRevenue,
        totalCost,
        totalMargin,
        marginPercent: totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0,
        marginPerUnit: totalSold > 0 ? totalMargin / totalSold : 0
      },
      lots: stockLots.map(l => ({
        name: l.name,
        qty: l.product_qty,
        expirationDate: l.expiration_date || null,
        isExpired: l.expiration_date ? new Date(l.expiration_date) < new Date() : false,
        isExpiringSoon: l.expiration_date
          ? new Date(l.expiration_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          : false
      }))
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Product story error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch product story'
    }, { status: 500 });
  }
}
