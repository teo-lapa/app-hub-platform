/**
 * LAPA Smart Ordering - Smart Alert System
 *
 * Sistema intelligente di alert per NON rimanere MAI senza prodotto!
 *
 * Funzionalità:
 * - Monitora stock in tempo reale
 * - Compara previsioni vs lead time
 * - Invia notifiche proattive
 * - Suggerisce azioni immediate
 */

import { aiPredictionEngine, type AIPrediction } from './ai-prediction-engine';
import { searchReadOdoo } from '@/lib/odoo/odoo-helper';

export interface SmartAlert {
  id: string;
  productId: number;
  productName: string;

  severity: 'EMERGENCY' | 'CRITICAL' | 'WARNING';
  alertType: 'STOCKOUT_IMMINENT' | 'LOW_STOCK' | 'SUPPLIER_DELAY' | 'TREND_SPIKE';

  message: string;
  actionRequired: string;

  // Metrics
  currentStock: number;
  daysUntilStockout: number;
  supplierLeadTime: number;

  // Recommendations
  recommendedAction: 'ORDER_NOW' | 'ORDER_TODAY' | 'ORDER_THIS_WEEK' | 'MONITOR';
  recommendedQty: number;
  alternativeSuppliers?: Array<{
    supplierId: number;
    supplierName: string;
    leadTime: number;
    reason: string;
  }>;

  // Status
  isResolved: boolean;
  createdAt: Date;
  expiresAt: Date;

  // Priority (per ordinamento)
  priority: number;  // 1-100 (1 = massima urgenza)
}

export interface AlertSummary {
  totalAlerts: number;
  emergencyCount: number;
  criticalCount: number;
  warningCount: number;
  unresolvedCount: number;

  topUrgentProducts: SmartAlert[];

  estimatedStockoutValue: number;  // € valore prodotti a rischio
  productsAtRisk: number;
}

class SmartAlertSystem {
  /**
   * Calcola priorità alert (1-100, 1 = massima urgenza)
   */
  private calculatePriority(
    severity: SmartAlert['severity'],
    daysUntilStockout: number,
    supplierLeadTime: number
  ): number {
    let priority = 50;

    // Severity weight
    if (severity === 'EMERGENCY') priority = 1;
    else if (severity === 'CRITICAL') priority = 10;
    else priority = 30;

    // Aggiungi giorni rimanenti (meno giorni = più urgente)
    priority += Math.max(0, Math.min(20, daysUntilStockout));

    // Penalizza se lead time lungo
    if (daysUntilStockout < supplierLeadTime) {
      priority = Math.max(1, priority - 10);
    }

    return Math.min(100, Math.max(1, priority));
  }

