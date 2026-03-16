import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

const ODOO_URL = process.env.ODOO_URL || 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = process.env.ODOO_DB || 'lapadevadmin-lapa-v2-main-7268478';

async function callOdoo(sessionId: string, model: string, method: string, args: any[] = [], kwargs: any = {}) {
  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `session_id=${sessionId}`
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model,
        method,
        args,
        kwargs
      },
      id: Math.floor(Math.random() * 1000000000)
    })
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`Errore ${model}.${method}: ${JSON.stringify(data.error)}`);
  }

  return data.result;
}

async function getSalesOrderPickings(sessionId: string, salesOrderName: string) {
  const pickings = await callOdoo(sessionId, 'stock.picking', 'search_read', [[
    ['origin', '=', salesOrderName]
  ]], {
    fields: ['name', 'picking_type_code', 'state', 'date_done'],
    order: 'date_done desc'
  });

  return pickings;
}

async function trovaOutCompletato(sessionId: string, salesOrderName: string) {
  const pickings = await getSalesOrderPickings(sessionId, salesOrderName);

  const outCompletati = pickings
    .filter((p: any) => p.picking_type_code === 'outgoing' && p.state === 'done')
    .sort((a: any, b: any) => new Date(b.date_done).getTime() - new Date(a.date_done).getTime());

  return outCompletati[0];
}

async function cercaScarichiParziali(sessionId: string, pickingId: number) {
  const messages = await callOdoo(sessionId, 'mail.message', 'search_read', [[
    ['model', '=', 'stock.picking'],
    ['res_id', '=', pickingId],
    ['message_type', 'in', ['comment', 'notification']],
    ['body', 'ilike', 'SCARICO PARZIALE']
  ]], {
    fields: ['date', 'author_id', 'body', 'subject', 'message_type', 'attachment_ids'],
    order: 'date desc'
  });

  const messaggiFormattati = [];

  // Leggi tutti gli allegati in parallelo
  const allAttachmentIds = messages.flatMap((msg: any) => msg.attachment_ids || []);
  let attachmentMap = new Map();
  if (allAttachmentIds.length > 0) {
    const attachments = await callOdoo(sessionId, 'ir.attachment', 'read', [allAttachmentIds], {
      fields: ['id', 'name', 'mimetype', 'description']
    });
    for (const att of attachments) {
      attachmentMap.set(att.id, { id: att.id, nome: att.name, tipo: att.mimetype, descrizione: att.description });
    }
  }

  for (const msg of messages) {
    const allegati = (msg.attachment_ids || []).map((id: number) => attachmentMap.get(id)).filter(Boolean);

    // Pulisci HTML dal body
    const cleanBody = msg.body
      ? msg.body.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
      : '';

    messaggiFormattati.push({
      autore: msg.author_id ? msg.author_id[1] : 'Sconosciuto',
      data: msg.date,
      subject: msg.subject || '',
      messaggio: cleanBody,
      tipo: msg.message_type,
      allegati: allegati,
      hasAudio: allegati.some((a: any) => a.tipo && a.tipo.includes('audio'))
    });
  }

  return messaggiFormattati;
}

async function getProdottiNonScaricati(sessionId: string, pickingId: number) {
  // Per trovare i prodotti nel furgone, leggo le "Operazioni Dettagliate" (stock.move.line)

  const moveLines = await callOdoo(sessionId, 'stock.move.line', 'search_read', [[
    ['picking_id', '=', pickingId]
  ]], {
    fields: ['product_id', 'product_uom_id', 'quantity', 'qty_done']
  });

  const prodottiNonScaricati = [];

  // Raggruppa per prodotto
  const prodottiMap = new Map();

  for (const line of moveLines) {
    const productId = line.product_id ? line.product_id[0] : 0;
    const productName = line.product_id ? line.product_id[1] : 'Prodotto sconosciuto';
    const uom = line.product_uom_id ? line.product_uom_id[1] : 'PZ';
    const qtyRichiesta = line.quantity || 0;
    const qtyDone = line.qty_done || 0;

    if (!prodottiMap.has(productId)) {
      prodottiMap.set(productId, {
        nome: productName,
        quantitaRichiesta: 0,
        quantitaEffettiva: 0,
        uom: uom
      });
    }

    const prodotto = prodottiMap.get(productId);
    prodotto.quantitaRichiesta += qtyRichiesta;
    prodotto.quantitaEffettiva += qtyDone;
  }

  // Prodotti con qty_done = 0 sono ancora nel furgone
  for (const [productId, prodotto] of Array.from(prodottiMap.entries())) {
    if (prodotto.quantitaEffettiva === 0 && prodotto.quantitaRichiesta > 0) {
      prodottiNonScaricati.push({
        nome: prodotto.nome,
        quantitaRichiesta: prodotto.quantitaRichiesta,
        quantitaEffettiva: prodotto.quantitaEffettiva,
        uom: prodotto.uom
      });
    }
  }

  return prodottiNonScaricati;
}


