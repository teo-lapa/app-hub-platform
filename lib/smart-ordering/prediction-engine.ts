/**
 * LAPA Smart Ordering - AI Prediction Engine
 *
 * Calcola previsioni intelligenti per ordini basate su:
 * - Pattern storici vendite
 * - Giorno della settimana
 * - Trend prodotto
 * - Stagionalità
 * - Frequenza ordini reale per raggiungere valore minimo
 * - Ottimizzazione coverage days dinamica
 */

import {
  ORDER_OPTIMIZATION_CONFIG,
  getCoverageDays,
  getSafetyStockMultiplier,
  estimateOrderFrequency
} from './config';

export interface ProductData {
  productId: number;
  productName: string;
  currentStock: number;
  avgDailySales: number;
  variability: number;
  leadTimeDays: number;
  preferredDays?: string[];
  trend?: 'stable' | 'declining' | 'volatile' | 'growing';
  category?: string;
  reorderPoint?: number;
  supplierInfo?: {
    id: number;
    name: string;
    leadTime: number;
    cadenceDays?: number;            // NUOVA: Cadenza fornitore dal DB (ogni quanti giorni si ordina)
    reliability: number;
    avgProductValue?: number;        // Valore medio prodotti fornitore
    totalProductsCount?: number;     // Totale prodotti fornitore
  };
  productPrice?: number;              // Prezzo unitario prodotto
  urgencyLevel?: 'CRITICAL' | 'EMERGENCY' | 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface PredictionResult {
  daysRemaining: number;
  urgencyLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  urgencyColor: string;
  recommendedOrderDate: Date;
  recommendedQuantity: number;
  safetyStock: number;
  nextStockoutDate: Date;
  confidenceScore: number;
  reasoning: string;
  weeklyForecast: {
    day: string;
    expectedSales: number;
    expectedStock: number;
  }[];
}

export class SmartPredictionEngine {
  // Pattern settimanali LAPA (da analisi reale)
  private readonly WEEKLY_PATTERN = {
    sunday: 0.05,
    monday: 0.15,
    tuesday: 0.35,    // PICCO!
    wednesday: 0.15,
    thursday: 0.15,
    friday: 0.12,
    saturday: 0.03
  };

  /**
   * Calcola giorni rimanenti prima esaurimento stock
   */
  calculateDaysRemaining(currentStock: number, avgDailySales: number): number {
    if (avgDailySales === 0) return 999;
    return currentStock / avgDailySales;
  }

  /**
   * Calcola safety stock dinamico basato su variabilità E affidabilità fornitore
   * Usa un periodo base fisso di 14 giorni per garantire copertura consistente
   */
  calculateSafetyStock(
    avgDailySales: number,
    leadTimeDays: number,
    variability: number,
    supplierReliability: number = 70 // default medio
  ): number {
    // Safety stock = (consumo medio × 14 giorni fissi) × multiplier
    // Periodo base fisso di 14 giorni per copertura consistente indipendente dal lead time
    // Multiplier dipende da:
    // - Affidabilità fornitore (reliability score 0-100)
    // - Variabilità vendite (variability 0-1)

    const safetyStockDays = 14; // Fixed base period for safety stock
    const multiplier = getSafetyStockMultiplier(supplierReliability, variability);
    const baseStock = avgDailySales * safetyStockDays;
    const safetyStock = baseStock * multiplier;

    return Math.ceil(safetyStock);
  }

  /**
   * Calcola punto di riordino ottimale
   */
  calculateReorderPoint(
    avgDailySales: number,
    leadTimeDays: number,
    safetyStock: number
  ): number {
    // ROP = (Avg Daily Sales × Lead Time) + Safety Stock
    return Math.ceil((avgDailySales * leadTimeDays) + safetyStock);
  }

