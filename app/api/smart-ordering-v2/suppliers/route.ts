/**
 * API Smart Ordering V2 - REAL-TIME from Odoo
 *
 * Carica dati REALI da Odoo + usa prediction engine migliorato
 * NO JSON, NO CACHE, NO DEMO - SOLO DATI VERI
 */

import { NextRequest, NextResponse } from 'next/server';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';
import { predictionEngine } from '@/lib/smart-ordering/prediction-engine';
import { sql } from '@vercel/postgres';

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

    // 1. Load PRE-ORDINE tag ID to exclude preorder products
    console.log('🔍 Caricamento tag PRE-ORDINE...');
    let preOrderTagId: number | null = null;
    try {
      const tags = await rpc.searchRead(
        'product.tag',
        [['name', 'ilike', 'PRE-ORDINE']],
        ['id', 'name'],
        1
      );
      if (tags && tags.length > 0) {
        preOrderTagId = tags[0].id;
        console.log(`✅ Found PRE-ORDINE tag ID: ${preOrderTagId}`);
      }
    } catch (error) {
      console.warn('⚠️ Could not load PRE-ORDINE tag:', error);
    }

    // 2. Get templates with PRE-ORDINE tag
    let excludedTemplateIds: number[] = [];
    if (preOrderTagId) {
      console.log('🔍 Caricamento template con tag PRE-ORDINE...');
      const preorderTemplates = await rpc.searchRead(
        'product.template',
        [
          ['product_tag_ids', 'in', [preOrderTagId]],
          ['active', '=', true]
        ],
        ['id'],
        0
      );
      excludedTemplateIds = preorderTemplates.map((t: any) => t.id);
      console.log(`🚫 Excluding ${excludedTemplateIds.length} preorder templates`);
    }

    // 3. Carica prodotti con stock (excluding preorder products)
    console.log('📦 Caricamento prodotti...');
    const productFilter: any[] = [
      ['type', '=', 'product'],
      ['active', '=', true]
    ];

    if (excludedTemplateIds.length > 0) {
      productFilter.push(['product_tmpl_id', 'not in', excludedTemplateIds]);
    }

    const products = await rpc.searchRead(
      'product.product',
      productFilter,
      ['id', 'name', 'default_code', 'qty_available', 'uom_id', 'list_price', 'seller_ids', 'product_tmpl_id'],
      0
    );

    console.log(`✅ ${products.length} prodotti caricati (excluding preorder products)`);

    // 3.5. Carica informazioni fornitori per LEAD TIME REALE da product.supplierinfo
    console.log('🚚 Caricamento lead time reali da product.supplierinfo...');
    const productIds = products.map((p: any) => p.id);

    // Extract all seller_ids from products to query supplierinfo
    const allSellerIds: number[] = [];
    products.forEach((p: any) => {
      if (p.seller_ids && Array.isArray(p.seller_ids)) {
        allSellerIds.push(...p.seller_ids);
      }
    });

    // Query product.supplierinfo to get REAL delay field
    const productLeadTimes = new Map<number, { supplierId: number; delay: number; price: number }[]>();

    if (allSellerIds.length > 0) {
      const supplierInfoRecords = await rpc.searchRead(
        'product.supplierinfo',
        [['id', 'in', allSellerIds]],
        ['id', 'partner_id', 'product_tmpl_id', 'delay', 'price', 'min_qty'],
        0
      );

      // Map product_tmpl_id -> supplier info with delay
      supplierInfoRecords.forEach((info: any) => {
        const tmplId = info.product_tmpl_id ? info.product_tmpl_id[0] : null;
        if (!tmplId) return;

        if (!productLeadTimes.has(tmplId)) {
          productLeadTimes.set(tmplId, []);
        }

        productLeadTimes.get(tmplId)!.push({
          supplierId: info.partner_id[0],
          delay: info.delay || 3, // Default 3 se non specificato
          price: info.price || 0
        });
      });

      console.log(`✅ Lead time reali caricati per ${productLeadTimes.size} templates da Odoo`);
    }

    // Load ALL incoming stock moves at once (batch query for efficiency)
    console.log('📦 Caricamento merce in arrivo...');
    const productIdsForMoves = products.map((p: any) => p.id);

    const incomingMoves = await rpc.searchRead(
      'stock.move',
      [
        ['product_id', 'in', productIdsForMoves],
        ['picking_code', '=', 'incoming'],
        ['state', 'in', ['confirmed', 'assigned', 'waiting']],
      ],
      ['product_id', 'product_uom_qty', 'date'],
      0
    );

    // Aggregate by product_id
    const incomingByProduct = new Map();
    incomingMoves.forEach((move: any) => {
      const productId = move.product_id[0];
      const existing = incomingByProduct.get(productId) || { qty: 0, earliestDate: null };
      existing.qty += move.product_uom_qty || 0;

      // Track earliest arrival date
      if (move.date) {
        const moveDate = new Date(move.date);
        if (!existing.earliestDate || moveDate < existing.earliestDate) {
          existing.earliestDate = moveDate;
        }
      }

      incomingByProduct.set(productId, existing);
    });

    console.log(`✅ Trovati ${incomingMoves.length} movimenti in arrivo per ${incomingByProduct.size} prodotti`);

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

      let mainSupplier: any = null;

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

        // Cerca LEAD TIME REALE da product.supplierinfo
        let realLeadTime = 7; // Default fallback
        const supplierInfos = productLeadTimes.get(templateId);
        if (supplierInfos) {
          // Trova l'info del fornitore principale
          const mainSupplierInfo = supplierInfos.find(si => si.supplierId === mainSupplier.supplierId);
          if (mainSupplierInfo && mainSupplierInfo.delay > 0) {
            realLeadTime = mainSupplierInfo.delay; // USA DELAY REALE DA ODOO!
          }
        }

        supplierMap.set(templateId, {
          id: mainSupplier.supplierId,
          name: mainSupplier.supplierName,
          leadTime: realLeadTime, // Lead time REALE da Odoo!
          price: 0
        });
      }
    });

    console.log(`✅ ${supplierMap.size} prodotti con fornitore principale identificato`);

    // 4.5. Carica cadenze fornitori dal database
    console.log('📅 Caricamento cadenze fornitori...');
    const cadencesResult = await sql`
      SELECT odoo_supplier_id, cadence_value, average_lead_time_days, is_active
      FROM supplier_avatars
      WHERE is_active = true AND cadence_value IS NOT NULL
    `;

    const supplierCadences = new Map();
    cadencesResult.rows.forEach((row: any) => {
      supplierCadences.set(row.odoo_supplier_id, {
        cadenceDays: row.cadence_value,
        leadTimeDays: row.average_lead_time_days || 3
      });
    });
    console.log(`✅ ${supplierCadences.size} cadenze caricate dal database`);

    // 4.6. Carica prodotti con assegnazioni pre-ordine attive (per mostrare come "favoriti")
    console.log('⭐ Caricamento prodotti con pre-ordini attivi...');
    let productsWithActivePreorders = new Set<number>();
    try {
      const preorderAssignments = await sql`
        SELECT DISTINCT product_id
        FROM preorder_customer_assignments
        WHERE (is_ordered = FALSE OR is_ordered IS NULL)
        AND quantity > 0
      `;
      productsWithActivePreorders = new Set(preorderAssignments.rows.map(r => r.product_id));
      console.log(`⭐ ${productsWithActivePreorders.size} prodotti con pre-ordini attivi`);
    } catch (error) {
      console.warn('⚠️ Errore caricamento pre-ordini attivi:', error);
    }

    // Aggiorna supplierMap con le cadenze e usa lead time DB solo come FALLBACK
    supplierMap.forEach((supplier: any, templateId: any) => {
      const cadence = supplierCadences.get(supplier.id);
      if (cadence) {
        // USA lead time da DB SOLO se non abbiamo quello reale da Odoo (ancora a default 7)
        // Il lead time reale da Odoo ha la priorità!
        if (supplier.leadTime === 7) {
          supplier.leadTime = cadence.leadTimeDays; // Fallback dal DB
        }
        supplier.cadenceDays = cadence.cadenceDays;
      }
    });

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

      // Add incoming quantity to current stock
      const incomingData = incomingByProduct.get(product.id);
      const incomingQty = incomingData?.qty || 0;
      const effectiveStock = (product.qty_available || 0) + incomingQty;

      if (incomingQty > 0) {
        console.log(`📊 Prodotto ${product.id} (${product.name}): Stock ${product.qty_available} + In arrivo ${incomingQty} = ${effectiveStock}`);
      }

      // USA PREDICTION ENGINE MIGLIORATO con stock effettivo
      const prediction = predictionEngine.predict({
        productId: product.id,
        productName: product.name,
        currentStock: effectiveStock, // Use adjusted stock!
        avgDailySales,
        variability,
        leadTimeDays: supplier.leadTime,
        supplierInfo: {
          id: supplier.id,
          name: supplier.name,
          leadTime: supplier.leadTime,
          cadenceDays: supplier.cadenceDays, // NUOVA: cadenza fornitore dal DB
          reliability: 70 // Default
        },
        productPrice: product.list_price
      });

      analyzedProducts.push({
        id: product.id,
        name: product.name,
        currentStock: product.qty_available || 0,
        incomingQty: incomingQty, // Add incoming data to response
        incomingDate: incomingData?.earliestDate,
        effectiveStock: effectiveStock, // Total available including incoming
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
        incomingQty: p.incomingQty || 0,
        incomingDate: p.incomingDate,
        effectiveStock: p.effectiveStock,
        avgDailySales: p.avgDailySales,
        daysRemaining: p.daysRemaining,
        urgencyLevel: p.urgencyLevel,
        totalSold3Months: p.totalSold3Months,
        suggestedQty: p.recommendedQuantity,
        uom: p.uom,
        avgPrice: p.listPrice,
        isPreOrder: false, // Prodotti caricati qui NON sono PRE-ORDINE (già filtrati)
        hasActivePreorder: productsWithActivePreorders.has(p.id), // ⭐ Flag per prodotti con pre-ordini attivi
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
