import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';
import { getOdooSession } from '@/lib/odoo-auth';

/**
 * POST /api/sales-agents/chat
 * Sales AI Hub - Sistema agenti semplificato
 * Usa Claude direttamente + dati Odoo real-time
 */

const claude = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, salespersonId, salespersonName } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    console.log(`[Sales AI Hub] Processing: "${message}" from ${salespersonName}`);

    // 1. Get Odoo session
    const userCookies = request.headers.get('cookie');
    const { cookies: odooCookies, uid } = await getOdooSession(userCookies || undefined);
    const odoo = createOdooRPCClient(odooCookies?.replace('session_id=', ''));

    // 2. Trova user Odoo dall'email
    let odooUserId: number = uid;
    if (typeof salespersonId === 'string' && salespersonId.includes('@')) {
      try {
        const users = await odoo.searchRead(
          'res.users',
          [['login', '=', salespersonId]],
          ['id', 'name'],
          1
        );
        if (users.length > 0) {
          odooUserId = users[0].id;
          console.log(`[Sales AI Hub] Found Odoo user ${odooUserId} for ${salespersonId}`);
        }
      } catch (error) {
        console.error('[Sales AI Hub] Error finding user:', error);
      }
    }

    // 3. Analizza intent e fetch dati Odoo
    const intent = await analyzeIntent(message);
    console.log(`[Sales AI Hub] Intent detected: ${intent.type}`);

    let context = '';

    try {
      switch (intent.type) {
        case 'daily_plan':
        case 'performance_check':
        case 'stats_query':
          context = await getPerformanceContext(odoo, odooUserId);
          break;

        case 'churn_risk':
          context = await getChurnRiskContext(odoo, odooUserId);
          break;

        case 'upsell_opportunities':
          context = await getUpsellContext(odoo, odooUserId);
          break;

        case 'client_analysis':
        case 'client_question':
          const clientName = intent.extractedData?.clientName;
          if (clientName) {
            context = await getClientContext(odoo, odooUserId, clientName);
          }
          break;

        case 'general':
          // Per domande generiche, carica sempre lista clienti completa
          // così può rispondere a domande come "parlami di cliente X"
          context = await getPerformanceContext(odoo, odooUserId);
          break;
      }
    } catch (error: any) {
      console.error('[Sales AI Hub] Error fetching Odoo data:', error);
      context = `⚠️ Errore recupero dati Odoo: ${error.message}`;
    }

    // 4. Genera risposta con Claude usando i dati Odoo
    const response = await generateAIResponse(message, intent.type, context, salespersonName);

    return NextResponse.json({
      success: true,
      response,
      intent: intent.type,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[Sales AI Hub] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: error.message
      },
      { status: 500 }
    );
  }
}

/**
 * Analizza intent del messaggio
 */
async function analyzeIntent(message: string): Promise<{ type: string; confidence: number; extractedData?: any }> {
  const lower = message.toLowerCase();

  // Simple pattern matching (veloce e affidabile)
  if (lower.includes('oggi') || lower.includes('piano') || lower.includes('cosa fare')) {
    return { type: 'daily_plan', confidence: 0.9 };
  }
  if (lower.includes('kpi') || lower.includes('performance') || lower.includes('come sto')) {
    return { type: 'performance_check', confidence: 0.9 };
  }
  if (lower.includes('rischio') || lower.includes('churn') || lower.includes('perdo')) {
    return { type: 'churn_risk', confidence: 0.9 };
  }
  if (lower.includes('upsell') || lower.includes('opportunità')) {
    return { type: 'upsell_opportunities', confidence: 0.9 };
  }

  // Quanti clienti/ordini ho?
  if (lower.includes('quanti') && (lower.includes('client') || lower.includes('ordini') || lower.includes('asegnat'))) {
    return { type: 'stats_query', confidence: 0.9 };
  }

  // Estrai nome cliente se presente
  const clientMatch = message.match(/cliente\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i);
  if (clientMatch) {
    return {
      type: 'client_analysis',
      confidence: 0.8,
      extractedData: { clientName: clientMatch[1] }
    };
  }

  return { type: 'general', confidence: 0.5 };
}

/**
 * Context: Performance KPIs
 */