  /**
   * Calcola quantità ordine ottimale con frequenza ordini intelligente
   */
  calculateOptimalOrderQuantity(
    product: ProductData,
    urgencyLevel?: 'CRITICAL' | 'EMERGENCY' | 'HIGH' | 'MEDIUM' | 'LOW'
  ): number {
    const { avgDailySales, leadTimeDays, variability, supplierInfo, productPrice } = product;

    // 1. Determina giorni di copertura basati su cadenza fornitore o urgency
    let coverageDays: number;

    if (supplierInfo?.cadenceDays) {
      // PRIORITÀ 1: Usa cadenza REALE dal database
      // Quantità deve bastare per: cadenza × 2 (100% margine di sicurezza)
      coverageDays = supplierInfo.cadenceDays * 2;
      console.log(`📅 Usa cadenza DB: ${supplierInfo.cadenceDays} giorni → coverage ${coverageDays} giorni`);
    } else if (urgencyLevel) {
      // PRIORITÀ 2: Usa configurazione basata su urgency
      coverageDays = getCoverageDays(urgencyLevel);
    } else if (supplierInfo) {
      // PRIORITÀ 3: Calcola frequenza ordini stimata per raggiungere valore minimo
      const avgValue = supplierInfo.avgProductValue || productPrice || 30;
      const totalProducts = supplierInfo.totalProductsCount || 50;

      const orderFrequencyDays = estimateOrderFrequency(
        supplierInfo.name,
        avgValue,
        totalProducts
      );

      // Coverage = frequenza ordini + lead time (per sicurezza)
      coverageDays = orderFrequencyDays + leadTimeDays;
    } else {
      // Fallback: usa default da config
      coverageDays = ORDER_OPTIMIZATION_CONFIG.coverageDays.default;
    }

    // 2. Calcola safety stock intelligente
    const reliability = supplierInfo?.reliability || 70;
    const safetyStock = this.calculateSafetyStock(
      avgDailySales,
      leadTimeDays,
      variability,
      reliability
    );

    // 3. Quantità = (consumo × coverage) + safety stock
    const baseQuantity = avgDailySales * coverageDays;
    const totalQuantity = baseQuantity + safetyStock;

    // 4. Arrotonda per eccesso (mai ordinare meno del necessario)
    return Math.ceil(totalQuantity);
  }

  /**
   * Determina urgenza ordine
   */
  determineUrgency(
    daysRemaining: number,
    leadTimeDays: number
  ): { level: PredictionResult['urgencyLevel']; color: string } {
    const criticalThreshold = leadTimeDays * 0.5;  // < 50% lead time
    const highThreshold = leadTimeDays * 1.0;      // < 100% lead time
    const mediumThreshold = leadTimeDays * 1.5;    // < 150% lead time

    if (daysRemaining <= 0) {
      return { level: 'CRITICAL', color: '#EF4444' }; // Red
    } else if (daysRemaining < criticalThreshold) {
      return { level: 'CRITICAL', color: '#EF4444' };
    } else if (daysRemaining < highThreshold) {
      return { level: 'HIGH', color: '#F97316' }; // Orange
    } else if (daysRemaining < mediumThreshold) {
      return { level: 'MEDIUM', color: '#EAB308' }; // Yellow
    } else {
      return { level: 'LOW', color: '#22C55E' }; // Green
    }
  }

  /**
   * Genera previsione settimanale considerando pattern LAPA
   */
  generateWeeklyForecast(
    currentStock: number,
    avgWeeklySales: number,
    startDate: Date = new Date()
  ): PredictionResult['weeklyForecast'] {
    const forecast = [];
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    let runningStock = currentStock;
    const today = new Date(startDate);

    for (let i = 0; i < 7; i++) {
      const currentDay = new Date(today);
      currentDay.setDate(today.getDate() + i);

      const dayName = days[currentDay.getDay()];
      const dayPattern = this.WEEKLY_PATTERN[dayName as keyof typeof this.WEEKLY_PATTERN];
      const expectedSales = avgWeeklySales * dayPattern;

      runningStock -= expectedSales;

      forecast.push({
        day: dayName.charAt(0).toUpperCase() + dayName.slice(1),
        expectedSales: Math.round(expectedSales * 10) / 10,
        expectedStock: Math.max(0, Math.round(runningStock * 10) / 10)
      });
    }

    return forecast;
  }

  /**
   * Calcola data raccomandata per ordine
   */
  calculateRecommendedOrderDate(
    daysRemaining: number,
    leadTimeDays: number
  ): Date {
    const today = new Date();

    // Se stock è critico, ordina OGGI
    if (daysRemaining < leadTimeDays * 0.5) {
      return today;
    }

    // Altrimenti calcola: giorni rimanenti - lead time - 1 giorno buffer
    const daysUntilOrder = Math.max(0, daysRemaining - leadTimeDays - 1);

    const orderDate = new Date(today);
    orderDate.setDate(today.getDate() + Math.floor(daysUntilOrder));

    return orderDate;
  }

