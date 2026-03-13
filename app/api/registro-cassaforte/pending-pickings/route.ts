import { NextRequest, NextResponse } from 'next/server';
import { getOdooSessionManager } from '@/lib/odoo/sessionManager';
import { verifyCassaforteAuth } from '@/lib/registro-cassaforte/api-auth';

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
  const authError = verifyCassaforteAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employee_id');

    const sessionManager = getOdooSessionManager();

    // 1. Recupera picking completati degli ultimi 30 giorni
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateFrom = thirtyDaysAgo.toISOString().split('T')[0];

    const domain: any[] = [
      ['state', '=', 'done'],
      ['picking_type_code', '=', 'outgoing'],
      ['date_done', '>=', dateFrom],
    ];

    if (employeeId) {
      const employees = await sessionManager.callKw(
        'hr.employee',
        'search_read',
        [[['id', '=', parseInt(employeeId)]]],
        { fields: ['id', 'user_id'], limit: 1 }
      );

      if (employees.length > 0 && employees[0].user_id) {
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

    // 2. Collect ALL message_ids from ALL pickings into one array
    const allMessageIds: number[] = [];
    for (const picking of pickings) {
      if (picking.message_ids && picking.message_ids.length > 0) {
        allMessageIds.push(...picking.message_ids);
      }
    }

    // 3. Fetch ALL messages in ONE batch query
    const allMessages: any[] = allMessageIds.length > 0
      ? await sessionManager.callKw(
          'mail.message',
          'search_read',
          [[['id', 'in', allMessageIds]]],
          { fields: ['id', 'body', 'date'] }
        )
      : [];

    // 4. Build a map of message id -> message
    const messageMap = new Map<number, any>();
    for (const msg of allMessages) {
      messageMap.set(msg.id, msg);
    }

    // 5. Process pickings in memory to find cash payments and filter deposited ones
    const cashPickings: { picking: any; amount: number; messageId: number }[] = [];

    for (const picking of pickings) {
      if (!picking.message_ids || picking.message_ids.length === 0) continue;

      const pickingMessages = picking.message_ids
        .map((id: number) => messageMap.get(id))
        .filter(Boolean);

      // Skip if already deposited
      const alreadyDeposited = pickingMessages.some((msg: any) => {
        const body = msg.body?.toLowerCase() || '';
        return body.includes('versato in cassaforte');
      });
      if (alreadyDeposited) continue;

      // Find first cash payment message
      for (const msg of pickingMessages) {
        const body = msg.body?.toLowerCase() || '';
        if (body.includes('incasso pagamento') && (body.includes('contanti') || body.includes('cash'))) {
          const amountMatch = body.match(/(?:€|chf)\s*([\d.,]+)/i);
          if (amountMatch) {
            const amount = parseFloat(amountMatch[1].replace(',', '.'));
            cashPickings.push({ picking, amount, messageId: msg.id });
            break; // Only first match per picking (dedup)
          }
        }
      }
    }

    // 6. Batch-fetch sale orders for pickings with sale_id
    const saleIds = Array.from(new Set(
      cashPickings
        .filter(cp => cp.picking.sale_id)
        .map(cp => Array.isArray(cp.picking.sale_id) ? cp.picking.sale_id[0] : cp.picking.sale_id)
    ))

    const saleOrderMap = new Map<number, any>();
    if (saleIds.length > 0) {
      const saleOrders = await sessionManager.callKw(
        'sale.order',
        'search_read',
        [[['id', 'in', saleIds]]],
        { fields: ['id', 'invoice_ids'] }
      );
      for (const so of saleOrders) {
        saleOrderMap.set(so.id, so);
      }
    }

    // 7. Collect all invoice ids and batch-fetch
    const allInvoiceIds: number[] = [];
    Array.from(saleOrderMap.values()).forEach((so) => {
      if (so.invoice_ids && so.invoice_ids.length > 0) {
        allInvoiceIds.push(so.invoice_ids[0]); // First invoice only
      }
    });

    const invoiceMap = new Map<number, any>();
    if (allInvoiceIds.length > 0) {
      const invoices = await sessionManager.callKw(
        'account.move',
        'search_read',
        [[['id', 'in', Array.from(new Set(allInvoiceIds))]]],
        { fields: ['id', 'name', 'amount_total'] }
      );
      for (const inv of invoices) {
        invoiceMap.set(inv.id, inv);
      }
    }

    // 8. Build response
    const pendingPayments = cashPickings.map(({ picking, amount, messageId }) => {
      let invoiceId: number | null = null;
      let invoiceName: string | null = null;
      let invoiceAmount: number | null = null;

      if (picking.sale_id) {
        const saleId = Array.isArray(picking.sale_id) ? picking.sale_id[0] : picking.sale_id;
        const so = saleOrderMap.get(saleId);
        if (so && so.invoice_ids && so.invoice_ids.length > 0) {
          const inv = invoiceMap.get(so.invoice_ids[0]);
          if (inv) {
            invoiceId = inv.id;
            invoiceName = inv.name;
            invoiceAmount = inv.amount_total;
          }
        }
      }

      return {
        picking_id: picking.id,
        picking_name: picking.name,
        partner_id: picking.partner_id ? picking.partner_id[0] : null,
        partner_name: picking.partner_id ? picking.partner_id[1] : 'Cliente sconosciuto',
        amount,
        date: picking.date_done?.split(' ')[0] || '',
        driver_name: picking.user_id ? picking.user_id[1] : 'Non assegnato',
        message_id: messageId,
        invoice_id: invoiceId,
        invoice_name: invoiceName,
        invoice_amount: invoiceAmount,
      };
    });

    return NextResponse.json({
      success: true,
      pickings: pendingPayments,
      count: pendingPayments.length,
    });

  } catch (error: any) {
    console.error('❌ Errore recupero incassi pendenti:', error);

    return NextResponse.json({
      success: false,
      error: error.message || 'Errore durante il recupero degli incassi',
    }, { status: 500 });
  }
}
