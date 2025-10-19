import { createOdooRPCClient } from '@/lib/odoo/rpcClient';
import { RFMScore, ChurnAlert, UpsellOpportunity, OdooClient, OdooOrder } from './types';

/**
 * Customer Intelligence Agent
 * Analizza clienti con RFM, identifica churn risk e opportunità upsell
 */

export class CustomerIntelligenceAgent {
  private odoo = createOdooRPCClient();

  /**
   * Calcola RFM Score per un cliente
   */
  async calculateRFM(customerId: number): Promise<RFMScore> {
    // Fetch orders ultimi 12 mesi
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const orders = await this.odoo.searchRead(
      'sale.order',
      [
        ['partner_id', '=', customerId],
        ['date_order', '>=', oneYearAgo.toISOString().split('T')[0]],
        ['state', 'in', ['sale', 'done']]
      ],
      ['id', 'name', 'partner_id', 'amount_total', 'date_order'],
      0,
      'date_order desc'
    );

    if (orders.length === 0) {
      // Cliente senza ordini
      return {
        customerId,
        name: '',
        recency: 999,
        frequency: 0,
        monetary: 0,
        recencyScore: 1,
        frequencyScore: 1,
        monetaryScore: 1,
        rfmScore: '111',
        segment: '💀 Lost'
      };
    }

    // 1. RECENCY (giorni dall'ultimo ordine)
    const lastOrder = orders[0];
    const lastOrderDate = new Date(lastOrder.date_order);
    const daysSinceLastOrder = Math.floor(
      (Date.now() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const recencyScore =
      daysSinceLastOrder <= 7 ? 5 :
      daysSinceLastOrder <= 30 ? 4 :
      daysSinceLastOrder <= 60 ? 3 :
      daysSinceLastOrder <= 90 ? 2 : 1;

    // 2. FREQUENCY (numero ordini)
    const frequency = orders.length;
    const frequencyScore =
      frequency >= 50 ? 5 :
      frequency >= 30 ? 4 :
      frequency >= 15 ? 3 :
      frequency >= 5 ? 2 : 1;

    // 3. MONETARY (revenue totale)
    const monetary = orders.reduce((sum, o) => sum + o.amount_total, 0);
    const monetaryScore =
      monetary >= 50000 ? 5 :
      monetary >= 30000 ? 4 :
      monetary >= 15000 ? 3 :
      monetary >= 5000 ? 2 : 1;

    // 4. SEGMENT
    const rfmScore = `${recencyScore}${frequencyScore}${monetaryScore}`;
    const segment = this.determineSegment(recencyScore, frequencyScore, monetaryScore);

    return {
      customerId,
      name: lastOrder.partner_id[1],
      recency: daysSinceLastOrder,
      frequency,
      monetary,
      recencyScore,
      frequencyScore,
      monetaryScore,
      rfmScore,
      segment
    };
  }

  /**
   * Determina il segmento cliente basato su RFM
   */
  private determineSegment(r: number, f: number, m: number): string {
    if (r >= 4 && f >= 4 && m >= 4) return '🏆 Champions'; // Best clienti
    if (r >= 3 && f >= 3 && m >= 3) return '⭐ Loyal'; // Fedeli
    if (r >= 4 && f <= 2) return '🌱 New Customers'; // Nuovi promettenti
    if (r <= 2 && f >= 3 && m >= 3) return '⚠️ At Risk'; // A rischio churn
    if (r <= 2 && f <= 2) return '💀 Lost'; // Persi
    if (r >= 3 && f <= 2 && m <= 2) return '💤 Inactive'; // Inattivi
    return '🔵 Regular'; // Normali
  }

  /**
   * Identifica clienti a rischio churn per un venditore
   * NOTA: Se salespersonId > 1000, probabilmente è un hash email - prendi tutti i clienti
   */
  async detectChurnRisks(salespersonId: number): Promise<ChurnAlert[]> {
    // Fetch clienti del venditore
    const domain: any[] = [['customer_rank', '>', 0]];

    // Solo se l'ID sembra valido (< 1000), filtra per venditore
    if (salespersonId < 1000) {
      domain.push(['user_id', '=', salespersonId]);
    }

    const clients = await this.odoo.searchRead(
      'res.partner',
      domain,
      ['id', 'name', 'email', 'phone', 'city', 'user_id'],
      50, // Limit per performance
      'name'
    );

    const churnAlerts: ChurnAlert[] = [];

    for (const client of clients) {
      const rfm = await this.calculateRFM(client.id);

      // Risk factors
      const riskFactors: string[] = [];
      let riskScore = 0;

      // 1. Non ordina da >60 giorni
      if (rfm.recency > 60) {
        riskFactors.push(`Inattivo ${rfm.recency} giorni`);
        riskScore += 30;
      }

      // 2. Recency score basso
      if (rfm.recencyScore <= 2) {
        riskFactors.push('Ordini sempre meno frequenti');
        riskScore += 25;
      }

      // 3. Era un cliente importante (alto M) ma non ordina più
      if (rfm.monetaryScore >= 4 && rfm.recencyScore <= 2) {
        riskFactors.push(`Era cliente alto valore (€${rfm.monetary.toFixed(0)}/anno)`);
        riskScore += 30;
      }

      // 4. Segment "At Risk" o "Lost"
      if (rfm.segment.includes('At Risk') || rfm.segment.includes('Lost')) {
        riskFactors.push(`Segmento: ${rfm.segment}`);
        riskScore += 15;
      }

      // Se ha almeno 2 risk factors, aggiungi alert
      if (riskFactors.length >= 2) {
        const churnProbability = Math.min(100, riskScore);

        churnAlerts.push({
          customer: client,
          rfm,
          riskFactors,
          churnProbability,
          suggestedActions: this.generateWinBackPlan(client, rfm, riskFactors)
        });
      }
    }

    // Ordina per probabilità churn (più alto prima)
    return churnAlerts.sort((a, b) => b.churnProbability - a.churnProbability);
  }

  /**
   * Genera piano di win-back per cliente a rischio
   */
  private generateWinBackPlan(
    client: OdooClient,
    rfm: RFMScore,
    riskFactors: string[]
  ): ChurnAlert['suggestedActions'] {
    const actions: ChurnAlert['suggestedActions'] = [];

    // Action 1: Chiamata immediata
    actions.push({
      priority: rfm.recency > 90 ? 'urgent' : 'high',
      action: `Chiama ${client.name} per capire motivo inattività`,
      expectedROI: rfm.monetary * 0.5, // recupera almeno 50% del valore
      cost: 0
    });

    // Action 2: Offerta speciale
    if (rfm.monetary > 5000) {
      actions.push({
        priority: 'high',
        action: `Offri sconto -15% sul prossimo ordine`,
        expectedROI: rfm.monetary * 0.4,
        cost: rfm.monetary * 0.15 * 0.3 // 15% su 30% dell'annual value
      });
    }

    // Action 3: Visita di persona
    if (rfm.monetaryScore >= 4) {
      actions.push({
        priority: 'high',
        action: 'Visita di persona con campioni gratis',
        expectedROI: rfm.monetary * 0.6,
        cost: 100 // costo campioni + tempo
      });
    }

    return actions;
  }

  /**
   * Identifica opportunità di upsell
   */
  async findUpsellOpportunities(salespersonId: number): Promise<UpsellOpportunity[]> {
    // Fetch top clienti del venditore (Champions e Loyal)
    const clients = await this.odoo.searchRead(
      'res.partner',
      [
        ['user_id', '=', salespersonId],
        ['customer_rank', '>', 0]
      ],
      ['id', 'name'],
      20
    );

    const opportunities: UpsellOpportunity[] = [];

    for (const client of clients) {
      const rfm = await this.calculateRFM(client.id);

      // Solo Champions e Loyal (attivi e fedeli)
      if (!['🏆 Champions', '⭐ Loyal'].some(seg => rfm.segment.includes(seg))) {
        continue;
      }

      // Calcola potenziale (assumiamo +20% per clienti buoni)
      const currentSpend = rfm.monetary;
      const potentialSpend = currentSpend * 1.2;
      const gap = potentialSpend - currentSpend;

      opportunities.push({
        customer: client,
        currentSpend,
        potentialSpend,
        gap,
        suggestions: [
          {
            product: 'Bundle Premium',
            reason: 'Cliente ad alto valore, proponi prodotti premium',
            estimatedRevenue: gap * 0.5
          },
          {
            product: 'Contratto annuale',
            reason: 'Frequenza alta, offri contratto con sconto volume',
            estimatedRevenue: gap * 0.3
          }
        ]
      });
    }

    // Ordina per gap (maggiore opportunità prima)
    return opportunities.sort((a, b) => b.gap - a.gap).slice(0, 10);
  }

  /**
   * Analizza cliente specifico
   */
  async analyzeClient(clientId: number): Promise<{
    rfm: RFMScore;
    isChurnRisk: boolean;
    hasUpsellPotential: boolean;
    insights: string[];
  }> {
    const rfm = await this.calculateRFM(clientId);
    const insights: string[] = [];

    // Churn risk
    const isChurnRisk = rfm.recency > 60 || rfm.recencyScore <= 2;
    if (isChurnRisk) {
      insights.push(`⚠️ ATTENZIONE: Cliente non ordina da ${rfm.recency} giorni`);
    }

    // Upsell potential
    const hasUpsellPotential = rfm.rfmScore.startsWith('4') || rfm.rfmScore.startsWith('5');
    if (hasUpsellPotential) {
      insights.push(`💰 OPPORTUNITÀ: Cliente alto valore (€${rfm.monetary.toFixed(0)}/anno)`);
    }

    // Segment insights
    if (rfm.segment.includes('Champions')) {
      insights.push('🏆 Cliente top! Mantieni la relazione con check-in regolari');
    } else if (rfm.segment.includes('Loyal')) {
      insights.push('⭐ Cliente fedele. Ottimo per upsell e referral');
    } else if (rfm.segment.includes('New')) {
      insights.push('🌱 Cliente nuovo. Fondamentale prima impressione!');
    }

    return {
      rfm,
      isChurnRisk,
      hasUpsellPotential,
      insights
    };
  }
}

// Export singleton instance
export const customerIntel = new CustomerIntelligenceAgent();