  /**
   * Genera reasoning AI per la decisione
   */
  generateReasoning(
    product: ProductData,
    prediction: Partial<PredictionResult>
  ): string {
    const parts = [];

    // Stock status
    if (prediction.daysRemaining === 0) {
      parts.push(`🔴 ZERO STOCK! Prodotto esaurito.`);
    } else if (prediction.daysRemaining! < 3) {
      parts.push(`🔴 Stock critico: solo ${prediction.daysRemaining!.toFixed(1)} giorni rimanenti.`);
    } else if (prediction.daysRemaining! < 7) {
      parts.push(`🟠 Attenzione: ${prediction.daysRemaining!.toFixed(1)} giorni di stock.`);
    } else {
      parts.push(`✅ Stock sufficiente per ${prediction.daysRemaining!.toFixed(1)} giorni.`);
    }

    // Pattern vendite
    parts.push(`Vendite medie: ${product.avgDailySales.toFixed(1)} pz/giorno.`);

    // Preferred days
    if (product.preferredDays && product.preferredDays.length > 0) {
      const days = product.preferredDays.join(', ');
      parts.push(`Picchi vendita: ${days}.`);
    }

    // Trend
    if (product.trend === 'declining') {
      parts.push(`📉 Trend in calo: considera riduzione ordine.`);
    } else if (product.trend === 'volatile') {
      parts.push(`🎢 Vendite volatili: aumentato safety stock.`);
    } else if (product.trend === 'growing') {
      parts.push(`📈 Trend crescita: considera aumento ordine.`);
    }

    // Action
    if (prediction.urgencyLevel === 'CRITICAL') {
      parts.push(`⚡ AZIONE IMMEDIATA: ordina ${prediction.recommendedQuantity} pz OGGI.`);
    } else if (prediction.urgencyLevel === 'HIGH') {
      parts.push(`⏰ Ordina ${prediction.recommendedQuantity} pz questa settimana.`);
    } else {
      parts.push(`📋 Pianifica ordine di ${prediction.recommendedQuantity} pz.`);
    }

    return parts.join(' ');
  }

  /**
   * MAIN: Genera predizione completa per prodotto
   */
  predict(product: ProductData): PredictionResult {
    // 1. Calcola giorni rimanenti
    const daysRemaining = this.calculateDaysRemaining(
      product.currentStock,
      product.avgDailySales
    );

    // 2. Determina urgenza PRIMA (necessario per calcolo quantità ottimale)
    const urgency = this.determineUrgency(daysRemaining, product.leadTimeDays);

    // 3. Calcola safety stock intelligente
    const reliability = product.supplierInfo?.reliability || 70;
    const safetyStock = this.calculateSafetyStock(
      product.avgDailySales,
      product.leadTimeDays,
      product.variability,
      reliability
    );

    // 4. Calcola quantità ordine ottimale (CON urgency e frequenza ordini)
    const recommendedQuantity = this.calculateOptimalOrderQuantity(
      product,
      urgency.level
    );

    // 5. Calcola data raccomandata
    const recommendedOrderDate = this.calculateRecommendedOrderDate(
      daysRemaining,
      product.leadTimeDays
    );

    // 6. Calcola data stockout
    const nextStockoutDate = new Date();
    nextStockoutDate.setDate(nextStockoutDate.getDate() + Math.floor(daysRemaining));

    // 7. Genera forecast settimanale
    const weeklyForecast = this.generateWeeklyForecast(
      product.currentStock,
      product.avgDailySales * 7
    );

    // 8. Calcola confidence score
    const confidenceScore = this.calculateConfidence(product.variability);

    // 9. Build prediction result
    const prediction: Partial<PredictionResult> = {
      daysRemaining,
      urgencyLevel: urgency.level,
      urgencyColor: urgency.color,
      recommendedOrderDate,
      recommendedQuantity,
      safetyStock,
      nextStockoutDate,
      confidenceScore,
      weeklyForecast
    };

    // 10. Genera reasoning
    const reasoning = this.generateReasoning(product, prediction);

    return {
      ...prediction,
      reasoning
    } as PredictionResult;
  }

  /**
   * Calcola confidence score basato su variabilità
   */
  private calculateConfidence(variability: number): number {
    // Variabilità bassa (< 0.3) = alta confidenza (90-100%)
    // Variabilità media (0.3-0.8) = media confidenza (70-90%)
    // Variabilità alta (> 0.8) = bassa confidenza (50-70%)

    if (variability < 0.3) {
      return 95;
    } else if (variability < 0.8) {
      return 85 - (variability * 20);
    } else {
      return Math.max(50, 75 - (variability * 15));
    }
  }

  /**
   * Batch prediction per multipli prodotti
   */
  predictBatch(products: ProductData[]): Map<number, PredictionResult> {
    const results = new Map<number, PredictionResult>();

    products.forEach(product => {
      const prediction = this.predict(product);
      results.set(product.productId, prediction);
    });

    return results;
  }
}

// Export singleton instance
export const predictionEngine = new SmartPredictionEngine();
