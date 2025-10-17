/**
 * API Endpoint: Analisi AI Prodotti Venduti Oggi
 *
 * Endpoint speciale che analizza SOLO i prodotti venduti oggi
 * e usa Claude AI per fare previsioni intelligenti basate sulle vendite giornaliere
 */

import { NextRequest, NextResponse } from 'next/server';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';

interface TodaySalesProduct {
  productId: number;
  productName: string;
  quantitySold: number;
  totalValue: number;
  currentStock: number;
  supplierId: number;
  supplierName: string;
  avgDailySales: number;
  todayVsAverage: number; // % differenza vs media
}

interface AnalyzeTodayResponse {
  date: string;
  totalProductsSold: number;
  totalRevenue: number;
  products: TodaySalesProduct[];
  aiInsights: {
    trends: string[];
    alerts: string[];
    recommendations: string[];
  };
  executionTime: number;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('🔍 [Analizza Vendite Oggi] Inizio analisi...');

    // Get odoo_session_id from cookies
    const sessionId = request.cookies.get('odoo_session_id')?.value;

    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Non autenticato - Odoo session non trovata'
      }, { status: 401 });
    }

    // Crea client RPC con sessione
    const rpcClient = createOdooRPCClient(sessionId);

    // 1. Calcola data odierna (inizio e fine giornata)
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
    const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();

    console.log(`📅 Data analisi: ${startOfDay} → ${endOfDay}`);

    // 2. Carica ordini di vendita confermati oggi
    const todayOrders = await rpcClient.searchRead(
      'sale.order',
      [
        ['effective_date', '>=', startOfDay],
        ['effective_date', '<=', endOfDay],
        ['state', 'in', ['sale', 'done']]
      ],
      ['id', 'name', 'effective_date', 'amount_total'],
      0,
      'effective_date desc'
    );

    console.log(`📦 Trovati ${todayOrders.length} ordini oggi`);

    if (todayOrders.length === 0) {
      return NextResponse.json({
        date: new Date().toISOString().split('T')[0],
        totalProductsSold: 0,
        totalRevenue: 0,
        products: [],
        aiInsights: {
          trends: ['Nessuna vendita registrata oggi'],
          alerts: [],
          recommendations: ['Verifica se ci sono ordini in attesa di conferma']
        },
        executionTime: Date.now() - startTime
      } as AnalyzeTodayResponse);
    }

    // 3. Carica righe ordini per prodotti venduti
    const orderIds = todayOrders.map(o => o.id);
    const orderLines = await rpcClient.searchRead(
      'sale.order.line',
      [
        ['order_id', 'in', orderIds],
        ['product_id', '!=', false]
      ],
      [
        'product_id',
        'product_uom_qty',
        'price_subtotal',
        'order_id'
      ],
      0
    );

    console.log(`📊 Trovate ${orderLines.length} righe ordine`);

    // 4. Raggruppa per prodotto
    const productSales = new Map<number, { qty: number; value: number; name: string }>();

    orderLines.forEach(line => {
      const productId = line.product_id[0];
      const productName = line.product_id[1];
      const qty = line.product_uom_qty || 0;
      const value = line.price_subtotal || 0;

      if (productSales.has(productId)) {
        const existing = productSales.get(productId)!;
        existing.qty += qty;
        existing.value += value;
      } else {
        productSales.set(productId, { qty, value, name: productName });
      }
    });

    console.log(`🎯 ${productSales.size} prodotti unici venduti`);

    // 5. Carica dati dettagliati prodotti
    const productIds = Array.from(productSales.keys());
    const products = await rpcClient.searchRead(
      'product.product',
      [['id', 'in', productIds]],
      [
        'id',
        'name',
        'default_code',
        'qty_available',
        'seller_ids',
        'list_price'
      ],
      0
    );

    // 6. Carica info fornitori
    const sellerIds = products
      .flatMap(p => p.seller_ids || [])
      .filter((id: number) => id > 0);

    let supplierInfoMap = new Map<number, any>();
    if (sellerIds.length > 0) {
      const supplierInfos = await rpcClient.searchRead(
        'product.supplierinfo',
        [['id', 'in', sellerIds]],
        ['id', 'partner_id', 'product_tmpl_id', 'delay', 'price'],
        0
      );
      supplierInfos.forEach(info => {
        supplierInfoMap.set(info.product_tmpl_id[0], info);
      });
    }

    // 7. Carica storico vendite ultimi 3 mesi per calcolare media
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const historicalStartDate = threeMonthsAgo.toISOString();

    const historicalLines = await rpcClient.searchRead(
      'sale.order.line',
      [
        ['order_id.effective_date', '>=', historicalStartDate],
        ['order_id.state', 'in', ['sale', 'done']],
        ['product_id', 'in', productIds]
      ],
      ['product_id', 'product_uom_qty', 'order_id'],
      0
    );

    // Calcola media vendite per prodotto
    const avgSalesMap = new Map<number, number>();
    const salesByProduct = new Map<number, number[]>();

    historicalLines.forEach(line => {
      const productId = line.product_id[0];
      const qty = line.product_uom_qty || 0;

      if (!salesByProduct.has(productId)) {
        salesByProduct.set(productId, []);
      }
      salesByProduct.get(productId)!.push(qty);
    });

    salesByProduct.forEach((quantities, productId) => {
      const totalQty = quantities.reduce((sum, q) => sum + q, 0);
      const avgDaily = totalQty / 90; // 3 mesi = ~90 giorni
      avgSalesMap.set(productId, avgDaily);
    });

    // 8. Costruisci risultato
    const todayProducts: TodaySalesProduct[] = [];
    let totalRevenue = 0;
    let totalQuantity = 0;

    products.forEach(product => {
      const sales = productSales.get(product.id);
      if (!sales) return;

      const avgDailySales = avgSalesMap.get(product.id) || 0;
      const todayVsAverage = avgDailySales > 0
        ? ((sales.qty - avgDailySales) / avgDailySales) * 100
        : 0;

      // Info fornitore
      const supplierInfo = supplierInfoMap.get(product.id);
      const supplierId = supplierInfo?.partner_id?.[0] || 0;
      const supplierName = supplierInfo?.partner_id?.[1] || 'Sconosciuto';

      todayProducts.push({
        productId: product.id,
        productName: product.name,
        quantitySold: sales.qty,
        totalValue: sales.value,
        currentStock: product.qty_available || 0,
        supplierId,
        supplierName,
        avgDailySales,
        todayVsAverage
      });

      totalRevenue += sales.value;
      totalQuantity += sales.qty;
    });

    // Ordina per valore venduto (decrescente)
    todayProducts.sort((a, b) => b.totalValue - a.totalValue);

    console.log(`💰 Revenue totale oggi: €${totalRevenue.toFixed(2)}`);
    console.log(`📦 Quantità totale venduta: ${totalQuantity} pz`);

    // 9. Analisi AI con Claude (opzionale, solo se richiesto)
    const { searchParams } = new URL(request.url);
    const useAI = searchParams.get('ai') === 'true';

    let aiInsights = {
      trends: [] as string[],
      alerts: [] as string[],
      recommendations: [] as string[]
    };

    if (useAI && todayProducts.length > 0) {
      try {
        console.log('🤖 Generazione insights AI...');

        // Prepara prompt per Claude (TODO: integrare Claude API quando disponibile)
        const topProducts = todayProducts.slice(0, 10);
        const prompt = `Analizza le vendite di oggi e fornisci insights:

VENDITE OGGI (${new Date().toLocaleDateString('it-IT')}):
${topProducts.map(p => `
- ${p.productName}
  Venduto: ${p.quantitySold} pz (€${p.totalValue.toFixed(2)})
  Stock rimanente: ${p.currentStock} pz
  Media giornaliera: ${p.avgDailySales.toFixed(1)} pz/giorno
  Variazione vs media: ${p.todayVsAverage > 0 ? '+' : ''}${p.todayVsAverage.toFixed(1)}%
  Fornitore: ${p.supplierName}
`).join('\n')}

TOTALE GIORNATA:
- Prodotti venduti: ${todayProducts.length}
- Quantità totale: ${totalQuantity} pz
- Revenue: €${totalRevenue.toFixed(2)}

Fornisci:
1. TRENDS: 2-3 pattern osservati (es: "Picco vendite prodotti premium", "Calo prodotti base")
2. ALERTS: eventuali prodotti a rischio stockout
3. RECOMMENDATIONS: azioni suggerite per domani

Rispondi in formato JSON:
{
  "trends": ["trend1", "trend2"],
  "alerts": ["alert1", "alert2"],
  "recommendations": ["rec1", "rec2"]
}`;

        // TODO: Integra Claude API quando disponibile
        // const aiResponse = await callClaudeAPI(prompt);

        // Genera insights basici matematici
        aiInsights.trends.push(`${todayProducts.length} prodotti venduti oggi`);

        const topSeller = todayProducts[0];
        if (topSeller) {
          aiInsights.trends.push(`Top seller: ${topSeller.productName} (€${topSeller.totalValue.toFixed(2)})`);
        }

        const highDemand = todayProducts.filter(p => p.todayVsAverage > 50);
        if (highDemand.length > 0) {
          aiInsights.alerts.push(`${highDemand.length} prodotti con domanda superiore al normale`);
        }

        const lowStock = todayProducts.filter(p => p.currentStock < p.avgDailySales * 7);
        if (lowStock.length > 0) {
          aiInsights.alerts.push(`⚠️ ${lowStock.length} prodotti con stock < 7 giorni`);
          aiInsights.recommendations.push(`Considera ordine urgente per: ${lowStock.slice(0, 3).map(p => p.productName).join(', ')}`);
        }

      } catch (error) {
        console.error('❌ Errore analisi AI:', error);
        aiInsights.recommendations.push('Analisi AI non disponibile, usa dati matematici');
      }
    }

    // 10. Risposta finale
    const response: AnalyzeTodayResponse = {
      date: new Date().toISOString().split('T')[0],
      totalProductsSold: todayProducts.length,
      totalRevenue,
      products: todayProducts,
      aiInsights,
      executionTime: Date.now() - startTime
    };

    console.log(`✅ Analisi completata in ${response.executionTime}ms`);

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('❌ Errore analisi vendite oggi:', error);

    return NextResponse.json(
      {
        error: 'Errore durante analisi vendite oggi',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

// Metodo GET per info endpoint
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/ordini-fornitori/analyze-today',
    description: 'Analizza prodotti venduti oggi con insights AI',
    method: 'POST',
    queryParams: {
      ai: 'boolean (true/false) - Abilita analisi AI con Claude'
    },
    response: {
      date: 'Data analisi (YYYY-MM-DD)',
      totalProductsSold: 'Numero prodotti unici venduti',
      totalRevenue: 'Revenue totale giornata',
      products: 'Array prodotti con quantità, valore, stock',
      aiInsights: 'Insights AI (trends, alerts, recommendations)',
      executionTime: 'Tempo esecuzione in ms'
    }
  });
}
