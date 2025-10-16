/**
 * LAPA Smart Ordering - AI Prediction Engine
 *
 * Engine INTELLIGENTE che usa:
 * - Lead time REALI dai fornitori
 * - Vendite REALI da consegne
 * - AI (Claude) per predizioni accurate
 * - Pattern ricorsivi clienti
 */

import Anthropic from '@anthropic-ai/sdk';
import { leadTimeAnalyzer, type LeadTimeAnalysis } from './lead-time-analyzer';
import { salesAnalyzer, type SalesHistory } from './sales-analyzer';
import { searchReadOdoo } from '@/lib/odoo/odoo-helper';

export interface ProductSnapshot {
  productId: number;
  productName: string;
  currentStock: number;

  // Supplier info
  supplierId: number;
  supplierName: string;
  supplierLeadTime: number;        // Lead time REALE
  supplierReliability: number;     // 0-100

  // Sales data
  avgDailySales: number;
  trend: 'growing' | 'stable' | 'declining' | 'volatile';
  trendPercentage: number;
  variability: number;
  peakDay: string;

  // Customer patterns
  recurringCustomers: number;
  totalCustomers: number;
}

export interface AIPrediction {
  productId: number;
  productName: string;

  // Critical metrics
  daysUntilStockout: number;
  urgencyLevel: 'EMERGENCY' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  urgencyColor: string;

  // Recommendations
  recommendedOrderQty: number;
  recommendedOrderDate: Date;
  safetyStock: number;
  reorderPoint: number;

  // Supplier
  suggestedSupplierId: number;
  supplierLeadTime: number;

  // AI Analysis
  aiReasoning: string;              // Spiegazione dettagliata AI
  confidenceScore: number;          // 0-100
  riskFactors: string[];            // Fattori di rischio identificati

  // Predictions
  next7DaysForecast: {
    day: string;
    date: Date;
    predictedSales: number;
    predictedStock: number;
    stockoutRisk: number;           // 0-100%
  }[];

  // Alternatives
  alternativeSuppliers?: {
    supplierId: number;
    supplierName: string;
    leadTime: number;
    reliability: number;
    reason: string;
  }[];
}

