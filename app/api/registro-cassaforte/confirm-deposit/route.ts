import { NextRequest, NextResponse } from 'next/server';
import { getOdooSessionManager } from '@/lib/odoo/sessionManager';
import { verifyCassaforteAuth, getCashJournalId } from '@/lib/registro-cassaforte/api-auth';
import { escapeHtml } from '@/lib/registro-cassaforte/helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
  photo_base64?: string; // Foto di conferma (selfie) in base64
}

/**
 * POST /api/registro-cassaforte/confirm-deposit
 * Registra un versamento in cassaforte creando una bank statement line nel registro Cash di Odoo.
 * La statement line crea automaticamente il move contabile e appare nella riconciliazione bancaria.
 */
export async function POST(request: NextRequest) {
  const authError = verifyCassaforteAuth(request);
  if (authError) return authError;

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
    const banknotesSummary = body.banknotes
      .filter(b => b.count > 0)
      .map(b => `${b.count}x${b.denomination}CHF`)
      .join(', ');
    const coinsSummary = body.coins
      .filter(c => c.count > 0)
      .map(c => `${c.count}x${c.denomination >= 1 ? c.denomination + 'CHF' : (c.denomination * 100) + 'ct'}`)
      .join(', ');

    let communication = `Versamento Cassaforte - ${body.employee_name}`;
    let pickingNames: string[] = [];
    let saleOrderNames: string[] = [];

    // Fetch picking details once (used for names, sale orders, and partner)
    let pickingDetails: any[] = [];
    if (body.type === 'from_delivery' && body.picking_ids && body.picking_ids.length > 0) {
      try {
        pickingDetails = await sessionManager.callKw(
          'stock.picking',
          'search_read',
          [[['id', 'in', body.picking_ids]]],
          { fields: ['id', 'name', 'sale_id', 'partner_id'] }
        );
        pickingNames = pickingDetails.map((p: any) => p.name).filter(Boolean);
        saleOrderNames = pickingDetails
          .map((p: any) => Array.isArray(p.sale_id) ? p.sale_id[1] : null)
          .filter(Boolean);
      } catch (e) {
        console.warn('⚠️ Errore recupero dettagli picking:', e);
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

    if (body.type === 'from_delivery' && pickingDetails.length > 0) {
      // Per versamenti da consegne, recupera il cliente AZIENDA (non il contatto di consegna)
      try {
        if (pickingDetails[0].partner_id) {
          const deliveryPartnerId = Array.isArray(pickingDetails[0].partner_id)
            ? pickingDetails[0].partner_id[0]
            : pickingDetails[0].partner_id;

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

    // Completa la comunicazione con tutti i dati di tracciabilità
    // Format: "Versamento Cassaforte - Employee - Partner - Picking - SaleOrder"
    if (body.type === 'from_delivery' && partnerName) {
      communication += ` - ${partnerName}`;
      if (pickingNames.length > 0) {
        communication += ` - ${pickingNames.join(', ')}`;
      }
      if (saleOrderNames.length > 0) {
        communication += ` - ${saleOrderNames.join(', ')}`;
      }
    }

    // In Odoo 17, creiamo direttamente una bank statement line nel registro Cash
    // Questo crea automaticamente il move contabile e appare nella riconciliazione bancaria
    const today = new Date().toISOString().split('T')[0];

    console.log('📝 Creazione statement line nel registro Cash...');

    const statementLineId = await sessionManager.callKw(
      'account.bank.statement.line',
      'create',
      [{
        journal_id: getCashJournalId(),
        date: today,
        payment_ref: communication,
        partner_id: partnerId,
        amount: body.amount,
      }]
    );

    console.log(`✅ Statement line creata: ${statementLineId}`);

    // Recupera il move_id creato automaticamente dalla statement line
    let moveId: number | null = null;
    try {
      const statementLine = await sessionManager.callKw(
        'account.bank.statement.line',
        'search_read',
        [[['id', '=', statementLineId]]],
        { fields: ['move_id'], limit: 1 }
      );
      if (statementLine.length > 0 && statementLine[0].move_id) {
        moveId = Array.isArray(statementLine[0].move_id)
          ? statementLine[0].move_id[0]
          : statementLine[0].move_id;
        console.log(`✅ Move ID associato: ${moveId}`);
      }
    } catch (e) {
      console.warn('⚠️ Errore recupero move_id:', e);
    }

    // Aggiungi nota nel chatter con dettagli completi
    const noteBody = `
      <h3>🔐 Versamento Cassaforte</h3>
      <ul>
        <li><strong>Dipendente:</strong> ${escapeHtml(body.employee_name)} (ID: ${escapeHtml(String(body.employee_id))})</li>
        <li><strong>Tipo:</strong> ${body.type === 'from_delivery' ? 'Da consegne' : 'Extra'}</li>
        ${body.type === 'extra' && body.customer_name ? `<li><strong>Cliente:</strong> ${escapeHtml(body.customer_name)}</li>` : ''}
        ${pickingNames.length > 0 ? `<li><strong>Picking:</strong> ${pickingNames.map(n => escapeHtml(n)).join(', ')}</li>` : ''}
        <li><strong>Importo:</strong> CHF ${body.amount.toFixed(2)}</li>
        ${body.expected_amount ? `<li><strong>Importo atteso:</strong> CHF ${body.expected_amount.toFixed(2)}</li>` : ''}
        ${discrepancy !== 0 ? `<li><strong>Discrepanza:</strong> CHF ${discrepancy > 0 ? '+' : ''}${discrepancy.toFixed(2)}</li>` : ''}
        <li><strong>Banconote:</strong> ${banknotesSummary || 'Nessuna'}</li>
        <li><strong>Monete:</strong> ${coinsSummary || 'Nessuna'}</li>
        <li><strong>Data/Ora:</strong> ${new Date().toLocaleString('it-CH')}</li>
      </ul>
    `;

    // Aggiungi nota nel chatter del move contabile (se disponibile)
    if (moveId) {
      try {
        await sessionManager.callKw(
          'mail.message',
          'create',
          [{
            body: noteBody,
            model: 'account.move',
            res_id: moveId,
            message_type: 'comment',
            subtype_id: 2, // Note subtype
          }]
        );
      } catch (noteError) {
        console.warn('⚠️ Errore creazione nota sul move:', noteError);
      }
    }

    // Se il versamento è da consegne, aggiungi nota anche sui picking
    if (body.type === 'from_delivery' && body.picking_ids && body.picking_ids.length > 0) {
      for (const pickingId of body.picking_ids) {
        try {
          await sessionManager.callKw(
            'mail.message',
            'create',
            [{
              body: `<p>💰 <strong>Versato in cassaforte</strong> da ${escapeHtml(body.employee_name)} - Statement Line ID: ${statementLineId}${moveId ? ` (Move: ${moveId})` : ''}</p>`,
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

    // Salva la foto di conferma come allegato sul move contabile
    let attachmentId: number | null = null;
    if (body.photo_base64 && moveId) {
      try {
        // Rimuovi il prefisso data:image/... se presente
        const base64Data = body.photo_base64.replace(/^data:image\/\w+;base64,/, '');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `versamento_${body.employee_name.replace(/\s+/g, '_')}_${timestamp}.jpg`;

        attachmentId = await sessionManager.callKw(
          'ir.attachment',
          'create',
          [{
            name: filename,
            type: 'binary',
            datas: base64Data,
            res_model: 'account.move',
            res_id: moveId,
            mimetype: 'image/jpeg',
            description: `Foto conferma versamento - ${body.employee_name} - CHF ${body.amount.toFixed(2)}`,
          }]
        );
        console.log(`📸 Foto allegata: ${attachmentId} (${filename})`);

        // Aggiungi anche un messaggio nel chatter con la foto
        await sessionManager.callKw(
          'mail.message',
          'create',
          [{
            body: `<p>📸 <strong>Foto di conferma versamento</strong></p>`,
            model: 'account.move',
            res_id: moveId,
            message_type: 'comment',
            subtype_id: 2,
            attachment_ids: [[6, 0, [attachmentId]]],
          }]
        );
      } catch (photoError) {
        console.warn('⚠️ Errore salvataggio foto:', photoError);
      }
    }

    return NextResponse.json({
      success: true,
      statement_line_id: statementLineId,
      move_id: moveId,
      message: 'Versamento registrato con successo',
      data: {
        amount: body.amount,
        employee: body.employee_name,
        type: body.type,
        discrepancy: discrepancy,
        partner_name: partnerName,
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
