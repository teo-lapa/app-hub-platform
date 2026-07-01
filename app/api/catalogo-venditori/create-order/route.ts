import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * POST /api/catalogo-venditori/create-order
 *
 * Creates a sale.order in Odoo from the cart for the seller catalog feature.
 * Uses the logged-in user's session to track who created the order.
 *
 * Request Body:
 * - customerId: number - The Odoo partner ID of the customer
 * - deliveryAddressId: number | null - Optional delivery address (partner child address)
 * - orderLines: Array<{product_id: number, quantity: number}> - Products to order
 * - notes?: string - Optional order notes
 *
 * Returns: { success: true, orderId: number, orderName: string }
 */

interface OrderLine {
  product_id: number;
  quantity: number;
  product_name?: string; // Optional, used for better error messages
  price?: number; // Optional, used for offer/urgent products with custom price
  source?: 'offer' | 'urgent'; // Optional, indicates if product is from offer or urgent
  forceLotId?: number; // Forza il lotto esatto sul movimento di consegna (controllo scadenze)
  forceLocationId?: number; // Forza l'ubicazione esatta sul movimento di consegna (controllo scadenze)
}

interface AIMatch {
  richiesta_originale: string;
  quantita: number;
  product_id: number | null;
  product_name: string | null;
  confidence: string;
  reasoning: string;
}

interface AIMessage {
  id: string; // UUID
  timestamp: number;
  messageType: string;
  transcription: string;
  matches: AIMatch[];
  fileData?: {
    base64: string;
    mimeType: string;
    fileName: string;
    size: number;
  };
}

interface AIData {
  // Legacy single message format (backwards compatible)
  transcription?: string;
  messageType?: string;
  matches?: AIMatch[];
  // New multi-message format
  messages?: AIMessage[];
}

interface CreateOrderRequest {
  customerId: number;
  deliveryAddressId: number | null;
  orderLines: OrderLine[];
  orderNotes?: string; // Customer-visible notes (goes to Chatter via message_post)
  warehouseNotes?: string; // Internal notes (goes to internal_note field)
  deliveryDate?: string; // Format: YYYY-MM-DD
  aiData?: AIData; // AI processing data (transcription, matches)
  confirmOrder?: boolean; // Se true, conferma l'ordine (action_confirm) e forza lotto/ubicazione richiesti
}

