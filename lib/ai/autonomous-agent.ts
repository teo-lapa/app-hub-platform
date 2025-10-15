/**
 * Agente Autonomo per Ordini Fornitori
 *
 * Esegue analisi giornaliera automatica:
 * 1. Carica tutti prodotti da Odoo
 * 2. Analizza con Claude AI
 * 3. Identifica prodotti critici
 * 4. Prepara ordini suggeriti
 * 5. Salva risultati per dashboard
 */

import { getClaudeAIService, ProductAnalysisInput, BulkAnalysisResult } from './claude-service';
import { getOdooSessionId } from '@/lib/odoo/odoo-helper';

// ============================================================================
// TYPES
// ============================================================================

export interface AgentExecutionResult {
  success: boolean;
  executionId: string;
  startedAt: string;
  completedAt: string;
  duration: number; // millisecondi

  // Dati analisi
  productsAnalyzed: number;
  criticalCount: number;
  warningCount: number;
  okCount: number;

  // Risultati AI
  aiAnalysis: BulkAnalysisResult;

  // Ordini suggeriti
  suggestedOrders: SuggestedOrder[];
  totalOrderValue: number;

  // Errori/Warning
  errors: string[];
  warnings: string[];
}

export interface SuggestedOrder {
  supplierId: number;
  supplierName: string;
  products: {
    id: number;
    name: string;
    code: string;
    currentStock: number;
    recommendedQuantity: number;
    urgencyLevel: string;
    estimatedValue: number;
    aiReasoning: string;
  }[];
  totalQuantity: number;
  totalValue: number;
  urgencyLevel: 'critica' | 'alta' | 'media' | 'bassa';
}

// ============================================================================
// ODOO DATA LOADER
// ============================================================================

class OdooDataLoader {
  private odooUrl: string;
  private dbName: string;
  private sessionId: string | null = null;
  private uid: number | null = null;

  constructor() {
    this.odooUrl = process.env.ODOO_URL || '';
    this.dbName = process.env.ODOO_DB || '';

    if (!this.odooUrl || !this.dbName) {
      throw new Error('❌ Configurazione Odoo mancante in .env');
    }
  }

  /**
   * Autentica con Odoo usando session_id utente
   */
  private async authenticate(): Promise<void> {
    if (this.sessionId) {
      return; // Già autenticato
    }

    console.log('🔑 Ottengo session_id utente...');

    const userSessionId = await getOdooSessionId();
    if (!userSessionId) {
      throw new Error('Sessione Odoo non valida. L\'utente deve effettuare il login.');
    }

    this.sessionId = userSessionId;
    this.uid = 1; // UID non più necessario con session_id utente

    console.log('✅ Session ID utente ottenuto');
  }

