import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

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

  for (const msg of messages) {
    // Leggi allegati
    let allegati = [];
    if (msg.attachment_ids && msg.attachment_ids.length > 0) {
      const attachments = await callOdoo(sessionId, 'ir.attachment', 'read', [msg.attachment_ids], {
        fields: ['id', 'name', 'mimetype', 'description']
      });

      allegati = attachments.map((att: any) => ({
        id: att.id,
        nome: att.name,
        tipo: att.mimetype,
        descrizione: att.description
      }));
    }

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
  // Per trovare i prodotti nel furgone, devo guardare le "Operazioni Dettagliate" (stock.move.line)
  // Questi sono i prodotti effettivamente riservati/disponibili nel furgone

  const moveLines = await callOdoo(sessionId, 'stock.move.line', 'search_read', [[
    ['picking_id', '=', pickingId],
    ['state', 'in', ['assigned', 'partially_available']]
  ]], {
    fields: ['product_id', 'product_uom_id', 'reserved_uom_qty', 'location_id', 'location_dest_id']
  });

  const prodottiNonScaricati = [];

  for (const line of moveLines) {
    const quantitaRiservata = line.reserved_uom_qty || 0;

    // Se c'è quantità riservata, significa che il prodotto è nel furgone
    if (quantitaRiservata > 0) {
      prodottiNonScaricati.push({
        nome: line.product_id ? line.product_id[1] : 'Prodotto sconosciuto',
        quantitaRichiesta: quantitaRiservata,
        quantitaEffettiva: 0, // Non ancora consegnato
        uom: line.product_uom_id ? line.product_uom_id[1] : 'PZ'
      });
    }
  }

  return prodottiNonScaricati;
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

    // Data di oggi
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);
    const oggiStr = oggi.toISOString().split('T')[0];

    console.log(`⚠️  Escludendo ordini con data prevista di OGGI: ${oggiStr}`);

    // Cerca tutti i picking OUT in stato "assigned" (Pronto) con data < oggi
    const pickingsResidui = await callOdoo(sessionId, 'stock.picking', 'search_read', [[
      ['picking_type_code', '=', 'outgoing'],
      ['state', '=', 'assigned'],
      ['scheduled_date', '<', oggiStr]
    ]], {
      fields: [
        'name',
        'partner_id',
        'scheduled_date',
        'state',
        'origin',
        'move_ids_without_package'
      ],
      order: 'scheduled_date desc'
    });

    console.log(`✅ Trovati ${pickingsResidui.length} ordini OUT residui`);

    // Per ogni ordine residuo, trova Sales Order → OUT completato → messaggi scarico parziale
    const ordiniConDettagli = [];

    for (const pickingResiduo of pickingsResidui) {
      console.log(`\n🔍 Analisi ordine residuo: ${pickingResiduo.name}`);

      const salesOrderName = pickingResiduo.origin;

      if (!salesOrderName) {
        console.log('   ⚠️  Nessun Sales Order collegato, skip');
        continue;
      }

      console.log(`   📦 Sales Order: ${salesOrderName}`);

      // Trova OUT completato per questo Sales Order
      const outCompletato = await trovaOutCompletato(sessionId, salesOrderName);

      if (!outCompletato) {
        console.log('   ⚠️  Nessun OUT completato trovato per questo SO');
        ordiniConDettagli.push({
          numeroOrdineResiduo: pickingResiduo.name,
          cliente: pickingResiduo.partner_id ? pickingResiduo.partner_id[1] : 'Sconosciuto',
          dataPrevisita: pickingResiduo.scheduled_date,
          salesOrder: salesOrderName,
          outCompletato: null,
          prodottiNonScaricati: [],
          messaggiScaricoParziale: [],
          haScarichiParziali: false
        });
        continue;
      }

      console.log(`   ✅ OUT completato trovato: ${outCompletato.name}`);

      // Cerca messaggi di scarico parziale nell'OUT completato
      const messaggiScaricoParziale = await cercaScarichiParziali(sessionId, outCompletato.id);

      console.log(`   📨 Messaggi scarico parziale: ${messaggiScaricoParziale.length}`);

      // Trova prodotti non scaricati (dall'ordine residuo)
      const prodottiNonScaricati = await getProdottiNonScaricati(sessionId, pickingResiduo.id);

      console.log(`   📦 Prodotti non scaricati: ${prodottiNonScaricati.length}`);

      ordiniConDettagli.push({
        numeroOrdineResiduo: pickingResiduo.name,
        cliente: pickingResiduo.partner_id ? pickingResiduo.partner_id[1] : 'Sconosciuto',
        dataPrevisita: pickingResiduo.scheduled_date,
        salesOrder: salesOrderName,
        outCompletato: outCompletato.name,
        prodottiNonScaricati,
        messaggiScaricoParziale,
        haScarichiParziali: messaggiScaricoParziale.length > 0
      });
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