async function getPerformanceContext(odoo: any, userId: number): Promise<string> {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  // Fetch ordini del mese
  const orders = await odoo.searchRead(
    'sale.order',
    [
      ['user_id', '=', userId],
      ['date_order', '>=', startOfMonth.toISOString()],
      ['state', 'in', ['sale', 'done']]
    ],
    ['id', 'name', 'partner_id', 'amount_total', 'date_order'],
    100
  );

  const revenue = orders.reduce((sum: number, o: any) => sum + (o.amount_total || 0), 0);
  const target = 50000; // €50k/mese

  // Fetch clienti attivi
  const clients = await odoo.searchRead(
    'res.partner',
    [
      ['user_id', '=', userId],
      ['customer_rank', '>', 0]
    ],
    ['id', 'name', 'email', 'phone', 'city', 'user_id'],
    0
  );

  // DEBUG: Log primi 10 clienti trovati
  console.log(`[Sales AI Hub] DEBUG - user_id ricerca: ${userId}`);
  console.log(`[Sales AI Hub] DEBUG - Primi 10 clienti trovati:`);
  clients.slice(0, 10).forEach((c: any) => {
    const assignedUser = c.user_id ? `${c.user_id[1]} (ID: ${c.user_id[0]})` : 'NESSUNO';
    console.log(`  - ${c.name} → Venditore: ${assignedUser}`);
  });

  // Build detailed context with REAL data
  let context = `**Performance Corrente (dati REALI da Odoo)**:
- Revenue mese: €${revenue.toFixed(0)} / €${target.toFixed(0)} (${((revenue/target)*100).toFixed(0)}%)
- Ordini chiusi: ${orders.length}
- Clienti attivi totali: ${clients.length}
- Avg deal size: €${(revenue / Math.max(orders.length, 1)).toFixed(0)}

**ORDINI REALI QUESTO MESE** (ultimi 10):
${orders.slice(0, 10).map((o: any) => {
  const clientName = o.partner_id[1] || 'N/A';
  const date = new Date(o.date_order).toLocaleDateString('it-IT');
  return `- ${o.name}: ${clientName} - €${o.amount_total.toFixed(0)} (${date})`;
}).join('\n')}

**CLIENTI ASSEGNATI** (primi 20):
${clients.slice(0, 20).map((c: any) => {
  const city = c.city || 'N/A';
  const phone = c.phone || 'N/A';
  return `- ${c.name} (${city}) - Tel: ${phone}`;
}).join('\n')}

**IMPORTANTE**: Usa SOLO questi dati reali. NON inventare nomi, cifre o dettagli che non sono in questa lista!`;

  return context;
}

/**
 * Context: Clienti a rischio churn
 */
