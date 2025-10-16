/**
 * LAPA Smart Ordering - Lead Time Analyzer
 *
 * Calcola lead time REALI dai purchase orders Odoo
 * IMPORTANTE: Usa date_approve (conferma) → effective_date (consegna)
 * NON la date_order (creazione)!
 */

import { searchReadOdoo } from '@/lib/odoo/odoo-helper';

export interface LeadTimeAnalysis {
  supplierId: number;
  supplierName: string;

  // Lead time statistics
  medianLeadTime: number;      // Giorni mediana (più robusta)
  avgLeadTime: number;         // Giorni media
  minLeadTime: number;         // Minimo osservato
  maxLeadTime: number;         // Massimo osservato
  stdDevLeadTime: number;      // Deviazione standard

  // Reliability metrics
  variabilityScore: number;    // 0-1 (0 = molto variabile, 1 = costante)
  onTimeRate: number;          // % consegne puntuali (entro planned date)
  reliabilityScore: number;    // 0-100 score complessivo

  // Sample info
  sampleSize: number;          // Numero ordini analizzati
  periodFrom: Date;
  periodTo: Date;

  // Details for debugging
  leadTimes: number[];         // Array di tutti i lead time osservati
  outliers: number[];          // Lead time anomali rimossi
}

export interface PurchaseOrderData {
  id: number;
  name: string;
  partner_id: [number, string];
  date_order: string | false;
  date_approve: string | false;   // DATA CONFERMA (START lead time)
  effective_date: string | false; // DATA CONSEGNA (END lead time)
  date_planned: string | false;
  state: string;
}

