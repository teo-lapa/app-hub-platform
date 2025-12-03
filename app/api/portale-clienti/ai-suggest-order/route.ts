import { NextRequest, NextResponse } from 'next/server';
import { callOdooAsAdmin } from '@/lib/odoo/admin-session';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

interface OrderLine {
  product_id: [number, string]; // [id, name]
  product_uom_qty: number;
  price_unit: number;
}

interface Order {
  id: number;
  name: string;
  date_order: string;
  order_line: number[];
  state: string;
}

interface ProductPurchase {
  productId: number;
  productName: string;
  date: Date;
  quantity: number;
}

interface ProductAnalysis {
  productId: number;
  productName: string;
  purchases: ProductPurchase[];
  averageQuantity: number;
  averageIntervalDays: number;
  lastPurchaseDate: Date;
  nextPredictedDate: Date;
  suggestedQuantity: number;
  confidence: 'high' | 'medium';
}

/**
 * GET /api/portale-clienti/ai-suggest-order
 *
 * Analizza lo storico ordini del cliente e suggerisce prodotti ricorsivi
 * da riordinare con quantità basata sulla media storica.
 *
 * Algoritmo:
 * 1. Recupera ordini delle ultime 5 settimane
 * 2. Identifica prodotti ordinati >= 2 volte (ricorsivi)
 * 3. Calcola intervallo medio tra ordini
 * 4. Calcola quantità media
 * 5. Prevede data prossimo ordine
 * 6. Suggerisce prodotti da riordinare entro 7 giorni
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🤖 [AI-ORDER] Inizio analisi storico ordini');

    // Extract and verify JWT token
    const token = request.cookies.get('token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Autenticazione richiesta' },
        { status: 401 }
      );
    }

    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    let decoded: any;

    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch (jwtError: any) {
      return NextResponse.json(
        { success: false, error: 'Token non valido' },
        { status: 401 }
      );
    }

    // Get partner ID from email
    const userPartners = await callOdooAsAdmin(
      'res.partner',
      'search_read',
      [],
      {
        domain: [['email', '=', decoded.email]],
        fields: ['id', 'name'],
        limit: 1
      }
    );

    if (!userPartners || userPartners.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Cliente non identificato' },
        { status: 401 }
      );
    }

    const partnerId = userPartners[0].id;
    console.log('✅ [AI-ORDER] Cliente identificato:', partnerId);

    // Calculate date range (last 5 weeks)
    const now = new Date();
    const fiveWeeksAgo = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000);
    const fromDate = fiveWeeksAgo.toISOString().split('T')[0];

    console.log('📅 [AI-ORDER] Analisi dal:', fromDate);

    // Get orders from Odoo
    const orders = await callOdooAsAdmin(
      'sale.order',
      'search_read',
      [],
      {
        domain: [
          ['partner_id', '=', partnerId],
          ['state', 'in', ['sale', 'done']],
          ['date_order', '>=', fromDate],
        ],
        fields: ['id', 'name', 'date_order', 'order_line', 'state'],
        order: 'date_order DESC',
        limit: 100,
      }
    ) as Order[];

    if (!orders || orders.length === 0) {
      console.log('⚠️ [AI-ORDER] Nessun ordine trovato nel periodo');
      return NextResponse.json({
        success: true,
        suggestions: [],
        message: 'Nessun ordine trovato nelle ultime 5 settimane'
      });
    }

    console.log(`✅ [AI-ORDER] Trovati ${orders.length} ordini`);

    // Get all order line IDs
    const allLineIds = orders.flatMap(o => o.order_line || []);

    if (allLineIds.length === 0) {
      return NextResponse.json({
        success: true,
        suggestions: [],
        message: 'Nessuna riga ordine trovata'
      });
    }

    // Get order lines details
    const orderLines = await callOdooAsAdmin(
      'sale.order.line',
      'search_read',
      [],
      {
        domain: [['id', 'in', allLineIds]],
        fields: ['id', 'order_id', 'product_id', 'product_uom_qty', 'price_unit'],
      }
    ) as (OrderLine & { id: number; order_id: [number, string] })[];

    console.log(`✅ [AI-ORDER] Recuperate ${orderLines.length} righe ordine`);

    // Build a map of order_id -> date
    const orderDateMap = new Map<number, string>();
    orders.forEach(o => {
      orderDateMap.set(o.id, o.date_order);
    });

    // Collect all purchases per product
    const productPurchases = new Map<number, ProductPurchase[]>();

    for (const line of orderLines) {
      if (!line.product_id) continue;

      const productId = line.product_id[0];
      const productName = line.product_id[1];
      const orderId = line.order_id[0];
      const orderDate = orderDateMap.get(orderId);

      if (!orderDate) continue;

      const purchase: ProductPurchase = {
        productId,
        productName,
        date: new Date(orderDate),
        quantity: line.product_uom_qty || 1,
      };

      if (!productPurchases.has(productId)) {
        productPurchases.set(productId, []);
      }
      productPurchases.get(productId)!.push(purchase);
    }

    console.log(`✅ [AI-ORDER] Analizzati ${productPurchases.size} prodotti unici`);

    // Analyze each product
    const analyses: ProductAnalysis[] = [];

    // Convert Map entries to array for iteration
    const productEntries = Array.from(productPurchases.entries());

    for (const [productId, purchases] of productEntries) {
      // Only consider products ordered >= 2 times (ricorsivi)
      if (purchases.length < 2) continue;

      // Sort by date ascending
      purchases.sort((a: ProductPurchase, b: ProductPurchase) => a.date.getTime() - b.date.getTime());

      // Calculate average interval between purchases
      const intervals: number[] = [];
      for (let i = 1; i < purchases.length; i++) {
        const daysDiff = Math.floor(
          (purchases[i].date.getTime() - purchases[i - 1].date.getTime()) /
            (1000 * 60 * 60 * 24)
        );
        intervals.push(daysDiff);
      }

      const averageInterval = intervals.length > 0
        ? Math.round(intervals.reduce((a: number, b: number) => a + b, 0) / intervals.length)
        : 7; // Default to 7 days if only one interval

      // Calculate average quantity
      const totalQuantity = purchases.reduce((sum: number, p: ProductPurchase) => sum + p.quantity, 0);
      const averageQuantity = Math.ceil(totalQuantity / purchases.length);

      // Get last purchase
      const lastPurchase = purchases[purchases.length - 1];

      // Predict next purchase date (with 10% margin - suggest earlier)
      const marginDays = Math.max(1, Math.floor(averageInterval * 0.1));
      const predictedInterval = averageInterval - marginDays;
      const nextPredictedDate = new Date(
        lastPurchase.date.getTime() + predictedInterval * 24 * 60 * 60 * 1000
      );

      // Confidence based on number of purchases
      const confidence: 'high' | 'medium' = purchases.length >= 3 ? 'high' : 'medium';

      analyses.push({
        productId,
        productName: lastPurchase.productName,
        purchases,
        averageQuantity,
        averageIntervalDays: averageInterval,
        lastPurchaseDate: lastPurchase.date,
        nextPredictedDate,
        suggestedQuantity: averageQuantity,
        confidence,
      });
    }

    console.log(`✅ [AI-ORDER] Trovati ${analyses.length} prodotti ricorsivi`);

    // Filter: suggest only products due within 7 days from now
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const suggestions = analyses
      .filter(a => a.nextPredictedDate <= sevenDaysFromNow)
      .sort((a, b) => a.nextPredictedDate.getTime() - b.nextPredictedDate.getTime())
      .map(a => ({
        productId: a.productId,
        productName: a.productName,
        suggestedQuantity: a.suggestedQuantity,
        averageInterval: a.averageIntervalDays,
        lastOrderDate: a.lastPurchaseDate.toISOString().split('T')[0],
        nextPredictedDate: a.nextPredictedDate.toISOString().split('T')[0],
        confidence: a.confidence,
        purchaseCount: a.purchases.length,
      }));

    console.log(`✅ [AI-ORDER] Suggeriti ${suggestions.length} prodotti da riordinare`);

    return NextResponse.json({
      success: true,
      suggestions,
      totalRecursiveProducts: analyses.length,
      analyzedOrders: orders.length,
      periodDays: 35,
    });

  } catch (error: any) {
    console.error('💥 [AI-ORDER] Errore:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Errore server' },
      { status: 500 }
    );
  }
}
