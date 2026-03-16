import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { GoogleGenAI } from '@google/genai';

const ODOO_URL = process.env.ODOO_URL || 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

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

function getBufferLocationFromCategory(categoryName: string | null): { name: string; locationId: number } {
  if (!categoryName) return { name: 'WH/Stock/Secco', locationId: 29 };
  const catLower = categoryName.toLowerCase();
  if (catLower.includes('frigo') || catLower.includes('refrigerat') || catLower.includes('freddo'))
    return { name: 'WH/Stock/Frigo', locationId: 28 };
  if (catLower.includes('pingu') || catLower.includes('surgelat') || catLower.includes('congelat'))
    return { name: 'WH/Stock/Pingu', locationId: 31 };
  if (catLower.includes('secco sopra') || catLower.includes('scaffalatura') || catLower.includes('sopra'))
    return { name: 'WH/Stock/Secco Sopra', locationId: 30 };
  return { name: 'WH/Stock/Secco', locationId: 29 };
}

async function analyzePhotoWithAI(photoBase64: string, expectedProduct: string): Promise<{ match: boolean; labelText: string; confidence: string }> {
  const response = await genai.models.generateContent({
    model: 'gemini-2.0-flash',
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
    // photo: base64 string (solo per action='photo')
    // reason: string (solo per action='not_found')
    // messaggiAutista: array di messaggi scarico parziale dell'autista

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

    // Cerca picking originale
    const pickings = await callOdoo(sessionId, 'stock.picking', 'search_read', [[
      ['name', '=', order.numeroOrdineResiduo]
    ]], { fields: ['id', 'name', 'location_id', 'move_ids_without_package'] });

    if (pickings.length === 0) throw new Error(`Picking ${order.numeroOrdineResiduo} non trovato`);
    const picking = pickings[0];
    const vanLocationId = picking.location_id[0];
    const vanLocationName = picking.location_id[1];

    // Trova il move corrispondente al prodotto
    const moves = await callOdoo(sessionId, 'stock.move', 'read', [picking.move_ids_without_package], {
      fields: ['product_id', 'product_uom_qty', 'quantity', 'product_uom']
    });
    const move = moves.find((m: any) => m.product_id[1] === product.nome);
    if (!move) throw new Error(`Prodotto "${product.nome}" non trovato nel picking`);

    // Categoria e buffer
    const prodData = await callOdoo(sessionId, 'product.product', 'read', [[move.product_id[0]]], {
      fields: ['id', 'categ_id']
    });
    const categoryName = prodData[0]?.categ_id?.[1] || null;
    const bufferInfo = getBufferLocationFromCategory(categoryName);

    // Lotto
    const moveLines = await callOdoo(sessionId, 'stock.move.line', 'search_read', [[
      ['picking_id', '=', picking.id],
      ['product_id', '=', move.product_id[0]],
      ['state', '!=', 'cancel']
    ]], { fields: ['lot_id'] });
    const lotId = moveLines[0]?.lot_id?.[0] || null;
    const lotName = moveLines[0]?.lot_id?.[1] || null;

    // Nota per il trasferimento
    let note = `Reso singolo prodotto → ${bufferInfo.name}\nCliente: ${order.cliente}\nSales Order: ${order.salesOrder}\n`;
    if (action === 'photo' && aiResult) {
      note += `\n📷 Verifica foto AI:\n- Match: ${aiResult.match ? 'SI' : 'NO'}\n- Etichetta letta: ${aiResult.labelText}\n- Confidenza: ${aiResult.confidence}`;
    } else if (action === 'not_found') {
      note += `\n❌ PRODOTTO NON TROVATO\nMotivo: ${reason || 'Non specificato'}`;
    }
    note += `\nCreato: ${new Date().toLocaleString('it-IT')}`;

    // Crea trasferimento
    const pickingId = await callOdoo(sessionId, 'stock.picking', 'create', [{
      picking_type_id: 5,
      location_id: vanLocationId,
      location_dest_id: bufferInfo.locationId,
      origin: `RESO_${order.numeroOrdineResiduo}_${product.nome.substring(0, 20)}`,
      note
    }]);

    // Crea move
    const moveId = await callOdoo(sessionId, 'stock.move', 'create', [{
      name: product.nome,
      picking_id: pickingId,
      product_id: move.product_id[0],
      product_uom_qty: qty,
      product_uom: move.product_uom[0],
      location_id: vanLocationId,
      location_dest_id: bufferInfo.locationId
    }]);

    // Conferma
    await callOdoo(sessionId, 'stock.picking', 'action_confirm', [[pickingId]]);

    // Move line con qty_done e lotto
    const moveLineData: any = {
      move_id: moveId,
      picking_id: pickingId,
      product_id: move.product_id[0],
      product_uom_id: move.product_uom[0],
      location_id: vanLocationId,
      location_dest_id: bufferInfo.locationId,
      quantity: qty,
      qty_done: qty
    };
    if (lotId) moveLineData.lot_id = lotId;
    await callOdoo(sessionId, 'stock.move.line', 'create', [moveLineData]);

    // Allega foto al picking e ottieni attachment_id per il chatter
    let photoAttachmentId = null;
    if (action === 'photo' && photo) {
      photoAttachmentId = await callOdoo(sessionId, 'ir.attachment', 'create', [{
        name: `foto_reso_${product.nome.substring(0, 30)}.jpg`,
        type: 'binary',
        datas: photo,
        res_model: 'stock.picking',
        res_id: pickingId,
        mimetype: 'image/jpeg'
      }]);
    }

    // Scrivi nel chatter del picking (testo semplice, no HTML)
    let chatterLines = [];
    chatterLines.push(`📦 RESO: ${product.nome}`);
    chatterLines.push(`Quantità: ${qty} ${product.uom}`);
    chatterLines.push(`Da: ${vanLocationName} → A: ${bufferInfo.name}`);
    if (lotName) chatterLines.push(`Lotto: ${lotName}`);

    // Motivazione autista
    if (messaggiAutista && messaggiAutista.length > 0) {
      chatterLines.push('');
      chatterLines.push('🚛 MOTIVAZIONE AUTISTA');
      for (const msg of messaggiAutista) {
        chatterLines.push(`${msg.autore} — ${new Date(msg.data).toLocaleString('it-IT')}`);
        chatterLines.push(msg.messaggio);
      }
    }

    // Risultato AI (se foto)
    if (action === 'photo' && aiResult) {
      chatterLines.push('');
      chatterLines.push('🤖 ANALISI GEMINI');
      chatterLines.push(`Match: ${aiResult.match ? '✅ Confermato' : '⚠️ Da verificare'}`);
      chatterLines.push(`Etichetta letta: ${aiResult.labelText}`);
      chatterLines.push(`Confidenza: ${aiResult.confidence}`);
    }

    // Motivo non trovato
    if (action === 'not_found' && reason) {
      chatterLines.push('');
      chatterLines.push('❌ PRODOTTO NON TROVATO');
      chatterLines.push(`Motivo: ${reason}`);
    }

    const chatterBody = chatterLines.join('\n');

    const messagePostKwargs: any = {
      body: chatterBody,
      message_type: 'comment',
      subtype_xmlid: 'mail.mt_note'
    };
    if (photoAttachmentId) {
      messagePostKwargs.attachment_ids = [photoAttachmentId];
    }
    await callOdoo(sessionId, 'stock.picking', 'message_post', [[pickingId]], messagePostKwargs);

    // Valida il picking (button_validate)
    if (action === 'photo') {
      try {
        await callOdoo(sessionId, 'stock.picking', 'button_validate', [[pickingId]]);
      } catch {
        // Se button_validate fallisce (wizard), proviamo action_assign
        await callOdoo(sessionId, 'stock.picking', 'action_assign', [[pickingId]]);
      }
    } else {
      // Non trovato: assegna ma NON validare
      await callOdoo(sessionId, 'stock.picking', 'action_assign', [[pickingId]]);
    }

    return NextResponse.json({
      success: true,
      pickingId,
      bufferName: bufferInfo.name,
      aiResult,
      action,
      message: action === 'photo'
        ? `✅ ${product.nome} → ${bufferInfo.name} (${aiResult?.match ? 'match confermato' : 'verifica manuale'})`
        : `⚠️ ${product.nome} segnalato come non trovato`
    });

  } catch (error: any) {
    console.error('❌ Errore process-product:', error);
    return NextResponse.json({ success: false, error: error.message || 'Errore del server' }, { status: 500 });
  }
}
