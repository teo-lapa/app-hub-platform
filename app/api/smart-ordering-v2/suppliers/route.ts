/**
 * API Smart Ordering V2 - REAL-TIME from Odoo
 *
 * Carica dati REALI da Odoo + usa prediction engine migliorato
 * NO JSON, NO CACHE, NO DEMO - SOLO DATI VERI
 */

import { NextRequest, NextResponse } from 'next/server';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';
import { predictionEngine } from '@/lib/smart-ordering/prediction-engine';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('🚀 [Smart Ordering V2] Caricamento REAL-TIME da Odoo...');

    // Get session
    const sessionId = request.cookies.get('odoo_session_id')?.value;
    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Session non trovata - Rifare login'
      }, { status: 401 });
    }

    const rpc = createOdooRPCClient(sessionId);

    // 1. Carica prodotti con stock
    console.log('📦 Caricamento prodotti...');
    const products = await rpc.searchRead(
      'product.product',
      [
        ['type', '=', 'product'],
        ['active', '=', true]
      ],
      ['id', 'name', 'default_code', 'qty_available', 'uom_id', 'list_price', 'seller_ids', 'product_tmpl_id'],
      0
    );

    console.log(`✅ ${products.length} prodotti caricati`);

    // 2. Calcola data 3 mesi fa
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    // 3. Carica ultimi ordini acquisto (ultimi 3 mesi) per determinare fornitore principale
    console.log('📋 Caricamento ordini acquisto recenti...');
    const purchaseOrders = await rpc.searchRead(
      'purchase.order.line',
      [
        ['order_id.date_order', '>=', threeMonthsAgo.toISOString().split('T')[0]],
        ['order_id.state', 'in', ['purchase', 'done']],
        ['product_id', 'in', products.map((p: any) => p.id)]
      ],
      ['product_id', 'partner_id', 'order_id', 'product_qty', 'date_order'],
      0
    );

    console.log(`✅ ${purchaseOrders.length} righe ordini acquisto caricate`);

    // 4. Calcola fornitore principale per ogni prodotto (Opzione 3: Ordini Recenti)
    const supplierMap = new Map();
    const productPurchases = new Map(); // product_id -> [{supplierId, qty, date, orderId}]

    purchaseOrders.forEach((line: any) => {
      const productId = line.product_id[0];
      if (!productPurchases.has(productId)) {
        productPurchases.set(productId, []);
      }
      productPurchases.get(productId).push({
        supplierId: line.partner_id[0],
        supplierName: line.partner_id[1],
        qty: line.product_qty || 0,
        date: line.date_order,
        orderId: line.order_id[0]
      });
    });

    // Per ogni prodotto, trova fornitore principale
    productPurchases.forEach((purchases, productId) => {
      // Ordina per data decrescente (più recente prima)
      purchases.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // LOGICA OPZIONE 3: Fornitore dell'ultimo ordine + almeno 2 ordini negli ultimi 3 mesi
      const supplierStats = new Map(); // supplierId -> {count, totalQty, lastDate}

      purchases.forEach((p: any) => {
        if (!supplierStats.has(p.supplierId)) {
          supplierStats.set(p.supplierId, {
            supplierId: p.supplierId,
            supplierName: p.supplierName,
            count: 0,
            totalQty: 0,
            lastDate: null
          });
        }
        const stat = supplierStats.get(p.supplierId);
        stat.count++;
        stat.totalQty += p.qty;
        if (!stat.lastDate || new Date(p.date) > new Date(stat.lastDate)) {
          stat.lastDate = p.date;
        }
      });

      // Trova fornitore principale: ultimo ordine + almeno 2 ordini totali
      const lastSupplier = purchases[0]; // Più recente
      const lastSupplierStats = supplierStats.get(lastSupplier.supplierId);

      let mainSupplier = null;

      if (lastSupplierStats && lastSupplierStats.count >= 2) {
        // Ultimo fornitore ha almeno 2 ordini → è il principale
        mainSupplier = lastSupplierStats;
      } else {
        // Prendi chi ha fatto più ordini (frequenza)
        const sortedByCount = Array.from(supplierStats.values()).sort((a: any, b: any) => b.count - a.count);
        mainSupplier = sortedByCount[0];
      }

      if (mainSupplier) {
        // Trova il prodotto per ottenere product_tmpl_id
        const product = products.find((p: any) => p.id === productId);
        const templateId = product?.product_tmpl_id ? product.product_tmpl_id[0] : productId;

        supplierMap.set(templateId, {
          id: mainSupplier.supplierId,
          name: mainSupplier.supplierName,
          leadTime: 7, // Default, verrà sovrascritto se disponibile
          price: 0
        });
      }
    });

    console.log(`✅ ${supplierMap.size} prodotti con fornitore principale identificato`);

    // 5. Carica vendite ultimi 3 mesi
    console.log('📊 Caricamento vendite...');
    const sales = await rpc.searchRead(
      'sale.order.line',
      [
        ['order_id.effective_date', '>=', threeMonthsAgo.toISOString().split('T')[0]],
        ['order_id.state', 'in', ['sale', 'done']],
        ['product_id', 'in', products.map((p: any) => p.id)]
      ],
      ['product_id', 'product_uom_qty', 'order_id'],
      0
    );

    console.log(`✅ ${sales.length} righe vendite caricate`);

    // 6. Calcola vendite per prodotto
    const salesByProduct = new Map();
    sales.forEach((line: any) => {
      const pid = line.product_id[0];
      if (!salesByProduct.has(pid)) {
        salesByProduct.set(pid, []);
      }
      salesByProduct.get(pid).push(line.product_uom_qty || 0);
    });

    // 7. Analizza ogni prodotto
    const analyzedProducts = [];

    for (const product of products) {
      const soldQty = salesByProduct.get(product.id) || [];
      if (soldQty.length === 0) continue; // Skip senza vendite

      const totalSold = soldQty.reduce((sum: number, q: number) => sum + q, 0);
      const avgDailySales = totalSold / 90; // 90 giorni

      if (avgDailySales === 0) continue;

      // USA product_tmpl_id per mappare fornitore (non product.id!)
      const templateId = product.product_tmpl_id ? product.product_tmpl_id[0] : product.id;
      const supplier = supplierMap.get(templateId);
      if (!supplier) continue; // Skip senza fornitore

      // Calcola variabilità
      const mean = avgDailySales;
      const variance = soldQty.reduce((sum: number, q: number) => sum + Math.pow(q - mean, 2), 0) / soldQty.length;
      const stdDev = Math.sqrt(variance);
      const variability = mean > 0 ? stdDev / mean : 0.5;

      // USA PREDICTION ENGINE MIGLIORATO
      const prediction = predictionEngine.predict({
        productId: product.id,
        productName: product.name,
        currentStock: product.qty_available || 0,
        avgDailySales,
        variability,
        leadTimeDays: supplier.leadTime,
        supplierInfo: {
          id: supplier.id,
          name: supplier.name,
          leadTime: supplier.leadTime,
          reliability: 70 // Default
        },
        productPrice: product.list_price
      });

      analyzedProducts.push({
        id: product.id,
        name: product.name,
        currentStock: product.qty_available || 0,
        avgDailySales,
        daysRemaining: prediction.daysRemaining,
        urgencyLevel: prediction.urgencyLevel,
        recommendedQuantity: prediction.recommendedQuantity,
        totalSold3Months: totalSold,
        uom: product.uom_id ? product.uom_id[1] : 'Units',
        listPrice: product.list_price,
        supplier: {
          id: supplier.id,
          name: supplier.name,
          leadTime: supplier.leadTime
        }
      });
    }

    console.log(`✅ ${analyzedProducts.length} prodotti analizzati`);

    // 8. Raggruppa per fornitore
    const supplierGroups = new Map();

    analyzedProducts.forEach((p: any) => {
      const sid = p.supplier.id;

      if (!supplierGroups.has(sid)) {
        supplierGroups.set(sid, {
          id: sid,
          name: p.supplier.name,
          leadTime: p.supplier.leadTime,
          criticalCount: 0,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0,
          totalProducts: 0,
          totalKg: 0,
          totalPz: 0,
          estimatedValue: 0,
          products: []
        });
      }

      const group = supplierGroups.get(sid);

      // Conta urgency
      if (['CRITICAL', 'EMERGENCY'].includes(p.urgencyLevel)) {
        group.criticalCount++;
      } else if (p.urgencyLevel === 'HIGH') {
        group.highCount++;
      } else if (p.urgencyLevel === 'MEDIUM') {
        group.mediumCount++;
      } else {
        group.lowCount++;
      }

      group.totalProducts++;

      // Calcola totali (solo CRITICAL/HIGH)
      if (['CRITICAL', 'EMERGENCY', 'HIGH'].includes(p.urgencyLevel) && p.recommendedQuantity > 0) {
        if (p.uom.toLowerCase().includes('kg')) {
          group.totalKg += p.recommendedQuantity;
        } else {
          group.totalPz += p.recommendedQuantity;
        }
        group.estimatedValue += p.listPrice * p.recommendedQuantity;
      }

      // Aggiungi prodotto
      group.products.push({
        id: p.id,
        name: p.name,
        currentStock: p.currentStock,
        avgDailySales: p.avgDailySales,
        daysRemaining: p.daysRemaining,
        urgencyLevel: p.urgencyLevel,
        totalSold3Months: p.totalSold3Months,
        suggestedQty: p.recommendedQuantity,
        uom: p.uom,
        avgPrice: p.listPrice,
        supplier: {
          name: p.supplier.name,
          leadTime: p.supplier.leadTime
        }
      });
    });

    // 9. Converti in array e ordina
    const suppliers = Array.from(supplierGroups.values());
    suppliers.sort((a, b) => {
      if (a.criticalCount !== b.criticalCount) return b.criticalCount - a.criticalCount;
      if (a.highCount !== b.highCount) return b.highCount - a.highCount;
      return b.estimatedValue - a.estimatedValue;
    });

    // Calcola fornitori urgenti per statistiche
    const urgentSuppliers = suppliers.filter(s => s.criticalCount > 0 || s.highCount > 0);

    const executionTime = Date.now() - startTime;
    console.log(`✅ Analisi completata in ${executionTime}ms`);
    console.log(`📊 Totale fornitori: ${suppliers.length}, Urgenti: ${urgentSuppliers.length}`);

    return NextResponse.json({
      success: true,
      analyzedAt: new Date().toISOString(),
      totalSuppliers: suppliers.length,
      urgentSuppliers: urgentSuppliers.length,
      suppliers: suppliers, // Ritorna TUTTI i fornitori, non solo urgenti
      summary: {
        totalCritical: suppliers.reduce((sum, s) => sum + s.criticalCount, 0),
        totalHigh: suppliers.reduce((sum, s) => sum + s.highCount, 0),
        totalEstimatedValue: suppliers.reduce((sum, s) => sum + s.estimatedValue, 0)
      },
      executionTime
    });

  } catch (error: any) {
    console.error('❌ Errore:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
