/**
 * LAPA Smart Ordering - Configurazione Parametri
 *
 * Parametri per ottimizzazione ordini fornitori con valore minimo
 */

export interface SupplierOrderConfig {
  /** Valore minimo ordine in EUR */
  minOrderValue: number;
  /** Frequenza media ordini in giorni (per raggiungere valore minimo) */
  targetOrderFrequencyDays: number;
  /** Moltiplicatore safety stock (0.3 = +30%) */
  safetyStockMultiplier: number;
}

export const ORDER_OPTIMIZATION_CONFIG = {
  /**
   * VALORE MINIMO ORDINE PER FORNITORE
   * Default: 2000€ (per ottimizzare costi spedizione/logistica)
   */
  minOrderValue: {
    default: 2000,

    // Valori personalizzati per fornitori specifici
    bySupplierName: {
      'FERRAIUOLO FOODS SRL': 2000,
      'POLO SPA': 1800,
      'MUSATI SAGL': 1500,
      'RISTORIS SRL': 2000,
      'PASTIFICIO DI MARTINO GAETANO & FLLI SPA': 2500,
      'PASTIFICIO MARCELLO': 1800,
    } as Record<string, number>
  },

  /**
   * FREQUENZA ORDINI TARGET
   * Giorni medi tra ordini per raggiungere valore minimo
   *
   * Esempio: Se fornitore ha 50 prodotti da €20-50 cad.
   * Per raggiungere 2000€ serve ordinare ~10-15 prodotti
   * Non ordini ogni settimana, ma ogni 30-45 giorni
   */
  orderFrequency: {
    /** Frequenza default se non calcolabile da storico */
    defaultDays: 30,

    /** Frequenza minima (anche se prodotto critico) */
    minDays: 14,

    /** Frequenza massima (prodotti lenti) */
    maxDays: 60,

    /** Per calcolo automatico da storico purchase orders */
    lookbackMonths: 6,
  },

  /**
   * GIORNI DI COPERTURA (Coverage Days)
   * Quanti giorni di stock deve coprire l'ordine
   *
   * Formula NUOVA: Qtà = (consumo_giornaliero × coverage_days) - stock_effettivo
   * Coverage già include safety buffer (no aggiunta separata)
   *
   * ⚠️ NOTA: I valori sotto sono SOLO DOCUMENTAZIONE (esempi con leadTime=3gg)
   * Il calcolo REALE è DINAMICO nella funzione getCoverageDays():
   * - critical: leadTimeDays + 2
   * - high: leadTimeDays + 4
   * - medium: leadTimeDays + 7
   * - low: leadTimeDays + 10
   */
  coverageDays: {
    /** Prodotti CRITICAL/EMERGENCY: leadTime + 2 buffer (esempio: 3+2=5) */
    critical: 5,

    /** Prodotti HIGH urgency: leadTime + 4 buffer (esempio: 3+4=7) */
    high: 7,

    /** Prodotti MEDIUM urgency: leadTime + 7 buffer (esempio: 3+7=10) */
    medium: 10,

    /** Prodotti LOW urgency: leadTime + 10 buffer (esempio: 3+10=13) */
    low: 13,

    /** Default: leadTime + 3 buffer (esempio: 3+3=6) */
    default: 7,
  },

  /**
   * SAFETY STOCK (Stock di Sicurezza)
   * Moltiplicatore basato su affidabilità fornitore e variabilità prodotto
   *
   * Formula: safety_stock = (consumo_giornaliero × lead_time) × multiplier
   */
  safetyStock: {
    /** Fornitori affidabili (reliability > 80) */
    reliable: 0.3,      // +30%

    /** Fornitori medi (reliability 50-80) */
    average: 0.5,       // +50%

    /** Fornitori inaffidabili (reliability < 50) */
    unreliable: 0.8,    // +80%

    /** Prodotti con alta variabilità (variability > 0.8) */
    highVariability: 1.0,  // +100%
  },

  /**
   * OTTIMIZZAZIONE ORDINE FORNITORE
   * Quando valore ordine < minOrderValue, aggiungi prodotti extra
   */
  optimization: {
    /** Abilita aggiunta automatica prodotti per raggiungere valore minimo */
    autoAddProducts: true,

    /** Percentuale target sopra valore minimo (5% = 2100€ target per 2000€ minimo) */
    targetOvershootPercent: 5,

    /** Prodotti da considerare per aggiunta automatica */
    candidateFilters: {
      /** Solo prodotti con consumo medio > X pz/settimana */
      minWeeklySales: 2,

      /** Escludi prodotti con urgency LOW se possibile */
      excludeLowUrgency: false,

      /** Preferisci prodotti con stock < X giorni */
      preferStockDaysBelow: 45,
    }
  },

  /**
   * PARAMETRI CALCOLO AI vs MATEMATICA
   */
  calculation: {
    /** Usa AI Claude per analisi avanzata (se false: solo matematica) */
    useAI: true,

    /** Fallback matematico se AI fallisce */
    mathFallback: true,

    /** Peso AI vs Matematica (0.7 = 70% AI, 30% matematica) */
    aiWeight: 0.7,

    /** Confidence minima AI per accettare suggerimento (altrimenti usa matematica) */
    minAIConfidence: 0.6,
  }
};