  /**
   * Genera alert per un prodotto basato su predizione AI
   */
  private generateAlert(prediction: AIPrediction): SmartAlert | null {
    // Solo per prodotti urgenti
    if (prediction.urgencyLevel === 'LOW') {
      return null;
    }

    let severity: SmartAlert['severity'];
    let alertType: SmartAlert['alertType'];
    let message: string;
    let actionRequired: string;
    let recommendedAction: SmartAlert['recommendedAction'];

    // Determina severity e tipo
    if (prediction.urgencyLevel === 'EMERGENCY') {
      severity = 'EMERGENCY';
      alertType = 'STOCKOUT_IMMINENT';
      message = `🚨 EMERGENZA! ${prediction.productName} sta finendo o è già esaurito. Stock-out tra ${prediction.daysUntilStockout.toFixed(1)} giorni, ma lead time fornitore è ${prediction.supplierLeadTime} giorni!`;
      actionRequired = `ORDINARE IMMEDIATAMENTE ${prediction.recommendedOrderQty} unità. Considera fornitore alternativo urgente se possibile.`;
      recommendedAction = 'ORDER_NOW';
    } else if (prediction.urgencyLevel === 'CRITICAL') {
      severity = 'CRITICAL';
      alertType = 'STOCKOUT_IMMINENT';
      message = `🔴 CRITICO! ${prediction.productName} rischio stock-out tra ${prediction.daysUntilStockout.toFixed(1)} giorni. Lead time fornitore: ${prediction.supplierLeadTime} giorni.`;
      actionRequired = `Ordinare ${prediction.recommendedOrderQty} unità OGGI per evitare stock-out.`;
      recommendedAction = 'ORDER_TODAY';
    } else if (prediction.urgencyLevel === 'HIGH') {
      severity = 'CRITICAL';
      alertType = 'LOW_STOCK';
      message = `🟠 Stock basso: ${prediction.productName} dura ${prediction.daysUntilStockout.toFixed(1)} giorni. Lead time: ${prediction.supplierLeadTime} giorni.`;
      actionRequired = `Ordinare ${prediction.recommendedOrderQty} unità questa settimana.`;
      recommendedAction = 'ORDER_THIS_WEEK';
    } else {
      severity = 'WARNING';
      alertType = 'LOW_STOCK';
      message = `⚠️  ${prediction.productName}: stock medio-basso (${prediction.daysUntilStockout.toFixed(1)} giorni rimanenti).`;
      actionRequired = `Pianificare ordine di ${prediction.recommendedOrderQty} unità.`;
      recommendedAction = 'MONITOR';
    }

    // Aggiungi risk factors al messaggio
    if (prediction.riskFactors.length > 0) {
      message += `\n\n⚠️  Fattori di rischio:\n${prediction.riskFactors.map(f => `- ${f}`).join('\n')}`;
    }

    const priority = this.calculatePriority(
      severity,
      prediction.daysUntilStockout,
      prediction.supplierLeadTime
    );

    const alert: SmartAlert = {
      id: `alert-${prediction.productId}-${Date.now()}`,
      productId: prediction.productId,
      productName: prediction.productName,
      severity,
      alertType,
      message,
      actionRequired,
      currentStock: prediction.next7DaysForecast[0].predictedStock,
      daysUntilStockout: prediction.daysUntilStockout,
      supplierLeadTime: prediction.supplierLeadTime,
      recommendedAction,
      recommendedQty: prediction.recommendedOrderQty,
      alternativeSuppliers: prediction.alternativeSuppliers,
      isResolved: false,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
      priority
    };

    return alert;
  }

  /**
   * Scansiona tutti i prodotti e genera alert
   */
  async scanAllProducts(): Promise<SmartAlert[]> {
    console.log('\n🔍 SCAN PRODOTTI per alert...');
    console.log('━'.repeat(60));

    try {
      // 1. Recupera tutti i prodotti con stock > 0
      const products = await searchReadOdoo(
        'product.product',
        [
          ['qty_available', '>', 0],
          ['type', '=', 'product']
        ],
        ['id', 'name', 'qty_available'],
        100
      );

      console.log(`   Trovati ${products.length} prodotti da analizzare`);

      // 2. Genera predizioni AI per tutti
      const productIds = products.map((p: any) => p.id);
      const predictions = await aiPredictionEngine.predictProducts(productIds);

      // 3. Genera alert per prodotti urgenti
      const alerts: SmartAlert[] = [];

      predictions.forEach(prediction => {
        const alert = this.generateAlert(prediction);
        if (alert) {
          alerts.push(alert);
        }
      });

      // 4. Ordina per priorità
      alerts.sort((a, b) => a.priority - b.priority);

      console.log(`\n✅ Generati ${alerts.length} alert`);
      console.log(`   - EMERGENCY: ${alerts.filter(a => a.severity === 'EMERGENCY').length}`);
      console.log(`   - CRITICAL: ${alerts.filter(a => a.severity === 'CRITICAL').length}`);
      console.log(`   - WARNING: ${alerts.filter(a => a.severity === 'WARNING').length}`);

      return alerts;

    } catch (error: any) {
      console.error('❌ Errore scan prodotti:', error.message);
      throw error;
    }
  }

