import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';
import type {
  DraftInvoiceAnalysis,
  AnomalyProduct,
  PriceData,
  DraftInvoiceStats,
} from '@/lib/types/monthly-analysis';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Internal Odoo types
interface DraftInvoice {
  id: number;
  name: string;
  partner_id: [number, string];
  amount_total: number;
  invoice_date: string | false;
  state: string;
  invoice_line_ids: number[];
}

interface InvoiceLine {
  id: number;
  move_id: [number, string];
  product_id: [number, string] | false;
  price_unit: number;
  quantity: number;
  discount: number;
  sale_line_ids: number[];
}

interface SaleOrder {
  id: number;
  name: string;
  tag_ids: [number, string][];
}

interface SaleLine {
  id: number;
  order_id: [number, string];
}

interface Product {
  id: number;
  standard_price: number;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Authenticate with Odoo
    const userCookies = request.headers.get('cookie');
    const { cookies: odooCookies } = await getOdooSession(userCookies || undefined);

    if (!odooCookies) {
      throw new Error('Failed to authenticate with Odoo');
    }

    console.log('[Fatture Bozza] Inizio fetch...');

    // ============================================================
    // STEP 1: Fetch Draft Invoices
    // ============================================================
    const draftInvoices: DraftInvoice[] = await callOdoo(
      odooCookies,
      'account.move',
      'search_read',
      [[
        ['state', '=', 'draft'],
        ['move_type', '=', 'out_invoice'],
        ['company_id', '=', 1],
      ]],
      {
        fields: ['id', 'name', 'partner_id', 'amount_total', 'invoice_date', 'state', 'invoice_line_ids'],
        order: 'invoice_date desc, id desc',
        limit: 100,
      }
    );

    console.log(`[Fatture Bozza] Trovate ${draftInvoices.length} fatture in bozza`);

    if (draftInvoices.length === 0) {
      return NextResponse.json({
        success: true,
        invoices: [],
        stats: {
          totalInvoices: 0,
          newCustomers: 0,
          higherPrices: 0,
          lowerPrices: 0,
          totalAnomalies: 0,
        },
        performanceMs: Date.now() - startTime,
      });
    }

    // ============================================================
    // STEP 2: Fetch All Invoice Lines (Batch)
    // ============================================================
    const allLineIds = draftInvoices.flatMap(inv => inv.invoice_line_ids);

    const invoiceLines: InvoiceLine[] = await callOdoo(
      odooCookies,
      'account.move.line',
      'search_read',
      [[
        ['id', 'in', allLineIds],
        ['display_type', '=', false], // Solo righe prodotto (no sezioni/note)
      ]],
      {
        fields: ['id', 'product_id', 'price_unit', 'quantity', 'discount', 'sale_line_ids', 'move_id'],
      }
    );

    console.log(`[Fatture Bozza] Fetched ${invoiceLines.length} invoice lines`);

    // Group lines by invoice
    const linesByInvoice = new Map<number, InvoiceLine[]>();
    invoiceLines.forEach(line => {
      const invoiceId = line.move_id?.[0];
      if (!invoiceId) return;

      if (!linesByInvoice.has(invoiceId)) {
        linesByInvoice.set(invoiceId, []);
      }
      linesByInvoice.get(invoiceId)!.push(line);
    });

    // ============================================================
    // STEP 3: Fetch Previous Invoices for Each Partner
    // ============================================================
    const partnerIds = Array.from(new Set(draftInvoices.map(inv => inv.partner_id[0])));

    const previousInvoices: any[] = await callOdoo(
      odooCookies,
      'account.move',
      'search_read',
      [[
        ['partner_id', 'in', partnerIds],
        ['move_type', '=', 'out_invoice'],
        ['state', '=', 'posted'],
        ['company_id', '=', 1],
      ]],
      {
        fields: ['id', 'partner_id', 'amount_total', 'invoice_date'],
        order: 'partner_id, invoice_date desc, id desc',
      }
    );

    // Group by partner, keep only latest
    const latestByPartner = new Map<number, any>();
    previousInvoices.forEach(inv => {
      const partnerId = inv.partner_id[0];
      if (!latestByPartner.has(partnerId)) {
        latestByPartner.set(partnerId, inv);
      }
    });

    console.log(`[Fatture Bozza] Trovate ${latestByPartner.size} fatture precedenti`);

    // ============================================================
    // STEP 4: Fetch Sale Orders (for tags)
    // ============================================================
    const allSaleLineIds = invoiceLines
      .flatMap(line => line.sale_line_ids || [])
      .filter(Boolean);

    let saleOrderMap = new Map<number, SaleOrder>();
    let saleLineToOrderMap = new Map<number, number>(); // sale.order.line.id → sale.order.id

    if (allSaleLineIds.length > 0) {
      const saleLines: SaleLine[] = await callOdoo(
        odooCookies,
        'sale.order.line',
        'search_read',
        [[['id', 'in', allSaleLineIds]]],
        { fields: ['id', 'order_id'] }
      );

      // Map sale line → order
      saleLines.forEach(sl => {
        saleLineToOrderMap.set(sl.id, sl.order_id[0]);
      });

      const saleOrderIds = Array.from(new Set(saleLines.map(sl => sl.order_id[0])));

      if (saleOrderIds.length > 0) {
        const saleOrders: SaleOrder[] = await callOdoo(
          odooCookies,
          'sale.order',
          'search_read',
          [[['id', 'in', saleOrderIds]]],
          { fields: ['id', 'name', 'tag_ids'] }
        );

        saleOrders.forEach(so => saleOrderMap.set(so.id, so));
      }
    }

    console.log(`[Fatture Bozza] Fetched ${saleOrderMap.size} sale orders`);

