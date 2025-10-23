import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * GET P.O. ATTACHMENTS
 *
 * Recupera gli allegati di un Purchase Order
 * Filtra per PDF e immagini, cerca fatture/DDT
 */
export async function POST(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
    }

    const body = await request.json();
    const { picking_id, purchase_order_id } = body;

    console.log('📎 [GET-PO-ATTACHMENTS] Input:', { picking_id, purchase_order_id });

    let poId = purchase_order_id;

    // Se non abbiamo P.O. ID ma abbiamo picking_id, cerca il P.O. dall'origin
    if (!poId && picking_id) {
      console.log('🔍 Cerca P.O. dal picking ID:', picking_id);

      const pickings = await callOdoo(cookies, 'stock.picking', 'read', [
        [picking_id],
        ['origin', 'name']
      ]);

      if (pickings.length === 0) {
        return NextResponse.json({ error: 'Picking non trovato' }, { status: 404 });
      }

      const picking = pickings[0];
      const origin = picking.origin;

      console.log('📋 Origin trovato:', origin);

      if (!origin) {
        return NextResponse.json({
          error: 'Nessun ordine di acquisto collegato a questo picking'
        }, { status: 404 });
      }

      // Cerca purchase.order per nome
      const purchaseOrders = await callOdoo(cookies, 'purchase.order', 'search_read', [
        [['name', '=', origin]],
        ['id', 'name', 'partner_id', 'date_order']
      ]);

      if (purchaseOrders.length === 0) {
        return NextResponse.json({
          error: `Ordine di acquisto "${origin}" non trovato in Odoo`
        }, { status: 404 });
      }

      poId = purchaseOrders[0].id;
      console.log('✅ P.O. trovato:', purchaseOrders[0].name, '(ID:', poId, ')');
    }

    if (!poId) {
      return NextResponse.json({
        error: 'purchase_order_id o picking_id richiesto'
      }, { status: 400 });
    }

    // Recupera allegati del P.O.
    console.log('📎 Recupero allegati per P.O. ID:', poId);

    const attachments = await callOdoo(cookies, 'ir.attachment', 'search_read', [
      [
        ['res_model', '=', 'purchase.order'],
        ['res_id', '=', poId],
        ['mimetype', 'in', ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/jpg']]
      ],
      ['id', 'name', 'mimetype', 'file_size', 'create_date', 'datas']
    ]);

    console.log(`📎 Trovati ${attachments.length} allegati`);

    // Classifica allegati per rilevanza
    const scoredAttachments = attachments.map((att: any) => {
      let score = 0;
      let reason = '';
      const nameLower = att.name.toLowerCase();

      // Keyword per fatture
      if (nameLower.includes('fattura') || nameLower.includes('invoice')) {
        score += 100;
        reason = '🔴 FATTURA';
      } else if (nameLower.includes('ddt') || nameLower.includes('delivery')) {
        score += 80;
        reason = '📦 DDT';
      } else if (nameLower.includes('bolla') || nameLower.includes('packing')) {
        score += 70;
        reason = '📄 Bolla';
      } else if (nameLower.includes('documento') || nameLower.includes('document')) {
        score += 60;
        reason = '📋 Documento';
      } else if (att.mimetype === 'application/pdf') {
        score += 50;
        reason = '📄 PDF';
      } else {
        score += 30;
        reason = '🖼️ Immagine';
      }

      // Penalità per allegati vecchi
      const daysOld = (Date.now() - new Date(att.create_date).getTime()) / (1000 * 60 * 60 * 24);
      if (daysOld > 30) score -= 20;

      // File size ragionevole (500KB - 10MB)
      const sizeMB = att.file_size / (1024 * 1024);
      if (sizeMB > 0.5 && sizeMB < 10) {
        score += 10;
      } else if (sizeMB > 10) {
        score -= 10; // Troppo grande
      }

      return {
        id: att.id,
        name: att.name,
        mimetype: att.mimetype,
        file_size: att.file_size,
        file_size_mb: sizeMB.toFixed(2),
        create_date: att.create_date,
        score: score,
        reason: reason,
        is_recommended: score >= 80
      };
    });

    // Ordina per score (più alto prima)
    scoredAttachments.sort((a, b) => b.score - a.score);

    const recommended = scoredAttachments.find(a => a.is_recommended);

    console.log('✅ Allegati processati e ordinati');
    if (recommended) {
      console.log('⭐ RACCOMANDATO:', recommended.name, `(score: ${recommended.score})`);
    }

    return NextResponse.json({
      success: true,
      purchase_order_id: poId,
      attachments: scoredAttachments,
      recommended_attachment: recommended || null,
      count: scoredAttachments.length
    });

  } catch (error: any) {
    console.error('❌ [GET-PO-ATTACHMENTS] Error:', error);
    return NextResponse.json({
      error: error.message || 'Errore durante il recupero degli allegati',
      details: error.toString()
    }, { status: 500 });
  }
}
