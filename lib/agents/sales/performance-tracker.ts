import { createOdooRPCClient } from '@/lib/odoo/rpcClient';
import { SalesKPIs, SalespersonContext } from './types';

/**
 * Performance Tracker Agent
 * Traccia e calcola KPI venditori in real-time
 */

export class PerformanceTrackerAgent {
  private odoo = createOdooRPCClient();

  /**
   * Recupera KPI per un venditore (usa odoo_user_id per query!)
   */
  async getKPIs(
    salespersonContext: SalespersonContext,
    period: { start: Date; end: Date } = this.getCurrentMonth()
  ): Promise<SalesKPIs> {
    const userId = salespersonContext.odoo_user_id;

    const [orders, salesperson] = await Promise.all([
      this.getOrders(userId, period),
      this.getSalesperson(userId)
    ]);

    // Calculate revenue
    const revenue = orders.reduce((sum, o) => sum + o.amount_total, 0);
    const target = 50000; // €50k/mese (default - TODO: get from Odoo)

    // Calculate vs last period
    const lastPeriod = this.getLastPeriod(period);
    const lastOrders = await this.getOrders(userId, lastPeriod);
    const lastRevenue = lastOrders.reduce((sum, o) => sum + o.amount_total, 0);
    const vs_last_period = lastRevenue > 0
      ? ((revenue - lastRevenue) / lastRevenue) * 100
      : 0;

    // Activity metrics (simplified - in futuro fetch da crm.activity)
    const activity = {
      visits: Math.floor(orders.length * 0.3), // stima: 30% ordini da visite
      calls: Math.floor(orders.length * 0.5),
      emails: Math.floor(orders.length * 0.2),
      meetings: Math.floor(orders.length * 0.1)
    };

    // Client metrics
    const uniqueClients = new Set(orders.map(o => o.partner_id[0]));
    const total = uniqueClients.size;

    // New clients (creati in questo periodo)
    const newClients = await this.odoo.searchRead(
      'res.partner',
      [
        ['user_id', '=', userId],
        ['create_date', '>=', period.start.toISOString()],
        ['create_date', '<=', period.end.toISOString()],
        ['customer_rank', '>', 0]
      ],
      ['id'],
      0
    );

    // Retention (clienti che hanno riordinato)
    const retention_rate = total > 0 ? (total / (total + newClients.length)) * 100 : 100;

    // Deals
    const avgDealSize = orders.length > 0 ? revenue / orders.length : 0;

    return {
      salespersonId: userId,
      name: salesperson?.name || 'Unknown',
      period,
      revenue: {
        total: revenue,
        target,
        progress: (revenue / target) * 100,
        vs_last_period
      },
      activity,
      clients: {
        total,
        new: newClients.length,
        retention_rate
      },
      deals: {
        closed: orders.length,
        avg_deal_size: avgDealSize
      }
    };
  }

  /**
   * Confronta performance di più venditori (leaderboard)
   */
  async getLeaderboard(
    salespersonIds: number[],
    period: { start: Date; end: Date } = this.getCurrentMonth()
  ): Promise<SalesKPIs[]> {
    const kpis = await Promise.all(
      salespersonIds.map(id => this.getKPIs({
        id,
        name: '',
        odoo_user_id: id
      }, period))
    );

    // Ordina per revenue (più alto prima)
    return kpis.sort((a, b) => b.revenue.total - a.revenue.total);
  }

  /**
   * Helper: get orders for salesperson
   * NOTA: Se salespersonId > 1000, probabilmente è un hash email - ignora filtro e prendi tutti
   */
  private async getOrders(salespersonId: number, period: { start: Date; end: Date }) {
    const domain: any[] = [
      ['date_order', '>=', period.start.toISOString()],
      ['date_order', '<=', period.end.toISOString()],
      ['state', 'in', ['sale', 'done']]
    ];

    // Solo se l'ID sembra valido (< 1000), filtra per venditore
    if (salespersonId < 1000) {
      domain.push(['user_id', '=', salespersonId]);
    }

    return await this.odoo.searchRead(
      'sale.order',
      domain,
      ['id', 'name', 'partner_id', 'amount_total', 'date_order', 'user_id'],
      100, // Limit per performance
      'date_order desc'
    );
  }

  /**
   * Helper: get salesperson info
   */
  private async getSalesperson(salespersonId: number) {
    const users = await this.odoo.searchRead(
      'res.users',
      [['id', '=', salespersonId]],
      ['id', 'name', 'login'],
      1
    );
    return users[0] || null;
  }

  /**
   * Helper: get current month period
   */
  private getCurrentMonth(): { start: Date; end: Date } {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return { start, end };
  }

  /**
   * Helper: get last period (same duration as input period)
   */
  private getLastPeriod(period: { start: Date; end: Date }): { start: Date; end: Date } {
    const duration = period.end.getTime() - period.start.getTime();
    return {
      start: new Date(period.start.getTime() - duration),
      end: new Date(period.end.getTime() - duration)
    };
  }

  /**
   * Format KPIs as readable text
   */
  formatKPIs(kpis: SalesKPIs): string {
    const { revenue, clients, deals } = kpis;

    return `
📊 **Performance ${kpis.name}**

💰 **Revenue**
- Totale: €${revenue.total.toLocaleString('it-IT', { maximumFractionDigits: 0 })}
- Target: €${revenue.target.toLocaleString('it-IT', { maximumFractionDigits: 0 })}
- Progress: ${revenue.progress.toFixed(0)}% ${revenue.progress >= 100 ? '✅' : revenue.progress >= 80 ? '⚠️' : '❌'}
- vs mese scorso: ${revenue.vs_last_period > 0 ? '+' : ''}${revenue.vs_last_period.toFixed(1)}%

👥 **Clienti**
- Totale attivi: ${clients.total}
- Nuovi acquisiti: ${clients.new}
- Retention: ${clients.retention_rate.toFixed(0)}%

💼 **Deals**
- Chiusi: ${deals.closed}
- Valore medio: €${deals.avg_deal_size.toLocaleString('it-IT', { maximumFractionDigits: 0 })}
    `.trim();
  }
}

// Export singleton instance
export const performanceTracker = new PerformanceTrackerAgent();