async function getChurnRiskContext(odoo: any, userId: number): Promise<string> {
  // Fetch tutti i clienti del venditore
  const clients = await odoo.searchRead(
    'res.partner',
    [
      ['user_id', '=', userId],
      ['customer_rank', '>', 0]
    ],
    ['id', 'name', 'email'],
    50
  );

  if (clients.length === 0) {
    return 'Nessun cliente assegnato.';
  }

  // Per ogni cliente, verifica ultimo ordine
  const atRisk = [];

  for (const client of clients.slice(0, 10)) { // Limit per performance
    const lastOrders = await odoo.searchRead(
      'sale.order',
      [
        ['partner_id', '=', client.id],
        ['state', 'in', ['sale', 'done']]
      ],
      ['id', 'date_order', 'amount_total'],
      1,
      'date_order desc'
    );

    if (lastOrders.length > 0) {
      const daysSinceOrder = Math.floor(
        (Date.now() - new Date(lastOrders[0].date_order).getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceOrder > 60) {
        atRisk.push({
          name: client.name,
          daysSinceOrder,
          lastAmount: lastOrders[0].amount_total
        });
      }
    }
  }

  if (atRisk.length === 0) {
    return 'Nessun cliente a rischio churn (tutti attivi negli ultimi 60 giorni).';
  }

  return `**Clienti a Rischio** (${atRisk.length}):
${atRisk.map(c => `- ${c.name}: ${c.daysSinceOrder} giorni dall'ultimo ordine (€${c.lastAmount})`).join('\n')}`;
}

/**
 * Context: Opportunità upsell
 */
async function getUpsellContext(odoo: any, userId: number): Promise<string> {
  // Fetch ordini recenti per analizzare pattern
  const recentOrders = await odoo.searchRead(
    'sale.order',
    [
      ['user_id', '=', userId],
      ['date_order', '>=', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()],
      ['state', 'in', ['sale', 'done']]
    ],
    ['id', 'partner_id', 'amount_total'],
    50
  );

  // Raggruppa per cliente
  const clientSpend: Record<string, { name: string; total: number; orders: number }> = {};

  for (const order of recentOrders) {
    const clientId = order.partner_id[0];
    const clientName = order.partner_id[1];

    if (!clientSpend[clientId]) {
      clientSpend[clientId] = { name: clientName, total: 0, orders: 0 };
    }

    clientSpend[clientId].total += order.amount_total || 0;
    clientSpend[clientId].orders += 1;
  }

  // Ordina per totale speso (top spenders)
  const topSpenders = Object.entries(clientSpend)
    .sort(([, a], [, b]) => b.total - a.total)
    .slice(0, 5);

  if (topSpenders.length === 0) {
    return 'Nessuna opportunità upsell identificata al momento.';
  }

  return `**Top Clienti per Upsell** (ultimi 90gg):
${topSpenders.map(([id, data]) =>
  `- ${data.name}: €${data.total.toFixed(0)} (${data.orders} ordini, avg €${(data.total/data.orders).toFixed(0)})`
).join('\n')}

💡 Focus su questi clienti per proposte premium/bundle/volumi maggiori.`;
}

/**
 * Context: Analisi cliente specifico
 */
async function getClientContext(odoo: any, userId: number, clientName: string): Promise<string> {
  // Cerca cliente per nome
  const clients = await odoo.searchRead(
    'res.partner',
    [
      ['name', 'ilike', clientName],
      ['user_id', '=', userId]
    ],
    ['id', 'name', 'email', 'phone', 'city'],
    5
  );

  if (clients.length === 0) {
    return `Cliente "${clientName}" non trovato tra i tuoi clienti.`;
  }

  const client = clients[0];

  // Fetch ordini cliente
  const orders = await odoo.searchRead(
    'sale.order',
    [
      ['partner_id', '=', client.id],
      ['state', 'in', ['sale', 'done']]
    ],
    ['id', 'name', 'date_order', 'amount_total'],
    20,
    'date_order desc'
  );

  const totalRevenue = orders.reduce((sum: number, o: any) => sum + (o.amount_total || 0), 0);
  const lastOrder = orders[0];
  const daysSinceLastOrder = lastOrder
    ? Math.floor((Date.now() - new Date(lastOrder.date_order).getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  return `**Cliente: ${client.name}**
- Email: ${client.email || 'N/A'}
- Telefono: ${client.phone || 'N/A'}
- Città: ${client.city || 'N/A'}

**Performance**:
- Ordini totali: ${orders.length}
- Revenue totale: €${totalRevenue.toFixed(0)}
- Ultimo ordine: ${daysSinceLastOrder} giorni fa
- Avg ordine: €${(totalRevenue / Math.max(orders.length, 1)).toFixed(0)}

**Ultimi Ordini**:
${orders.slice(0, 5).map((o: any) => `- ${o.name}: €${o.amount_total.toFixed(0)} (${new Date(o.date_order).toLocaleDateString('it-IT')})`).join('\n')}`;
}

/**
 * Genera risposta AI usando Claude + context Odoo
 */
async function generateAIResponse(
  message: string,
  intentType: string,
  context: string,
  salespersonName: string
): Promise<string> {
  const systemPrompt = `Sei un assistente AI per venditori B2B nel settore food.

RUOLO: Aiuti ${salespersonName} (venditore Lapa) a gestire clienti e raggiungere obiettivi.

STILE:
- Conciso e pratico (massimo 10 righe)
- Usa emoji moderatamente (1-2 max)
- Focus su azioni concrete
- Dati numerici precisi

⚠️ **REGOLA CRITICA**:
USA SOLO I DATI FORNITI QUI SOTTO.
NON inventare nomi di clienti, cifre, città o dettagli che non sono esplicitamente menzionati.
Se i dati mancano, dì "Non ho questi dati in Odoo" invece di inventare.

DATI ODOO DISPONIBILI:
${context}

Rispondi alla richiesta del venditore usando ESCLUSIVAMENTE i dati sopra.`;

  const response = await claude.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    temperature: 0.7,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: message
    }]
  });

  const content = response.content[0];
  return content.type === 'text' ? content.text : 'Mi dispiace, non ho capito.';
}
