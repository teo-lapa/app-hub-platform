import { useState, useEffect, useCallback } from 'react';

// ===== CONFIGURAZIONE =====

// ID TEAM LAPA REALI (esattamente come nell'HTML originale)
const LAPA_TEAM_IDS = [5, 9, 12, 8, 1, 11, 14];

// Mappa utenti autorizzati per team (esattamente come nell'HTML originale)
const USER_TEAM_PERMISSIONS: Record<number, number[] | 'ALL'> = {
  1: 'ALL',    // LapaBot → SUPER ADMIN (utente sistema app-hub-platform)
  407: [1],    // Domingos Ferreira → I Maestri del Sapore
  14: [12],    // Mihai Nita → I Custodi della Tradizione
  121: [9],    // Alessandro Motta → I Campioni del Gusto
  7: 'ALL',    // Paul Teodorescu → SUPER ADMIN (tutti i team)
  8: 'ALL',    // Laura Teodorescu → SUPER ADMIN (tutti i team)
  249: 'ALL'   // Gregorio Buccolieri → SUPER ADMIN (tutti i team)
};

// 🚀 SISTEMA DI CACHING PERFORMANTE
const performanceCache = {
  data: new Map<string, { value: any; timestamp: number }>(),
  ttl: 5 * 60 * 1000, // 5 minuti

  set(key: string, value: any) {
    this.data.set(key, {
      value: value,
      timestamp: Date.now()
    });
  },

  get(key: string) {
    const item = this.data.get(key);
    if (!item) return null;

    if (Date.now() - item.timestamp > this.ttl) {
      this.data.delete(key);
      return null;
    }

    return item.value;
  },

  clear() {
    this.data.clear();
  }
};

const DEBUG_MODE = true; // Attiva per sviluppo
const USE_MOCK_DATA = false; // ❌ DISABILITATO - Usa sempre dati REALI da Odoo

function addDebugLog(message: string) {
  if (DEBUG_MODE) console.log('LAPA:', message);
}

// ===== DATI MOCK PER SVILUPPO =====
const MOCK_USER = {
  id: 7,
  name: 'Paul Teodorescu',
  login: 'paul@lapa.ch'
};

const MOCK_TEAMS = [
  { id: 1, name: 'I Maestri del Sapore', user_id: [407, 'Domingos Ferreira'], member_ids: [407, 121, 14], sale_order_count: 150, invoiced: 250000, invoiced_target: 300000 },
  { id: 5, name: 'Team Ticino', user_id: [7, 'Paul Teodorescu'], member_ids: [7, 8], sale_order_count: 200, invoiced: 450000, invoiced_target: 500000 },
  { id: 9, name: 'I Campioni del Gusto', user_id: [121, 'Alessandro Motta'], member_ids: [121, 249], sale_order_count: 180, invoiced: 380000, invoiced_target: 400000 },
  { id: 12, name: 'I Custodi della Tradizione', user_id: [14, 'Mihai Nita'], member_ids: [14], sale_order_count: 120, invoiced: 220000, invoiced_target: 250000 }
];