class AIPredictionEngine {
  private anthropic: Anthropic;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY non trovata in .env');
    }

    this.anthropic = new Anthropic({ apiKey });
  }

  /**
   * Determina urgenza basata su giorni vs lead time
   */
  private determineUrgency(
    daysUntilStockout: number,
    leadTime: number
  ): { level: AIPrediction['urgencyLevel']; color: string } {
    // EMERGENCY: Già senza stock o impossibile ordinare in tempo
    if (daysUntilStockout <= 0 || daysUntilStockout < leadTime * 0.5) {
      return { level: 'EMERGENCY', color: '#DC2626' };
    }

    // CRITICAL: Meno del lead time (rischio stock-out!)
    if (daysUntilStockout < leadTime) {
      return { level: 'CRITICAL', color: '#EF4444' };
    }

    // HIGH: Meno di 1.5x lead time
    if (daysUntilStockout < leadTime * 1.5) {
      return { level: 'HIGH', color: '#F97316' };
    }

    // MEDIUM: Meno di 2x lead time
    if (daysUntilStockout < leadTime * 2) {
      return { level: 'MEDIUM', color: '#EAB308' };
    }

    return { level: 'LOW', color: '#22C55E' };
  }

  /**
   * Calcola safety stock dinamico
   */
  private calculateSafetyStock(
    avgDailySales: number,
    leadTime: number,
    variability: number,
    reliability: number
  ): number {
    // Z-score basato su reliability fornitore
    // Alta reliability = Z 1.65 (95% service level)
    // Bassa reliability = Z 2.33 (99% service level)
    const zScore = reliability > 85 ? 1.65 : reliability > 70 ? 1.96 : 2.33;

    // Std Dev = avg × variability
    const stdDev = avgDailySales * variability;

    // Safety Stock = Z × σ × √LT
    const safetyStock = zScore * stdDev * Math.sqrt(leadTime);

    return Math.ceil(safetyStock);
  }

  /**
   * Usa AI (Claude) per predire vendite prossimi 7 giorni
   */
  private async predictNext7Days(
    product: ProductSnapshot,
    salesHistory: SalesHistory
  ): Promise<number[]> {
    console.log(`   🤖 AI predizione vendite prossimi 7 giorni...`);

    try {
      const prompt = `Sei un AI esperto in forecast di vendite per un'azienda di food delivery (LAPA).

PRODOTTO: ${product.productName}

DATI STORICI (ultimi 3 mesi):
- Vendite totali: ${salesHistory.totalSold3Months.toFixed(1)} unità
- Media giornaliera: ${salesHistory.avgDailySales.toFixed(1)} unità/giorno
- Trend: ${salesHistory.trend} (${salesHistory.trendPercentage.toFixed(1)}%)
- Variabilità: ${(salesHistory.variability * 100).toFixed(0)}%
- Peak day: ${salesHistory.peakDay}

PATTERN SETTIMANALE:
${Object.entries(salesHistory.weekdayPattern).map(([day, pct]) =>
  `- ${day}: ${pct.toFixed(1)}%`
).join('\n')}

VENDITE ULTIME 4 SETTIMANE:
${salesHistory.weeklyData.slice(-4).map(w =>
  `- Settimana ${w.weekStart.toLocaleDateString('it-IT')}: ${w.quantitySold.toFixed(1)} unità`
).join('\n')}

CLIENTI:
- Totale: ${salesHistory.totalCustomers}
- Ricorrenti: ${salesHistory.recurringCustomers} (${((salesHistory.recurringCustomers/salesHistory.totalCustomers)*100).toFixed(0)}%)

OGGI: ${new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}

COMPITO:
Prevedi le vendite per i prossimi 7 giorni (da oggi).
Considera:
1. Pattern settimanale storico
2. Trend recente
3. Stagionalità
4. Clienti ricorrenti
5. Variabilità

Rispondi SOLO con un array JSON di 7 numeri (vendite previste per ogni giorno):
[day1, day2, day3, day4, day5, day6, day7]

Esempio: [45.2, 52.1, 68.5, 48.3, 50.2, 55.0, 20.5]`;

      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        temperature: 0.3,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Risposta AI non testuale');
      }

      // Estrai JSON dalla risposta
      const jsonMatch = content.text.match(/\[[\d\s,\.]+\]/);
      if (!jsonMatch) {
        throw new Error('Formato risposta AI non valido');
      }

      const predictions = JSON.parse(jsonMatch[0]) as number[];

      if (predictions.length !== 7) {
        throw new Error('AI ha ritornato numero giorni errato');
      }

      console.log(`   ✅ AI predizioni: ${predictions.map(p => p.toFixed(1)).join(', ')}`);

      return predictions;

    } catch (error: any) {
      console.error(`   ⚠️  Errore AI prediction, uso fallback:`, error.message);

      // Fallback: usa pattern settimanale
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const today = new Date();
      const predictions: number[] = [];

      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        const dayName = days[date.getDay()];
        const dayPercent = salesHistory.weekdayPattern[dayName] / 100;
        const prediction = salesHistory.avgWeeklySales * dayPercent;
        predictions.push(prediction);
      }

      return predictions;
    }
  }

  /**
   * Usa AI per generare reasoning dettagliato
   */
  private async generateAIReasoning(
    product: ProductSnapshot,
    prediction: Partial<AIPrediction>,
    salesHistory: SalesHistory,
    leadTimeAnalysis: LeadTimeAnalysis
  ): Promise<{ reasoning: string; riskFactors: string[] }> {
    console.log(`   🤖 AI reasoning generation...`);

    try {
      const prompt = `Sei un AI esperto in supply chain management per LAPA (food delivery).

SITUAZIONE PRODOTTO: ${product.productName}

STOCK:
- Attuale: ${product.currentStock.toFixed(1)} unità
- Giorni rimanenti: ${prediction.daysUntilStockout!.toFixed(1)} giorni
- Urgenza: ${prediction.urgencyLevel}

FORNITORE: ${product.supplierName}
- Lead time medio: ${leadTimeAnalysis.medianLeadTime} giorni (range: ${leadTimeAnalysis.minLeadTime}-${leadTimeAnalysis.maxLeadTime})
- Affidabilità: ${leadTimeAnalysis.reliabilityScore.toFixed(0)}/100
- Puntualità consegne: ${leadTimeAnalysis.onTimeRate.toFixed(0)}%
- Variabilità: ${(leadTimeAnalysis.variabilityScore * 100).toFixed(0)}%

VENDITE (ultimi 3 mesi):
- Media: ${salesHistory.avgDailySales.toFixed(1)} unità/giorno
- Trend: ${salesHistory.trend} (${salesHistory.trendPercentage.toFixed(1)}%)
- Variabilità: ${(salesHistory.variability * 100).toFixed(0)}%
- Peak day: ${salesHistory.peakDay}

RACCOMANDAZIONE:
- Ordinare: ${prediction.recommendedOrderQty} unità
- Quando: ${prediction.recommendedOrderDate!.toLocaleDateString('it-IT')}
- Safety stock: ${prediction.safetyStock} unità

COMPITO:
1. Genera una spiegazione chiara e concisa (2-4 frasi) del perché serve ordinare
2. Identifica i principali fattori di rischio (se presenti)

Rispondi in formato JSON:
{
  "reasoning": "Spiegazione dettagliata...",
  "riskFactors": ["Fattore 1", "Fattore 2", ...]
}`;

      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        temperature: 0.5,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Risposta AI non testuale');
      }

      // Estrai JSON
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Formato risposta AI non valido');
      }

      const result = JSON.parse(jsonMatch[0]);

      console.log(`   ✅ AI reasoning generato`);

      return {
        reasoning: result.reasoning,
        riskFactors: result.riskFactors || []
      };

    } catch (error: any) {
      console.error(`   ⚠️  Errore AI reasoning, uso fallback:`, error.message);

      // Fallback: reasoning semplice
      const riskFactors: string[] = [];

      if (prediction.urgencyLevel === 'EMERGENCY') {
        riskFactors.push('Stock-out imminente o già verificato');
      }

      if (prediction.daysUntilStockout! < leadTimeAnalysis.medianLeadTime) {
        riskFactors.push('Giorni rimanenti < lead time fornitore');
      }

      if (leadTimeAnalysis.reliabilityScore < 70) {
        riskFactors.push('Fornitore poco affidabile');
      }

      if (salesHistory.trend === 'growing') {
        riskFactors.push('Trend in crescita - domanda in aumento');
      }

      if (salesHistory.trend === 'volatile') {
        riskFactors.push('Vendite molto variabili - difficile prevedere');
      }

      const reasoning = `Stock attuale di ${product.currentStock.toFixed(0)} unità dura circa ${prediction.daysUntilStockout!.toFixed(1)} giorni. ` +
        `Con lead time fornitore di ${leadTimeAnalysis.medianLeadTime} giorni, è necessario ordinare ${prediction.recommendedOrderQty} unità ${prediction.urgencyLevel === 'EMERGENCY' ? 'IMMEDIATAMENTE' : prediction.urgencyLevel === 'CRITICAL' ? 'OGGI' : 'presto'} per evitare stock-out.`;

      return { reasoning, riskFactors };
    }
  }

  /**
   * MAIN: Genera predizione AI completa per un prodotto
   */
  async predictProduct(productId: number): Promise<AIPrediction> {
    console.log(`\n🤖 AI PREDICTION per prodotto ${productId}`);
    console.log('━'.repeat(60));

    try {
      // 1. Recupera dati prodotto da Odoo
      console.log('📦 Caricamento dati prodotto...');
      const products = await searchReadOdoo(
        'product.product',
        [['id', '=', productId]],
        ['name', 'qty_available', 'seller_ids']
      );

      if (products.length === 0) {
        throw new Error(`Prodotto ${productId} non trovato`);
      }

      const product = products[0];
      const currentStock = product.qty_available || 0;

      // 2. Trova fornitore principale
      console.log('🚚 Analisi fornitore...');
      let supplierId = 0;
      let supplierName = 'Sconosciuto';

      if (product.seller_ids && product.seller_ids.length > 0) {
        const sellerInfo = await searchReadOdoo(
          'product.supplierinfo',
          [['id', '=', product.seller_ids[0]]],
          ['partner_id']
        );

        if (sellerInfo.length > 0) {
          supplierId = sellerInfo[0].partner_id[0];
          supplierName = sellerInfo[0].partner_id[1];
        }
      }

      // 3. Analizza lead time fornitore
      let leadTimeAnalysis: LeadTimeAnalysis;
      try {
        leadTimeAnalysis = await leadTimeAnalyzer.analyzeSupplier(supplierId, 6);
      } catch (error) {
        console.warn('   ⚠️  Lead time non disponibile, uso default 7 giorni');
        leadTimeAnalysis = {
          supplierId,
          supplierName,
          medianLeadTime: 7,
          avgLeadTime: 7,
          minLeadTime: 5,
          maxLeadTime: 10,
          stdDevLeadTime: 2,
          variabilityScore: 0.7,
          onTimeRate: 80,
          reliabilityScore: 75,
          sampleSize: 0,
          periodFrom: new Date(),
          periodTo: new Date(),
          leadTimes: [],
          outliers: []
        };
      }

      // 4. Analizza storico vendite
      console.log('📊 Analisi vendite...');
      const salesHistory = await salesAnalyzer.analyzeProduct(productId, 3);

      // 5. Crea snapshot prodotto
      const productSnapshot: ProductSnapshot = {
        productId,
        productName: product.name,
        currentStock,
        supplierId,
        supplierName,
        supplierLeadTime: leadTimeAnalysis.medianLeadTime,
        supplierReliability: leadTimeAnalysis.reliabilityScore,
        avgDailySales: salesHistory.avgDailySales,
        trend: salesHistory.trend,
        trendPercentage: salesHistory.trendPercentage,
        variability: salesHistory.variability,
        peakDay: salesHistory.peakDay,
        recurringCustomers: salesHistory.recurringCustomers,
        totalCustomers: salesHistory.totalCustomers
      };

      // 6. Predizione AI prossimi 7 giorni
      const next7DaysSales = await this.predictNext7Days(productSnapshot, salesHistory);

      // 7. Simula stock prossimi 7 giorni
      const today = new Date();
      const days = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
      let runningStock = currentStock;
      let stockoutDay: number | null = null;

      const forecast = next7DaysSales.map((sales, index) => {
        const date = new Date(today);
        date.setDate(today.getDate() + index);

        runningStock -= sales;

        if (runningStock < 0 && stockoutDay === null) {
          stockoutDay = index;
        }

        const stockoutRisk = runningStock <= 0 ? 100 :
          runningStock < salesHistory.avgDailySales * 2 ? 80 :
          runningStock < salesHistory.avgDailySales * 5 ? 50 : 20;

        return {
          day: days[date.getDay()],
          date,
          predictedSales: Math.round(sales * 10) / 10,
          predictedStock: Math.max(0, Math.round(runningStock * 10) / 10),
          stockoutRisk
        };
      });

      // 8. Calcola giorni fino a stock-out
      const daysUntilStockout = stockoutDay !== null
        ? stockoutDay
        : currentStock / salesHistory.avgDailySales;

      // 9. Determina urgenza
      const urgency = this.determineUrgency(
        daysUntilStockout,
        leadTimeAnalysis.medianLeadTime
      );

      // 10. Calcola safety stock
      const safetyStock = this.calculateSafetyStock(
        salesHistory.avgDailySales,
        leadTimeAnalysis.medianLeadTime,
        salesHistory.variability,
        leadTimeAnalysis.reliabilityScore
      );

      // 11. Calcola reorder point
      const reorderPoint = Math.ceil(
        (salesHistory.avgDailySales * leadTimeAnalysis.medianLeadTime) + safetyStock
      );

      // 12. Calcola quantità ordine raccomandata
      // Coverage: 14 giorni default, aumentato se growing o volatile
      let coverageDays = 14;
      if (salesHistory.trend === 'growing') coverageDays = 21;
      if (salesHistory.trend === 'volatile') coverageDays = 21;

      const recommendedOrderQty = Math.ceil(
        (salesHistory.avgDailySales * coverageDays) + safetyStock
      );

      // 13. Calcola data ordine raccomandata
      const daysUntilOrder = Math.max(0, daysUntilStockout - leadTimeAnalysis.medianLeadTime - 1);
      const recommendedOrderDate = new Date();
      recommendedOrderDate.setDate(recommendedOrderDate.getDate() + Math.floor(daysUntilOrder));

      // Se urgente, ordina OGGI
      if (urgency.level === 'EMERGENCY' || urgency.level === 'CRITICAL') {
        recommendedOrderDate.setTime(today.getTime());
      }

      // 14. Genera AI reasoning
      const partialPrediction: Partial<AIPrediction> = {
        daysUntilStockout,
        urgencyLevel: urgency.level,
        recommendedOrderQty,
        recommendedOrderDate,
        safetyStock
      };

      const { reasoning: aiReasoning, riskFactors } = await this.generateAIReasoning(
        productSnapshot,
        partialPrediction,
        salesHistory,
        leadTimeAnalysis
      );

      // 15. Calcola confidence score
      const confidenceScore = this.calculateConfidence(
        salesHistory.variability,
        leadTimeAnalysis.variabilityScore,
        salesHistory.orderCount,
        leadTimeAnalysis.sampleSize
      );

      console.log('━'.repeat(60));
      console.log(`✅ PREDICTION COMPLETATA`);
      console.log(`   Urgenza: ${urgency.level}`);
      console.log(`   Giorni rimanenti: ${daysUntilStockout.toFixed(1)}`);
      console.log(`   Ordina: ${recommendedOrderQty} unità`);
      console.log(`   Confidenza: ${confidenceScore}%`);

      // 16. Ritorna predizione completa
      return {
        productId,
        productName: product.name,
        daysUntilStockout: Math.round(daysUntilStockout * 10) / 10,
        urgencyLevel: urgency.level,
        urgencyColor: urgency.color,
        recommendedOrderQty,
        recommendedOrderDate,
        safetyStock,
        reorderPoint,
        suggestedSupplierId: supplierId,
        supplierLeadTime: leadTimeAnalysis.medianLeadTime,
        aiReasoning,
        confidenceScore,
        riskFactors,
        next7DaysForecast: forecast
      };

    } catch (error: any) {
      console.error(`❌ Errore prediction prodotto ${productId}:`, error.message);
      throw error;
    }
  }

  /**
   * Calcola confidence score
   */
  private calculateConfidence(
    salesVariability: number,
    supplierVariability: number,
    salesSampleSize: number,
    supplierSampleSize: number
  ): number {
    // Score base da variabilità (0-50 punti)
    const salesScore = Math.max(0, 25 - (salesVariability * 25));
    const supplierScore = Math.max(0, 25 - ((1 - supplierVariability) * 25));

    // Bonus da sample size (0-50 punti)
    const salesBonus = Math.min(25, (salesSampleSize / 50) * 25);
    const supplierBonus = Math.min(25, (supplierSampleSize / 20) * 25);

    const total = salesScore + supplierScore + salesBonus + supplierBonus;

    return Math.round(Math.min(100, Math.max(50, total)));
  }

  /**
   * Batch predictions
   */
  async predictProducts(productIds: number[]): Promise<AIPrediction[]> {
    console.log(`\n🤖 BATCH PREDICTION: ${productIds.length} prodotti`);
    console.log('━'.repeat(60));

    const results: AIPrediction[] = [];

    for (const productId of productIds) {
      try {
        const prediction = await this.predictProduct(productId);
        results.push(prediction);
      } catch (error: any) {
        console.error(`⚠️  Skip prodotto ${productId}:`, error.message);
      }
    }

    console.log(`\n✅ Completate ${results.length}/${productIds.length} predizioni`);

    // Ordina per urgenza
    const urgencyOrder = { EMERGENCY: 0, CRITICAL: 1, HIGH: 2, MEDIUM: 3, LOW: 4 };
    results.sort((a, b) => {
      const aOrder = urgencyOrder[a.urgencyLevel];
      const bOrder = urgencyOrder[b.urgencyLevel];
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.daysUntilStockout - b.daysUntilStockout;
    });

    return results;
  }
}

// Export singleton
export const aiPredictionEngine = new AIPredictionEngine();