    // ============================================================
    // STEP 5: Fetch Products (for cost calculation)
    // ============================================================
    const productIds = Array.from(new Set(
      invoiceLines
        .filter(line => line.product_id && Array.isArray(line.product_id))
        .map(line => (line.product_id as [number, string])[0])
    ));

    const products: Product[] = await callOdoo(
      odooCookies,
      'product.product',
      'search_read',
      [[
        ['id', 'in', productIds],
        ['company_id', 'in', [1, false]],
      ]],
      { fields: ['id', 'standard_price'] }
    );

    const productMap = new Map(products.map(p => [p.id, p]));

    // ============================================================
    // STEP 6: Analyze Each Invoice
    // ============================================================
    const analysisResults: DraftInvoiceAnalysis[] = [];
    let stats = {
      totalInvoices: 0,
      newCustomers: 0,
      higherPrices: 0,
      lowerPrices: 0,
      totalAnomalies: 0,
    };

    for (const invoice of draftInvoices) {
      const partnerId = invoice.partner_id[0];
      const customerName = invoice.partner_id[1];
      const totalAmount = invoice.amount_total || 0;

      // Find previous invoice
      const previousInvoice = latestByPartner.get(partnerId);

      let growthEmoji = '';
      let growthType: 'new' | 'higher' | 'lower' | 'equal' = 'new';
      let deltaVsPrevious = 0;

      if (!previousInvoice) {
        growthEmoji = '🆕';
        growthType = 'new';
        stats.newCustomers++;
      } else {
        const prevTotal = previousInvoice.amount_total || 0;
        deltaVsPrevious = totalAmount - prevTotal;

        if (Math.abs(deltaVsPrevious) < 0.01) {
          growthEmoji = '';
          growthType = 'equal';
        } else if (deltaVsPrevious > 0) {
          growthEmoji = '📈';
          growthType = 'higher';
          stats.higherPrices++;
        } else {
          growthEmoji = '📉';
          growthType = 'lower';
          stats.lowerPrices++;
        }
      }

      // ============================================================
      // Analyze Products in This Invoice
      // ============================================================
      const lines = linesByInvoice.get(invoice.id) || [];
      const productData = new Map<number, PriceData[]>();

      for (const line of lines) {
        if (!line.product_id) continue;

        const productId = line.product_id[0];
        const productName = line.product_id[1];
        const priceUnit = line.price_unit || 0;
        const cost = productMap.get(productId)?.standard_price || 0;

        // Calculate margin
        let marginPercent = 0;
        if (priceUnit > 0) {
          marginPercent = ((priceUnit - cost) / priceUnit) * 100;
        }

        // Get sale order tags
        let saleOrderTags: string[] = [];
        let saleOrderId: number | null = null;
        let saleOrderName: string | null = null;

        if (line.sale_line_ids && line.sale_line_ids.length > 0) {
          const saleLineId = line.sale_line_ids[0];
          const orderId = saleLineToOrderMap.get(saleLineId);

          if (orderId) {
            const saleOrder = saleOrderMap.get(orderId);

            if (saleOrder) {
              saleOrderId = saleOrder.id;
              saleOrderName = saleOrder.name;
              // Extract tag names from many2many relation
              saleOrderTags = (saleOrder.tag_ids || []).map((tag: any) =>
                Array.isArray(tag) ? tag[1] : String(tag)
              );
            }
          }
        }

        const priceData: PriceData = {
          priceUnit,
          saleOrderId,
          saleOrderName,
          saleOrderTags,
          marginPercent,
        };

        if (!productData.has(productId)) {
          productData.set(productId, []);
        }
        productData.get(productId)!.push(priceData);
      }

      // Filter anomaly products
      const anomalyProducts: AnomalyProduct[] = [];

      for (const [productId, prices] of Array.from(productData.entries())) {
        const productLine = lines.find(l => l.product_id && Array.isArray(l.product_id) && l.product_id[0] === productId);
        const productName = productLine?.product_id ? (productLine.product_id as [number, string])[1] : 'Unknown';

        const hasMultiplePrices = prices.length >= 2;
        const hasZeroPrice = prices.some(p => p.priceUnit === 0);
        const hasHighMargin = prices.some(p => p.marginPercent >= 70);
        const hasOfferTag = prices.some(p =>
          p.saleOrderTags.some(tag => tag.toLowerCase().includes('offerta'))
        );

        // Include if any anomaly
        if (hasMultiplePrices || hasZeroPrice || hasHighMargin || hasOfferTag) {
          anomalyProducts.push({
            productId,
            productName,
            prices,
            hasMultiplePrices,
            hasZeroPrice,
            hasHighMargin,
            hasOfferTag,
          });

          stats.totalAnomalies++;
        }
      }

      // Skip invoice if no anomalies (unless new customer or big delta)
      const isSignificant =
        growthType === 'new' ||
        Math.abs(deltaVsPrevious) > 100 ||
        anomalyProducts.length > 0;

      if (isSignificant) {
        analysisResults.push({
          invoiceId: invoice.id,
          invoiceName: invoice.name,
          customerId: partnerId,
          customerName,
          totalAmount,
          invoiceDate: invoice.invoice_date || 'N/A',
          growthEmoji,
          growthType,
          deltaVsPrevious,
          previousInvoiceTotal: previousInvoice?.amount_total || null,
          previousInvoiceId: previousInvoice?.id || null,
          anomalyProducts,
        });
      }
    }

    stats.totalInvoices = analysisResults.length;

    console.log(`[Fatture Bozza] Analisi completata: ${analysisResults.length} fatture significative`);

    return NextResponse.json({
      success: true,
      invoices: analysisResults,
      stats,
      performanceMs: Date.now() - startTime,
    });

  } catch (error: any) {
    console.error('[Fatture Bozza] Errore:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore sconosciuto',
        performanceMs: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
