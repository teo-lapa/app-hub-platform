import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { GoogleGenAI } from '@google/genai';
import { injectLangContext } from '@/lib/odoo/user-lang';

const ODOO_URL = process.env.ODOO_URL || 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

async function callOdoo(sessionId: string, model: string, method: string, args: any[] = [], kwargs: any = {}) {
  kwargs = injectLangContext(kwargs);
  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `session_id=${sessionId}`
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { model, method, args, kwargs },
      id: Math.floor(Math.random() * 1000000000)
    })
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Odoo ha risposto con errore (${response.status}): ${text.substring(0, 100)}`);
  }
  if (data.error) throw new Error(`Errore ${model}.${method}: ${JSON.stringify(data.error)}`);
  return data.result;
}

async function analyzePhotoWithAI(photoBase64: string, expectedProduct: string): Promise<{ match: boolean; labelText: string; confidence: string }> {
  const response = await genai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: photoBase64 } },
        { text: `Analizza questa foto di un prodotto alimentare. Leggi l'etichetta e il nome del prodotto visibile.

Prodotto atteso: "${expectedProduct}"

Rispondi SOLO in questo formato JSON:
{"match": true/false, "labelText": "testo letto dall'etichetta", "confidence": "alta/media/bassa"}

- match = true se il prodotto nella foto corrisponde a quello atteso (anche se il nome non è identico, basta che sia lo stesso prodotto)
- labelText = quello che riesci a leggere dall'etichetta
- confidence = quanto sei sicuro del match` }
      ]
    }]
  });

  const text = response.text || '';
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch {}
  return { match: false, labelText: text, confidence: 'bassa' };
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const sessionId = cookieStore.get('odoo_session_id')?.value;
    if (!sessionId) return NextResponse.json({ success: false, error: 'Non autenticato' }, { status: 401 });

    const body = await request.json();
    const { action, product, order, photo, reason, messaggiAutista } = body;
    // action: 'photo' | 'not_found'
    // product: { nome, quantitaRichiesta, quantitaEffettiva, uom }
    // order: { numeroOrdineResiduo, cliente, salesOrder }

    if (!product || !order) {
      return NextResponse.json({ success: false, error: 'Dati mancanti' }, { status: 400 });
    }

    const qty = product.quantitaRichiesta - product.quantitaEffettiva;
    if (qty <= 0) return NextResponse.json({ success: false, error: 'Quantità zero' }, { status: 400 });

    // AI analysis (solo per foto)
    let aiResult = null;
    if (action === 'photo') {
      if (!photo) return NextResponse.json({ success: false, error: 'Foto mancante' }, { status: 400 });
      aiResult = await analyzePhotoWithAI(photo, product.nome);
    }

    // Picking residuo (OUT Furgoni→Cliente) dell'ordine: serve a ricavare il prodotto e la location del furgone
    const outPickings = await callOdoo(sessionId, 'stock.picking', 'search_read', [[
      ['name', '=', order.numeroOrdineResiduo]
    ]], { fields: ['id', 'move_ids'] });
    if (outPickings.length === 0) throw new Error(`Picking ${order.numeroOrdineResiduo} non trovato`);
    const outPickingId = outPickings[0].id;

    const outMoves = await callOdoo(sessionId, 'stock.move', 'read', [outPickings[0].move_ids], {
      fields: ['product_id', 'location_id']
    });
    const outMove = outMoves.find((m: any) => m.product_id[1] === product.nome);
    if (!outMove) throw new Error(`Prodotto "${product.nome}" non trovato nell'ordine ${order.numeroOrdineResiduo}`);
    const productId = outMove.product_id[0];
    const vanLocationId = outMove.location_id[0]; // WH/Furgoni (origine dell'OUT)

    // === RESO LEGATO AL DOCUMENTO (solo per foto) ===
    // Il prodotto è rimasto nel furgone: si fa il RESO NATIVO di Odoo del PICK
    // (Deposito→Furgoni) che ce l'ha portato. Odoo aggancia il movimento al lotto/move
    // originale di QUESTO ordine (return_id + origin_returned_move_id) → riporta esattamente
    // quei kg di quel documento, senza toccare lo stock di un altro ordine (niente "furto").
    let returnPickingId: number | null = null;
    let returnPickingName = '';
    let lotName: string | null = null;
    let validated = false;

    if (action === 'photo') {
      // Move del PICK (Deposito→Furgoni, completato) che ha portato il prodotto nel furgone per questo ordine
      const pickMoves = await callOdoo(sessionId, 'stock.move', 'search_read', [[
        ['product_id', '=', productId],
        ['location_dest_id', '=', vanLocationId],
        ['state', '=', 'done'],
        ['picking_id.origin', '=', order.salesOrder]
      ]], { fields: ['id', 'picking_id'], order: 'id desc' });
      if (pickMoves.length === 0) {
        throw new Error(`Nessun PICK di origine (Deposito→Furgoni) trovato per "${product.nome}" sull'ordine ${order.salesOrder}: impossibile fare il reso legato al documento`);
      }
      const pickMove = pickMoves[0];
      const pickId = pickMove.picking_id[0];

      // Lotto (solo per il chatter)
      const pickLines = await callOdoo(sessionId, 'stock.move.line', 'search_read', [[
        ['move_id', '=', pickMove.id]
      ]], { fields: ['lot_id'] });
      lotName = pickLines[0]?.lot_id?.[1] || null;

      // RESO nativo agganciato al PICK, SOLO per questo prodotto e questa quantità
      const wizardId = await callOdoo(sessionId, 'stock.return.picking', 'create', [{
        picking_id: pickId,
        product_return_moves: [[0, 0, {
          product_id: productId,
          quantity: qty,
          move_id: pickMove.id,
          to_refund: false
        }]]
      }]);
      const returnAction = await callOdoo(sessionId, 'stock.return.picking', 'action_create_returns', [[wizardId]]);
      returnPickingId = returnAction?.res_id || null;
      if (!returnPickingId) throw new Error('Creazione reso fallita (nessun picking di reso generato)');

      // Assegna (riserva il quant del move originale grazie a origin_returned_move_id) e valida → merce torna in WH/Deposito
      await callOdoo(sessionId, 'stock.picking', 'action_assign', [[returnPickingId]]);
      try {
        await callOdoo(sessionId, 'stock.picking', 'button_validate', [[returnPickingId]], { context: { skip_backorder: true } });
        validated = true;
      } catch {
        // Disponibilità/wizard: il reso resta assegnato, da completare a mano in Odoo
      }

      const retInfo = await callOdoo(sessionId, 'stock.picking', 'read', [[returnPickingId]], { fields: ['name'] });
      returnPickingName = retInfo[0]?.name || '';
    }

    // Documento su cui allegare foto e scrivere il chatter:
    // - 'photo'     → il picking di reso appena creato
    // - 'not_found' → il picking residuo (OUT) dell'ordine, come semplice segnalazione (nessun movimento)
    const targetPickingId = returnPickingId || outPickingId;

    // Allega foto
    let photoAttachmentId = null;
    if (action === 'photo' && photo) {
      photoAttachmentId = await callOdoo(sessionId, 'ir.attachment', 'create', [{
        name: `foto_reso_${product.nome.substring(0, 30)}.jpg`,
        type: 'binary',
        datas: photo,
        res_model: 'stock.picking',
        res_id: targetPickingId,
        mimetype: 'image/jpeg'
      }]);
    }

    // Chatter
    const chatterLines: string[] = [];
    if (action === 'photo') {
      chatterLines.push(`📦 RESO: ${product.nome}`);
      chatterLines.push(`Quantità: ${qty} ${product.uom}`);
      chatterLines.push(`WH/Furgoni → WH/Deposito${returnPickingName ? ` (${returnPickingName})` : ''}`);
      if (lotName) chatterLines.push(`Lotto: ${lotName}`);
      if (!validated) chatterLines.push('⚠️ Reso creato ma NON validato: verificare disponibilità in Odoo');
    } else {
      chatterLines.push(`🔎 PRODOTTO NON TROVATO NEL FURGONE: ${product.nome}`);
      chatterLines.push(`Quantità attesa: ${qty} ${product.uom}`);
      chatterLines.push('Nessun movimento creato (merce non presente nel furgone).');
    }
    chatterLines.push(`Cliente: ${order.cliente} — ${order.salesOrder}`);

    if (messaggiAutista && messaggiAutista.length > 0) {
      chatterLines.push('');
      chatterLines.push('🚛 MOTIVAZIONE AUTISTA');
      for (const msg of messaggiAutista) {
        chatterLines.push(`${msg.autore} — ${new Date(msg.data).toLocaleString('it-IT')}`);
        chatterLines.push(msg.messaggio);
      }
    }

    if (action === 'photo' && aiResult) {
      chatterLines.push('');
      chatterLines.push('🤖 ANALISI GEMINI');
      chatterLines.push(`Match: ${aiResult.match ? '✅ Confermato' : '⚠️ Da verificare'}`);
      chatterLines.push(`Etichetta letta: ${aiResult.labelText}`);
      chatterLines.push(`Confidenza: ${aiResult.confidence}`);
    }

    if (action === 'not_found' && reason) {
      chatterLines.push('');
      chatterLines.push('❌ Motivo non trovato:');
      chatterLines.push(reason);
    }

    const messagePostKwargs: any = {
      body: chatterLines.join('\n'),
      message_type: 'comment',
      subtype_xmlid: 'mail.mt_note'
    };
    if (photoAttachmentId) messagePostKwargs.attachment_ids = [photoAttachmentId];
    await callOdoo(sessionId, 'stock.picking', 'message_post', [[targetPickingId]], messagePostKwargs);

    return NextResponse.json({
      success: true,
      action,
      returnPickingId,
      returnPickingName,
      aiResult,
      message: action === 'photo'
        ? `✅ Reso ${returnPickingName} creato: ${product.nome} → WH/Deposito${validated ? '' : ' (da validare in Odoo)'}${aiResult?.match ? '' : ' — verifica foto'}`
        : `⚠️ ${product.nome} segnalato come non trovato nel furgone`
    });

  } catch (error: any) {
    console.error('❌ Errore process-product:', error);
    return NextResponse.json({ success: false, error: error.message || 'Errore del server' }, { status: 500 });
  }
}
