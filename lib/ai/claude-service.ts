/**
 * Claude AI Service per Ordini Fornitori Intelligenti
 *
 * Questo servizio utilizza Claude 3.5 Sonnet per:
 * - Analisi predittiva vendite
 * - Ottimizzazione quantità ordini
 * - Rilevamento anomalie
 * - Suggerimenti strategici
 */

import Anthropic from '@anthropic-ai/sdk';

// ============================================================================
// TYPES
// ============================================================================

export interface ProductAnalysisInput {
  productId: number;
  productName: string;
  productCode: string;
  category: string;
  supplier: string;
  supplierId: number;
  currentStock: number;
  salesHistory: DailySale[];
  leadTime: number;
  supplierReliability: number;
  unitPrice?: number;
  seasonalityData?: any;
}

export interface DailySale {
  date: string;
  quantity: number;
  customers: { name: string; quantity: number; }[];
  revenue?: number;
}

export interface AIAnalysisResult {
  productId: number;
  productName: string;

  // Previsione
  predictedDailySales: number;
  predictedWeeklySales: number;
  predictedMonthlySales: number;
  confidenceLevel: number; // 0-1

  // Raccomandazione ordine
  recommendedQuantity: number;
  urgencyLevel: 'critica' | 'alta' | 'media' | 'bassa';
  daysUntilStockout: number;

  // Analisi
  trend: 'crescente' | 'decrescente' | 'stabile' | 'volatile';
  seasonalityDetected: boolean;
  anomaliesDetected: string[];

  // Spiegazione AI
  reasoning: string;
  risks: string[];
  opportunities: string[];
  strategicSuggestions: string[];

  // Metriche finanziarie
  estimatedOrderValue?: number;
  estimatedStockoutCost?: number;
  estimatedOverstockCost?: number;

  // Timestamp
  analyzedAt: string;
}

export interface BulkAnalysisResult {
  totalProducts: number;
  criticalProducts: AIAnalysisResult[];
  warningProducts: AIAnalysisResult[];
  okProducts: AIAnalysisResult[];
  totalRecommendedOrderValue: number;
  overallRisks: string[];
  overallOpportunities: string[];
  executiveSummary: string;
  analyzedAt: string;
}

// ============================================================================
// CLAUDE AI SERVICE
// ============================================================================