  /**
   * Scansiona prodotti specifici
   */
  async scanProducts(productIds: number[]): Promise<SmartAlert[]> {
    console.log(`\n🔍 SCAN ${productIds.length} prodotti specifici...`);

    try {
      const predictions = await aiPredictionEngine.predictProducts(productIds);

      const alerts: SmartAlert[] = [];

      predictions.forEach(prediction => {
        const alert = this.generateAlert(prediction);
        if (alert) {
          alerts.push(alert);
        }
      });

      alerts.sort((a, b) => a.priority - b.priority);

      return alerts;

    } catch (error: any) {
      console.error('❌ Errore scan prodotti:', error.message);
      throw error;
    }
  }

  /**
   * Genera summary degli alert
   */
  async getAlertSummary(alerts: SmartAlert[]): Promise<AlertSummary> {
    const emergencyCount = alerts.filter(a => a.severity === 'EMERGENCY').length;
    const criticalCount = alerts.filter(a => a.severity === 'CRITICAL').length;
    const warningCount = alerts.filter(a => a.severity === 'WARNING').length;
    const unresolvedCount = alerts.filter(a => !a.isResolved).length;

    // Top 5 più urgenti
    const topUrgentProducts = alerts
      .filter(a => !a.isResolved)
      .slice(0, 5);

    // Calcola valore a rischio (stima)
    let estimatedStockoutValue = 0;
    const productsAtRisk = new Set<number>();

    alerts.forEach(alert => {
      if (alert.severity === 'EMERGENCY' || alert.severity === 'CRITICAL') {
        productsAtRisk.add(alert.productId);
        // Stima: assumiamo €10/unità medio
        estimatedStockoutValue += alert.currentStock * 10;
      }
    });

    return {
      totalAlerts: alerts.length,
      emergencyCount,
      criticalCount,
      warningCount,
      unresolvedCount,
      topUrgentProducts,
      estimatedStockoutValue: Math.round(estimatedStockoutValue),
      productsAtRisk: productsAtRisk.size
    };
  }

  /**
   * Invia notifiche (placeholder per Telegram/Email/Push)
   */
  async sendNotifications(alerts: SmartAlert[]): Promise<void> {
    const urgentAlerts = alerts.filter(
      a => (a.severity === 'EMERGENCY' || a.severity === 'CRITICAL') && !a.isResolved
    );

    if (urgentAlerts.length === 0) {
      console.log('✅ Nessun alert urgente da notificare');
      return;
    }

    console.log(`📧 Invio ${urgentAlerts.length} notifiche urgenti...`);

    // TODO: Implementa invio Telegram
    // TODO: Implementa invio Email
    // TODO: Implementa push notifications

    const message = this.formatTelegramMessage(urgentAlerts);
    console.log('\n📱 MESSAGGIO TELEGRAM:\n');
    console.log(message);
  }

  /**
   * Formatta messaggio per Telegram
   */
  private formatTelegramMessage(alerts: SmartAlert[]): string {
    const lines: string[] = [];

    lines.push('🚨 *LAPA SMART ORDERING ALERT*');
    lines.push('');
    lines.push(`⚠️  *${alerts.length} prodotti richiedono attenzione urgente*`);
    lines.push('');

    alerts.slice(0, 10).forEach((alert, index) => {
      const emoji = alert.severity === 'EMERGENCY' ? '🔴' : '🟠';
      lines.push(`${emoji} *${alert.productName}*`);
      lines.push(`   Stock-out tra: ${alert.daysUntilStockout.toFixed(1)} giorni`);
      lines.push(`   Azione: ${alert.actionRequired}`);
      lines.push('');
    });

    if (alerts.length > 10) {
      lines.push(`... e altri ${alerts.length - 10} prodotti`);
      lines.push('');
    }

    lines.push('👉 Apri dashboard: https://app.lapa.com/ordini-smart');

    return lines.join('\n');
  }

  /**
   * Risolvi alert
   */
  async resolveAlert(alertId: string): Promise<void> {
    console.log(`✅ Alert ${alertId} risolto`);
    // TODO: Salva in database
  }

  /**
   * Risolvi alert per prodotto (quando ordine creato)
   */
  async resolveAlertsForProduct(productId: number): Promise<void> {
    console.log(`✅ Alert prodotto ${productId} risolti (ordine creato)`);
    // TODO: Aggiorna database
  }
}

// Export singleton
export const smartAlertSystem = new SmartAlertSystem();
