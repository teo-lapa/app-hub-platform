/**
 * API COMPENSI VENDITORI - DASHBOARD LIVE (TEAM-BASED)
 *
 * Restituisce dati real-time sui compensi dei TEAM di vendita LAPA:
 * - Fatturato mese corrente per team
 * - Totale clienti attivi del team
 * - Clienti qualificati per bonus (3-8 mesi)
 * - Clienti non qualificati (troppo nuovi <3 mesi / troppo vecchi ≥9 mesi)
 *
 * GET /api/compensi-venditori
 * GET /api/compensi-venditori?teamId=5 (singolo team)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

const SALES_TEAMS = [
  { id: 5, name: 'La Squadra del Successo' },
  { id: 9, name: 'I Campioni del Gusto' },
  { id: 12, name: 'I Custodi della Tradizione' }
];
const THRESHOLD_TIER1 = 80000; // Inizio scaglione 1 (2.5%)
const THRESHOLD = 95000; // Soglia principale - Scaglione 2 (8%)

interface ClientInfo {
  id: number;
  name: string;
  first_order_date: string;
  age_months: number;
  revenue_current_month: number;
}

interface TeamData {
  id: number;
  name: string;
  revenue_current_month: number;
  revenue_paid: number; // Fatturato pagato
  payment_percentage: number; // Percentuale di pagamento
  threshold: number;
  threshold_met: boolean;
  bonus: number; // Bonus reale (per retrocompatibilità)
  bonus_theoretical: number; // Bonus teorico (se tutto fosse pagato)
  bonus_real: number; // Bonus reale (proporzionale al pagato)
  total_clients: number;
  qualified_clients: {
    count: number;
    revenue: number;
    percentage: string;
    list: ClientInfo[];
  };
  too_new_clients: {
    count: number;
    revenue: number;
    percentage: string;
    list: ClientInfo[];
  };
  too_old_clients: {
    count: number;
    revenue: number;
    percentage: string;
    list: ClientInfo[];
  };
}

function getFirstOrderDate(
  partnerId: number,
  allOrders: any[],
  partnerToParent: Record<number, number>
): string | null {
  const parentId = partnerToParent[partnerId] || partnerId;

  const groupPartnerIds = Object.keys(partnerToParent)
    .filter((id) => partnerToParent[parseInt(id)] === parentId)
    .map((id) => parseInt(id));

  const groupOrders = allOrders
    .filter((ord) => groupPartnerIds.includes(ord.partner_id[0]))
    .sort((a, b) => new Date(a.commitment_date).getTime() - new Date(b.commitment_date).getTime());

  return groupOrders.length > 0 ? groupOrders[0].commitment_date : null;
}

function getMonthsSinceFirstOrder(firstOrderDate: string, referenceDate: string): number {
  const first = new Date(firstOrderDate);
  const ref = new Date(referenceDate);

  let months = (ref.getFullYear() - first.getFullYear()) * 12;
  months += ref.getMonth() - first.getMonth();

  if (ref.getDate() < first.getDate()) {
    months--;
  }

  return months;
}

async function getTeamData(
  cookies: string,
  teamId: number,
  teamName: string,
  startDateStr: string,
  endDateStr: string,
  isCurrentMonth: boolean
): Promise<TeamData> {
  let activePartnerIds: number[] = [];
  let revenueMonth = 0;
  let monthOrders: any[] = [];
  let monthInvoices: any[] = [];

  if (isCurrentMonth) {
    // MESE CORRENTE: usa ordini con commitment_date
    monthOrders = await callOdoo(cookies, 'sale.order', 'search_read', [], {
      domain: [
        ['team_id', '=', teamId],
        ['state', 'in', ['sale', 'done']],
        ['commitment_date', '>=', startDateStr],
        ['commitment_date', '<=', endDateStr],
      ],
      fields: ['id', 'name', 'partner_id', 'amount_total', 'amount_invoiced', 'commitment_date'],
    });

    activePartnerIds = Array.from(new Set<number>(monthOrders.map((o: any) => o.partner_id[0])));
  } else {
    // MESI PASSATI: usa fatture con invoice_date
    monthInvoices = await callOdoo(cookies, 'account.move', 'search_read', [], {
      domain: [
        ['team_id', '=', teamId],
        ['move_type', '=', 'out_invoice'],
        ['state', '=', 'posted'],
        ['invoice_date', '>=', startDateStr],
        ['invoice_date', '<=', endDateStr],
      ],
      fields: ['id', 'name', 'partner_id', 'amount_total', 'invoice_date'],
    });

    activePartnerIds = Array.from(new Set<number>(monthInvoices.map((inv: any) => inv.partner_id[0])));
  }

  if (activePartnerIds.length === 0) {
    return {
      id: teamId,
      name: teamName,
      revenue_current_month: 0,
      revenue_paid: 0,
      payment_percentage: 0,
      threshold: THRESHOLD,
      threshold_met: false,
      bonus: 0,
      bonus_theoretical: 0,
      bonus_real: 0,
      total_clients: 0,
      qualified_clients: { count: 0, revenue: 0, percentage: '0.0', list: [] },
      too_new_clients: { count: 0, revenue: 0, percentage: '0.0', list: [] },
      too_old_clients: { count: 0, revenue: 0, percentage: '0.0', list: [] },
    };
  }

  // 2. Recupera info partner per parent_id
  const partners = await callOdoo(cookies, 'res.partner', 'search_read', [], {
    domain: [['id', 'in', activePartnerIds]],
    fields: ['id', 'name', 'parent_id'],
  });

  const partnerToParent: Record<number, number> = {};
  partners.forEach((p: any) => {
    partnerToParent[p.id] = p.parent_id ? p.parent_id[0] : p.id;
  });

  // 3. Trova tutti i partner del gruppo
  const allParentIds = Array.from(new Set<number>(Object.values(partnerToParent)));
  const allGroupPartners = await callOdoo(cookies, 'res.partner', 'search_read', [], {
    domain: [
      '|',
      ['id', 'in', allParentIds],
      ['parent_id', 'in', allParentIds],
    ],
    fields: ['id', 'name', 'parent_id'],
  });

  allGroupPartners.forEach((p: any) => {
    partnerToParent[p.id] = p.parent_id ? p.parent_id[0] : p.id;
  });

  const allGroupPartnerIds = allGroupPartners.map((p: any) => p.id);

  // 4. Recupera TUTTI gli ordini dei gruppi (per calcolare anzianità cliente)
  const allOrders = await callOdoo(cookies, 'sale.order', 'search_read', [], {
    domain: [
      ['partner_id', 'in', allGroupPartnerIds],
      ['state', 'in', ['sale', 'done']],
      ['commitment_date', '!=', false],
    ],
    fields: ['id', 'name', 'partner_id', 'user_id', 'amount_total', 'amount_invoiced', 'commitment_date'],
  });

  // 5. Calcola fatturato mese
  if (isCurrentMonth) {
    // MESE CORRENTE: usa merce consegnata (qty_delivered * price_unit)
    const orderIds = monthOrders.map((o: any) => o.id);

    if (orderIds.length > 0) {
      const orderLines = await callOdoo(cookies, 'sale.order.line', 'search_read', [], {
        domain: [['order_id', 'in', orderIds]],
        fields: ['order_id', 'product_id', 'qty_delivered', 'price_unit', 'price_subtotal'],
      });

      // Calcola: qty_delivered * price_unit per ogni riga
      revenueMonth = orderLines.reduce((sum: number, line: any) => {
        return sum + (line.qty_delivered * line.price_unit);
      }, 0);
    }
  } else {
    // MESI PASSATI: usa fatture (amount_total dalle invoice)
    revenueMonth = monthInvoices.reduce((sum: number, inv: any) => sum + inv.amount_total, 0);
  }

  const thresholdMet = revenueMonth >= THRESHOLD;

  // 5a. Calcola fatturato PAGATO (da fatture pagate del team)
  let revenuePaid = 0;

  try {
    const paidInvoices = await callOdoo(cookies, 'account.move', 'search_read', [], {
      domain: [
        ['team_id', '=', teamId],
        ['move_type', '=', 'out_invoice'],
        ['state', '=', 'posted'],
        ['payment_state', 'in', ['paid', 'in_payment']],
        ['invoice_date', '>=', startDateStr],
        ['invoice_date', '<=', endDateStr],
      ],
      fields: ['id', 'name', 'amount_total', 'payment_state', 'invoice_date'],
    });

    revenuePaid = paidInvoices.reduce((sum: number, inv: any) => sum + inv.amount_total, 0);
    console.log(`💰 ${teamName}: Fatturato pagato = ${revenuePaid.toFixed(2)} CHF (da ${paidInvoices.length} fatture)`);
  } catch (error) {
    console.warn(`⚠️ Impossibile recuperare fatture pagate per ${teamName}:`, error);
    revenuePaid = 0;
  }

  // Calcola percentuale di pagamento
  const paymentPercentage = revenueMonth > 0 ? (revenuePaid / revenueMonth) * 100 : 0;

  // 5b. Crea mappa per calcolare revenue per cliente
  let revenueByPartner: Record<number, number> = {};

  if (isCurrentMonth) {
    // MESE CORRENTE: calcola da order lines
    const orderIds = monthOrders.map((o: any) => o.id);
    if (orderIds.length > 0) {
      const orderLines = await callOdoo(cookies, 'sale.order.line', 'search_read', [], {
        domain: [['order_id', 'in', orderIds]],
        fields: ['order_id', 'qty_delivered', 'price_unit'],
      });

      // Calcola revenue per ogni ordine
      const orderRevenueMap: Record<number, number> = {};
      orderLines.forEach((line: any) => {
        const orderId = line.order_id[0];
        const lineRevenue = line.qty_delivered * line.price_unit;
        orderRevenueMap[orderId] = (orderRevenueMap[orderId] || 0) + lineRevenue;
      });

      // Mappa ordini → partner → revenue
      monthOrders.forEach((order: any) => {
        const partnerId = order.partner_id[0];
        const orderRevenue = orderRevenueMap[order.id] || 0;
        revenueByPartner[partnerId] = (revenueByPartner[partnerId] || 0) + orderRevenue;
      });
    }
  } else {
    // MESI PASSATI: calcola da fatture
    monthInvoices.forEach((invoice: any) => {
      const partnerId = invoice.partner_id[0];
      revenueByPartner[partnerId] = (revenueByPartner[partnerId] || 0) + invoice.amount_total;
    });
  }

  // 6. Classifica clienti per anzianità
  const qualifiedClients: ClientInfo[] = [];
  const tooNewClients: ClientInfo[] = [];
  const tooOldClients: ClientInfo[] = [];

  // Ottieni dettagli partner per i nomi
  const partnerDetails = await callOdoo(cookies, 'res.partner', 'search_read', [], {
    domain: [['id', 'in', activePartnerIds]],
    fields: ['id', 'name'],
  });
  const partnerNames: Record<number, string> = {};
  partnerDetails.forEach((p: any) => {
    partnerNames[p.id] = p.name;
  });

  activePartnerIds.forEach((partnerId) => {
    const firstOrder = getFirstOrderDate(partnerId, allOrders, partnerToParent);
    if (!firstOrder) return;

    const ageMonths = getMonthsSinceFirstOrder(firstOrder, endDateStr);

    // Calcola revenue per cliente dalla mappa
    const customerRevenue = revenueByPartner[partnerId] || 0;
    const customerName = partnerNames[partnerId] || `Cliente ${partnerId}`;

    const clientInfo: ClientInfo = {
      id: partnerId,
      name: customerName,
      first_order_date: firstOrder,
      age_months: ageMonths,
      revenue_current_month: customerRevenue,
    };

    if (ageMonths >= 9) {
      tooOldClients.push(clientInfo);
    } else if (ageMonths < 3) {
      tooNewClients.push(clientInfo);
    } else {
      qualifiedClients.push(clientInfo);
    }
  });

  // Ordina per fatturato
  qualifiedClients.sort((a, b) => b.revenue_current_month - a.revenue_current_month);
  tooNewClients.sort((a, b) => b.revenue_current_month - a.revenue_current_month);
  tooOldClients.sort((a, b) => b.revenue_current_month - a.revenue_current_month);

  // Calcola totali
  const qualifiedRevenue = qualifiedClients.reduce((sum, c) => sum + c.revenue_current_month, 0);
  const tooNewRevenue = tooNewClients.reduce((sum, c) => sum + c.revenue_current_month, 0);
  const tooOldRevenue = tooOldClients.reduce((sum, c) => sum + c.revenue_current_month, 0);

  // Calcola bonus - scelta scaglione in base al fatturato TOTALE
  // Se totale >= 95K → 8% su qualificati
  // Se totale 80K-95K → 2.5% su qualificati
  // Se totale < 80K → 0%
  let bonusTheoretical = 0;
  let bonusRate = 0;

  if (revenueMonth >= THRESHOLD) {
    // Sopra 95K → 8% su tutto il qualificato
    bonusRate = 0.08;
  } else if (revenueMonth >= THRESHOLD_TIER1) {
    // Tra 80K e 95K → 2.5% su tutto il qualificato
    bonusRate = 0.025;
  }

  bonusTheoretical = qualifiedRevenue * bonusRate;

  const bonusReal = bonusTheoretical * (paymentPercentage / 100);

  return {
    id: teamId,
    name: teamName,
    revenue_current_month: revenueMonth,
    revenue_paid: revenuePaid,
    payment_percentage: paymentPercentage,
    threshold: THRESHOLD,
    threshold_met: thresholdMet,
    bonus: bonusReal, // Per retrocompatibilità, bonus = bonus reale
    bonus_theoretical: bonusTheoretical,
    bonus_real: bonusReal,
    total_clients: activePartnerIds.length,
    qualified_clients: {
      count: qualifiedClients.length,
      revenue: qualifiedRevenue,
      percentage: revenueMonth > 0 ? ((qualifiedRevenue / revenueMonth) * 100).toFixed(1) : '0.0',
      list: qualifiedClients,
    },
    too_new_clients: {
      count: tooNewClients.length,
      revenue: tooNewRevenue,
      percentage: revenueMonth > 0 ? ((tooNewRevenue / revenueMonth) * 100).toFixed(1) : '0.0',
      list: tooNewClients,
    },
    too_old_clients: {
      count: tooOldClients.length,
      revenue: tooOldRevenue,
      percentage: revenueMonth > 0 ? ((tooOldRevenue / revenueMonth) * 100).toFixed(1) : '0.0',
      list: tooOldClients,
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    console.log('📊 [COMPENSI] GET /api/compensi-venditori (TEAM-BASED)');

    // Get Odoo session
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!cookies) {
      return NextResponse.json({ error: 'Autenticazione Odoo fallita' }, { status: 401 });
    }

    // Parametri query
    const { searchParams } = new URL(request.url);
    const teamIdParam = searchParams.get('teamId');
    const monthsBackParam = searchParams.get('monthsBack');
    const monthsBack = monthsBackParam ? parseInt(monthsBackParam) : 0;

    // Periodo: mese corrente o mesi indietro
    const today = new Date();
    const targetDate = new Date(today.getFullYear(), today.getMonth() - monthsBack, 1);
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();

    const startDate = new Date(year, month, 1);
    // Se è il mese corrente, endDate = oggi, altrimenti ultimo giorno del mese
    const endDate = monthsBack === 0
      ? today
      : new Date(year, month + 1, 0); // Ultimo giorno del mese

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // Seleziona team da elaborare
    const teamsToProcess = teamIdParam
      ? SALES_TEAMS.filter(t => t.id === parseInt(teamIdParam))
      : SALES_TEAMS;

    const teams: TeamData[] = [];
    const isCurrentMonth = monthsBack === 0;

    for (const team of teamsToProcess) {
      console.log(`📋 Elaborando team: ${team.name}...`);
      const data = await getTeamData(cookies, team.id, team.name, startDateStr, endDateStr, isCurrentMonth);
      teams.push(data);
    }

    const response = {
      success: true,
      period: {
        start: startDateStr,
        end: endDateStr,
        label: startDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }),
        generated_at: new Date().toISOString(),
      },
      salespeople: teams, // Mantiene nome 'salespeople' per retrocompatibilità frontend
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('❌ [COMPENSI] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