  /**
   * RPC call to Odoo
   */
  private async rpc(model: string, method: string, args: any[]): Promise<any> {
    await this.authenticate();

    // Per sviluppo locale: disabilita verifica SSL se necessario
    const fetchOptions: any = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${this.sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: model,
          method: method,
          args: args,
          kwargs: {}
        },
        id: Math.floor(Math.random() * 1000000)
      })
    };

    // Disabilita verifica SSL in sviluppo locale
    if (process.env.NODE_ENV === 'development') {
      const https = await import('https');
      fetchOptions.agent = new https.Agent({
        rejectUnauthorized: false
      });
    }

    const response = await fetch(`${this.odooUrl}/web/dataset/call_kw`, fetchOptions);

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.data?.message || data.error.message || 'Errore RPC');
    }

    return data.result;
  }

  /**
   * Search and read records
   */
  private async searchRead(
    model: string,
    domain: any[],
    fields: string[],
    limit?: number
  ): Promise<any[]> {
    const args: any = [domain, fields];
    if (limit) {
      args.push(0); // offset
      args.push(limit);
    }
    return await this.rpc(model, 'search_read', args);
  }

  /**
   * Carica storico vendite prodotto
   */
  async loadProductSalesHistory(productId: number, days: number = 60): Promise<any> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Carica sale.order.line
    const salesLines = await this.searchRead('sale.order.line', [
      ['product_id', '=', productId],
      ['create_date', '>=', startDateStr + ' 00:00:00']
    ], ['product_uom_qty', 'order_id', 'create_date', 'price_unit']);

    if (!salesLines || salesLines.length === 0) {
      return { dailySales: [], detailedHistory: [] };
    }

    // Carica ordini per ottenere clienti e date
    const orderIds = Array.from(new Set(
      salesLines.map((line: any) => line.order_id ? line.order_id[0] : null)
        .filter((id: any) => id)
    ));

    const orders = await this.searchRead('sale.order', [
      ['id', 'in', orderIds],
      ['state', 'in', ['sale', 'done']]
    ], ['partner_id', 'date_order', 'name']);

    // Mappa ordini
    const orderMap: any = {};
    orders.forEach((order: any) => {
      orderMap[order.id] = {
        customer: order.partner_id ? order.partner_id[1] : 'Cliente Sconosciuto',
        date: order.date_order ? order.date_order.split(' ')[0] : null
      };
    });

    // Raggruppa per giorno
    const salesByDay: any = {};
    const customersByDay: any = {};

    salesLines.forEach((line: any) => {
      const orderId = line.order_id ? line.order_id[0] : null;
      const orderInfo = orderMap[orderId];
      if (!orderInfo || !orderInfo.date) return;

      const date = orderInfo.date;
      const quantity = line.product_uom_qty || 0;
      const customer = orderInfo.customer;

      if (!salesByDay[date]) salesByDay[date] = 0;
      salesByDay[date] += quantity;

      if (!customersByDay[date]) customersByDay[date] = {};
      if (!customersByDay[date][customer]) customersByDay[date][customer] = 0;
      customersByDay[date][customer] += quantity;
    });

    // Crea array giornaliero
    const dailySales = [];
    const detailedHistory = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const dailyTotal = salesByDay[dateStr] || 0;
      dailySales.push(dailyTotal);

      const customers = [];
      if (customersByDay[dateStr]) {
        for (const [customer, qty] of Object.entries(customersByDay[dateStr])) {
          customers.push({ name: customer, quantity: qty as number });
        }
      }

      detailedHistory.push({
        date: dateStr,
        quantity: dailyTotal,
        customers: customers
      });
    }

    return { dailySales, detailedHistory };
  }

  /**
   * Carica info fornitore
   */
  async loadSupplierInfo(supplierInfoId: number): Promise<any> {
    try {
      const supplierInfo = await this.searchRead('product.supplierinfo', [
        ['id', '=', supplierInfoId]
      ], ['partner_id', 'delay', 'price']);

      if (supplierInfo && supplierInfo.length > 0) {
        const info = supplierInfo[0];
        return {
          id: info.partner_id[0],
          name: info.partner_id[1],
          leadTime: info.delay || 7,
          price: info.price || 0
        };
      }
    } catch (error) {
      console.error('Errore caricamento fornitore:', error);
    }
    return null;
  }

  /**
   * Carica tutti i prodotti che necessitano analisi
   */
  async loadProductsForAnalysis(minSalesThreshold: number = 1): Promise<ProductAnalysisInput[]> {
    console.log('🔄 Caricamento prodotti da Odoo...');

    // Carica prodotti con vendite recenti
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 60);
    const startDateStr = startDate.toISOString().split('T')[0];

    const salesLines = await this.searchRead('sale.order.line', [
      ['create_date', '>=', startDateStr + ' 00:00:00']
    ], ['product_id', 'product_uom_qty']);

    // Raggruppa per prodotto
    const productSales: Record<number, number> = {};
    salesLines.forEach((line: any) => {
      const productId = line.product_id[0];
      if (!productSales[productId]) productSales[productId] = 0;
      productSales[productId] += line.product_uom_qty || 0;
    });

    // Filtra prodotti con vendite sufficienti
    const productIds = Object.entries(productSales)
      .filter(([_, sales]) => sales >= minSalesThreshold)
      .map(([id, _]) => parseInt(id));

    console.log(`📦 Trovati ${productIds.length} prodotti con vendite recenti`);

    // Carica dettagli prodotti
    const products = await this.searchRead('product.product', [
      ['id', 'in', productIds]
    ], ['name', 'default_code', 'categ_id', 'seller_ids', 'qty_available', 'list_price']);

    // Elabora prodotti
    const results: ProductAnalysisInput[] = [];

    for (const product of products) {
      try {
        // Carica storico vendite
        const salesHistory = await this.loadProductSalesHistory(product.id, 60);

        if (salesHistory.detailedHistory.length === 0) continue;

        // Carica info fornitore
        let supplier = null;
        if (product.seller_ids && product.seller_ids.length > 0) {
          supplier = await this.loadSupplierInfo(product.seller_ids[0]);
        }

        results.push({
          productId: product.id,
          productName: product.name,
          productCode: product.default_code || `PROD-${product.id}`,
          category: product.categ_id ? product.categ_id[1] : 'Altro',
          supplier: supplier?.name || 'Nessun Fornitore',
          supplierId: supplier?.id || 0,
          currentStock: product.qty_available || 0,
          salesHistory: salesHistory.detailedHistory,
          leadTime: supplier?.leadTime || 7,
          supplierReliability: 90, // TODO: calcolare da storico
          unitPrice: supplier?.price || product.list_price || 0
        });

        console.log(`  ✅ ${product.name}`);
      } catch (error) {
        console.error(`  ❌ Errore elaborazione ${product.name}:`, error);
      }
    }

    console.log(`✅ Caricati ${results.length} prodotti per analisi`);
    return results;
  }
}