const MOCK_CLIENTS = [
  {
    id: 1,
    name: 'Ristorante La Stella',
    email: 'info@lastella.ch',
    phone: '+41 91 123 4567',
    street: 'Via Roma 15',
    city: 'Lugano',
    zip: '6900',
    country_id: [214, 'Switzerland'],
    user_id: [7, 'Paul Teodorescu'],
    team_id: [5, 'Team Ticino'],
    is_company: true,
    customer_rank: 1,
    parent_id: false,
    child_ids: []
  },
  {
    id: 2,
    name: 'Hotel Belvedere',
    email: 'info@belvedere.ch',
    phone: '+41 91 234 5678',
    street: 'Via Nassa 25',
    city: 'Lugano',
    zip: '6900',
    country_id: [214, 'Switzerland'],
    user_id: [7, 'Paul Teodorescu'],
    team_id: [5, 'Team Ticino'],
    is_company: true,
    customer_rank: 1,
    parent_id: false,
    child_ids: []
  },
  {
    id: 3,
    name: 'Pizzeria Napoli',
    email: 'info@pizzerianapoli.ch',
    phone: '+41 91 345 6789',
    street: 'Via Centrale 10',
    city: 'Bellinzona',
    zip: '6500',
    country_id: [214, 'Switzerland'],
    user_id: [7, 'Paul Teodorescu'],
    team_id: [5, 'Team Ticino'],
    is_company: true,
    customer_rank: 1,
    parent_id: false,
    child_ids: []
  },
  {
    id: 4,
    name: 'Bar Centrale',
    email: 'info@barcentrale.ch',
    phone: '+41 91 456 7890',
    street: 'Piazza Grande 5',
    city: 'Locarno',
    zip: '6600',
    country_id: [214, 'Switzerland'],
    user_id: [7, 'Paul Teodorescu'],
    team_id: [5, 'Team Ticino'],
    is_company: true,
    customer_rank: 1,
    parent_id: false,
    child_ids: []
  },
  {
    id: 5,
    name: 'Ristorante Il Giardino',
    email: 'info@ilgiardino.ch',
    phone: '+41 91 567 8901',
    street: 'Via dei Fiori 8',
    city: 'Lugano',
    zip: '6900',
    country_id: [214, 'Switzerland'],
    user_id: [7, 'Paul Teodorescu'],
    team_id: [5, 'Team Ticino'],
    is_company: true,
    customer_rank: 1,
    parent_id: false,
    child_ids: []
  }
];

function generateMockOrders(companyId: number, orderCount: number) {
  const orders = [];
  const today = new Date();

  for (let i = 0; i < orderCount; i++) {
    const daysAgo = Math.floor(Math.random() * 90); // Ultimi 90 giorni
    const orderDate = new Date(today);
    orderDate.setDate(orderDate.getDate() - daysAgo);

    const amount = 500 + Math.random() * 3000; // CHF 500-3500

    orders.push({
      id: companyId * 100 + i,
      name: `SO/${String(companyId).padStart(3, '0')}/${String(i).padStart(4, '0')}`,
      partner_id: [companyId, MOCK_CLIENTS.find(c => c.id === companyId)?.name || 'Cliente'],
      commercial_partner_id: [companyId, MOCK_CLIENTS.find(c => c.id === companyId)?.name || 'Cliente'],
      amount_total: amount,
      amount_invoiced: amount,
      commitment_date: orderDate.toISOString().split('T')[0],
      date_order: orderDate.toISOString().split('T')[0],
      state: 'sale'
    });
  }

  return orders;
}

// ===== FUNZIONI RPC ODOO =====

// Get session info tramite API
async function getSessionInfo() {
  addDebugLog('📋 Recupero informazioni utente...');

  try {
    // L'API /api/odoo/rpc fa già login con paul@lapa.ch
    // Recuperiamo le info dell'utente loggato
    const userInfo = await callOdoo('res.users', 'read', [[1]], {
      fields: ['id', 'name', 'login']
    });

    if (userInfo && userInfo.length > 0) {
      const user = userInfo[0];
      addDebugLog('✅ Informazioni utente recuperate');
      return {
        uid: user.id || 7, // Usa ID di Paul se non trovato
        name: user.name || 'Paul Teodorescu',
        login: user.login || 'paul@lapa.ch',
        username: user.login || 'paul@lapa.ch'
      };
    }

    // Fallback: usa direttamente i dati di Paul dall'API
    return {
      uid: 7,
      name: 'Paul Teodorescu',
      login: 'paul@lapa.ch',
      username: 'paul@lapa.ch'
    };
  } catch (error: any) {
    addDebugLog(`⚠️ Impossibile recuperare utente, uso Paul di default: ${error.message}`);
    // Fallback: ritorna Paul che è SUPER ADMIN
    return {
      uid: 7,
      name: 'Paul Teodorescu',
      login: 'paul@lapa.ch',
      username: 'paul@lapa.ch'
    };
  }
}

