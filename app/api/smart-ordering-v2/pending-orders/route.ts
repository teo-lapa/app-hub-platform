/**
 * API Smart Ordering V2 - Ordini in Corso
 *
 * Recupera gli ordini di acquisto in stato:
 * - sent = Preventivo Inviato
 * - purchase = Ordine Confermato (ma non ancora ricevuto)
 *
 * Per ogni ordine mostra:
 * - Fornitore
 * - Prodotti ordinati
 * - Analisi: quantità corretta? altri prodotti da aggiungere?
 */

import { NextRequest, NextResponse } from 'next/server';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    console.log('📋 [Pending Orders] Caricamento ordini in corso...');

    const sessionId = request.cookies.get('odoo_session_id')?.value;
    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Session non trovata - Rifare login'
      }, { status: 401 });
    }

    const rpc = createOdooRPCClient(sessionId);

    // 1. Carica ordini di acquisto in corso (sent + purchase)
    // Escludi quelli con tutti i prodotti ricevuti
    const pendingOrders = await rpc.searchRead(
      'purchase.order',
      [
        ['state', 'in', ['sent', 'purchase']],
        ['company_id', '=', 1] // Solo LAPA
      ],
      [
        'id', 'name', 'partner_id', 'date_order', 'date_planned',
        'state', 'amount_total', 'currency_id', 'order_line',
        'invoice_status', 'receipt_status'
      ],
      0,
      'date_order desc'
    );

    console.log(`✅ Trovati ${pendingOrders.length} ordini in corso`);

    if (pendingOrders.length === 0) {
      return NextResponse.json({
        success: true,
        orders: [],
        totalOrders: 0
      });
    }

    // 2. Carica righe ordine per tutti gli ordini
    const allOrderLineIds: number[] = [];
    pendingOrders.forEach((order: any) => {
      if (order.order_line) {
        allOrderLineIds.push(...order.order_line);
      }
    });

    const orderLines = await rpc.searchRead(
      'purchase.order.line',
      [['id', 'in', allOrderLineIds]],
      [
        'id', 'order_id', 'product_id', 'name', 'product_qty',
        'qty_received', 'price_unit', 'price_subtotal', 'product_uom'
      ],
      0
    );

    // Mappa righe per ordine
    const linesByOrder = new Map<number, any[]>();
    orderLines.forEach((line: any) => {
      const orderId = line.order_id[0];
      if (!linesByOrder.has(orderId)) {
        linesByOrder.set(orderId, []);
      }
      linesByOrder.get(orderId)!.push(line);
    });

    // 3. Costruisci risposta con dettagli
    const enrichedOrders = pendingOrders.map((order: any) => {
      const lines = linesByOrder.get(order.id) || [];

      // Calcola quantità totale ordinata vs ricevuta
      const totalOrdered = lines.reduce((sum: number, l: any) => sum + (l.product_qty || 0), 0);
      const totalReceived = lines.reduce((sum: number, l: any) => sum + (l.qty_received || 0), 0);
      const pendingQty = totalOrdered - totalReceived;

      // Stato leggibile
      const stateLabels: Record<string, string> = {
        'draft': 'Bozza',
        'sent': 'Preventivo Inviato',
        'purchase': 'Confermato',
        'done': 'Completato',
        'cancel': 'Annullato'
      };

      return {
        id: order.id,
        name: order.name,
        supplier: {
          id: order.partner_id[0],
          name: order.partner_id[1]
        },
        dateOrder: order.date_order,
        datePlanned: order.date_planned,
        state: order.state,
        stateLabel: stateLabels[order.state] || order.state,
        currency: order.currency_id ? order.currency_id[1] : 'CHF',
        amountTotal: order.amount_total,
        products: lines.map((line: any) => ({
          id: line.product_id[0],
          name: line.product_id[1],
          description: line.name,
          qtyOrdered: line.product_qty,
          qtyReceived: line.qty_received,
          qtyPending: (line.product_qty || 0) - (line.qty_received || 0),
          priceUnit: line.price_unit,
          priceSubtotal: line.price_subtotal,
          uom: line.product_uom ? line.product_uom[1] : 'Pz'
        })),
        summary: {
          totalProducts: lines.length,
          totalOrdered,
          totalReceived,
          pendingQty,
          percentReceived: totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0
        }
      };
    });

    // Filtra ordini che hanno ancora prodotti da ricevere
    const ordersWithPending = enrichedOrders.filter((o: any) => o.summary.pendingQty > 0);

    return NextResponse.json({
      success: true,
      orders: ordersWithPending,
      totalOrders: ordersWithPending.length,
      allOrders: enrichedOrders.length
    });

  } catch (error: any) {
    console.error('❌ Errore:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