// ============================================================================
// AUTONOMOUS AGENT
// ============================================================================

export class AutonomousOrderAgent {
  private odooLoader: OdooDataLoader;
  private aiService: ReturnType<typeof getClaudeAIService>;
  private executionId: string;

  constructor() {
    this.odooLoader = new OdooDataLoader();
    this.aiService = getClaudeAIService();
    this.executionId = `exec-${Date.now()}`;
  }

  /**
   * Esegue analisi completa automatica
   */
  async execute(): Promise<AgentExecutionResult> {
    const startTime = Date.now();
    const startedAt = new Date().toISOString();
    const errors: string[] = [];
    const warnings: string[] = [];

    console.log('═══════════════════════════════════════════════════════════');
    console.log('🤖 AGENTE AUTONOMO ORDINI FORNITORI - AVVIO');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`ID Esecuzione: ${this.executionId}`);
    console.log(`Data/Ora: ${new Date().toLocaleString('it-IT')}`);
    console.log('');

    try {
      // STEP 1: Carica prodotti da Odoo
      console.log('📥 STEP 1: Caricamento dati da Odoo...');
      const products = await this.odooLoader.loadProductsForAnalysis(5);

      if (products.length === 0) {
        throw new Error('Nessun prodotto trovato per analisi');
      }

      console.log(`✅ Caricati ${products.length} prodotti\n`);

      // STEP 2: Analisi AI
      console.log('🤖 STEP 2: Analisi AI con Claude...');
      const aiAnalysis = await this.aiService.analyzeBulkProducts(products);
      console.log(`✅ Analisi completata\n`);

      // STEP 3: Genera ordini suggeriti
      console.log('📋 STEP 3: Generazione ordini suggeriti...');
      const suggestedOrders = this.generateSuggestedOrders(aiAnalysis);
      console.log(`✅ ${suggestedOrders.length} ordini preparati\n`);

      // STEP 4: Calcola metriche
      const totalOrderValue = suggestedOrders.reduce((sum, o) => sum + o.totalValue, 0);

      const completedAt = new Date().toISOString();
      const duration = Date.now() - startTime;

      // Log risultati
      console.log('═══════════════════════════════════════════════════════════');
      console.log('✅ ANALISI COMPLETATA');
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`Durata: ${(duration / 1000).toFixed(2)}s`);
      console.log(`Prodotti analizzati: ${products.length}`);
      console.log(`  - Critici: ${aiAnalysis.criticalProducts.length}`);
      console.log(`  - In attenzione: ${aiAnalysis.warningProducts.length}`);
      console.log(`  - OK: ${aiAnalysis.okProducts.length}`);
      console.log(`Ordini suggeriti: ${suggestedOrders.length}`);
      console.log(`Valore totale: €${totalOrderValue.toFixed(2)}`);
      console.log('═══════════════════════════════════════════════════════════\n');