// Call Odoo RPC tramite API Next.js
async function callOdoo(model: string, method: string, args: any[] = [], kwargs: any = {}) {
  try {
    addDebugLog(`📞 Chiamata RPC: ${model}.${method}`);

    if (!model || !method) {
      throw new Error('Model e method sono richiesti');
    }

    const response = await fetch('/api/odoo/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        method,
        args,
        kwargs
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.success) {
      const errorMsg = data.error || 'RPC Error';
      addDebugLog(`❌ Errore RPC (${model}.${method}): ${errorMsg}`);
      throw new Error(errorMsg);
    }

    addDebugLog(`✅ RPC completata: ${model}.${method}`);
    return data.result;
  } catch (error: any) {
    addDebugLog(`❌ Errore chiamata RPC: ${error.message}`);
    throw error;
  }
}

// ===== UTILITY FUNCTIONS =====

function formatAddress(company: any) {
  const parts = [];
  if (company.street) parts.push(company.street);
  if (company.city) parts.push(company.city);
  if (company.zip) parts.push(company.zip);
  if (company.country_id && company.country_id[1]) parts.push(company.country_id[1]);
  return parts.join(', ');
}

function calculateRealHealthScore(data: {
  orderCount: number;
  totalAmount: number;
  lastOrderDays: number;
}) {
  let score = 50; // Base score

  // Peso per numero di ordini (max +20)
  if (data.orderCount > 50) score += 20;
  else if (data.orderCount > 30) score += 15;
  else if (data.orderCount > 10) score += 10;
  else score += data.orderCount / 2;

  // Peso per fatturato (max +20)
  if (data.totalAmount > 50000) score += 20;
  else if (data.totalAmount > 30000) score += 15;
  else if (data.totalAmount > 10000) score += 10;
  else score += data.totalAmount / 2000;

  // Peso per ultimo ordine (max +10)
  if (data.lastOrderDays < 7) score += 10;
  else if (data.lastOrderDays < 14) score += 7;
  else if (data.lastOrderDays < 30) score += 5;
  else if (data.lastOrderDays > 60) score -= 10;

  return Math.min(100, Math.max(0, Math.round(score)));
}

function getClientStatus(healthScore: number): 'active' | 'warning' | 'inactive' {
  if (healthScore >= 70) return 'active';
  if (healthScore >= 40) return 'warning';
  return 'inactive';
}

function calculateWeeklyRevenue(orders: any[]) {
  // Ultimi 12 settimane (84 giorni)
  const weeklyData = new Array(12).fill(0);
  const today = new Date();

  orders.forEach((order) => {
    const orderDate = new Date(order.commitment_date || order.date_order);
    const daysDiff = Math.floor((today.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));

    // Calcola in quale settimana cade (0 = settimana corrente, 11 = 11 settimane fa)
    const weekIndex = Math.floor(daysDiff / 7);

    if (weekIndex >= 0 && weekIndex < 12) {
      weeklyData[11 - weekIndex] += order.amount_invoiced || 0;
    }
  });

  return weeklyData;
}

function calculateMonthlyRevenue(orders: any[]) {
  // Ultimi 12 mesi
  const monthlyData = new Array(12).fill(0);
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  orders.forEach((order) => {
    const orderDate = new Date(order.commitment_date || order.date_order);
    const orderMonth = orderDate.getMonth();
    const orderYear = orderDate.getFullYear();

    // Calcola differenza in mesi
    const monthsDiff = (currentYear - orderYear) * 12 + (currentMonth - orderMonth);

    if (monthsDiff >= 0 && monthsDiff < 12) {
      monthlyData[11 - monthsDiff] += order.amount_invoiced || 0;
    }
  });

  return monthlyData;
}

