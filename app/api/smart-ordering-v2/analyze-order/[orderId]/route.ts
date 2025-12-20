/**
 * API Smart Ordering V2 - Analizza Ordine
 *
 * Analizza un ordine di acquisto e suggerisce:
 * 1. Se le quantità ordinate sono corrette
 * 2. Se ci sono altri prodotti da aggiungere (basato su vendite recenti)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId: orderIdStr } = await params;
    const orderId = parseInt(orderIdStr);

    if (!orderId || isNaN(orderId)) {
      return NextResponse.json({
        success: false,
        error: 'orderId non valido'
      }, { status: 400 });
    }

    console.log(`🔍 [Analyze Order] Analisi ordine ${orderId}...`);

    const sessionId = request.cookies.get('odoo_session_id')?.value;
    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Session non trovata - Rifare login'
      }, { status: 401 });
    }

    const rpc = createOdooRPCClient(sessionId);

    // 1. Carica ordine
    const orders = await rpc.searchRead(
      'purchase.order',
      [['id', '=', orderId]],
      ['id', 'name', 'partner_id', 'date_order', 'state', 'order_line', 'amount_total', 'currency_id'],
      1
    );

    if (!orders || orders.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Ordine non trovato'
      }, { status: 404 });
    }

    const order = orders[0];
    const supplierId = order.partner_id[0];
    const supplierName = order.partner_id[1];

    console.log(`📦 Ordine: ${order.name} - Fornitore: ${supplierName}`);

    // 2. Carica righe ordine
    const orderLines = await rpc.searchRead(
      'purchase.order.line',
      [['order_id', '=', orderId]],
      ['id', 'product_id', 'name', 'product_qty', 'qty_received', 'price_unit', 'price_subtotal', 'product_uom'],
      0
    );

    const orderedProductIds = orderLines.map((l: any) => l.product_id[0]);

    // 3. Calcola data 3 mesi fa per analisi vendite
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    // 4. Trova TUTTI i prodotti che compriamo da questo fornitore (storico acquisti)
    console.log(`📊 Caricamento storico acquisti dal fornitore ${supplierId}...`);

    const purchaseHistory = await rpc.searchRead(
      'purchase.order.line',
      [
        ['order_id.partner_id', '=', supplierId],
        ['order_id.state', 'in', ['purchase', 'done']],
        ['order_id.date_order', '>=', threeMonthsAgo.toISOString().split('T')[0]]
      ],
      ['product_id', 'product_qty', 'order_id'],
      0
    );

    // Conta quante volte abbiamo ordinato ogni prodotto
    const productPurchaseCount = new Map<number, { count: number; totalQty: number; name: string }>();
    purchaseHistory.forEach((line: any) => {
      const pid = line.product_id[0];
      const pname = line.product_id[1];
      if (!productPurchaseCount.has(pid)) {
        productPurchaseCount.set(pid, { count: 0, totalQty: 0, name: pname });
      }
      const stat = productPurchaseCount.get(pid)!;
      stat.count++;
      stat.totalQty += line.product_qty || 0;
    });

    // 5. Carica vendite degli ultimi 3 mesi per i prodotti del fornitore
    const supplierProductIds = Array.from(productPurchaseCount.keys());

    let salesByProduct = new Map<number, { totalSold: number; avgDaily: number }>();

    if (supplierProductIds.length > 0) {
      const sales = await rpc.searchRead(
        'sale.order.line',
        [
          ['product_id', 'in', supplierProductIds],
          ['order_id.effective_date', '>=', threeMonthsAgo.toISOString().split('T')[0]],
          ['order_id.state', 'in', ['sale', 'done']]
        ],
        ['product_id', 'product_uom_qty'],
        0
      );

      sales.forEach((line: any) => {
        const pid = line.product_id[0];
        if (!salesByProduct.has(pid)) {
          salesByProduct.set(pid, { totalSold: 0, avgDaily: 0 });
        }
        salesByProduct.get(pid)!.totalSold += line.product_uom_qty || 0;
      });

      // Calcola media giornaliera
      salesByProduct.forEach((stat) => {
        stat.avgDaily = stat.totalSold / 90; // 90 giorni
      });
    }

    // 6. Carica stock attuale per i prodotti
    const products = await rpc.searchRead(
      'product.product',
      [['id', 'in', [...orderedProductIds, ...supplierProductIds]]],
      ['id', 'name', 'qty_available', 'uom_id'],
      0
    );

    const productStock = new Map<number, { stock: number; name: string; uom: string }>();
    products.forEach((p: any) => {
      productStock.set(p.id, {
        stock: p.qty_available || 0,
        name: p.name,
        uom: p.uom_id ? p.uom_id[1] : 'Pz'
      });
    });

    // 7. Analizza ogni prodotto ordinato
    const analyzedProducts = orderLines.map((line: any) => {
      const pid = line.product_id[0];
      const stock = productStock.get(pid);
      const sales = salesByProduct.get(pid);

      const currentStock = stock?.stock || 0;
      const avgDailySales = sales?.avgDaily || 0;
      const qtyOrdered = line.product_qty || 0;
      const qtyPending = qtyOrdered - (line.qty_received || 0);

      // Calcola giorni di copertura con ordine
      const totalAfterOrder = currentStock + qtyPending;
      const daysOfCoverage = avgDailySales > 0 ? totalAfterOrder / avgDailySales : 999;

      // Quantità suggerita (copertura 30 giorni)
      const targetDays = 30;
      const suggestedQty = avgDailySales > 0
        ? Math.ceil(avgDailySales * targetDays) - currentStock
        : qtyOrdered;

      // Valutazione
      let evaluation: 'OK' | 'TROPPO_POCO' | 'TROPPO' | 'SCONOSCIUTO' = 'OK';
      let evaluationNote = '';

      if (avgDailySales === 0) {
        evaluation = 'SCONOSCIUTO';
        evaluationNote = 'Nessuna vendita negli ultimi 3 mesi';
      } else if (daysOfCoverage < 14) {
        evaluation = 'TROPPO_POCO';
        evaluationNote = `Solo ${Math.round(daysOfCoverage)} giorni di copertura`;
      } else if (daysOfCoverage > 60) {
        evaluation = 'TROPPO';
        evaluationNote = `${Math.round(daysOfCoverage)} giorni di copertura (troppo)`;
      } else {
        evaluationNote = `${Math.round(daysOfCoverage)} giorni di copertura`;
      }

      return {
        id: pid,
        name: line.product_id[1],
        lineId: line.id,
        qtyOrdered,
        qtyReceived: line.qty_received || 0,
        qtyPending,
        priceUnit: line.price_unit,
        uom: line.product_uom ? line.product_uom[1] : 'Pz',
        currentStock,
        avgDailySales: Math.round(avgDailySales * 100) / 100,
        daysOfCoverage: Math.round(daysOfCoverage),
        suggestedQty: Math.max(0, suggestedQty),
        evaluation,
        evaluationNote
      };
    });

    // 8. Trova prodotti MANCANTI (comprati spesso da questo fornitore ma non in questo ordine)
    const missingProducts: any[] = [];

    productPurchaseCount.forEach((stat, pid) => {
      // Salta se già nell'ordine
      if (orderedProductIds.includes(pid)) return;

      // Salta se comprato meno di 2 volte
      if (stat.count < 2) return;

      const stock = productStock.get(pid);
      const sales = salesByProduct.get(pid);

      const currentStock = stock?.stock || 0;
      const avgDailySales = sales?.avgDaily || 0;

      // Calcola giorni rimanenti
      const daysRemaining = avgDailySales > 0 ? currentStock / avgDailySales : 999;

      // Se meno di 14 giorni, suggerisci di aggiungere
      if (daysRemaining < 14 && avgDailySales > 0) {
        const suggestedQty = Math.ceil(avgDailySales * 30) - currentStock;

        missingProducts.push({
          id: pid,
          name: stat.name,
          currentStock: Math.round(currentStock),
          avgDailySales: Math.round(avgDailySales * 100) / 100,
          daysRemaining: Math.round(daysRemaining),
          suggestedQty: Math.max(1, suggestedQty),
          purchaseCount: stat.count,
          uom: stock?.uom || 'Pz'
        });
      }
    });

    // Ordina per urgenza (meno giorni prima)
    missingProducts.sort((a, b) => a.daysRemaining - b.daysRemaining);

    // 9. Calcola summary
    const okCount = analyzedProducts.filter((p: any) => p.evaluation === 'OK').length;
    const tooLittleCount = analyzedProducts.filter((p: any) => p.evaluation === 'TROPPO_POCO').length;
    const tooMuchCount = analyzedProducts.filter((p: any) => p.evaluation === 'TROPPO').length;

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        name: order.name,
        supplier: {
          id: supplierId,
          name: supplierName
        },
        dateOrder: order.date_order,
        state: order.state,
        amountTotal: order.amount_total,
        currency: order.currency_id ? order.currency_id[1] : 'CHF'
      },
      analysis: {
        products: analyzedProducts,
        missingProducts: missingProducts.slice(0, 10), // Top 10
        summary: {
          totalProducts: analyzedProducts.length,
          ok: okCount,
          tooLittle: tooLittleCount,
          tooMuch: tooMuchCount,
          missingCount: missingProducts.length
        }
      }
    });

  } catch (error: any) {
    console.error('❌ Errore:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
