import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export async function POST(request: NextRequest) {
  try {
    const { cookies, uid } = await getOdooSession();
    if (!uid) {
      return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
    }

    const body = await request.json();
    const { picking_id, amount, payment_method, note, receipt_photo } = body;

    if (!picking_id || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Dati pagamento non validi' }, { status: 400 });
    }

    console.log('💰 [PAYMENT] Registrazione incasso per picking:', picking_id, 'Importo:', amount);

    // Upload receipt photo as attachment if present
    let attachmentId = null;
    if (receipt_photo) {
      console.log('💰 [PAYMENT] Caricamento ricevuta pagamento come allegato...');

      // Extract base64 data from photo (remove data:image/jpeg;base64, prefix)
      const photoBase64 = receipt_photo.split(',')[1];

      // Create ir.attachment for stock.picking
      attachmentId = await callOdoo(cookies, 'ir.attachment', 'create', [{
        name: `Ricevuta_Pagamento_${picking_id}_${Date.now()}.jpg`,
        datas: photoBase64,
        res_model: 'stock.picking',
        res_id: picking_id,
        mimetype: 'image/jpeg',
        description: 'Ricevuta pagamento alla consegna'
      }]);

      console.log('✅ Ricevuta caricata come allegato ID:', attachmentId);
    }

    // Create message in stock.picking chatter
    const messageHtml = `<strong>💰 INCASSO REGISTRATO ALLA CONSEGNA</strong><br/>
<strong>Importo:</strong> € ${amount.toFixed(2)}<br/>
<strong>Metodo:</strong> ${payment_method === 'cash' ? 'Contanti' : payment_method === 'card' ? 'Carta' : 'Bonifico'}<br/>
${note ? `<strong>Note:</strong> ${note}<br/>` : ''}
${attachmentId ? '<strong>📸 Ricevuta pagamento allegata</strong><br/>' : ''}
<strong>Data:</strong> ${new Date().toLocaleString('it-IT')}<br/>`;

    const messageId = await callOdoo(cookies, 'mail.message', 'create', [{
      body: messageHtml,
      model: 'stock.picking',
      res_id: picking_id,
      message_type: 'comment',
      subtype_id: 1,
      attachment_ids: attachmentId ? [[6, false, [attachmentId]]] : false
    }]);

    console.log('✅ Messaggio incasso creato nel chatter del picking:', picking_id, 'Message ID:', messageId);

    return NextResponse.json({
      success: true,
      message_id: messageId,
      attachment_id: attachmentId,
      message: 'Incasso registrato con successo nel documento'
    });
  } catch (error: any) {
    console.error('❌ [PAYMENT] Errore:', error);
    return NextResponse.json(
      { error: error.message || 'Errore registrazione incasso' },
      { status: 500 }
    );
  }
}