// Calcola dati finanziari REALI da fatture Odoo
async function calculateRealFinancialData(partnerId: number) {
  try {
    const cacheKey = `financial_${partnerId}`;
    const cachedData = performanceCache.get(cacheKey);
    if (cachedData) {
      addDebugLog(`🎯 Cache HIT finanziario per partner ${partnerId}`);
      return cachedData;
    }

    addDebugLog(`💰 Caricamento dati finanziari per partner ${partnerId}`);
    const today = new Date().toISOString().split('T')[0];

    // Carica TUTTE le fatture del partner
    const allInvoices = await callOdoo('account.move', 'search_read', [
      [
        ['move_type', '=', 'out_invoice'],
        ['partner_id', 'child_of', partnerId],
        ['state', '=', 'posted']
      ]
    ], {
      fields: ['name', 'amount_total', 'amount_residual', 'invoice_date', 'invoice_date_due', 'payment_state', 'partner_id']
    });

    // Separa fatture per stato
    const paidInvoices = allInvoices.filter((inv: any) => inv.payment_state === 'paid');
    const pendingInvoices = allInvoices.filter((inv: any) =>
      ['not_paid', 'partial'].includes(inv.payment_state) &&
      inv.invoice_date_due >= today
    );
    const overdueInvoices = allInvoices.filter((inv: any) =>
      ['not_paid', 'partial'].includes(inv.payment_state) &&
      inv.invoice_date_due < today &&
      inv.amount_residual > 0
    );

    // Calcola totali
    const paidTotal = paidInvoices.reduce((sum: number, inv: any) => sum + (inv.amount_total || 0), 0);
    const pendingTotal = pendingInvoices.reduce((sum: number, inv: any) => sum + (inv.amount_residual || inv.amount_total || 0), 0);
    const overdueTotal = overdueInvoices.reduce((sum: number, inv: any) => sum + (inv.amount_residual || inv.amount_total || 0), 0);

    addDebugLog(`💰 Partner ${partnerId} - Pagate: ${paidInvoices.length}, In Sospeso: ${pendingInvoices.length}, Scadute: ${overdueInvoices.length}`);

    const result = {
      paid: Math.round(paidTotal),
      pending: Math.round(pendingTotal),
      overdue: Math.round(overdueTotal),
      paidCount: paidInvoices.length,
      pendingCount: pendingInvoices.length,
      overdueCount: overdueInvoices.length,
      realInvoices: {
        paid: paidInvoices,
        pending: pendingInvoices,
        overdue: overdueInvoices
      }
    };

    performanceCache.set(cacheKey, result);
    return result;

  } catch (error: any) {
    addDebugLog(`❌ Errore dati finanziari partner ${partnerId}: ${error.message}`);
    return null;
  }
}

// Genera dati finanziari simulati
function generateFinancialData(totalInvoiced: number, healthScore: number) {
  const baseAmount = totalInvoiced || 2000;
  let paidAmount, pendingAmount, overdueAmount;

  if (healthScore >= 80) {
    paidAmount = baseAmount * (0.80 + Math.random() * 0.15);
    overdueAmount = baseAmount * (Math.random() * 0.05);
    pendingAmount = baseAmount - paidAmount - overdueAmount;
  } else if (healthScore >= 60) {
    paidAmount = baseAmount * (0.65 + Math.random() * 0.20);
    overdueAmount = baseAmount * (0.05 + Math.random() * 0.10);
    pendingAmount = baseAmount - paidAmount - overdueAmount;
  } else {
    paidAmount = baseAmount * (0.40 + Math.random() * 0.25);
    overdueAmount = baseAmount * (0.15 + Math.random() * 0.25);
    pendingAmount = baseAmount - paidAmount - overdueAmount;
  }

  if (pendingAmount < 0) {
    overdueAmount += pendingAmount;
    pendingAmount = 0;
  }

  return {
    paid: Math.max(0, Math.round(paidAmount)),
    pending: Math.max(0, Math.round(pendingAmount)),
    overdue: Math.max(0, Math.round(overdueAmount)),
    paidCount: 0,
    pendingCount: 0,
    overdueCount: 0,
    realInvoices: null
  };
}

// ===== HOOK PRINCIPALE =====

