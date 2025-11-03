/**
 * ANALISI PRODOTTO API - Analisi Completa Prodotto da Odoo
 *
 * GET /api/analisi-prodotto
 *
 * Query Parameters:
 * - productName: Nome prodotto (required)
 * - dateFrom: Data inizio analisi (default: 6 mesi fa)
 * - dateTo: Data fine analisi (default: oggi)
 *
 * Recupera e analizza tutti i dati di un prodotto da Odoo:
 * - Info prodotto (prezzi, giacenze, ubicazioni)
 * - Fornitori
 * - Ordini acquisto nel periodo
 * - Ordini vendita nel periodo
 * - Statistiche aggregate (totali, margini, top clienti, suggerimenti riordino)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// ========================================================================
// TYPES
// ========================================================================

interface StockLocation {
  location: string;
  quantity: number;
  reserved: number;
  available: number;
}

interface ProductInfo {
  id: number;
  name: string;
  defaultCode: string | null;
  barcode: string | null;
  category: string;
  listPrice: number;
  standardPrice: number;
  theoreticalMargin: number;
  qtyAvailable: number;
  virtualAvailable: number;
  incomingQty: number;
  outgoingQty: number;
  uom: string;
  locations?: StockLocation[];
}

interface Supplier {
  partnerId: number;
  partnerName: string;
  productName: string | null;
  productCode: string | null;
  price: number;
  minQty: number;
  delay: number;
}

interface PurchaseOrder {
  orderId: number;
  orderName: string;
  supplierId: number;
  supplierName: string;
  productQty: number;
  qtyReceived: number;
  priceUnit: number;
  priceSubtotal: number;
  dateOrder: string;
  state: string;
}

interface SaleOrder {
  orderId: number;
  orderName: string;
  customerId: number;
  customerName: string;
  productQty: number;
  qtyDelivered: number;
  priceUnit: number;
  priceSubtotal: number;
  createDate: string;
  state: string;
}

interface SupplierStats {
  supplierName: string;
  orders: number;
  qty: number;
  cost: number;
  avgPrice: number;
}

interface CustomerStats {
  customerName: string;
  orders: number;
  qty: number;
  revenue: number;
  avgPrice: number;
}

interface Statistics {
  totalPurchased: number;
  totalReceived: number;
  totalPurchaseCost: number;
  avgPurchasePrice: number;
  totalSold: number;
  totalDelivered: number;
  totalRevenue: number;
  avgSalePrice: number;
  profit: number;
  marginPercent: number;
  roi: number;
  monthlyAvgSales: number;
  weeklyAvgSales: number;
  daysOfCoverage: number;
}

interface ReorderSuggestion {
  reorderPoint: number;
  safetyStock: number;
  optimalOrderQty: number;
  currentStock: number;
  actionRequired: boolean;
  actionMessage: string;
  leadTime: number;
}

interface AnalisiProdottoResponse {
  product: ProductInfo;
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  saleOrders: SaleOrder[];
  statistics: Statistics;
  topSuppliers: SupplierStats[];
  topCustomers: CustomerStats[];
  reorderSuggestion: ReorderSuggestion;
  period: {
    dateFrom: string;
    dateTo: string;
  };
}

// ========================================================================
// MAIN HANDLER
// ========================================================================

export async function GET(request: NextRequest) {
  console.log('\n========================================');
  console.log('ANALISI PRODOTTO API - START');
  console.log('========================================\n');

  try {
    // 1. Parse query parameters
    const { searchParams } = new URL(request.url);

    const productName = searchParams.get('productName');
    if (!productName) {
      return NextResponse.json(
        { error: 'Parameter productName is required' },
        { status: 400 }
      );
    }

    // Default date range: 6 mesi fa fino a oggi
    const today = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const dateFrom = searchParams.get('dateFrom') || sixMonthsAgo.toISOString().split('T')[0];
    const dateTo = searchParams.get('dateTo') || today.toISOString().split('T')[0];

    console.log('Parameters:', { productName, dateFrom, dateTo });

    // 2. Authenticate with Odoo
    console.log('\nAuthenticating with Odoo...');
    const userCookies = request.headers.get('cookie');
    const { cookies: odooCookies, uid } = await getOdooSession(userCookies || undefined);

    if (!odooCookies) {
      throw new Error('Failed to authenticate with Odoo');
    }

    console.log('Authenticated successfully. UID:', uid);

    // 3. Search for product
    console.log('\nSearching for product:', productName);
    const products = await callOdoo(
      odooCookies,
      'product.product',
      'search_read',
      [[['name', 'ilike', productName]]],
      {
        fields: [
          'id', 'name', 'default_code', 'barcode', 'list_price', 'standard_price',
          'qty_available', 'virtual_available', 'incoming_qty', 'outgoing_qty',
          'uom_id', 'categ_id', 'product_tmpl_id'
        ],
        limit: 1
      }
    ) as any[];

    if (products.length === 0) {
      return NextResponse.json(
        { error: `Product "${productName}" not found` },
        { status: 404 }
      );
    }

    const product = products[0];
    const productId = product.id;
    const productTmplId = product.product_tmpl_id[0];

    console.log('Product found:', product.name);

    // 4. Fetch suppliers (escludendo ItaEmpire)
    console.log('\nFetching suppliers...');
    const allSuppliers = await callOdoo(
      odooCookies,
      'product.supplierinfo',
      'search_read',
      [[['product_tmpl_id', '=', productTmplId]]],
      {
        fields: ['partner_id', 'product_name', 'product_code', 'price', 'min_qty', 'delay']
      }
    ) as any[];

    console.log(`Found ${allSuppliers.length} total supplier(s)`);

    // Filtriamo escludendo ItaEmpire
    const suppliers = allSuppliers.filter((supplier: any) => {
      const partnerName = supplier.partner_id?.[1] || '';
      const isItaEmpire = partnerName.includes('ItaEmpire');

      if (isItaEmpire) {
        console.log(`  ⏭️  Escluso fornitore interno: ${partnerName}`);
      }

      return !isItaEmpire;
    });

    console.log(`After filtering: ${suppliers.length} external supplier(s)`);

    // 5. Fetch purchase orders (within date range)
    // IMPORTANTE: Filtriamo solo azienda "LAPA - finest italian food GmbH" (company_id = 1)
    console.log('\nFetching purchase orders for LAPA company (ID=1)...');
    const purchaseLines = await callOdoo(
      odooCookies,
      'purchase.order.line',
      'search_read',
      [[
        ['product_id', '=', productId],
        ['create_date', '>=', `${dateFrom} 00:00:00`],
        ['create_date', '<=', `${dateTo} 23:59:59`],
        ['state', 'in', ['purchase', 'done']],
        ['company_id', '=', 1]  // LAPA - finest italian food GmbH
      ]],
      {
        fields: [
          'order_id', 'partner_id', 'product_qty', 'qty_received',
          'price_unit', 'price_subtotal', 'date_order', 'state', 'create_date', 'company_id'
        ],
        order: 'date_order desc'
      }
    ) as any[];

    console.log(`Found ${purchaseLines.length} purchase orders for LAPA company`);

    // 6. Fetch sale orders (within date range)
    // IMPORTANTE: Filtriamo solo azienda "LAPA - finest italian food GmbH" (company_id = 1)
    console.log('\nFetching sale orders for LAPA company (ID=1)...');

    const saleLines = await callOdoo(
      odooCookies,
      'sale.order.line',
      'search_read',
      [[
        ['product_id', '=', productId],
        ['create_date', '>=', `${dateFrom} 00:00:00`],
        ['create_date', '<=', `${dateTo} 23:59:59`],
        ['state', 'in', ['sale', 'done']],
        ['company_id', '=', 1]  // LAPA - finest italian food GmbH
      ]],
      {
        fields: [
          'order_id', 'order_partner_id', 'product_uom_qty', 'qty_delivered',
          'price_unit', 'price_subtotal', 'create_date', 'state', 'company_id'
        ],
        order: 'create_date desc'
      }
    ) as any[];

    console.log(`Found ${saleLines.length} sale orders for LAPA company`);

    // 7. Fetch stock locations (ubicazioni)
    console.log('\nFetching stock locations...');
    const stockQuants = await callOdoo(
      odooCookies,
      'stock.quant',
      'search_read',
      [[
        ['product_id', '=', productId],
        ['quantity', '>', 0],
        ['location_id.usage', '=', 'internal']  // Only internal locations
      ]],
      {
        fields: ['location_id', 'quantity', 'reserved_quantity'],
        order: 'quantity desc'
      }
    ) as any[];

    console.log(`Found ${stockQuants.length} stock location(s)`);

    // 8. Build response
    const response = buildAnalysisResponse(
      product,
      suppliers,
      purchaseLines,
      saleLines,
      stockQuants,
      dateFrom,
      dateTo
    );

    console.log('\n========================================');
    console.log('ANALISI PRODOTTO API - SUCCESS');
    console.log('========================================\n');
    console.log('Summary:');
    console.log(`- Product: ${response.product.name}`);
    console.log(`- Purchase Orders: ${response.purchaseOrders.length}`);
    console.log(`- Sale Orders: ${response.saleOrders.length}`);
    console.log(`- Total Purchased: ${response.statistics.totalPurchased} ${response.product.uom}`);
    console.log(`- Total Sold: ${response.statistics.totalSold} ${response.product.uom}`);
    console.log(`- Profit: CHF ${response.statistics.profit.toFixed(2)}`);
    console.log(`- Margin: ${response.statistics.marginPercent.toFixed(2)}%`);
    console.log('\n');

    return NextResponse.json(response);

  } catch (error: unknown) {
    console.error('\n========================================');
    console.error('ANALISI PRODOTTO API - ERROR');
    console.error('========================================\n');
    console.error(error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        error: 'Failed to analyze product',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}

// ========================================================================
// HELPER FUNCTIONS
// ========================================================================

function buildAnalysisResponse(
  product: any,
  suppliers: any[],
  purchaseLines: any[],
  saleLines: any[],
  stockQuants: any[],
  dateFrom: string,
  dateTo: string
): AnalisiProdottoResponse {
  // Product info with stock locations
  const locations = stockQuants.map(sq => ({
    location: sq.location_id[1],
    quantity: sq.quantity || 0,
    reserved: sq.reserved_quantity || 0,
    available: (sq.quantity || 0) - (sq.reserved_quantity || 0)
  }));

  const productInfo: ProductInfo = {
    id: product.id,
    name: product.name,
    defaultCode: product.default_code || null,
    barcode: product.barcode || null,
    category: product.categ_id[1],
    listPrice: product.list_price || 0,
    standardPrice: product.standard_price || 0,
    theoreticalMargin: product.list_price && product.standard_price
      ? ((product.list_price - product.standard_price) / product.list_price * 100)
      : 0,
    qtyAvailable: product.qty_available || 0,
    virtualAvailable: product.virtual_available || 0,
    incomingQty: product.incoming_qty || 0,
    outgoingQty: product.outgoing_qty || 0,
    uom: product.uom_id[1],
    locations: locations  // Add locations array
  };

  // Suppliers
  const suppliersList: Supplier[] = suppliers.map(s => ({
    partnerId: s.partner_id[0],
    partnerName: s.partner_id[1],
    productName: s.product_name || null,
    productCode: s.product_code || null,
    price: s.price || 0,
    minQty: s.min_qty || 1,
    delay: s.delay || 0
  }));

  // Purchase orders
  const purchaseOrdersList: PurchaseOrder[] = purchaseLines.map(line => ({
    orderId: line.order_id[0],
    orderName: line.order_id[1],
    supplierId: line.partner_id[0],
    supplierName: line.partner_id[1],
    productQty: line.product_qty || 0,
    qtyReceived: line.qty_received || 0,
    priceUnit: line.price_unit || 0,
    priceSubtotal: line.price_subtotal || 0,
    dateOrder: line.date_order || line.create_date.split(' ')[0],
    state: line.state
  }));

  // Sale orders
  const saleOrdersList: SaleOrder[] = saleLines.map(line => ({
    orderId: line.order_id[0],
    orderName: line.order_id[1],
    customerId: line.order_partner_id[0],
    customerName: line.order_partner_id[1],
    productQty: line.product_uom_qty || 0,
    qtyDelivered: line.qty_delivered || 0,
    priceUnit: line.price_unit || 0,
    priceSubtotal: line.price_subtotal || 0,
    createDate: line.create_date.split(' ')[0],
    state: line.state
  }));

  // Calculate statistics
  const totalPurchased = purchaseOrdersList.reduce((sum, p) => sum + p.productQty, 0);
  const totalReceived = purchaseOrdersList.reduce((sum, p) => sum + p.qtyReceived, 0);
  const totalPurchaseCost = purchaseOrdersList.reduce((sum, p) => sum + p.priceSubtotal, 0);
  const avgPurchasePrice = totalPurchased > 0 ? totalPurchaseCost / totalPurchased : 0;

  const totalSold = saleOrdersList.reduce((sum, s) => sum + s.productQty, 0);
  const totalDelivered = saleOrdersList.reduce((sum, s) => sum + s.qtyDelivered, 0);
  const totalRevenue = saleOrdersList.reduce((sum, s) => sum + s.priceSubtotal, 0);
  const avgSalePrice = totalSold > 0 ? totalRevenue / totalSold : 0;

  const profit = totalRevenue - totalPurchaseCost;
  const marginPercent = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;
  const roi = totalPurchaseCost > 0 ? (profit / totalPurchaseCost) * 100 : 0;

  // Calculate 6-month period stats
  const periodMonths = calculateMonthsDifference(dateFrom, dateTo);
  const monthlyAvgSales = periodMonths > 0 ? totalSold / periodMonths : totalSold;
  const weeklyAvgSales = monthlyAvgSales / 4;

  const currentStock = productInfo.qtyAvailable + productInfo.incomingQty;
  const daysOfCoverage = weeklyAvgSales > 0 ? (currentStock / weeklyAvgSales) * 7 : 999;

  const statistics: Statistics = {
    totalPurchased,
    totalReceived,
    totalPurchaseCost,
    avgPurchasePrice,
    totalSold,
    totalDelivered,
    totalRevenue,
    avgSalePrice,
    profit,
    marginPercent,
    roi,
    monthlyAvgSales,
    weeklyAvgSales,
    daysOfCoverage
  };

  // Top suppliers
  const supplierStatsMap = new Map<string, SupplierStats>();
  purchaseOrdersList.forEach(p => {
    if (!supplierStatsMap.has(p.supplierName)) {
      supplierStatsMap.set(p.supplierName, {
        supplierName: p.supplierName,
        orders: 0,
        qty: 0,
        cost: 0,
        avgPrice: 0
      });
    }
    const stats = supplierStatsMap.get(p.supplierName)!;
    stats.orders++;
    stats.qty += p.productQty;
    stats.cost += p.priceSubtotal;
  });

  const topSuppliers = Array.from(supplierStatsMap.values())
    .map(s => ({
      ...s,
      avgPrice: s.qty > 0 ? s.cost / s.qty : 0
    }))
    .sort((a, b) => b.qty - a.qty);

  // Top customers (top 10)
  const customerStatsMap = new Map<string, CustomerStats>();
  saleOrdersList.forEach(s => {
    if (!customerStatsMap.has(s.customerName)) {
      customerStatsMap.set(s.customerName, {
        customerName: s.customerName,
        orders: 0,
        qty: 0,
        revenue: 0,
        avgPrice: 0
      });
    }
    const stats = customerStatsMap.get(s.customerName)!;
    stats.orders++;
    stats.qty += s.productQty;
    stats.revenue += s.priceSubtotal;
  });

  const topCustomers = Array.from(customerStatsMap.values())
    .map(c => ({
      ...c,
      avgPrice: c.qty > 0 ? c.revenue / c.qty : 0
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // Reorder suggestion
  const avgLeadTime = suppliersList.length > 0 ? suppliersList[0].delay : 7;
  const safetyStock = weeklyAvgSales * 2; // 2 settimane di scorta
  const reorderPoint = (weeklyAvgSales * avgLeadTime / 7) + safetyStock;
  const optimalOrderQty = monthlyAvgSales; // ordine mensile

  let actionRequired = false;
  let actionMessage = 'Stock OK';

  if (currentStock < reorderPoint) {
    actionRequired = true;
    const toOrder = Math.max(optimalOrderQty - currentStock, 0);
    actionMessage = `AZIONE RICHIESTA: Ordinare ${toOrder.toFixed(0)} ${productInfo.uom}`;
  } else if (daysOfCoverage < avgLeadTime + 7) {
    actionRequired = true;
    actionMessage = `ATTENZIONE: Stock sufficiente per solo ${daysOfCoverage.toFixed(0)} giorni. Considera di ordinare presto (lead time: ${avgLeadTime} giorni)`;
  } else {
    actionMessage = `Stock OK per i prossimi ${daysOfCoverage.toFixed(0)} giorni`;
  }

  const reorderSuggestion: ReorderSuggestion = {
    reorderPoint,
    safetyStock,
    optimalOrderQty,
    currentStock,
    actionRequired,
    actionMessage,
    leadTime: avgLeadTime
  };

  return {
    product: productInfo,
    suppliers: suppliersList,
    purchaseOrders: purchaseOrdersList,
    saleOrders: saleOrdersList,
    statistics,
    topSuppliers,
    topCustomers,
    reorderSuggestion,
    period: {
      dateFrom,
      dateTo
    }
  };
}

/**
 * Calculate the number of months between two dates
 */
function calculateMonthsDifference(dateFrom: string, dateTo: string): number {
  const from = new Date(dateFrom);
  const to = new Date(dateTo);

  const months = (to.getFullYear() - from.getFullYear()) * 12
    + (to.getMonth() - from.getMonth())
    + (to.getDate() >= from.getDate() ? 0 : -1);

  return Math.max(months, 1); // Almeno 1 mese
}
