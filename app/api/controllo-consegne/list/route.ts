import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;
// Force recompilation

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get('date'); // Format: YYYY-MM-DD
    const type = searchParams.get('type'); // 'signature' | 'photo' | 'payment' | 'reso' | 'scarico_parziale' | 'all'

    if (!date) {
      return NextResponse.json(
        { error: 'Date parameter is required' },
        { status: 400 }
      );
    }

    // Get user session
    const userCookies = request.headers.get('cookie');
    if (!userCookies) {
      return NextResponse.json(
        { error: 'Autenticazione richiesta' },
        { status: 401 }
      );
    }

    const { cookies, uid } = await getOdooSession(userCookies);
    if (!uid || !cookies) {
      return NextResponse.json(
        { error: 'Sessione non valida' },
        { status: 401 }
      );
    }

    // Search for completed pickings on the specified date
    const startDate = `${date} 00:00:00`;
    const endDate = `${date} 23:59:59`;

    console.log(`[QUERY] Searching for pickings on date: ${date}`);
    console.log(`[QUERY] Date range: ${startDate} to ${endDate}`);

    const pickings = await callOdoo(
      cookies,
      'stock.picking',
      'search_read',
      [],
      {
        domain: [
          ['picking_type_code', '=', 'outgoing'],
          ['state', '=', 'done'],
          ['date_done', '>=', startDate],
          ['date_done', '<=', endDate],
        ],
        fields: [
          'name',
          'partner_id',
          'user_id',
          'date_done',
          'note',
          'signature',
          'vehicle_id',
          'carrier_id',
          'location_dest_id',
          'sale_id',
          'origin',
        ]
      }
    );

    console.log(`[QUERY] Total pickings found: ${pickings?.length || 0}`);
    if (pickings && pickings.length > 0) {
      console.log('[QUERY] First picking:', {
        name: pickings[0].name,
        date_done: pickings[0].date_done,
        partner: pickings[0].partner_id?.[1]
      });
    }

    if (!pickings || pickings.length === 0) {
      console.log('[QUERY] No pickings found for this date range');
      return NextResponse.json({ documents: [] });
    }

    // Get all picking IDs
    const pickingIds = pickings.map((p: any) => p.id);

    // Fetch all attachments for these pickings
    const attachments = await callOdoo(
      cookies,
      'ir.attachment',
      'search_read',
      [],
      {
        domain: [
          ['res_model', '=', 'stock.picking'],
          ['res_id', 'in', pickingIds],
        ],
        fields: ['id', 'name', 'datas', 'res_id', 'description', 'create_date', 'mimetype']
      }
    );

    // Fetch mail messages to get notes and context
    const messages = await callOdoo(
      cookies,
      'mail.message',
      'search_read',
      [],
      {
        domain: [
          ['model', '=', 'stock.picking'],
          ['res_id', 'in', pickingIds],
        ],
        fields: ['id', 'body', 'res_id', 'date', 'subtype_id']
      }
    );

    // Get employee/driver info for each picking
    const userIds = pickings
      .map((p: any) => p.user_id?.[0])
      .filter((id: any) => id);

    let employees: any[] = [];
    if (userIds.length > 0) {
      employees = await callOdoo(
        cookies,
        'hr.employee',
        'search_read',
        [],
        {
          domain: [['user_id', 'in', userIds]],
          fields: ['id', 'name', 'user_id']
        }
      );
    }

    // Build documents array
    const documents = pickings.map((picking: any) => {
      const pickingId = picking.id;
      const pickingAttachments = attachments.filter(
        (att: any) => att.res_id === pickingId
      );
      const pickingMessages = messages.filter(
        (msg: any) => msg.res_id === pickingId
      );

      // Find driver/employee
      const userId = picking.user_id?.[0];
      const employee = employees.find((emp: any) => emp.user_id?.[0] === userId);
      const driverName = employee?.name || picking.user_id?.[1] || 'N/A';

      // Extract vehicle info
      const vehicle = picking.vehicle_id?.[1] || picking.carrier_id?.[1] || 'N/A';

      // Get address (from location_dest_id or partner_id)
      const address = picking.location_dest_id?.[1] || picking.partner_id?.[1] || 'N/A';

      // Categorize attachments by type
      const attachmentsByType: any = {};

      // DEBUG: print messages that contain "RESO"
      const resoMsg = pickingMessages.find((m: any) => m.body && m.body.includes('RESO'));
      if (resoMsg) {
        console.log(`\n[RESO TROVATO] Picking ${picking.name}`);
        console.log('[RESO BODY]:', resoMsg.body);
      }

      // FIRMA: cerca messaggio "CONSEGNA COMPLETATA CON FIRMA"
      const firmaMessage = pickingMessages.find(
        (msg: any) => msg.body?.includes('CONSEGNA COMPLETATA CON FIRMA')
      );
      if (firmaMessage) {
        // La firma è salvata come PDF attachment separato
        // Cerca PDF creato vicino al messaggio
        const messageDate = new Date(firmaMessage.date);

        console.log(`[FIRMA DEBUG] Picking ${picking.name}: Searching for signature PDF`);
        console.log('[FIRMA DEBUG] Message date:', firmaMessage.date);
        console.log('[FIRMA DEBUG] Total attachments for this picking:', pickingAttachments.length);

        pickingAttachments.forEach((att: any, idx: number) => {
          console.log(`[FIRMA DEBUG] Attachment ${idx + 1}:`, {
            id: att.id,
            name: att.name,
            mimetype: att.mimetype,
            create_date: att.create_date,
            has_datas: !!att.datas
          });
        });

        const signatureAttachment = pickingAttachments.find((att: any) => {
          if (!att.create_date) return false;
          const attDate = new Date(att.create_date);
          const timeDiff = Math.abs(attDate.getTime() - messageDate.getTime());
          // Cerca PDF creati entro 2 minuti dal messaggio
          return timeDiff < 120000 && att.mimetype && att.mimetype === 'application/pdf';
        });

        console.log('[FIRMA DEBUG] Found signature attachment:', signatureAttachment ? 'YES' : 'NO');
        if (signatureAttachment) {
          console.log('[FIRMA DEBUG] Signature attachment ID:', signatureAttachment.id, 'mimetype:', signatureAttachment.mimetype);
          console.log('[FIRMA DEBUG] Signature has data:', !!signatureAttachment.datas, 'data length:', signatureAttachment.datas?.length || 0);
        }

        attachmentsByType.signature = {
          type: 'signature',
          data: signatureAttachment?.datas || picking.signature || null,
          timestamp: firmaMessage.date,
          note: firmaMessage.body,
          message_id: firmaMessage.id,
          odoo_attachment_id: signatureAttachment?.id,
        };
      }

      // FOTO: cerca messaggio "CONSEGNA COMPLETATA CON FOTO"
      const fotoMessage = pickingMessages.find(
        (msg: any) => msg.body?.includes('CONSEGNA COMPLETATA CON FOTO')
      );
      if (fotoMessage) {
        // La foto è salvata come attachment separato, non nel body
        // Cerca attachment immagine creato vicino al messaggio
        const messageDate = new Date(fotoMessage.date);

        console.log(`[FOTO DEBUG] Picking ${picking.name}: Searching for photo attachment`);
        console.log('[FOTO DEBUG] Message date:', fotoMessage.date);
        console.log('[FOTO DEBUG] Total attachments for this picking:', pickingAttachments.length);

        pickingAttachments.forEach((att: any, idx: number) => {
          console.log(`[FOTO DEBUG] Attachment ${idx + 1}:`, {
            id: att.id,
            name: att.name,
            mimetype: att.mimetype,
            create_date: att.create_date,
            has_datas: !!att.datas
          });
        });

        const photoAttachment = pickingAttachments.find((att: any) => {
          if (!att.create_date) return false;
          const attDate = new Date(att.create_date);
          const timeDiff = Math.abs(attDate.getTime() - messageDate.getTime());
          // Cerca immagini create entro 2 minuti dal messaggio
          return timeDiff < 120000 && att.mimetype && att.mimetype.startsWith('image/');
        });

        console.log('[FOTO DEBUG] Found photo attachment:', photoAttachment ? 'YES' : 'NO');
        if (photoAttachment) {
          console.log('[FOTO DEBUG] Photo attachment ID:', photoAttachment.id, 'mimetype:', photoAttachment.mimetype);
          console.log('[FOTO DEBUG] Photo has data:', !!photoAttachment.datas, 'data length:', photoAttachment.datas?.length || 0);
        }

        attachmentsByType.photo = {
          type: 'photo',
          data: photoAttachment?.datas || null,
          timestamp: fotoMessage.date,
          note: fotoMessage.body,
          message_id: fotoMessage.id,
          odoo_attachment_id: photoAttachment?.id,
        };
      }

      // PAGAMENTO: cerca messaggio "CONSEGNA COMPLETATA CON INCASSO PAGAMENTO" o "INCASSO PAGAMENTO"
      const paymentMessage = pickingMessages.find(
        (msg: any) => msg.body?.includes('INCASSO PAGAMENTO')
      );
      if (paymentMessage) {
        // La ricevuta pagamento è salvata come immagine attachment separata
        // Cerca immagine creata vicino al messaggio
        const messageDate = new Date(paymentMessage.date);

        console.log(`[PAGAMENTO DEBUG] Picking ${picking.name}: Searching for payment receipt`);
        console.log('[PAGAMENTO DEBUG] Message date:', paymentMessage.date);
        console.log('[PAGAMENTO DEBUG] Total attachments for this picking:', pickingAttachments.length);

        const paymentAttachment = pickingAttachments.find((att: any) => {
          if (!att.create_date) return false;
          const attDate = new Date(att.create_date);
          const timeDiff = Math.abs(attDate.getTime() - messageDate.getTime());
          // Cerca immagini create entro 2 minuti dal messaggio
          return timeDiff < 120000 && att.mimetype && att.mimetype.startsWith('image/');
        });

        console.log('[PAGAMENTO DEBUG] Found payment attachment:', paymentAttachment ? 'YES' : 'NO');
        if (paymentAttachment) {
          console.log('[PAGAMENTO DEBUG] Payment attachment ID:', paymentAttachment.id, 'mimetype:', paymentAttachment.mimetype);
          console.log('[PAGAMENTO DEBUG] Payment has data:', !!paymentAttachment.datas, 'data length:', paymentAttachment.datas?.length || 0);
        }

        const body = paymentMessage.body || '';
        // Estrai dettagli pagamento dal messaggio
        let paymentAmount: number | undefined;
        let paymentMethod: string | undefined;
        const amountMatch = body.match(/€\s*([\d.,]+)/);
        if (amountMatch) {
          paymentAmount = parseFloat(amountMatch[1].replace(',', '.'));
        }
        if (body.includes('Contant')) paymentMethod = 'cash';
        if (body.includes('Carta')) paymentMethod = 'card';
        if (body.includes('Bonifico')) paymentMethod = 'bonifico';

        attachmentsByType.payment = {
          type: 'payment',
          data: paymentAttachment?.datas || null,
          timestamp: paymentMessage.date,
          note: body,
          message_id: paymentMessage.id,
          odoo_attachment_id: paymentAttachment?.id,
          amount: paymentAmount,
          method: paymentMethod,
        };
      }

      // RESO: cerca messaggio "RESO REGISTRATO" (con o senza emoji)
      const resoMessage = pickingMessages.find(
        (msg: any) => msg.body?.includes('RESO REGISTRATO')
      );
      if (resoMessage) {
        // La foto del reso è salvata come immagine attachment separata
        // Cerca immagine creata vicino al messaggio
        const messageDate = new Date(resoMessage.date);

        console.log(`[RESO DEBUG] Picking ${picking.name}: Searching for return photo`);
        console.log('[RESO DEBUG] Message date:', resoMessage.date);
        console.log('[RESO DEBUG] Total attachments for this picking:', pickingAttachments.length);

        const returnAttachment = pickingAttachments.find((att: any) => {
          if (!att.create_date) return false;
          const attDate = new Date(att.create_date);
          const timeDiff = Math.abs(attDate.getTime() - messageDate.getTime());
          // Cerca immagini create entro 2 minuti dal messaggio
          return timeDiff < 120000 && att.mimetype && att.mimetype.startsWith('image/');
        });

        console.log('[RESO DEBUG] Found return attachment:', returnAttachment ? 'YES' : 'NO');
        if (returnAttachment) {
          console.log('[RESO DEBUG] Return attachment ID:', returnAttachment.id, 'mimetype:', returnAttachment.mimetype);
          console.log('[RESO DEBUG] Return has data:', !!returnAttachment.datas, 'data length:', returnAttachment.datas?.length || 0);
        }

        const body = resoMessage.body || '';
        // Estrai motivo del reso dal messaggio
        let reason: string | undefined;
        // Il messaggio è in HTML: <p><strong>Motivo:</strong> Cornetti</p>
        const reasonMatch = body.match(/<strong>Motivo:<\/strong>\s*([^<]+)/i);
        if (reasonMatch) {
          reason = reasonMatch[1].trim();
          console.log('[RESO DEBUG] Extracted reason:', reason);
        } else {
          console.log('[RESO DEBUG] Failed to extract reason from body:', body.substring(0, 200));
        }

        attachmentsByType.reso = {
          type: 'reso',
          data: returnAttachment?.datas || null,
          timestamp: resoMessage.date,
          note: body,
          message_id: resoMessage.id,
          odoo_attachment_id: returnAttachment?.id,
          reason: reason,
        };
      }

      // SCARICO PARZIALE: cerca messaggio "SCARICO PARZIALE" (con o senza emoji)
      const scaricoParzialMessage = pickingMessages.find(
        (msg: any) => msg.body?.includes('SCARICO PARZIALE')
      );
      if (scaricoParzialMessage) {
        // La giustificazione/nota dello scarico parziale è nel messaggio
        // Può avere anche attachment se c'è una foto
        const messageDate = new Date(scaricoParzialMessage.date);

        console.log(`[SCARICO PARZIALE DEBUG] Picking ${picking.name}: Searching for partial delivery attachment`);
        console.log('[SCARICO PARZIALE DEBUG] Message date:', scaricoParzialMessage.date);
        console.log('[SCARICO PARZIALE DEBUG] Total attachments for this picking:', pickingAttachments.length);

        const scaricoParzialAttachment = pickingAttachments.find((att: any) => {
          if (!att.create_date) return false;
          const attDate = new Date(att.create_date);
          const timeDiff = Math.abs(attDate.getTime() - messageDate.getTime());
          // Cerca immagini/documenti/audio creati entro 24 ore dal messaggio (86400000 ms)
          return timeDiff < 86400000 && att.mimetype && (
            att.mimetype.startsWith('image/') ||
            att.mimetype === 'application/pdf' ||
            att.mimetype.startsWith('audio/')
          );
        });

        console.log('[SCARICO PARZIALE DEBUG] Found partial delivery attachment:', scaricoParzialAttachment ? 'YES' : 'NO');
        if (scaricoParzialAttachment) {
          console.log('[SCARICO PARZIALE DEBUG] Attachment ID:', scaricoParzialAttachment.id, 'mimetype:', scaricoParzialAttachment.mimetype);
          console.log('[SCARICO PARZIALE DEBUG] Has data:', !!scaricoParzialAttachment.datas, 'data length:', scaricoParzialAttachment.datas?.length || 0);

          // Validazione dati audio
          if (scaricoParzialAttachment.mimetype?.startsWith('audio/')) {
            if (!scaricoParzialAttachment.datas || scaricoParzialAttachment.datas.length === 0) {
              console.error('[SCARICO PARZIALE ERROR] Audio attachment found but datas field is empty!');
            } else if (scaricoParzialAttachment.datas.length < 100) {
              console.warn('[SCARICO PARZIALE WARNING] Audio datas seems too short (< 100 chars), might be corrupted');
            } else {
              console.log('[SCARICO PARZIALE SUCCESS] Audio datas looks valid');
            }
          }
        }

        const body = scaricoParzialMessage.body || '';
        // Estrai giustificazione dal messaggio (se presente)
        let justification: string | undefined;
        // Il messaggio può contenere: **Nota:** seguito dalla giustificazione
        const justificationMatch = body.match(/\*\*Nota:\*\*\s*([^<]+)/i);
        if (justificationMatch) {
          justification = justificationMatch[1].trim();
          console.log('[SCARICO PARZIALE DEBUG] Extracted justification:', justification);
        } else {
          console.log('[SCARICO PARZIALE DEBUG] No specific justification pattern found in body');
        }

        attachmentsByType.scarico_parziale = {
          type: 'scarico_parziale',
          data: scaricoParzialAttachment?.datas || null,
          timestamp: scaricoParzialMessage.date,
          note: body,
          message_id: scaricoParzialMessage.id,
          odoo_attachment_id: scaricoParzialAttachment?.id,
          justification: justification,
          mimetype: scaricoParzialAttachment?.mimetype || null,
        };
      }

      return {
        id: pickingId,
        picking_name: picking.name,
        customer_name: picking.partner_id?.[1] || 'N/A',
        driver_name: driverName,
        vehicle: vehicle,
        delivery_address: address,
        completion_time: picking.date_done,
        completion_date: date,
        attachments: attachmentsByType,
        sale_id: picking.sale_id?.[0] || null,
        sale_name: picking.origin || null,
      };
    });

    // Filter by type if specified
    let filteredDocuments = documents;
    if (type && type !== 'all') {
      filteredDocuments = documents.filter(
        (doc: any) => doc.attachments[type] !== undefined
      );
    }

    return NextResponse.json({ documents: filteredDocuments });
  } catch (error: any) {
    console.error('Error fetching delivery documents:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}