class ClaudeAIService {
  private client: Anthropic;
  private model = 'claude-sonnet-4-5-20250929';
  private maxTokens = 4096;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('❌ ANTHROPIC_API_KEY non trovata in .env');
    }

    this.client = new Anthropic({
      apiKey: apiKey
    });
  }

  /**
   * Analizza singolo prodotto con AI
   */
  async analyzeSingleProduct(input: ProductAnalysisInput): Promise<AIAnalysisResult> {
    const prompt = this.buildSingleProductPrompt(input);

    try {
      const message = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        messages: [{
          role: 'user',
          content: prompt
        }],
        temperature: 0.3 // Più deterministico per analisi numeriche
      });

      const responseText = message.content[0].type === 'text'
        ? message.content[0].text
        : '';

      return this.parseSingleProductResponse(responseText, input);
    } catch (error: any) {
      console.error('❌ Errore analisi AI prodotto:', error);
      throw new Error(`Analisi AI fallita: ${error.message}`);
    }
  }

  /**
   * Analizza multipli prodotti in batch
   */
  async analyzeBulkProducts(products: ProductAnalysisInput[]): Promise<BulkAnalysisResult> {
    console.log(`🤖 Analisi AI di ${products.length} prodotti...`);

    // Analizza prodotti in parallelo (max 5 alla volta per non sovraccaricare API)
    const batchSize = 5;
    const results: AIAnalysisResult[] = [];

    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(product => this.analyzeSingleProduct(product))
      );
      results.push(...batchResults);

      console.log(`✅ Analizzati ${Math.min(i + batchSize, products.length)}/${products.length} prodotti`);
    }

    // Genera executive summary
    const executiveSummary = await this.generateExecutiveSummary(results);

    // Classifica prodotti
    const critical = results.filter(r => r.urgencyLevel === 'critica');
    const warning = results.filter(r => r.urgencyLevel === 'alta');
    const ok = results.filter(r => ['media', 'bassa'].includes(r.urgencyLevel));

    // Calcola totale ordini
    const totalValue = results.reduce((sum, r) =>
      sum + (r.estimatedOrderValue || 0), 0
    );

    // Aggrega rischi e opportunità
    const allRisks = Array.from(new Set(results.flatMap(r => r.risks)));
    const allOpportunities = Array.from(new Set(results.flatMap(r => r.opportunities)));

    return {
      totalProducts: products.length,
      criticalProducts: critical,
      warningProducts: warning,
      okProducts: ok,
      totalRecommendedOrderValue: totalValue,
      overallRisks: allRisks,
      overallOpportunities: allOpportunities,
      executiveSummary: executiveSummary,
      analyzedAt: new Date().toISOString()
    };
  }

  /**
   * Genera executive summary dell'analisi completa
   */
  private async generateExecutiveSummary(results: AIAnalysisResult[]): Promise<string> {
    const critical = results.filter(r => r.urgencyLevel === 'critica').length;
    const warning = results.filter(r => r.urgencyLevel === 'alta').length;
    const totalValue = results.reduce((sum, r) => sum + (r.estimatedOrderValue || 0), 0);

    const prompt = `Sei un esperto di supply chain management. Analizza questi risultati e crea un executive summary conciso (max 200 parole):

PRODOTTI ANALIZZATI: ${results.length}
- Critici (ordina subito): ${critical}
- In attenzione: ${warning}
- OK: ${results.length - critical - warning}

VALORE TOTALE ORDINI RACCOMANDATI: €${totalValue.toFixed(2)}

TOP 5 PRODOTTI CRITICI:
${results
  .filter(r => r.urgencyLevel === 'critica')
  .slice(0, 5)
  .map(r => `- ${r.productName}: ordina ${r.recommendedQuantity} pz (esaurimento in ${r.daysUntilStockout.toFixed(1)} giorni)`)
  .join('\n')}

Scrivi un summary esecutivo che evidenzi:
1. Situazione generale stock
2. Azioni immediate richieste
3. Rischi principali
4. Opportunità da cogliere

Rispondi SOLO con il testo del summary, senza introduzioni.`;

    try {
      const message = await this.client.messages.create({
        model: this.model,
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5
      });

      return message.content[0].type === 'text'
        ? message.content[0].text
        : 'Summary non disponibile';
    } catch (error) {
      console.error('❌ Errore generazione summary:', error);
      return 'Executive summary non disponibile a causa di un errore.';
    }
  }

  /**
   * Costruisce prompt dettagliato per analisi singolo prodotto
   */
  private buildSingleProductPrompt(input: ProductAnalysisInput): string {
    const recentSales = input.salesHistory.slice(-7);
    const mediumSales = input.salesHistory.slice(-30);

    const avgRecent = recentSales.reduce((sum, s) => sum + s.quantity, 0) / recentSales.length;
    const avgMedium = mediumSales.reduce((sum, s) => sum + s.quantity, 0) / mediumSales.length;

    const topCustomers = this.getTopCustomers(input.salesHistory);

    return `Sei un esperto AI di supply chain management e demand forecasting. Analizza questo prodotto e fornisci raccomandazioni precise.

═══════════════════════════════════════════════════════════
📦 PRODOTTO: ${input.productName}
═══════════════════════════════════════════════════════════

🔢 DATI ATTUALI:
- Codice: ${input.productCode}
- Categoria: ${input.category}
- Giacenza attuale: ${input.currentStock} pz
- Prezzo unitario: ${input.unitPrice ? `€${input.unitPrice.toFixed(2)}` : 'N/D'}

🏭 FORNITORE:
- Nome: ${input.supplier}
- Lead time: ${input.leadTime} giorni
- Affidabilità: ${input.supplierReliability}%

📊 STORICO VENDITE (ultimi ${input.salesHistory.length} giorni):
${input.salesHistory.slice(-14).map(s => `  ${s.date}: ${s.quantity} pz`).join('\n')}

📈 METRICHE:
- Media ultimi 7 giorni: ${avgRecent.toFixed(2)} pz/giorno
- Media ultimi 30 giorni: ${avgMedium.toFixed(2)} pz/giorno
- Totale venduto (periodo): ${input.salesHistory.reduce((sum, s) => sum + s.quantity, 0)} pz

👥 TOP 3 CLIENTI:
${topCustomers.slice(0, 3).map(c => `  - ${c.name}: ${c.total} pz`).join('\n')}

═══════════════════════════════════════════════════════════
🎯 RICHIESTA ANALISI:
═══════════════════════════════════════════════════════════

Analizza i dati e rispondi IN FORMATO JSON VALIDO con questa struttura ESATTA:

{
  "predictedDailySales": <numero>,
  "predictedWeeklySales": <numero>,
  "predictedMonthlySales": <numero>,
  "confidenceLevel": <0-1>,
  "recommendedQuantity": <numero intero>,
  "urgencyLevel": "<critica|alta|media|bassa>",
  "daysUntilStockout": <numero>,
  "trend": "<crescente|decrescente|stabile|volatile>",
  "seasonalityDetected": <true|false>,
  "anomaliesDetected": [<array stringhe>],
  "reasoning": "<stringa: spiegazione decisioni in 2-3 frasi>",
  "risks": [<array stringhe: 2-3 rischi principali>],
  "opportunities": [<array stringhe: 1-2 opportunità>],
  "strategicSuggestions": [<array stringhe: 2-3 suggerimenti>]
}

CRITERI ANALISI:
1. **Previsione**: Usa modelli statistici considerando trend, stagionalità, anomalie
2. **Quantità**: Calcola fabbisogno = (vendite previste × lead time) + safety stock
3. **Safety stock**: 15-30% in base a variabilità
4. **Urgenza**:
   - Critica: stock < 50% del fabbisogno lead time
   - Alta: stock < 100% del fabbisogno lead time
   - Media: stock < 150% del fabbisogno lead time
   - Bassa: stock > 150% del fabbisogno lead time
5. **Trend**: Confronta medie recenti vs medie storiche
6. **Anomalie**: Picchi/cali improvvisi, pattern insoliti, customer concentration risk

IMPORTANTE:
- Sii conservativo ma non eccessivo (no overstock)
- Considera lead time nella raccomandazione
- Rispondi SOLO con JSON valido, NESSUN testo aggiuntivo
- I numeri devono essere realistici e calcolati matematicamente`;
  }

  /**
   * Estrae top customers da storico vendite
   */
  private getTopCustomers(salesHistory: DailySale[]): { name: string; total: number }[] {
    const customerTotals: Record<string, number> = {};

    salesHistory.forEach(day => {
      day.customers?.forEach(customer => {
        customerTotals[customer.name] = (customerTotals[customer.name] || 0) + customer.quantity;
      });
    });

    return Object.entries(customerTotals)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
  }

  /**
   * Parsa risposta AI in formato strutturato
   */
  private parseSingleProductResponse(
    responseText: string,
    input: ProductAnalysisInput
  ): AIAnalysisResult {
    try {
      // Estrai JSON dalla risposta (potrebbe avere markdown code blocks)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Nessun JSON trovato nella risposta');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Calcola valori finanziari
      const estimatedOrderValue = input.unitPrice
        ? parsed.recommendedQuantity * input.unitPrice
        : undefined;

      const estimatedStockoutCost = input.unitPrice
        ? parsed.predictedDailySales * input.unitPrice * 7 * 0.3 // stima 30% revenue loss
        : undefined;

      return {
        productId: input.productId,
        productName: input.productName,
        predictedDailySales: parsed.predictedDailySales,
        predictedWeeklySales: parsed.predictedWeeklySales,
        predictedMonthlySales: parsed.predictedMonthlySales,
        confidenceLevel: parsed.confidenceLevel,
        recommendedQuantity: Math.round(parsed.recommendedQuantity),
        urgencyLevel: parsed.urgencyLevel,
        daysUntilStockout: parsed.daysUntilStockout,
        trend: parsed.trend,
        seasonalityDetected: parsed.seasonalityDetected,
        anomaliesDetected: parsed.anomaliesDetected || [],
        reasoning: parsed.reasoning,
        risks: parsed.risks || [],
        opportunities: parsed.opportunities || [],
        strategicSuggestions: parsed.strategicSuggestions || [],
        estimatedOrderValue,
        estimatedStockoutCost,
        estimatedOverstockCost: undefined, // TODO: implementare calcolo
        analyzedAt: new Date().toISOString()
      };
    } catch (error: any) {
      console.error('❌ Errore parsing risposta AI:', error);
      console.log('Risposta raw:', responseText);

      // Fallback con calcolo matematico semplice
      return this.fallbackAnalysis(input);
    }
  }

  /**
   * Analisi fallback se AI fallisce
   */
  private fallbackAnalysis(input: ProductAnalysisInput): AIAnalysisResult {
    const recent = input.salesHistory.slice(-7);
    const avgDaily = recent.reduce((sum, s) => sum + s.quantity, 0) / recent.length;

    const baseNeed = avgDaily * input.leadTime;
    const safetyStock = baseNeed * 0.2;
    const recommendedQuantity = Math.max(0, Math.ceil(baseNeed + safetyStock - input.currentStock));

    const daysUntilStockout = avgDaily > 0 ? input.currentStock / avgDaily : 999;

    let urgencyLevel: 'critica' | 'alta' | 'media' | 'bassa' = 'bassa';
    if (daysUntilStockout < input.leadTime * 0.5) urgencyLevel = 'critica';
    else if (daysUntilStockout < input.leadTime) urgencyLevel = 'alta';
    else if (daysUntilStockout < input.leadTime * 1.5) urgencyLevel = 'media';

    return {
      productId: input.productId,
      productName: input.productName,
      predictedDailySales: avgDaily,
      predictedWeeklySales: avgDaily * 7,
      predictedMonthlySales: avgDaily * 30,
      confidenceLevel: 0.5,
      recommendedQuantity: recommendedQuantity,
      urgencyLevel: urgencyLevel,
      daysUntilStockout: daysUntilStockout,
      trend: 'stabile',
      seasonalityDetected: false,
      anomaliesDetected: [],
      reasoning: 'Analisi matematica di fallback (AI non disponibile)',
      risks: ['AI non disponibile - usata analisi semplificata'],
      opportunities: [],
      strategicSuggestions: ['Verifica connessione AI per analisi avanzata'],
      estimatedOrderValue: input.unitPrice ? recommendedQuantity * input.unitPrice : undefined,
      analyzedAt: new Date().toISOString()
    };
  }
}

// ============================================================================
// EXPORT SINGLETON
// ============================================================================

let instance: ClaudeAIService | null = null;

export function getClaudeAIService(): ClaudeAIService {
  if (!instance) {
    instance = new ClaudeAIService();
  }
  return instance;
}

export default ClaudeAIService;
