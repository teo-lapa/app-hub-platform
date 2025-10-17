/**
 * LAPA Smart Ordering - Sales Analyzer
 *
 * Analizza vendite REALI dai sale orders Odoo
 * IMPORTANTE: Usa data CONSEGNA effettiva, NON data creazione ordine!
 */

import { searchReadOdoo } from '@/lib/odoo/odoo-helper';

export interface SalesHistory {
  productId: number;
  productName: string;

  // Sales metrics
  totalSold3Months: number;
  totalRevenue: number;
  avgDailySales: number;
  avgWeeklySales: number;
  avgMonthlySales: number;

  // Trend analysis
  trend: 'growing' | 'stable' | 'declining' | 'volatile';
  trendPercentage: number;      // % crescita/decrescita
  variability: number;           // 0-1 (coefficiente variazione)

  // Pattern settimanale
  weekdayPattern: {
    [key: string]: number;       // % vendite per giorno settimana
  };
  peakDay: string;

  // Customer insights
  totalCustomers: number;
  recurringCustomers: number;    // Clienti con 2+ ordini
  avgOrderSize: number;

  // Sample info
  orderCount: number;
  periodFrom: Date;
  periodTo: Date;

  // Weekly breakdown
  weeklyData: {
    weekStart: Date;
    quantitySold: number;
    revenue: number;
    orderCount: number;
  }[];
}

interface SaleOrderLine {
  id: number;
  order_id: [number, string];
  product_id: [number, string] | false;
  product_uom_qty: number;
  price_subtotal: number;
  order_partner_id: [number, string];
  // Date dalla relazione order
  order_date_order: string;
  order_commitment_date: string | false;  // Data consegna promessa
  order_effective_date: string | false;   // Data consegna EFFETTIVA
  order_state: string;
}

class SalesAnalyzer {
  /**
   * Calcola trend: compara primo mese vs ultimo mese
   */
  private calculateTrend(weeklyData: Array<{ weekStart: Date; quantitySold: number }>): {
    trend: 'growing' | 'stable' | 'declining' | 'volatile';
    percentage: number;
  } {
    if (weeklyData.length < 4) {
      return { trend: 'stable', percentage: 0 };
    }

    // Compara media primi 4 settimane vs ultimi 4 settimane
    const firstWeeks = weeklyData.slice(0, 4);
    const lastWeeks = weeklyData.slice(-4);

    const firstAvg = firstWeeks.reduce((sum, w) => sum + w.quantitySold, 0) / 4;
    const lastAvg = lastWeeks.reduce((sum, w) => sum + w.quantitySold, 0) / 4;

    const changePercent = firstAvg > 0 ? ((lastAvg - firstAvg) / firstAvg) * 100 : 0;

    // Calcola variabilità per detectare volatile
    const allQty = weeklyData.map(w => w.quantitySold);
    const mean = allQty.reduce((sum, q) => sum + q, 0) / allQty.length;
    const stdDev = Math.sqrt(
      allQty.reduce((sum, q) => sum + Math.pow(q - mean, 2), 0) / allQty.length
    );
    const cv = mean > 0 ? stdDev / mean : 0;

    // Volatile se CV > 0.5
    if (cv > 0.5) {
      return { trend: 'volatile', percentage: changePercent };
    }

    // Growing se > +15%
    if (changePercent > 15) {
      return { trend: 'growing', percentage: changePercent };
    }

    // Declining se < -15%
    if (changePercent < -15) {
      return { trend: 'declining', percentage: changePercent };
    }

    return { trend: 'stable', percentage: changePercent };
  }

  /**
   * Calcola pattern settimanale (quale giorno si vende di più)
   */
  private calculateWeekdayPattern(
    salesByDate: Array<{ date: Date; quantity: number }>
  ): { pattern: { [key: string]: number }; peakDay: string } {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const salesByDay: { [key: string]: number } = {};

    // Inizializza
    days.forEach(day => salesByDay[day] = 0);

    // Aggrega per giorno settimana
    salesByDate.forEach(sale => {
      const dayName = days[sale.date.getDay()];
      salesByDay[dayName] += sale.quantity;
    });

    // Calcola totale
    const total = Object.values(salesByDay).reduce((sum, val) => sum + val, 0);

    // Converte in percentuali
    const pattern: { [key: string]: number } = {};
    days.forEach(day => {
      pattern[day] = total > 0 ? (salesByDay[day] / total) * 100 : 0;
    });

    // Trova peak day
    let peakDay = 'tuesday'; // Default LAPA
    let maxPercent = 0;

    Object.entries(pattern).forEach(([day, percent]) => {
      if (percent > maxPercent) {
        maxPercent = percent;
        peakDay = day;
      }
    });

    return { pattern, peakDay };
  }