export async function POST(request: NextRequest) {
  try {
    console.log('📦 [CREATE-ORDER-API] POST - Starting order creation process');

    // Get user session
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      console.error('❌ [CREATE-ORDER-API] No valid user session');
      return NextResponse.json(
        { success: false, error: 'User session not valid' },
        { status: 401 }
      );
    }

    console.log('✅ [CREATE-ORDER-API] User authenticated, UID:', uid);

    // Parse request body
    let body: CreateOrderRequest;
    try {
      body = await request.json();
    } catch (parseError: any) {
      console.error('❌ [CREATE-ORDER-API] Invalid JSON body:', parseError.message);
      return NextResponse.json(
        { success: false, error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { customerId, deliveryAddressId, orderLines, orderNotes, warehouseNotes, deliveryDate, aiData, confirmOrder } = body;

    console.log('📋 [CREATE-ORDER-API] Request data:', {
      customerId,
      deliveryAddressId,
      orderLinesCount: orderLines?.length,
      hasOrderNotes: !!orderNotes,
      hasWarehouseNotes: !!warehouseNotes,
      deliveryDate: deliveryDate || 'not specified',
      hasAiData: !!aiData
    });

    // Validate input
    if (!customerId || typeof customerId !== 'number') {
      console.error('❌ [CREATE-ORDER-API] Invalid customerId:', customerId);
      return NextResponse.json(
        { success: false, error: 'customerId is required and must be a number' },
        { status: 400 }
      );
    }

    if (!Array.isArray(orderLines) || orderLines.length === 0) {
      console.error('❌ [CREATE-ORDER-API] Invalid orderLines:', orderLines);
      return NextResponse.json(
        { success: false, error: 'orderLines must be a non-empty array' },
        { status: 400 }
      );
    }

    // Validate each order line
    for (const line of orderLines) {
      if (!line.product_id || typeof line.product_id !== 'number') {
        console.error('❌ [CREATE-ORDER-API] Invalid product_id in order line:', line);
        return NextResponse.json(
          { success: false, error: 'Each order line must have a valid product_id (number)' },
          { status: 400 }
        );
      }

      if (!line.quantity || typeof line.quantity !== 'number' || line.quantity <= 0) {
        console.error('❌ [CREATE-ORDER-API] Invalid quantity in order line:', line);
        return NextResponse.json(
          { success: false, error: 'Each order line must have a valid quantity (positive number)' },
          { status: 400 }
        );
      }
    }

    console.log('✅ [CREATE-ORDER-API] Input validation passed');

    // Get customer partner from Odoo
    console.log('🔍 [CREATE-ORDER-API] Fetching customer partner...');
    const customerPartners = await callOdoo(
      cookies,
      'res.partner',
      'search_read',
      [],
      {
        domain: [['id', '=', customerId]],
        fields: ['id', 'name', 'email', 'property_payment_term_id', 'customer_rank', 'property_product_pricelist'],
        limit: 1
      }
    );

    if (!customerPartners || customerPartners.length === 0) {
      console.error('❌ [CREATE-ORDER-API] Customer partner not found:', customerId);
      return NextResponse.json(
        { success: false, error: `Customer with ID ${customerId} not found` },
        { status: 404 }
      );
    }

    const customer = customerPartners[0];
    console.log('✅ [CREATE-ORDER-API] Customer found:', {
      id: customer.id,
      name: customer.name,
      email: customer.email
    });

    // Determine delivery address
    let shippingPartnerId = customerId;

    if (deliveryAddressId) {
      console.log('🔍 [CREATE-ORDER-API] Validating delivery address...');

      // Validate that delivery address exists and belongs to customer
      const deliveryAddresses = await callOdoo(
        cookies,
        'res.partner',
        'search_read',
        [],
        {
          domain: [
            ['id', '=', deliveryAddressId],
            ['parent_id', '=', customerId]
          ],
          fields: ['id', 'name', 'type'],
          limit: 1
        }
      );

      if (!deliveryAddresses || deliveryAddresses.length === 0) {
        console.error('❌ [CREATE-ORDER-API] Delivery address not found or does not belong to customer:', {
          deliveryAddressId,
          customerId
        });
        return NextResponse.json(
          { success: false, error: `Delivery address ${deliveryAddressId} not found or does not belong to customer` },
          { status: 404 }
        );
      }

      shippingPartnerId = deliveryAddressId;
      console.log('✅ [CREATE-ORDER-API] Delivery address validated:', deliveryAddresses[0].name);
    } else {
      console.log('ℹ️ [CREATE-ORDER-API] Using customer main address for delivery');
    }

    // Validate product availability
    console.log('🔍 [CREATE-ORDER-API] Validating product availability...');

    for (const line of orderLines) {
      const products = await callOdoo(
        cookies,
        'product.product',
        'search_read',
        [],
        {
          domain: [['id', '=', line.product_id]],
          fields: ['id', 'name', 'default_code', 'sale_ok', 'active', 'qty_available'],
          limit: 1
        }
      );

      if (!products || products.length === 0) {
        console.error('❌ [CREATE-ORDER-API] Product not found:', line.product_id);
        const productName = line.product_name || `ID ${line.product_id}`;
        return NextResponse.json(
          {
            success: false,
            error: `Il prodotto "${productName}" non è più disponibile in Odoo. Potrebbe essere stato archiviato o cancellato. Rimuovilo dal carrello e riprova.`,
            productId: line.product_id,
            productName: line.product_name
          },
          { status: 404 }
        );
      }

      const product = products[0];

      if (!product.active || !product.sale_ok) {
        console.error('❌ [CREATE-ORDER-API] Product not available for sale:', {
          id: product.id,
          name: product.name,
          active: product.active,
          sale_ok: product.sale_ok
        });
        return NextResponse.json(
          {
            success: false,
            error: `Product ${product.name} (${product.default_code || product.id}) is not available for sale`
          },
          { status: 409 }
        );
      }

      console.log('✅ [CREATE-ORDER-API] Product validated:', {
        id: product.id,
        name: product.name,
        code: product.default_code,
        quantity: line.quantity,
        available: product.qty_available
      });
    }

    console.log('✅ [CREATE-ORDER-API] All products validated');

    // Create sale.order in Odoo
    console.log('📝 [CREATE-ORDER-API] Creating sale.order in Odoo...');

    // Format date for Odoo (YYYY-MM-DD HH:MM:SS)
    const formatDateForOdoo = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    };

    const orderData: any = {
      partner_id: customerId,
      partner_shipping_id: shippingPartnerId,
      date_order: formatDateForOdoo(new Date()),
      state: 'draft',
      origin: 'Catalogo Venditori',
      company_id: 1, // LAPA - finest italian food GmbH
    };

    // Add pricelist (which includes currency) from customer if available
    if (customer.property_product_pricelist && customer.property_product_pricelist[0]) {
      orderData.pricelist_id = customer.property_product_pricelist[0];
      console.log('✅ [CREATE-ORDER-API] Pricelist ID added from customer:', customer.property_product_pricelist[0]);
    }

    // Add warehouse notes (internal) to the internal_note field
    if (warehouseNotes && warehouseNotes.trim()) {
      orderData.internal_note = warehouseNotes.trim();
      console.log('✅ [CREATE-ORDER-API] Warehouse notes added to internal_note field');
    }

    // Add delivery date if provided (Odoo field: commitment_date or requested_date)
    if (deliveryDate) {
      // Format delivery date to YYYY-MM-DD (Odoo date field format)
      orderData.commitment_date = deliveryDate;
      console.log('✅ [CREATE-ORDER-API] Delivery date set:', deliveryDate);
    }

    // Add payment term if available
    if (customer.property_payment_term_id) {
      orderData.payment_term_id = customer.property_payment_term_id[0];
      console.log('✅ [CREATE-ORDER-API] Payment term added:', customer.property_payment_term_id[0]);
    }

    const odooOrderId = await callOdoo(
      cookies,
      'sale.order',
      'create',
      [orderData],
      {}
    );

    console.log('✅ [CREATE-ORDER-API] Sale order created in Odoo:', odooOrderId);

    // Create order lines
    console.log('📝 [CREATE-ORDER-API] Creating order lines...');

    const orderLinePromises = orderLines.map(async (line) => {
      const lineData: any = {
        order_id: odooOrderId,
        product_id: line.product_id,
        product_uom_qty: line.quantity,
        company_id: 1, // LAPA - finest italian food GmbH
      };

      // ✅ Se c'è un prezzo dall'offerta o urgente, usa quello
      if (line.price !== undefined && line.price !== null) {
        lineData.price_unit = line.price;
        console.log(`✅ [CREATE-ORDER-API] Using custom price for product ${line.product_id}: ${line.price.toFixed(2)}${line.source ? ` (from ${line.source})` : ''}`);
      }

      // ✅ Aggiungi badge per prodotti da offerta/urgente nella description
      if (line.source) {
        const badge = line.source === 'offer' ? '🏷️ OFFERTA' : '🔔 URGENTE';
        lineData.name = `${badge} - ${line.product_name || `Product ${line.product_id}`}`;
        console.log(`✅ [CREATE-ORDER-API] Added ${badge} badge to product ${line.product_id}`);
      }

      const lineId = await callOdoo(
        cookies,
        'sale.order.line',
        'create',
        [lineData],
        {}
      );

      return { lineId, line };
    });

    const createdLines = await Promise.all(orderLinePromises);

    console.log(`✅ [CREATE-ORDER-API] Created ${orderLines.length} order lines`);

    // Conferma l'ordine e forza lotto/ubicazione esatti sul movimento di consegna
    // (flusso controllo scadenze: il prodotto va prelevato ESATTAMENTE da quel lotto/ubicazione)
    let orderConfirmed = false;

    if (confirmOrder) {
      try {
        console.log('📝 [CREATE-ORDER-API] Confirming order (action_confirm)...');
        await callOdoo(cookies, 'sale.order', 'action_confirm', [[odooOrderId]], {});
        orderConfirmed = true;
        console.log('✅ [CREATE-ORDER-API] Order confirmed');
      } catch (confirmError: any) {
        console.error('⚠️ [CREATE-ORDER-API] Failed to confirm order:', confirmError.message);
      }

      if (orderConfirmed) {
        for (const { lineId, line } of createdLines) {
          if (!line.forceLotId || !line.forceLocationId) continue;

          try {
            const moves = await callOdoo(
              cookies,
              'stock.move',
              'search_read',
              [],
              {
                domain: [['sale_line_id', '=', lineId]],
                fields: ['id', 'picking_id', 'location_dest_id', 'product_uom', 'move_line_ids']
              }
            );

            for (const move of moves) {
              if (move.move_line_ids && move.move_line_ids.length > 0) {
                await callOdoo(cookies, 'stock.move.line', 'unlink', [move.move_line_ids], {});
              }

              await callOdoo(
                cookies,
                'stock.move.line',
                'create',
                [{
                  move_id: move.id,
                  picking_id: move.picking_id ? move.picking_id[0] : false,
                  product_id: line.product_id,
                  lot_id: line.forceLotId,
                  quantity: line.quantity,
                  location_id: line.forceLocationId,
                  location_dest_id: move.location_dest_id[0],
                  product_uom_id: move.product_uom[0],
                }],
                {}
              );
            }

            console.log(`✅ [CREATE-ORDER-API] Lotto ${line.forceLotId} forzato su ${moves.length} movimento/i per prodotto ${line.product_id}`);
          } catch (lotError: any) {
            console.error('⚠️ [CREATE-ORDER-API] Impossibile forzare lotto/ubicazione:', lotError.message);
          }
        }
      }
    }

    // Fetch order details from Odoo
    console.log('🔍 [CREATE-ORDER-API] Fetching order details...');
    const createdOrder = await callOdoo(
      cookies,
      'sale.order',
      'search_read',
      [],
      {
        domain: [['id', '=', odooOrderId]],
        fields: ['name', 'amount_total', 'state'],
        limit: 1
      }
    );

    const orderName = createdOrder?.[0]?.name || `SO-${odooOrderId}`;

    console.log('✅ [CREATE-ORDER-API] Order details:', {
      id: odooOrderId,
      name: orderName,
      total: createdOrder?.[0]?.amount_total,
      state: createdOrder?.[0]?.state
    });

    // Get user name for chatter message
    let userName = 'Venditore';
    try {
      const users = await callOdoo(
        cookies,
        'res.users',
        'search_read',
        [],
        {
          domain: [['id', '=', uid]],
          fields: ['name'],
          limit: 1
        }
      );

      if (users && users.length > 0) {
        userName = users[0].name;
        console.log('✅ [CREATE-ORDER-API] User name retrieved:', userName);
      }
    } catch (userError: any) {
      console.error('⚠️ [CREATE-ORDER-API] Could not fetch user name:', userError.message);
      // Continue with default name
    }

    // Post automatic creation message to Chatter (ALWAYS)
    try {
      console.log('📝 [CREATE-ORDER-API] Posting creation message to Chatter...');

      const now = new Date();
      const formattedDate = now.toLocaleDateString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      const formattedTime = now.toLocaleTimeString('it-IT', {
        hour: '2-digit',
        minute: '2-digit'
      });

      const creationMessage = `<p><strong>📱 Ordine inserito da Catalogo Venditori AI</strong></p><ul><li><strong>Venditore:</strong> ${userName}</li><li><strong>Data/Ora:</strong> ${formattedDate} ${formattedTime}</li><li><strong>Prodotti inseriti:</strong> ${orderLines.length}</li></ul>`;

      await callOdoo(
        cookies,
        'mail.message',
        'create',
        [{
          model: 'sale.order',
          res_id: odooOrderId,
          body: creationMessage,
          message_type: 'comment',
          subtype_id: 1, // mt_note (internal note)
        }],
        {}
      );

      console.log('✅ [CREATE-ORDER-API] Creation message posted to Chatter');
    } catch (chatterError: any) {
      console.error('⚠️ [CREATE-ORDER-API] Failed to post creation message to Chatter:', chatterError.message);
      // Continue anyway - not critical
    }

    // Post order notes (customer-visible) to Chatter if provided
    if (orderNotes && orderNotes.trim()) {
      try {
        console.log('📝 [CREATE-ORDER-API] Posting order notes to Chatter...');

        const notesMessage = `<p><strong>💬 Note Ordine dal Cliente</strong></p><p>${orderNotes.replace(/\n/g, '<br/>')}</p><p><em>Inserite dal venditore tramite Catalogo Venditori</em></p>`;

        await callOdoo(
          cookies,
          'sale.order',
          'message_post',
          [[odooOrderId]],
          {
            body: notesMessage,
            message_type: 'comment',
            subtype_xmlid: 'mail.mt_comment', // Public message (visible to customer)
          }
        );

        console.log('✅ [CREATE-ORDER-API] Order notes posted to Chatter (customer-visible)');
      } catch (notesError: any) {
        console.error('❌ [CREATE-ORDER-API] Failed to post order notes to Chatter:', notesError.message);
        // Continue anyway - not critical
      }
    }

    // Post AI processing data to Chatter and upload file attachments if provided
    if (aiData && (aiData.messages || aiData.transcription)) {
      try {
        console.log('📝 [CREATE-ORDER-API] Posting AI processing data to Chatter and uploading file attachments...');

        const messageTypeLabels: Record<string, string> = {
          'text': '💬 Messaggio Testo',
          'audio': '🎤 Trascrizione Audio',
          'image': '📷 Testo da Immagine',
          'recording': '🎙️ Registrazione Vocale',
          'document': '📄 Documento'
        };

        // Get messages array (either new format or legacy single message)
        let messages: AIMessage[] = [];
        if (aiData.messages && aiData.messages.length > 0) {
          // New multi-message format
          messages = aiData.messages;
        } else if (aiData.transcription && aiData.messageType && aiData.matches) {
          // Legacy single message format - convert to array
          messages = [{
            id: 'legacy-' + Date.now(), // Generate ID for legacy messages
            timestamp: Date.now(),
            messageType: aiData.messageType,
            transcription: aiData.transcription,
            matches: aiData.matches
          }];
        }

        if (messages.length === 0) {
          console.log('⚠️ [CREATE-ORDER-API] No AI messages to post');
          return;
        }

        // Build comprehensive AI message for chatter
        let aiMessage = `<p><strong>🤖 ORDINE CREATO CON AI - ${messages.length} ${messages.length === 1 ? 'messaggio processato' : 'messaggi processati'}</strong></p>`;
        aiMessage += `<hr style="border: 1px solid #e5e7eb; margin: 10px 0;" />`;

        // Process each message
        messages.forEach((msg, index) => {
          const messageNumber = index + 1;
          const messageTypeLabel = messageTypeLabels[msg.messageType] || '📝 Messaggio';
          const messageDate = new Date(msg.timestamp);
          const formattedDate = messageDate.toLocaleDateString('it-IT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          });
          const formattedTime = messageDate.toLocaleTimeString('it-IT', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          });

          // Message header
          aiMessage += `<div style="background-color: #f9fafb; padding: 15px; margin: 15px 0; border-radius: 8px; border-left: 4px solid #3b82f6;">`;
          aiMessage += `<p><strong>Messaggio ${messageNumber} di ${messages.length}</strong></p>`;
          aiMessage += `<p><strong>Tipo:</strong> ${messageTypeLabel}</p>`;
          aiMessage += `<p><strong>Orario:</strong> ${formattedDate} ${formattedTime}</p>`;

          // File attachment indicator
          if (msg.fileData) {
            aiMessage += `<p><strong>📎 File Allegato:</strong> ${msg.fileData.fileName} (${(msg.fileData.size / 1024).toFixed(1)} KB)</p>`;
          }

          // Transcription
          aiMessage += `<blockquote style="background-color: #ffffff; padding: 12px; border-left: 4px solid #3b82f6; margin: 10px 0;">`;
          aiMessage += `<em>${msg.transcription.replace(/\n/g, '<br/>')}</em>`;
          aiMessage += `</blockquote>`;

          // Separate found and not found products
          const foundMatches = msg.matches.filter(m => m.product_id !== null);
          const notFoundMatches = msg.matches.filter(m => m.product_id === null);

          // Products found
          if (foundMatches.length > 0) {
            aiMessage += `<p><strong>✅ Prodotti Trovati: ${foundMatches.length}</strong></p><ul>`;
            foundMatches.forEach(match => {
              const confidenceBadge = match.confidence === 'ALTA' ? '🟢' :
                                     match.confidence === 'MEDIA' ? '🟡' :
                                     match.confidence === 'BASSA' ? '🟠' : '⚪';
              aiMessage += `<li>${confidenceBadge} <strong>${match.product_name}</strong> - Quantità: ${match.quantita}`;
              if (match.reasoning) {
                aiMessage += `<br/><small style="color: #6b7280;">💡 ${match.reasoning}</small>`;
              }
              aiMessage += `</li>`;
            });
            aiMessage += `</ul>`;
          } else {
            aiMessage += `<p><em>Nessun prodotto trovato in questo messaggio</em></p>`;
          }

          // Products not found
          if (notFoundMatches.length > 0) {
            aiMessage += `<p><strong>❌ Prodotti NON Trovati: ${notFoundMatches.length}</strong></p><ul>`;
            notFoundMatches.forEach(match => {
              aiMessage += `<li><strong>"${match.richiesta_originale}"</strong> - Quantità richiesta: ${match.quantita}`;
              if (match.reasoning) {
                aiMessage += `<br/><small style="color: #6b7280;">💡 ${match.reasoning}</small>`;
              }
              aiMessage += `</li>`;
            });
            aiMessage += `</ul>`;
          }

          aiMessage += `</div>`;
        });

        // Summary footer
        const totalFoundProducts = messages.reduce((sum, msg) =>
          sum + msg.matches.filter(m => m.product_id !== null).length, 0);
        const totalNotFoundProducts = messages.reduce((sum, msg) =>
          sum + msg.matches.filter(m => m.product_id === null).length, 0);

        aiMessage += `<hr style="border: 1px solid #e5e7eb; margin: 10px 0;" />`;
        aiMessage += `<p><strong>📊 RIEPILOGO TOTALE</strong></p><ul>`;
        aiMessage += `<li><strong>Messaggi processati:</strong> ${messages.length}</li>`;
        aiMessage += `<li><strong>✅ Prodotti trovati e aggiunti:</strong> ${totalFoundProducts}</li>`;
        if (totalNotFoundProducts > 0) {
          aiMessage += `<li><strong>❌ Prodotti NON trovati:</strong> ${totalNotFoundProducts}</li>`;
          aiMessage += `</ul><p><em style="color: #dc2626;">⚠️ I prodotti non trovati NON sono stati aggiunti all'ordine</em></p>`;
        } else {
          aiMessage += `</ul>`;
        }

        aiMessage += `<p><em>Ordine elaborato con AI - Claude Sonnet 4 + Whisper</em></p>`;

        await callOdoo(
          cookies,
          'mail.message',
          'create',
          [{
            model: 'sale.order',
            res_id: odooOrderId,
            body: aiMessage,
            message_type: 'comment',
            subtype_id: 1, // mt_note (internal note)
          }],
          {}
        );

        console.log('✅ [CREATE-ORDER-API] AI processing data posted to Chatter');
        console.log(`   - Messages processed: ${messages.length}`);
        console.log(`   - Total found matches: ${totalFoundProducts}`);
        console.log(`   - Total not found matches: ${totalNotFoundProducts}`);

        // Upload file attachments for each message that has fileData
        let filesUploaded = 0;
        for (const msg of messages) {
          if (msg.fileData && msg.fileData.base64) {
            try {
              console.log(`📎 [CREATE-ORDER-API] Uploading file attachment: ${msg.fileData.fileName} (${(msg.fileData.size / 1024).toFixed(1)} KB)`);

              const messageDate = new Date(msg.timestamp);
              const formattedDate = messageDate.toLocaleDateString('it-IT', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });

              // Create ir.attachment in Odoo
              const attachmentId = await callOdoo(
                cookies,
                'ir.attachment',
                'create',
                [{
                  name: msg.fileData.fileName,
                  datas: msg.fileData.base64, // Odoo expects base64 without prefix
                  res_model: 'sale.order',
                  res_id: odooOrderId,
                  mimetype: msg.fileData.mimeType,
                  description: `File originale AI - ${messageTypeLabels[msg.messageType] || msg.messageType} - ${formattedDate}`,
                }],
                {}
              );

              filesUploaded++;
              console.log(`✅ [CREATE-ORDER-API] File attachment uploaded: ${msg.fileData.fileName} (ID: ${attachmentId})`);
            } catch (fileError: any) {
              console.error(`⚠️ [CREATE-ORDER-API] Failed to upload file ${msg.fileData.fileName}:`, fileError.message);
              // Continue with other files even if one fails
            }
          }
        }

        if (filesUploaded > 0) {
          console.log(`✅ [CREATE-ORDER-API] Total file attachments uploaded: ${filesUploaded}/${messages.length}`);
        }

      } catch (aiDataError: any) {
        console.error('⚠️ [CREATE-ORDER-API] Failed to post AI data to Chatter:', aiDataError.message);
        // Continue anyway - not critical
      }
    }

    // Post message about urgent/offer products if any
    const urgentProducts = orderLines.filter(l => l.source === 'urgent');
    const offerProducts = orderLines.filter(l => l.source === 'offer');

    if (urgentProducts.length > 0 || offerProducts.length > 0) {
      try {
        console.log('📝 [CREATE-ORDER-API] Posting urgent/offer products message to Chatter...');

        let specialProductsMessage = '<p><strong>⚡ Prodotti Speciali in questo Ordine</strong></p><ul>';

        if (urgentProducts.length > 0) {
          specialProductsMessage += '<li><strong>🔔 Prodotti Urgenti:</strong> ' + urgentProducts.length;
          urgentProducts.forEach(p => {
            const priceInfo = p.price ? ` - ${p.price.toFixed(2)}` : '';
            specialProductsMessage += `<br/>• ${p.product_name} (x${p.quantity}${priceInfo})`;
          });
          specialProductsMessage += '</li>';
        }

        if (offerProducts.length > 0) {
          specialProductsMessage += '<li><strong>🏷️ Prodotti in Offerta:</strong> ' + offerProducts.length;
          offerProducts.forEach(p => {
            const priceInfo = p.price ? ` - ${p.price.toFixed(2)}` : '';
            specialProductsMessage += `<br/>• ${p.product_name} (x${p.quantity}${priceInfo})`;
          });
          specialProductsMessage += '</li>';
        }

        specialProductsMessage += '</ul><p><em>Questi prodotti hanno prezzi speciali da controllo scadenze</em></p>';

        await callOdoo(
          cookies,
          'mail.message',
          'create',
          [{
            model: 'sale.order',
            res_id: odooOrderId,
            body: specialProductsMessage,
            message_type: 'comment',
            subtype_id: 1, // mt_note (internal note)
          }],
          {}
        );

        console.log('✅ [CREATE-ORDER-API] Urgent/Offer products message posted to Chatter');
      } catch (specialError: any) {
        console.error('⚠️ [CREATE-ORDER-API] Failed to post special products message:', specialError.message);
        // Continue anyway - not critical
      }
    }

    console.log('✅ [CREATE-ORDER-API] Order creation completed successfully');

    return NextResponse.json({
      success: true,
      message: 'Order created successfully',
      orderId: odooOrderId,
      orderName: orderName,
      total: createdOrder?.[0]?.amount_total || 0,
      itemsCount: orderLines.length,
      confirmed: orderConfirmed
    });

  } catch (error: any) {
    console.error('💥 [CREATE-ORDER-API] Error:', error);

    // Detailed error logging
    if (error.message) {
      console.error('💥 [CREATE-ORDER-API] Error message:', error.message);
    }
    if (error.stack) {
      console.error('💥 [CREATE-ORDER-API] Error stack:', error.stack);
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error creating order',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