      return {
        success: true,
        executionId: this.executionId,
        startedAt,
        completedAt,
        duration,
        productsAnalyzed: products.length,
        criticalCount: aiAnalysis.criticalProducts.length,
        warningCount: aiAnalysis.warningProducts.length,
        okCount: aiAnalysis.okProducts.length,
        aiAnalysis,
        suggestedOrders,
        totalOrderValue,
        errors,
        warnings
      };
    } catch (error: any) {
      const completedAt = new Date().toISOString();
      const duration = Date.now() - startTime;

      console.error('❌ ERRORE ESECUZIONE AGENTE:', error);

      errors.push(error.message);

      return {
        success: false,
        executionId: this.executionId,
        startedAt,
        completedAt,
        duration,
        productsAnalyzed: 0,
        criticalCount: 0,
        warningCount: 0,
        okCount: 0,
        aiAnalysis: {
          totalProducts: 0,
          criticalProducts: [],
          warningProducts: [],
          okProducts: [],
          totalRecommendedOrderValue: 0,
          overallRisks: [],
          overallOpportunities: [],
          executiveSummary: 'Analisi fallita',
          analyzedAt: new Date().toISOString()
        },
        suggestedOrders: [],
        totalOrderValue: 0,
        errors,
        warnings
      };
    }
  }

  /**
   * Genera ordini suggeriti raggruppati per fornitore
   */
  private generateSuggestedOrders(analysis: BulkAnalysisResult): SuggestedOrder[] {
    const ordersBySupplier: Record<string, any> = {};

    // Considera solo prodotti critici e warning
    const productsToOrder = [
      ...analysis.criticalProducts,
      ...analysis.warningProducts
    ];

    productsToOrder.forEach(product => {
      const key = `${product.productId}`; // TODO: usare supplierId quando disponibile

      if (!ordersBySupplier[key]) {
        ordersBySupplier[key] = {
          supplierId: 0, // TODO: ricavare da product
          supplierName: 'Fornitore', // TODO: ricavare da product
          products: [],
          totalQuantity: 0,
          totalValue: 0,
          urgencyLevel: 'bassa' as any
        };
      }

      ordersBySupplier[key].products.push({
        id: product.productId,
        name: product.productName,
        code: '', // TODO: aggiungere a AIAnalysisResult
        currentStock: 0, // TODO: aggiungere a AIAnalysisResult
        recommendedQuantity: product.recommendedQuantity,
        urgencyLevel: product.urgencyLevel,
        estimatedValue: product.estimatedOrderValue || 0,
        aiReasoning: product.reasoning
      });

      ordersBySupplier[key].totalQuantity += product.recommendedQuantity;
      ordersBySupplier[key].totalValue += product.estimatedOrderValue || 0;

      // Aggiorna urgency level (prendi la più alta)
      if (product.urgencyLevel === 'critica') {
        ordersBySupplier[key].urgencyLevel = 'critica';
      } else if (product.urgencyLevel === 'alta' && ordersBySupplier[key].urgencyLevel !== 'critica') {
        ordersBySupplier[key].urgencyLevel = 'alta';
      }
    });

    return Object.values(ordersBySupplier);
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Esegue agente e ritorna risultati
 */
export async function runAgent(): Promise<AgentExecutionResult> {
  const agent = new AutonomousOrderAgent();
  return await agent.execute();
}
