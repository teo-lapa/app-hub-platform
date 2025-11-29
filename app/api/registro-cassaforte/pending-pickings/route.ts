import { NextRequest, NextResponse } from 'next/server';
import { getOdooSessionManager } from '@/lib/odoo/sessionManager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/registro-cassaforte/pending-pickings
 * Recupera gli incassi cash da versare (da stock.picking con pagamento cash)
 *
 * Query params:
 * - employee_id: ID dipendente (opzionale, filtra per driver)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employee_id');

    const sessionManager = getOdooSessionManager();

    // Prima cerchiamo i picking completati con pagamento cash
    // I pagamenti cash sono registrati nel chatter come messaggi contenenti "INCASSO PAGAMENTO"

    // 1. Recupera picking completati degli ultimi 30 giorni
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateFrom = thirtyDaysAgo.toISOString().split('T')[0];

    const domain: any[] = [
      ['state', '=', 'done'],
      ['picking_type_code', '=', 'outgoing'],
      ['date_done', '>=', dateFrom],
    ];

    // Se specificato employee_id, filtra per driver
    if (employeeId) {
      // Trova l'hr.employee per ottenere il partner_id associato
      const employees = await sessionManager.callKw(
        'hr.employee',
        'search_read',
        [[['id', '=', parseInt(employeeId)]]],
        { fields: ['id', 'user_id'], limit: 1 }
      );

      if (employees.length > 0 && employees[0].user_id) {
        // Cerca picking dove il driver corrisponde
        domain.push(['user_id', '=', employees[0].user_id[0]]);
      }
    }

    const pickings = await sessionManager.callKw(
      'stock.picking',
      'search_read',
      [domain],
      {
        fields: ['id', 'name', 'partner_id', 'date_done', 'user_id', 'sale_id', 'message_ids'],
        order: 'date_done desc',
        limit: 100,
      }
    );

    // 2. Per ogni picking, cerca nei messaggi se c'è un incasso cash non ancora versato
    const pendingPayments: any[] = [];

    for (const picking of pickings) {
      if (!picking.message_ids || picking.message_ids.length === 0) continue;

      // Leggi i messaggi del picking
      const messages = await sessionManager.callKw(
        'mail.message',
        'search_read',
        [[['id', 'in', picking.message_ids]]],
        { fields: ['id', 'body', 'date'] }
      );

      // Prima controlla se questo picking è già stato versato in cassaforte
      const alreadyDeposited = messages.some((msg: any) => {
        const body = msg.body?.toLowerCase() || '';
        return body.includes('versato in cassaforte');
      });

      // Se già versato, salta questo picking
      if (alreadyDeposited) {
        continue;
      }

      // Cerca messaggi con "INCASSO PAGAMENTO" e metodo "contanti" o "cash"
      for (const msg of messages) {
        const body = msg.body?.toLowerCase() || '';

        if (body.includes('incasso pagamento') && (body.includes('contanti') || body.includes('cash'))) {
          // Estrai importo dal messaggio (pattern: "€ 123.45" o "CHF 123.45")
          const amountMatch = body.match(/(?:€|chf)\s*([\d.,]+)/i);
          if (amountMatch) {
            const amount = parseFloat(amountMatch[1].replace(',', '.'));

            pendingPayments.push({
              picking_id: picking.id,
              picking_name: picking.name,
              partner_id: picking.partner_id ? picking.partner_id[0] : null,
              partner_name: picking.partner_id ? picking.partner_id[1] : 'Cliente sconosciuto',
              amount: amount,
              date: picking.date_done?.split(' ')[0] || '',
              driver_name: picking.user_id ? picking.user_id[1] : 'Non assegnato',
              message_id: msg.id,
            });
          }
        }
      }
    }

    // Rimuovi duplicati (stesso picking)
    const uniquePayments = pendingPayments.reduce((acc: any[], payment: any) => {
      if (!acc.find(p => p.picking_id === payment.picking_id)) {
        acc.push(payment);
      }
      return acc;
    }, []);

    return NextResponse.json({
      success: true,
      pickings: uniquePayments,
      count: uniquePayments.length,
    });

  } catch (error: any) {
    console.error('❌ Errore recupero incassi pendenti:', error);

    return NextResponse.json({
      success: false,
      error: error.message || 'Errore durante il recupero degli incassi',
    }, { status: 500 });
  }
}