async function getAutistaEVeicolo(sessionId: string, pickingId: number, batchId: number | null, locationName: string | null) {
  let autista = null;
  let veicolo = null;

  // Prova 1: Se picking ha batch_id, leggi info da batch
  if (batchId) {
    try {
      const batch = await callOdoo(sessionId, 'stock.picking.batch', 'read', [[batchId]], {
        fields: ['x_studio_autista_del_giro', 'x_studio_auto_del_giro']
      });

      if (batch && batch.length > 0) {
        autista = batch[0].x_studio_autista_del_giro ? batch[0].x_studio_autista_del_giro[1] : null;
        veicolo = batch[0].x_studio_auto_del_giro ? batch[0].x_studio_auto_del_giro[1] : null;
      }
    } catch (error) {
      console.log('   ⚠️  Errore lettura batch:', error);
    }
  }

  // Prova 2: Estrai autista dalla location (es: "WH/Furgoni/Liviu")
  if (!autista && locationName && locationName.includes('Furgon')) {
    const parts = locationName.split('/');
    if (parts.length >= 3) {
      autista = parts[2]; // "Liviu"
      veicolo = veicolo || autista; // Usa il nome autista come default per veicolo
    }
  }

  return { autista, veicolo };
}

async function checkReturnCreated(sessionId: string, residualPickingName: string) {
  try {
    // Cerca transfer interni con origin che contiene il nome del picking residuo
    const existingReturns = await callOdoo(sessionId, 'stock.picking', 'search_read', [[
      ['picking_type_code', '=', 'internal'],
      ['origin', 'ilike', residualPickingName]
    ]], {
      fields: ['id', 'name', 'state'],
      limit: 1
    });

    return existingReturns && existingReturns.length > 0;
  } catch (error) {
    console.log('   ⚠️  Errore verifica return:', error);
    return false;
  }
}

export async function GET(request: NextRequest) {
  try {
    // Autentica con sessione utente
    const cookieStore = cookies();
    const sessionId = cookieStore.get('odoo_session_id')?.value;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Non autenticato' },
        { status: 401 }
      );
    }

    console.log('📋 Ricerca ordini OUT residui...');

    // Cerca TUTTI i picking OUT in stato "assigned" (Pronto), senza filtro per data
    const pickingsResidui = await callOdoo(sessionId, 'stock.picking', 'search_read', [[
      ['picking_type_code', '=', 'outgoing'],
      ['state', '=', 'assigned']
    ]], {
      fields: [
        'name',
        'partner_id',
        'scheduled_date',
        'state',
        'origin',
        'move_ids_without_package',
        'batch_id',
        'location_id'
      ],
      order: 'scheduled_date desc'
    });

    console.log(`✅ Trovati ${pickingsResidui.length} ordini OUT residui`);

    // Processa tutti gli ordini in parallelo (max 10 alla volta per non sovraccaricare Odoo)
    const BATCH_SIZE = 10;
    const ordiniConDettagli = [];

    const pickingsValidi = pickingsResidui.filter((p: any) => p.origin);

    for (let i = 0; i < pickingsValidi.length; i += BATCH_SIZE) {
      const batch = pickingsValidi.slice(i, i + BATCH_SIZE);

      const results = await Promise.all(batch.map(async (pickingResiduo: any) => {
        const salesOrderName = pickingResiduo.origin;
        const batchId = pickingResiduo.batch_id ? pickingResiduo.batch_id[0] : null;
        const locationName = pickingResiduo.location_id ? pickingResiduo.location_id[1] : null;

        // Fase 1: 4 query in parallelo
        const [outCompletato, { autista, veicolo }, returnCreated, prodottiNonScaricati] = await Promise.all([
          trovaOutCompletato(sessionId, salesOrderName),
          getAutistaEVeicolo(sessionId, pickingResiduo.id, batchId, locationName),
          checkReturnCreated(sessionId, pickingResiduo.name),
          getProdottiNonScaricati(sessionId, pickingResiduo.id)
        ]);

        // FILTRO 1: almeno 1 prodotto nel furgone
        if (prodottiNonScaricati.length === 0) return null;
        // FILTRO 2: deve avere OUT completato (scarico parziale precedente)
        if (!outCompletato) return null;

        // Fase 2: messaggi scarico parziale (serve outCompletato.id)
        const messaggiScaricoParziale = await cercaScarichiParziali(sessionId, outCompletato.id);

        return {
          numeroOrdineResiduo: pickingResiduo.name,
          cliente: pickingResiduo.partner_id ? pickingResiduo.partner_id[1] : 'Sconosciuto',
          clienteId: pickingResiduo.partner_id ? pickingResiduo.partner_id[0] : 0,
          dataPrevisita: pickingResiduo.scheduled_date,
          salesOrder: salesOrderName,
          outCompletato: outCompletato.name,
          prodottiNonScaricati,
          messaggiScaricoParziale,
          haScarichiParziali: messaggiScaricoParziale.length > 0,
          autista,
          veicolo,
          returnCreated
        };
      }));

      ordiniConDettagli.push(...results.filter(Boolean));
    }

    console.log(`\n✅ Analisi completata! ${ordiniConDettagli.length} ordini con dettagli`);

    return NextResponse.json({
      success: true,
      orders: ordiniConDettagli,
      count: ordiniConDettagli.length
    });

  } catch (error: any) {
    console.error('❌ Errore:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Errore del server'
    }, { status: 500 });
  }
}