  /**
   * Raggruppa vendite per settimana
   */
  private groupByWeek(
    salesByDate: Array<{ date: Date; quantity: number; revenue: number }>
  ): Array<{ weekStart: Date; quantitySold: number; revenue: number; orderCount: number }> {
    const weekMap = new Map<string, { quantitySold: number; revenue: number; orderCount: number }>();

    salesByDate.forEach(sale => {
      // Trova lunedì della settimana
      const date = new Date(sale.date);
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Lunedì
      const monday = new Date(date.setDate(diff));
      monday.setHours(0, 0, 0, 0);

      const weekKey = monday.toISOString().split('T')[0];

      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, { quantitySold: 0, revenue: 0, orderCount: 0 });
      }

      const week = weekMap.get(weekKey)!;
      week.quantitySold += sale.quantity;
      week.revenue += sale.revenue;
      week.orderCount += 1;
    });

    // Converti in array ordinato
    return Array.from(weekMap.entries())
      .map(([weekKey, data]) => ({
        weekStart: new Date(weekKey),
        quantitySold: data.quantitySold,
        revenue: data.revenue,
        orderCount: data.orderCount
      }))
      .sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime());
  }

  /**
   * MAIN: Analizza vendite per un prodotto
   */
  async analyzeProduct(productId: number, monthsHistory: number = 3): Promise<SalesHistory> {
    console.log(`📊 Analisi vendite prodotto ${productId}...`);

    // Calcola periodo
    const periodTo = new Date();
    const periodFrom = new Date();
    periodFrom.setMonth(periodFrom.getMonth() - monthsHistory);
    const periodFromStr = periodFrom.toISOString().split('T')[0];

    try {
      // 1. Prima recupera gli ordini con date consegna valide
      const orders = await searchReadOdoo(
        'sale.order',
        [
          ['state', 'in', ['sale', 'done']],
          ['effective_date', '!=', false],
          ['effective_date', '>=', periodFromStr]
        ],
        ['id', 'name', 'partner_id', 'date_order', 'commitment_date', 'effective_date', 'state'],
        500
      ) as any[];

      if (orders.length === 0) {
        throw new Error('Nessun ordine trovato nel periodo');
      }

      const orderIds = orders.map((o: any) => o.id);

      // 2. Recupera le righe per questo prodotto da questi ordini
      const lines = await searchReadOdoo(
        'sale.order.line',
        [
          ['product_id', '=', productId],
          ['order_id', 'in', orderIds]
        ],
        ['order_id', 'product_id', 'product_uom_qty', 'price_subtotal'],
        500
      ) as any[];

      // 3. Crea mappa ordini per lookup veloce
      const orderMap = new Map();
      orders.forEach((order: any) => {
        orderMap.set(order.id, order);
      });

      console.log(`   Trovate ${lines.length} vendite`);

      if (lines.length === 0) {
        throw new Error('Nessuna vendita trovata per questo prodotto');
      }

      const productName = lines[0].product_id[1];

      // 4. Elabora dati vendite
      const salesByDate: Array<{ date: Date; quantity: number; revenue: number; customerId: number }> = [];
      const customerSet = new Set<number>();
      const customerOrderCount = new Map<number, number>();

      lines.forEach(line => {
        // Trova l'ordine corrispondente
        const orderId = Array.isArray(line.order_id) ? line.order_id[0] : line.order_id;
        const order = orderMap.get(orderId);

        if (!order) {
          console.warn(`   ⚠️  Ordine ${orderId} non trovato`);
          return;
        }

        const effectiveDate = order.effective_date || order.commitment_date;

        if (!effectiveDate) {
          console.warn(`   ⚠️  Skip riga senza data consegna`);
          return;
        }

        const deliveryDate = new Date(effectiveDate);
        const quantity = line.product_uom_qty || 0;
        const revenue = line.price_subtotal || 0;
        const customerId = Array.isArray(order.partner_id) ? order.partner_id[0] : 0;

        salesByDate.push({
          date: deliveryDate,
          quantity,
          revenue,
          customerId
        });

        // Track customers
        if (customerId) {
          customerSet.add(customerId);
          customerOrderCount.set(customerId, (customerOrderCount.get(customerId) || 0) + 1);
        }
      });

      // 3. Calcola metriche base
      const totalSold = salesByDate.reduce((sum, s) => sum + s.quantity, 0);
      const totalRevenue = salesByDate.reduce((sum, s) => sum + s.revenue, 0);

      const daysDiff = (periodTo.getTime() - periodFrom.getTime()) / (1000 * 60 * 60 * 24);
      const avgDailySales = totalSold / daysDiff;
      const avgWeeklySales = avgDailySales * 7;
      const avgMonthlySales = avgDailySales * 30;

      // 4. Customer insights
      const totalCustomers = customerSet.size;
      const recurringCustomers = Array.from(customerOrderCount.values()).filter(count => count >= 2).length;
      const avgOrderSize = totalSold / lines.length;

      // 5. Raggruppa per settimana
      const weeklyData = this.groupByWeek(salesByDate);

      // 6. Calcola trend
      const { trend, percentage: trendPercentage } = this.calculateTrend(weeklyData);

      // 7. Calcola variability
      const quantities = weeklyData.map(w => w.quantitySold);
      const mean = quantities.reduce((sum, q) => sum + q, 0) / quantities.length;
      const stdDev = Math.sqrt(
        quantities.reduce((sum, q) => sum + Math.pow(q - mean, 2), 0) / quantities.length
      );
      const variability = mean > 0 ? stdDev / mean : 0;

      // 8. Pattern settimanale
      const { pattern: weekdayPattern, peakDay } = this.calculateWeekdayPattern(salesByDate);

      console.log(`   📈 Vendite totali: ${totalSold.toFixed(1)} | Media/gg: ${avgDailySales.toFixed(1)}`);
      console.log(`   📊 Trend: ${trend} (${trendPercentage.toFixed(1)}%) | Variability: ${variability.toFixed(2)}`);
      console.log(`   👥 Clienti: ${totalCustomers} (${recurringCustomers} ricorrenti)`);
      console.log(`   ⭐ Peak day: ${peakDay}`);

      return {
        productId,
        productName,
        totalSold3Months: Math.round(totalSold * 10) / 10,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        avgDailySales: Math.round(avgDailySales * 10) / 10,
        avgWeeklySales: Math.round(avgWeeklySales * 10) / 10,
        avgMonthlySales: Math.round(avgMonthlySales * 10) / 10,
        trend,
        trendPercentage: Math.round(trendPercentage * 10) / 10,
        variability: Math.round(variability * 100) / 100,
        weekdayPattern,
        peakDay,
        totalCustomers,
        recurringCustomers,
        avgOrderSize: Math.round(avgOrderSize * 10) / 10,
        orderCount: lines.length,
        periodFrom,
        periodTo,
        weeklyData
      };

    } catch (error: any) {
      console.error(`   ❌ Errore analisi prodotto ${productId}:`, error.message);
      throw error;
    }
  }

  /**
   * Analizza vendite per lista prodotti
   */
  async analyzeProducts(productIds: number[], monthsHistory: number = 3): Promise<SalesHistory[]> {
    console.log(`📊 Analisi vendite ${productIds.length} prodotti...`);

    const results: SalesHistory[] = [];

    for (const productId of productIds) {
      try {
        const analysis = await this.analyzeProduct(productId, monthsHistory);
        results.push(analysis);
      } catch (error: any) {
        console.warn(`   ⚠️  Skip prodotto ${productId}:`, error.message);
      }
    }

    console.log(`   ✅ Analizzati ${results.length}/${productIds.length} prodotti`);

    return results;
  }

  /**
   * Analizza TUTTI i prodotti con stock > 0
   */
  async analyzeAllProducts(monthsHistory: number = 3): Promise<SalesHistory[]> {
    console.log('📊 Analisi vendite TUTTI i prodotti...');

    try {
      // 1. Trova tutti i prodotti con vendite recenti
      const periodFrom = new Date();
      periodFrom.setMonth(periodFrom.getMonth() - monthsHistory);
      const periodFromStr = periodFrom.toISOString().split('T')[0];

      const lines = await searchReadOdoo(
        'sale.order.line',
        [
          ['order_id.state', 'in', ['sale', 'done']],
          ['order_id.effective_date', '>=', periodFromStr],
          ['product_id', '!=', false]
        ],
        ['product_id'],
        1000
      ) as any[];

      // Estrai product IDs unici
      const productIds = Array.from(new Set(lines.map((l: any) => l.product_id[0])));

      console.log(`   Trovati ${productIds.length} prodotti venduti`);

      // 2. Analizza ogni prodotto
      return await this.analyzeProducts(productIds, monthsHistory);

    } catch (error: any) {
      console.error('❌ Errore analisi prodotti:', error.message);
      throw error;
    }
  }
}

// Export singleton
export const salesAnalyzer = new SalesAnalyzer();
