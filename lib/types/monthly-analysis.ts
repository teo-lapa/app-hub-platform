// Types per Analisi Prezzi Mensile
// Confronto prezzi venduti vs prezzi di riferimento (bloccati o listino base)

export interface MonthlyAnalysisLine {
  // Identificativi
  lineId: number;
  orderId: number;
  orderName: string;
  productId: number;
  productName: string;
  productCode: string;
  customerId: number;
  customerName: string;
  commitmentDate: string; // Data consegna YYYY-MM-DD

  // Quantita e prezzi
  quantity: number;
  soldPrice: number;           // price_unit dalla riga ordine
  referencePrice: number;      // prezzo fisso OPPURE prezzo listino base
  costPrice: number;           // standard_price (costo acquisto)
  discount: number;            // sconto applicato (%)

  // Calcoli
  priceDiffCHF: number;        // soldPrice - referencePrice
  priceDiffPercent: number;    // ((soldPrice - referencePrice) / referencePrice) * 100
  profitCHF: number;           // (soldPrice - costPrice) * quantity
  marginPercent: number;       // ((soldPrice - costPrice) / costPrice) * 100

  // Classificazione
  priceGroup: 'fixed' | 'base_pricelist';
  direction: 'higher' | 'lower' | 'equal';
  referencePricelistName: string;  // Nome listino di riferimento
}

export interface MonthlyAnalysisStats {
  totalLines: number;

  // Gruppo 1 - Prezzi Fissi
  fixedPriceCount: number;
  fixedHigherCount: number;
  fixedLowerCount: number;
  fixedTotalDiffCHF: number;

  // Gruppo 2 - Listino Base
  basePriceCount: number;
  baseHigherCount: number;
  baseLowerCount: number;
  baseTotalDiffCHF: number;

  // Totali
  totalProfitCHF: number;
  averageMarginPercent: number;
}

export interface MonthlyAnalysisResponse {
  success: boolean;
  month: string;
  stats: MonthlyAnalysisStats;
  fixedPriceLines: MonthlyAnalysisLine[];
  basePriceLines: MonthlyAnalysisLine[];
  performanceMs: number;
  error?: string;
}
