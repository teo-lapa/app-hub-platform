import { NextRequest, NextResponse } from 'next/server';
import { getOdooSessionManager } from '@/lib/odoo/sessionManager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Journal Cash ID (verificato in Odoo)
const CASH_JOURNAL_ID = 8;

interface BanknoteCount {
  denomination: number;
  count: number;
}

interface CoinCount {
  denomination: number;
  count: number;
}

interface DepositRequest {
  employee_id: number;
  employee_name: string;
  type: 'from_delivery' | 'extra';
  picking_ids?: number[];
  customer_name?: string;
  expected_amount?: number;
  amount: number;
  banknotes: BanknoteCount[];
  coins: CoinCount[];
}

/**
 * POST /api/registro-cassaforte/confirm-deposit
 * Registra un versamento in cassaforte creando un account.payment in Odoo
 */
export async function POST(request: NextRequest) {
  try {
    const body: DepositRequest = await request.json();

    // Validazione
    if (!body.employee_id || !body.employee_name) {
      return NextResponse.json({
        success: false,
        error: 'Dipendente non specificato',
      }, { status: 400 });
    }

    if (!body.amount || body.amount <= 0) {
      return NextResponse.json({
        success: false,
        error: 'Importo non valido',
      }, { status: 400 });
    }

    if (body.type === 'extra' && !body.customer_name) {
      return NextResponse.json({
        success: false,
        error: 'Nome cliente richiesto per versamenti extra',
      }, { status: 400 });
    }

    const sessionManager = getOdooSessionManager();

    // Costruisci la comunicazione/memo
    const timestamp = new Date().toISOString();
    const banknotesSummary = body.banknotes
      .filter(b => b.count > 0)
      .map(b => `${b.count}x${b.denomination}CHF`)
      .join(', ');
    const coinsSummary = body.coins
      .filter(c => c.count > 0)
      .map(c => `${c.count}x${c.denomination >= 1 ? c.denomination + 'CHF' : (c.denomination * 100) + 'ct'}`)
      .join(', ');

    let communication = `Versamento Cassaforte - ${body.employee_name}`;
    if (body.type === 'from_delivery') {
      communication += ` - Da consegne`;
      if (body.picking_ids && body.picking_ids.length > 0) {
        communication += ` (${body.picking_ids.length} incassi)`;
      }
    } else {
      communication += ` - Extra: ${body.customer_name}`;
    }

    // Calcola discrepanza se applicabile
    let discrepancy = 0;
    if (body.expected_amount && body.expected_amount > 0) {
      discrepancy = body.amount - body.expected_amount;
    }

    // Determina il partner_id corretto
    let partnerId: number | null = null;
    let partnerName: string = '';

    if (body.type === 'from_delivery' && body.picking_ids && body.picking_ids.length > 0) {
      // Per versamenti da consegne, recupera il cliente AZIENDA (non il contatto di consegna)
      try {
        const pickings = await sessionManager.callKw(
          'stock.picking',
          'search_read',
          [[['id', 'in', body.picking_ids]]],
          { fields: ['id', 'partner_id', 'sale_id'], limit: 1 }
        );

        if (pickings.length > 0 && pickings[0].partner_id) {
          const deliveryPartnerId = Array.isArray(pickings[0].partner_id)
            ? pickings[0].partner_id[0]
            : pickings[0].partner_id;

          // Recupera il partner di consegna per trovare l'azienda madre
          const deliveryPartner = await sessionManager.callKw(
            'res.partner',
            'search_read',
            [[['id', '=', deliveryPartnerId]]],
            { fields: ['id', 'name', 'parent_id', 'commercial_partner_id', 'type'], limit: 1 }
          );

          if (deliveryPartner.length > 0) {
            // commercial_partner_id è l'azienda principale per la fatturazione
            // Altrimenti usa parent_id, altrimenti il partner stesso se è già l'azienda
            if (deliveryPartner[0].commercial_partner_id) {
              partnerId = Array.isArray(deliveryPartner[0].commercial_partner_id)
                ? deliveryPartner[0].commercial_partner_id[0]
                : deliveryPartner[0].commercial_partner_id;
              partnerName = Array.isArray(deliveryPartner[0].commercial_partner_id)
                ? deliveryPartner[0].commercial_partner_id[1]
                : '';
              console.log(`🏢 Azienda commerciale: ${partnerName} (ID: ${partnerId})`);
            } else if (deliveryPartner[0].parent_id) {
              partnerId = Array.isArray(deliveryPartner[0].parent_id)
                ? deliveryPartner[0].parent_id[0]
                : deliveryPartner[0].parent_id;
              partnerName = Array.isArray(deliveryPartner[0].parent_id)
                ? deliveryPartner[0].parent_id[1]
                : '';
              console.log(`🏢 Azienda madre: ${partnerName} (ID: ${partnerId})`);
            } else {
              // Il partner è già l'azienda (nessun parent)
              partnerId = deliveryPartnerId;
              partnerName = deliveryPartner[0].name || '';
              console.log(`🏢 Partner diretto (azienda): ${partnerName} (ID: ${partnerId})`);
            }
          }
        }
      } catch (pickingError) {
        console.warn('⚠️ Errore recupero cliente dal picking:', pickingError);
      }
    }

    // Se non abbiamo trovato un cliente dal picking, usa il partner generico
    if (!partnerId) {
      // Cerca partner esistente "Versamenti Cassaforte"
      const existingPartners = await sessionManager.callKw(
        'res.partner',
        'search_read',
        [[['name', '=', 'Versamenti Cassaforte']]],
        { fields: ['id'], limit: 1 }
      );

      if (existingPartners.length > 0) {
        partnerId = existingPartners[0].id;
      } else {
        // Crea partner generico
        partnerId = await sessionManager.callKw(
          'res.partner',
          'create',
          [{
            name: 'Versamenti Cassaforte',
            is_company: false,
            customer_rank: 1,
            comment: 'Partner generico per versamenti in cassaforte',
          }]
        );
      }
      partnerName = 'Versamenti Cassaforte';
    }

    // Crea il pagamento in Odoo
    const paymentData = {
      payment_type: 'inbound',
      partner_type: 'customer',
      partner_id: partnerId,
      amount: body.amount,
      journal_id: CASH_JOURNAL_ID,
      payment_method_line_id: 1, // Default cash method
      ref: communication,
      // Campi custom (se esistono in Odoo)
      // x_safe_employee_id: body.employee_id,
      // x_safe_employee_name: body.employee_name,
      // x_safe_deposit_type: body.type,
      // x_safe_banknotes: banknotesSummary,
      // x_safe_coins: coinsSummary,
      // x_safe_discrepancy: discrepancy,
    };

    console.log('📝 Creazione payment:', paymentData);

    const paymentId = await sessionManager.callKw(
      'account.payment',
      'create',
      [paymentData]
    );

    console.log('✅ Payment creato:', paymentId);

    // Conferma il pagamento (action_post)
    try {
      await sessionManager.callKw(
        'account.payment',
        'action_post',
        [[paymentId]]
      );
      console.log('✅ Payment confermato');
    } catch (postError) {
      console.warn('⚠️ Errore conferma payment (potrebbe essere già confermato):', postError);
    }

    // Crea una riga nel registro Cash (bank statement line) per la riconciliazione
    // In Odoo 17+, le bank statement lines possono essere create direttamente senza statement
    let statementLineId: number | null = null;
    try {
      const today = new Date().toISOString().split('T')[0];

      // In Odoo 17, creiamo direttamente la statement line
      // Il journal gestisce automaticamente lo statement
      statementLineId = await sessionManager.callKw(
        'account.bank.statement.line',
        'create',
        [{
          journal_id: CASH_JOURNAL_ID,
          date: today,
          payment_ref: communication,
          partner_id: partnerId,
          amount: body.amount,
        }]
      );
      console.log(`✅ Statement line creata: ${statementLineId}`);

    } catch (statementError: any) {
      console.error('❌ Errore creazione statement line:', statementError.message);
      console.error('   Dettagli:', JSON.stringify(statementError));
      // Non blocchiamo - il pagamento è stato creato comunque
    }

    // Aggiungi nota nel chatter con dettagli completi
    const noteBody = `
      <h3>🔐 Versamento Cassaforte</h3>
      <ul>
        <li><strong>Dipendente:</strong> ${body.employee_name} (ID: ${body.employee_id})</li>
        <li><strong>Tipo:</strong> ${body.type === 'from_delivery' ? 'Da consegne' : 'Extra'}</li>
        ${body.type === 'extra' ? `<li><strong>Cliente:</strong> ${body.customer_name}</li>` : ''}
        ${body.picking_ids && body.picking_ids.length > 0 ? `<li><strong>Picking IDs:</strong> ${body.picking_ids.join(', ')}</li>` : ''}
        <li><strong>Importo:</strong> CHF ${body.amount.toFixed(2)}</li>
        ${body.expected_amount ? `<li><strong>Importo atteso:</strong> CHF ${body.expected_amount.toFixed(2)}</li>` : ''}
        ${discrepancy !== 0 ? `<li><strong>Discrepanza:</strong> CHF ${discrepancy > 0 ? '+' : ''}${discrepancy.toFixed(2)}</li>` : ''}
        <li><strong>Banconote:</strong> ${banknotesSummary || 'Nessuna'}</li>
        <li><strong>Monete:</strong> ${coinsSummary || 'Nessuna'}</li>
        <li><strong>Data/Ora:</strong> ${new Date().toLocaleString('it-CH')}</li>
      </ul>
    `;

    try {
      await sessionManager.callKw(
        'mail.message',
        'create',
        [{
          body: noteBody,
          model: 'account.payment',
          res_id: paymentId,
          message_type: 'comment',
          subtype_id: 2, // Note subtype
        }]
      );
    } catch (noteError) {
      console.warn('⚠️ Errore creazione nota:', noteError);
    }

    // Se il versamento è da consegne, aggiungi nota anche sui picking
    if (body.type === 'from_delivery' && body.picking_ids && body.picking_ids.length > 0) {
      for (const pickingId of body.picking_ids) {
        try {
          await sessionManager.callKw(
            'mail.message',
            'create',
            [{
              body: `<p>💰 <strong>Versato in cassaforte</strong> da ${body.employee_name} - Payment ID: ${paymentId}</p>`,
              model: 'stock.picking',
              res_id: pickingId,
              message_type: 'comment',
              subtype_id: 2,
            }]
          );
        } catch (pickingNoteError) {
          console.warn(`⚠️ Errore nota picking ${pickingId}:`, pickingNoteError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      payment_id: paymentId,
      message: 'Versamento registrato con successo',
      data: {
        amount: body.amount,
        employee: body.employee_name,
        type: body.type,
        discrepancy: discrepancy,
      },
    });

  } catch (error: any) {
    console.error('❌ Errore conferma versamento:', error);

    return NextResponse.json({
      success: false,
      error: error.message || 'Errore durante la registrazione del versamento',
    }, { status: 500 });
  }
}