class LeadTimeAnalyzer {
  /**
   * Calcola mediana (più robusta della media contro outlier)
   */
  private calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    } else {
      return sorted[mid];
    }
  }

  /**
   * Calcola deviazione standard
   */
  private calculateStdDev(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;

    return Math.sqrt(variance);
  }

  /**
   * Rimuove outlier usando IQR method
   */
  private removeOutliers(values: number[]): { clean: number[]; outliers: number[] } {
    if (values.length < 4) return { clean: values, outliers: [] };

    const sorted = [...values].sort((a, b) => a - b);
    const q1Index = Math.floor(sorted.length * 0.25);
    const q3Index = Math.floor(sorted.length * 0.75);

    const q1 = sorted[q1Index];
    const q3 = sorted[q3Index];
    const iqr = q3 - q1;

    const lowerBound = q1 - (1.5 * iqr);
    const upperBound = q3 + (1.5 * iqr);

    const clean: number[] = [];
    const outliers: number[] = [];

    values.forEach(val => {
      if (val >= lowerBound && val <= upperBound) {
        clean.push(val);
      } else {
        outliers.push(val);
      }
    });

    return { clean, outliers };
  }

  /**
   * Calcola giorni tra due date
   */
  private daysBetween(startDate: string, endDate: string): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = end.getTime() - start.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    return diffDays;
  }

  /**
   * MAIN: Analizza lead time per un fornitore
   */
  async analyzeSupplier(supplierId: number, monthsHistory: number = 6): Promise<LeadTimeAnalysis> {
    console.log(`📊 Analisi lead time fornitore ${supplierId}...`);

    // Calcola data inizio periodo
    const periodFrom = new Date();
    periodFrom.setMonth(periodFrom.getMonth() - monthsHistory);
    const periodFromStr = periodFrom.toISOString().split('T')[0];

    try {
      // 1. Recupera purchase orders confermati e ricevuti
      const orders = await searchReadOdoo(
        'purchase.order',
        [
          ['partner_id', '=', supplierId],
          ['state', 'in', ['purchase', 'done']],  // Solo confermati/completati
          ['date_approve', '!=', false],           // Deve avere data conferma
          ['date_approve', '>=', periodFromStr]    // Ultimi N mesi
        ],
        [
          'name',
          'partner_id',
          'date_order',
          'date_approve',      // DATA CONFERMA (INIZIO)
          'effective_date',    // DATA CONSEGNA (FINE)
          'date_planned',
          'state'
        ],
        100 // Max 100 ordini
      ) as PurchaseOrderData[];

      console.log(`   Trovati ${orders.length} ordini da analizzare`);

      if (orders.length === 0) {
        throw new Error('Nessun ordine trovato per questo fornitore');
      }

      const supplierName = orders[0].partner_id[1];

      // 2. Calcola lead time per ogni ordine
      const leadTimes: number[] = [];
      const onTimeCount = { onTime: 0, total: 0 };

      orders.forEach(order => {
        // IMPORTANTE: Usa date_approve (conferma) come START
        if (!order.date_approve) {
          console.warn(`   ⚠️  Ordine ${order.name} senza date_approve, skip`);
          return;
        }

        // Usa effective_date se disponibile, altrimenti date_planned
        const deliveryDate = order.effective_date || order.date_planned;

        if (!deliveryDate) {
          console.warn(`   ⚠️  Ordine ${order.name} senza data consegna, skip`);
          return;
        }

        // Calcola lead time: CONFERMA → CONSEGNA
        const leadTimeDays = this.daysBetween(order.date_approve, deliveryDate);

        // Valida lead time (tra 0 e 365 giorni)
        if (leadTimeDays > 0 && leadTimeDays < 365) {
          leadTimes.push(leadTimeDays);

          // Check se on-time (entro data pianificata)
          if (order.date_planned && order.effective_date) {
            onTimeCount.total++;
            const delay = this.daysBetween(order.date_planned, order.effective_date);
            if (delay <= 1) { // Tolleranza 1 giorno
              onTimeCount.onTime++;
            }
          }
        } else {
          console.warn(`   ⚠️  Lead time anomalo ${leadTimeDays}gg per ordine ${order.name}`);
        }
      });

      if (leadTimes.length === 0) {
        throw new Error('Nessun lead time valido calcolato');
      }

      console.log(`   ✅ Calcolati ${leadTimes.length} lead time validi`);

      // 3. Rimuovi outlier
      const { clean: cleanLeadTimes, outliers } = this.removeOutliers(leadTimes);

      if (outliers.length > 0) {
        console.log(`   🧹 Rimossi ${outliers.length} outlier: ${outliers.map(o => o.toFixed(1)).join(', ')}`);
      }

      // 4. Calcola statistiche
      const medianLeadTime = this.calculateMedian(cleanLeadTimes);
      const avgLeadTime = cleanLeadTimes.reduce((sum, val) => sum + val, 0) / cleanLeadTimes.length;
      const minLeadTime = Math.min(...cleanLeadTimes);
      const maxLeadTime = Math.max(...cleanLeadTimes);
      const stdDevLeadTime = this.calculateStdDev(cleanLeadTimes);

      // 5. Calcola variability score (0 = molto variabile, 1 = costante)
      // Coefficiente di variazione invertito e normalizzato
      const cv = stdDevLeadTime / avgLeadTime; // Coefficiente di variazione
      const variabilityScore = Math.max(0, Math.min(1, 1 - cv));

      // 6. Calcola on-time rate
      const onTimeRate = onTimeCount.total > 0
        ? (onTimeCount.onTime / onTimeCount.total) * 100
        : 0;

      // 7. Calcola reliability score (0-100)
      // Considera: variability (50%) + on-time rate (50%)
      const reliabilityScore = (variabilityScore * 50) + (onTimeRate / 2);

      console.log(`   📈 Mediana: ${medianLeadTime.toFixed(1)}gg | Media: ${avgLeadTime.toFixed(1)}gg | Std Dev: ${stdDevLeadTime.toFixed(1)}gg`);
      console.log(`   ✅ On-time: ${onTimeRate.toFixed(1)}% | Reliability: ${reliabilityScore.toFixed(0)}/100`);

      return {
        supplierId,
        supplierName,
        medianLeadTime: Math.round(medianLeadTime * 10) / 10,
        avgLeadTime: Math.round(avgLeadTime * 10) / 10,
        minLeadTime: Math.round(minLeadTime * 10) / 10,
        maxLeadTime: Math.round(maxLeadTime * 10) / 10,
        stdDevLeadTime: Math.round(stdDevLeadTime * 10) / 10,
        variabilityScore: Math.round(variabilityScore * 100) / 100,
        onTimeRate: Math.round(onTimeRate * 10) / 10,
        reliabilityScore: Math.round(reliabilityScore * 10) / 10,
        sampleSize: cleanLeadTimes.length,
        periodFrom,
        periodTo: new Date(),
        leadTimes: cleanLeadTimes,
        outliers
      };

    } catch (error: any) {
      console.error(`   ❌ Errore analisi fornitore ${supplierId}:`, error.message);
      throw error;
    }
  }

  /**
   * Analizza tutti i fornitori attivi
   */
  async analyzeAllSuppliers(monthsHistory: number = 6): Promise<LeadTimeAnalysis[]> {
    console.log('📊 Analisi lead time TUTTI i fornitori...');

    try {
      // 1. Trova tutti i fornitori con purchase orders recenti
      const periodFrom = new Date();
      periodFrom.setMonth(periodFrom.getMonth() - monthsHistory);
      const periodFromStr = periodFrom.toISOString().split('T')[0];

      const orders = await searchReadOdoo(
        'purchase.order',
        [
          ['state', 'in', ['purchase', 'done']],
          ['date_approve', '>=', periodFromStr]
        ],
        ['partner_id'],
        500
      ) as PurchaseOrderData[];

      // Estrai supplier IDs unici
      const supplierIds = [...new Set(orders.map(o => o.partner_id[0]))];

      console.log(`   Trovati ${supplierIds.length} fornitori attivi`);

      // 2. Analizza ogni fornitore
      const results: LeadTimeAnalysis[] = [];

      for (const supplierId of supplierIds) {
        try {
          const analysis = await this.analyzeSupplier(supplierId, monthsHistory);
          results.push(analysis);
        } catch (error: any) {
          console.error(`   ⚠️  Skip fornitore ${supplierId}:`, error.message);
        }
      }

      console.log(`   ✅ Analizzati ${results.length}/${supplierIds.length} fornitori`);

      // 3. Ordina per reliability score
      results.sort((a, b) => b.reliabilityScore - a.reliabilityScore);

      return results;

    } catch (error: any) {
      console.error('❌ Errore analisi fornitori:', error.message);
      throw error;
    }
  }

  /**
   * Get lead time consigliato per un fornitore
   * Include buffer per sicurezza
   */
  getRecommendedLeadTime(analysis: LeadTimeAnalysis): {
    recommended: number;
    conservative: number;
    optimistic: number;
  } {
    // Usa mediana + metà dello std dev come raccomandato
    const recommended = Math.ceil(analysis.medianLeadTime + (analysis.stdDevLeadTime * 0.5));

    // Conservative: mediana + 1 std dev (copre ~84% dei casi)
    const conservative = Math.ceil(analysis.medianLeadTime + analysis.stdDevLeadTime);

    // Optimistic: mediana (copre ~50% dei casi)
    const optimistic = Math.ceil(analysis.medianLeadTime);

    return {
      recommended,
      conservative,
      optimistic
    };
  }
}

// Export singleton
export const leadTimeAnalyzer = new LeadTimeAnalyzer();