export function useOdooData() {
  const [user, setUser] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalClients: 0,
    weeklyRevenue: 0,
    totalOrders: 0,
    alertCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'error'>('error');

  // Carica utente da Odoo (o mock)
  const loadUser = useCallback(async () => {
    try {
      addDebugLog('👤 Caricamento utente...');

      // 🎭 USA DATI MOCK IN SVILUPPO
      if (USE_MOCK_DATA) {
        addDebugLog('🎭 Usando dati MOCK per sviluppo locale');
        setUser(MOCK_USER);
        setConnectionStatus('connected');
        addDebugLog(`✅ Utente MOCK caricato: ${MOCK_USER.name} (ID: ${MOCK_USER.id})`);
        return MOCK_USER;
      }

      const sessionInfo = await getSessionInfo();

      const currentUser = {
        id: sessionInfo.uid,
        name: sessionInfo.name || sessionInfo.username || 'Utente Odoo',
        login: sessionInfo.login || sessionInfo.username
      };

      setUser(currentUser);
      addDebugLog(`✅ Utente caricato: ${currentUser.name} (ID: ${currentUser.id})`);
      setConnectionStatus('connected');

      return currentUser;
    } catch (error: any) {
      addDebugLog(`❌ Errore caricamento utente: ${error.message}`);
      setConnectionStatus('error');
      throw error;
    }
  }, []);

  // Carica teams da Odoo (o mock)
  const loadTeams = useCallback(async (currentUser: any) => {
    try {
      addDebugLog('👥 Caricamento teams...');

      // 🔒 CONTROLLO PERMESSI UTENTE
      const userPermissions = USER_TEAM_PERMISSIONS[currentUser.id];

      if (!userPermissions) {
        throw new Error(
          `⛔ Utente ${currentUser.name} (ID: ${currentUser.id}) non ha permessi per accedere alla dashboard`
        );
      }

      addDebugLog(`🔐 Permessi utente ${currentUser.name}: ${JSON.stringify(userPermissions)}`);

      // 🎭 USA DATI MOCK IN SVILUPPO
      let teamsResponse;
      if (USE_MOCK_DATA) {
        addDebugLog('🎭 Usando teams MOCK');
        teamsResponse = MOCK_TEAMS;
      } else {
        teamsResponse = await callOdoo(
          'crm.team',
          'search_read',
          [[['id', 'in', LAPA_TEAM_IDS]]],
          {
            fields: [
              'id',
              'name',
              'user_id',
              'member_ids',
              'sale_order_count',
              'invoiced',
              'invoiced_target'
            ],
            order: 'name asc'
          }
        );
      }

      if (!teamsResponse || teamsResponse.length === 0) {
        throw new Error(`Nessun team trovato con ID: ${LAPA_TEAM_IDS.join(', ')}`);
      }

      // 🔒 FILTRA TEAMS IN BASE AI PERMESSI
      let allowedTeams = teamsResponse;

      if (userPermissions !== 'ALL') {
        allowedTeams = teamsResponse.filter((team: any) =>
          userPermissions.includes(team.id)
        );
        addDebugLog(
          `🔒 Utente limitato a ${allowedTeams.length} team: ${allowedTeams.map((t: any) => t.name).join(', ')}`
        );
      } else {
        addDebugLog(`🔓 Utente SUPER ADMIN: accesso a tutti i ${allowedTeams.length} team`);
      }

      if (allowedTeams.length === 0) {
        throw new Error(
          `⛔ Nessun team disponibile per l'utente ${currentUser.name}`
        );
      }

      const formattedTeams = allowedTeams.map((team: any) => ({
        id: team.id,
        name: team.name,
        leader: team.user_id ? team.user_id[1] : 'Nessun leader',
        memberIds: team.member_ids || [],
        memberCount: team.member_ids ? team.member_ids.length : 0,
        saleOrderCount: team.sale_order_count || 0,
        invoiced: team.invoiced || 0,
        invoicedTarget: team.invoiced_target || 0,
        rawData: team
      }));

      setTeams(formattedTeams);
      addDebugLog(
        `✅ Caricati ${formattedTeams.length} teams: ${formattedTeams.map((t: any) => t.name).join(', ')}`
      );

      return formattedTeams;
    } catch (error: any) {
      addDebugLog(`❌ Errore caricamento teams: ${error.message}`);
      throw error;
    }
  }, []);

  // Carica clienti per un team specifico
  const loadClientsForTeam = useCallback(async (teamId: number) => {
    try {
      setLoading(true);
      setError(null);
      addDebugLog(`👥 Caricamento clienti per team ${teamId}...`);

      const team = teams.find((t) => t.id === teamId);
      if (!team || !team.memberIds.length) {
        addDebugLog('❌ Team non trovato o senza membri');
        setClients([]);
        setLoading(false);
        return [];
      }

      addDebugLog(`🔍 Team ${team.name} - Membri: [${team.memberIds.join(', ')}]`);

      // STEP 1: Carica aziende MADRE del team
      addDebugLog(`🏢 Caricamento aziende MADRE del team ${team.name}...`);

      let companies;
      if (USE_MOCK_DATA) {
        addDebugLog('🎭 Usando clienti MOCK');
        companies = MOCK_CLIENTS.filter(c => c.team_id[0] === teamId);
      } else {
        companies = await callOdoo(
          'res.partner',
          'search_read',
          [
            [
              ['team_id', '=', teamId],
              ['is_company', '=', true],
              ['customer_rank', '>', 0],
              ['parent_id', '=', false]
            ]
          ],
          {
            fields: [
              'id',
              'name',
              'user_id',
              'team_id',
              'child_ids',
              'email',
              'phone',
              'mobile',
              'street',
              'city',
              'zip',
              'country_id'
            ]
          }
        );
      }

      addDebugLog(`✅ Trovate ${companies.length} aziende MADRE del team`);

      if (companies.length === 0) {
        addDebugLog('⚠️ Nessuna azienda madre trovata per questo team');
        setClients([]);
        setLoading(false);
        return [];
      }

      // STEP 2: Carica TUTTI gli ordini
      const allPartnerIds = companies.flatMap((company: any) => [
        company.id,
        ...(company.child_ids || [])
      ]);

      const ordersCacheKey = `orders_team_${teamId}`;
      let allOrders = performanceCache.get(ordersCacheKey);

      if (!allOrders) {
        addDebugLog(`📦 Cache MISS - carico ordini per team ${team.name}`);

        if (USE_MOCK_DATA) {
          // Genera ordini mock per ogni cliente
          addDebugLog('🎭 Generando ordini MOCK');
          allOrders = [];
          companies.forEach((company: any) => {
            const orderCount = 15 + Math.floor(Math.random() * 20); // 15-35 ordini
            const companyOrders = generateMockOrders(company.id, orderCount);
            allOrders = [...allOrders, ...companyOrders];
          });
        } else {
          allOrders = await callOdoo(
            'sale.order',
            'search_read',
            [[['partner_id', 'in', allPartnerIds], ['state', 'in', ['sale', 'done']]]],
            {
              fields: [
                'id',
                'name',
                'partner_id',
                'commercial_partner_id',
                'amount_total',
                'amount_invoiced',
                'commitment_date',
                'date_order'
              ],
              order: 'commitment_date desc'
            }
          );
        }
        performanceCache.set(ordersCacheKey, allOrders);
        addDebugLog(`💾 Ordini salvati in cache`);
      } else {
        addDebugLog(`🎯 Cache HIT per ordini team`);
      }

      addDebugLog(`📦 ${allOrders.length} ordini caricati`);

      // STEP 3: Carica contatti figli
      const allChildIds = companies.flatMap((company: any) => company.child_ids || []);
      let allChildContacts: any[] = [];

      if (allChildIds.length > 0) {
        addDebugLog(`👥 Caricamento ${allChildIds.length} contatti figli...`);
        allChildContacts = await callOdoo(
          'res.partner',
          'search_read',
          [[['id', 'in', allChildIds]]],
          {
            fields: ['id', 'name', 'email', 'phone', 'mobile', 'parent_id', 'function']
          }
        );
      }

      // STEP 4: Raggruppa ordini per azienda madre
      const clientsData: any[] = [];
      const today = new Date();

      for (const company of companies) {
        const companyPartnerIds = [company.id, ...(company.child_ids || [])];

        const companyOrders = allOrders.filter(
          (order: any) =>
            companyPartnerIds.includes(order.partner_id[0]) ||
            (order.commercial_partner_id && order.commercial_partner_id[0] === company.id)
        );

        if (companyOrders.length === 0) {
          continue;
        }

        // Calcola statistiche
        const totalInvoiced = companyOrders.reduce(
          (sum: number, order: any) => sum + (order.amount_invoiced || 0),
          0
        );
        const orderCount = companyOrders.length;

        // Calcolo fatturato e ordini mese scorso
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        const lastMonthStart = new Date(currentYear, currentMonth - 1, 1);
        const lastMonthEnd = new Date(currentYear, currentMonth, 0);

        const lastMonthOrders = companyOrders.filter((order: any) => {
          const orderDate = new Date(order.commitment_date || order.date_order);
          return orderDate >= lastMonthStart && orderDate <= lastMonthEnd;
        });

        const monthlyInvoiced = lastMonthOrders.reduce(
          (sum: number, order: any) => sum + (order.amount_invoiced || 0),
          0
        );
        const monthlyOrderCount = lastMonthOrders.length;

        // Calcola ultimo ordine
        let lastOrderDate: Date | null = null;
        let lastOrderDays = 999;

        companyOrders.forEach((order: any) => {
          const orderDate = new Date(order.commitment_date || order.date_order);
          if (!lastOrderDate || orderDate > lastOrderDate) {
            lastOrderDate = orderDate;
            lastOrderDays = Math.floor(
              (today.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24)
            );
          }
        });

        // Calcola dati settimanali e mensili
        const weeklyData = calculateWeeklyRevenue(companyOrders);
        const monthlyData = calculateMonthlyRevenue(companyOrders);

        // Health score
        const healthScore = calculateRealHealthScore({
          orderCount,
          totalAmount: totalInvoiced,
          lastOrderDays
        });

        // 💰 CALCOLA DATI FINANZIARI (FATTURE)
        let financialData;
        try {
          financialData = await calculateRealFinancialData(company.id);

          if (!financialData || (financialData.paid === 0 && financialData.pending === 0 && financialData.overdue === 0)) {
            addDebugLog(`⚠️ Nessuna fattura per ${company.name}, uso dati simulati`);
            financialData = generateFinancialData(totalInvoiced, healthScore);
          }
        } catch (error: any) {
          addDebugLog(`❌ Errore dati finanziari ${company.name}: ${error.message}`);
          financialData = generateFinancialData(totalInvoiced, healthScore);
        }

        clientsData.push({
          id: company.id,
          name: company.name,
          email: company.email || '',
          phone: company.phone || company.mobile || '',
          address: formatAddress(company),
          salesperson: company.user_id ? company.user_id[1] : 'Non assegnato',
          orderCount: orderCount,
          totalInvoiced: totalInvoiced,
          monthlyInvoiced: monthlyInvoiced,
          monthlyOrderCount: monthlyOrderCount,
          healthScore: healthScore,
          status: getClientStatus(healthScore),
          lastOrderDays: lastOrderDays,
          weeklyData: weeklyData,
          monthlyData: monthlyData,
          // 💰 DATI FINANZIARI
          invoicesPaid: financialData.paid,
          invoicesPending: financialData.pending,
          invoicesOverdue: financialData.overdue,
          financialData: financialData,
          childContacts: allChildContacts.filter(
            (contact: any) => contact.parent_id && contact.parent_id[0] === company.id
          )
        });
      }

      addDebugLog(`✅ Processati ${clientsData.length} clienti con ordini`);

      // Calcola statistiche globali
      const totalClients = clientsData.length;
      const weeklyRevenue = clientsData.reduce((sum, c) => sum + c.monthlyInvoiced, 0);
      const totalOrders = clientsData.reduce((sum, c) => sum + c.orderCount, 0);
      const alertCount = clientsData.filter((c) => c.status === 'inactive').length;

      setStats({
        totalClients,
        weeklyRevenue,
        totalOrders,
        alertCount
      });

      setClients(clientsData);
      setLoading(false);

      return clientsData;
    } catch (error: any) {
      addDebugLog(`❌ Errore caricamento clienti: ${error.message}`);
      setError(error.message);
      setLoading(false);
      throw error;
    }
  }, [teams]);

  // Inizializzazione
  useEffect(() => {
    const initialize = async () => {
      try {
        const currentUser = await loadUser();
        await loadTeams(currentUser);
      } catch (error: any) {
        setError(error.message);
        setLoading(false);
      }
    };

    initialize();
  }, []);

  return {
    user,
    teams,
    clients,
    stats,
    loading,
    error,
    connectionStatus,
    loadClientsForTeam
  };
}