/**
 * Helper: Ottieni valore minimo ordine per fornitore
 */
export function getMinOrderValue(supplierName: string): number {
  const custom = ORDER_OPTIMIZATION_CONFIG.minOrderValue.bySupplierName[supplierName];
  return custom || ORDER_OPTIMIZATION_CONFIG.minOrderValue.default;
}

/**
 * Helper: Ottieni giorni copertura per urgency level
 *
 * @param urgencyLevel - Livello urgenza del prodotto
 * @param leadTimeDays - Lead time REALE del fornitore in giorni (da Odoo product.supplierinfo.delay)
 * @returns Giorni di copertura calcolati DINAMICAMENTE: leadTime + buffer basato su urgency
 */
export function getCoverageDays(
  urgencyLevel: 'CRITICAL' | 'EMERGENCY' | 'HIGH' | 'MEDIUM' | 'LOW',
  leadTimeDays: number = 3 // Default fallback se non fornito
): number {
  // CALCOLO DINAMICO: Lead time reale + buffer variabile per urgency
  switch (urgencyLevel) {
    case 'CRITICAL':
    case 'EMERGENCY':
      return leadTimeDays + 2; // Minimo buffer per prodotti critici
    case 'HIGH':
      return leadTimeDays + 4; // Buffer moderato
    case 'MEDIUM':
      return leadTimeDays + 7; // Buffer standard
    case 'LOW':
      return leadTimeDays + 10; // Buffer maggiore per prodotti lenti
    default:
      return leadTimeDays + 3; // Default buffer
  }
}

/**
 * Helper: Ottieni moltiplicatore safety stock
 */
export function getSafetyStockMultiplier(
  reliability: number,
  variability: number
): number {
  const config = ORDER_OPTIMIZATION_CONFIG.safetyStock;

  // Se alta variabilità, usa sempre il valore max
  if (variability > 0.8) {
    return config.highVariability;
  }

  // Altrimenti basati su reliability fornitore
  if (reliability >= 80) {
    return config.reliable;
  } else if (reliability >= 50) {
    return config.average;
  } else {
    return config.unreliable;
  }
}

/**
 * Helper: Calcola frequenza ordini target per fornitore
 * Basato su valore medio prodotti e valore minimo ordine
 */
export function estimateOrderFrequency(
  supplierName: string,
  avgProductValue: number,
  totalProductsCount: number
): number {
  const minValue = getMinOrderValue(supplierName);
  const config = ORDER_OPTIMIZATION_CONFIG.orderFrequency;

  // Stima quanti prodotti servono per raggiungere valore minimo
  const estimatedProductsPerOrder = Math.ceil(minValue / avgProductValue);

  // Se serve ordinare molti prodotti (es. 20 su 50 totali), frequenza alta
  // Se serve ordinare pochi prodotti (es. 5 su 50 totali), frequenza bassa
  const productRatio = estimatedProductsPerOrder / totalProductsCount;

  let frequencyDays: number;

  if (productRatio > 0.5) {
    // Serve ordinare >50% prodotti → ordini frequenti
    frequencyDays = config.minDays + 7;  // ~21 giorni
  } else if (productRatio > 0.3) {
    // Serve ordinare 30-50% prodotti → ordini medi
    frequencyDays = config.defaultDays;  // 30 giorni
  } else if (productRatio > 0.15) {
    // Serve ordinare 15-30% prodotti → ordini rari
    frequencyDays = config.defaultDays + 15;  // 45 giorni
  } else {
    // Serve ordinare <15% prodotti → ordini molto rari
    frequencyDays = config.maxDays;  // 60 giorni
  }

  // Clamp tra min e max
  return Math.max(
    config.minDays,
    Math.min(config.maxDays, frequencyDays)
  );
}
