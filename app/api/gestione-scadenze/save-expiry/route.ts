import { NextRequest, NextResponse } from 'next/server';
import { getOdooSessionId } from '@/lib/odoo/odoo-helper';

const ODOO_URL = process.env.NEXT_PUBLIC_ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-24517859.dev.odoo.com';

export async function POST(req: NextRequest) {
  try {
    const sessionId = await getOdooSessionId();
    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Sessione non valida. Effettua il login.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { action } = body;

    // Helper per chiamate Odoo
    const callOdoo = async (model: string, method: string, args: any[] = [], kwargs: any = {}) => {
      const response = await fetch(`${ODOO_URL}/web/dataset/call_kw/${model}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': `session_id=${sessionId}` },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: { model, method, args, kwargs },
          id: Date.now()
        })
      });

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error.data?.message || data.error.message || 'Errore Odoo');
      }
      return data.result;
    };

    // ACTION: Upload photos as attachments
    if (action === 'upload_photos') {
      const { productId, lotId, photos } = body;

      if (!productId || !photos || !Array.isArray(photos)) {
        return NextResponse.json({ success: false, error: 'Parametri mancanti' });
      }

      // Determina dove allegare le foto: al lotto se esiste, altrimenti al prodotto
      const targetModel = lotId ? 'stock.lot' : 'product.product';
      const targetId = lotId || productId;

      console.log(`📸 [save-expiry] Caricando ${photos.length} foto su ${targetModel} ID ${targetId}`);

      const attachmentIds: number[] = [];
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];

        // Rimuovi il prefisso data:image/...;base64, se presente
        const base64Data = photo.includes('base64,')
          ? photo.split('base64,')[1]
          : photo;

        const attachmentData = {
          name: `scadenza_${timestamp}_${i + 1}.jpg`,
          type: 'binary',
          datas: base64Data,
          res_model: targetModel,
          res_id: targetId,
          mimetype: 'image/jpeg',
          description: `Foto etichetta scadenza - ${new Date().toLocaleDateString('it-IT')}${lotId ? ` - Lotto ID: ${lotId}` : ''}`
        };

        try {
          const attachmentId = await callOdoo('ir.attachment', 'create', [attachmentData]);
          attachmentIds.push(attachmentId);
          console.log(`✅ [save-expiry] Allegato ${i + 1} creato: ID ${attachmentId} su ${targetModel}`);
        } catch (err: any) {
          console.error(`❌ [save-expiry] Errore upload foto ${i + 1}:`, err.message);
        }
      }

      return NextResponse.json({
        success: true,
        message: `${attachmentIds.length} foto caricate su ${targetModel}`,
        attachmentIds,
        targetModel,
        targetId
      });
    }

    // ACTION: Update expiry data
    if (action === 'update_expiry') {
      const { productId, quantId, lotId, lotName, expiryDate } = body;

      if (!productId && !lotId) {
        return NextResponse.json({ success: false, error: 'ID prodotto o lotto mancante' });
      }

      console.log(`📅 [save-expiry] Aggiornando scadenza - Prodotto: ${productId}, LottoID: ${lotId}, LottoName: ${lotName}, Scadenza: ${expiryDate}`);

      // Se abbiamo un lotId diretto, aggiorniamo direttamente il lotto
      if (lotId && expiryDate) {
        try {
          // 1. Aggiorna il lotto
          await callOdoo('stock.lot', 'write', [[lotId], { expiration_date: expiryDate }]);
          console.log(`✅ [save-expiry] Aggiornata scadenza lotto ${lotId} a ${expiryDate}`);

          // 2. Aggiorna anche tutte le move lines associate a questo lotto
          // (il campo expiration_date sulla move line potrebbe non aggiornarsi automaticamente)
          const moveLines = await callOdoo('stock.move.line', 'search_read',
            [[['lot_id', '=', lotId], ['state', 'not in', ['done', 'cancel']]]],
            { fields: ['id'] }
          );

          if (moveLines && moveLines.length > 0) {
            const moveLineIds = moveLines.map((ml: any) => ml.id);
            await callOdoo('stock.move.line', 'write', [moveLineIds, { expiration_date: expiryDate }]);
            console.log(`✅ [save-expiry] Aggiornate ${moveLineIds.length} move lines con nuova scadenza`);
          }

          return NextResponse.json({
            success: true,
            message: 'Scadenza aggiornata',
            lotId
          });
        } catch (err: any) {
          console.error(`❌ [save-expiry] Errore aggiornamento lotto ${lotId}:`, err.message);
          return NextResponse.json({ success: false, error: err.message }, { status: 500 });
        }
      }

      // Se abbiamo un quantId, aggiorniamo quel quant specifico
      if (quantId) {
        // Prima recuperiamo il quant per ottenere info sul lotto
        const quants = await callOdoo('stock.quant', 'search_read',
          [[['id', '=', quantId]]],
          { fields: ['id', 'product_id', 'lot_id'] }
        );

        if (quants?.length > 0) {
          const quant = quants[0];
          let lotId = quant.lot_id ? quant.lot_id[0] : null;

          // Se abbiamo un nome lotto
          if (lotName) {
            // Cerca lotto esistente
            const existingLots = await callOdoo('stock.lot', 'search_read',
              [[['product_id', '=', productId], ['name', '=', lotName]]],
              { fields: ['id'], limit: 1 }
            );

            if (existingLots?.length > 0) {
              lotId = existingLots[0].id;
              // Aggiorna scadenza del lotto esistente
              if (expiryDate) {
                await callOdoo('stock.lot', 'write', [[lotId], { expiration_date: expiryDate }]);
                console.log(`✅ [save-expiry] Aggiornata scadenza lotto ${lotId}`);
              }
            } else {
              // Crea nuovo lotto
              const lotData: any = {
                product_id: productId,
                name: lotName,
                company_id: 1
              };
              if (expiryDate) {
                lotData.expiration_date = expiryDate;
              }
              const newLotId = await callOdoo('stock.lot', 'create', [lotData]);
              lotId = newLotId;
              console.log(`✅ [save-expiry] Creato nuovo lotto ${lotId}: ${lotName}`);
            }

            // Aggiorna il quant con il nuovo lotto (se diverso)
            if (lotId && lotId !== (quant.lot_id ? quant.lot_id[0] : null)) {
              await callOdoo('stock.quant', 'write', [[quantId], { lot_id: lotId }]);
              console.log(`✅ [save-expiry] Aggiornato quant ${quantId} con lotto ${lotId}`);
            }
          } else if (lotId && expiryDate) {
            // Solo aggiorna scadenza del lotto esistente
            await callOdoo('stock.lot', 'write', [[lotId], { expiration_date: expiryDate }]);
            console.log(`✅ [save-expiry] Aggiornata scadenza lotto esistente ${lotId}`);
          }

          return NextResponse.json({
            success: true,
            message: 'Scadenza aggiornata',
            lotId
          });
        }
      }

      // Fallback: cerca/crea lotto per il prodotto
      if (lotName) {
        const existingLots = await callOdoo('stock.lot', 'search_read',
          [[['product_id', '=', productId], ['name', '=', lotName]]],
          { fields: ['id'], limit: 1 }
        );

        let lotId;
        if (existingLots?.length > 0) {
          lotId = existingLots[0].id;
          if (expiryDate) {
            await callOdoo('stock.lot', 'write', [[lotId], { expiration_date: expiryDate }]);
          }
        } else {
          const lotData: any = {
            product_id: productId,
            name: lotName,
            company_id: 1
          };
          if (expiryDate) {
            lotData.expiration_date = expiryDate;
          }
          lotId = await callOdoo('stock.lot', 'create', [lotData]);
        }

        return NextResponse.json({
          success: true,
          message: 'Lotto/scadenza salvati',
          lotId
        });
      }

      return NextResponse.json({
        success: false,
        error: 'Nessun dato da salvare'
      });
    }

    // ACTION: Check which lots have photos attached (verification status)
    if (action === 'check_verified') {
      const { lotIds, productIds } = body;

      if ((!lotIds || !Array.isArray(lotIds)) && (!productIds || !Array.isArray(productIds))) {
        return NextResponse.json({ success: false, error: 'Parametri mancanti' });
      }

      const verifiedLots: number[] = [];
      const verifiedProducts: number[] = [];

      // Controlla allegati sui lotti
      if (lotIds && lotIds.length > 0) {
        const lotAttachments = await callOdoo('ir.attachment', 'search_read',
          [[
            ['res_model', '=', 'stock.lot'],
            ['res_id', 'in', lotIds],
            ['mimetype', 'like', 'image%']
          ]],
          { fields: ['res_id'] }
        );

        if (lotAttachments?.length > 0) {
          lotAttachments.forEach((att: any) => {
            if (!verifiedLots.includes(att.res_id)) {
              verifiedLots.push(att.res_id);
            }
          });
        }
      }

      // Controlla allegati sui prodotti (per prodotti senza lotto)
      if (productIds && productIds.length > 0) {
        const productAttachments = await callOdoo('ir.attachment', 'search_read',
          [[
            ['res_model', '=', 'product.product'],
            ['res_id', 'in', productIds],
            ['mimetype', 'like', 'image%'],
            ['name', 'like', 'scadenza_%']
          ]],
          { fields: ['res_id'] }
        );

        if (productAttachments?.length > 0) {
          productAttachments.forEach((att: any) => {
            if (!verifiedProducts.includes(att.res_id)) {
              verifiedProducts.push(att.res_id);
            }
          });
        }
      }

      console.log(`🔍 [save-expiry] Verificati: ${verifiedLots.length} lotti, ${verifiedProducts.length} prodotti`);

      return NextResponse.json({
        success: true,
        verifiedLots,
        verifiedProducts
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Azione non riconosciuta'
    });

  } catch (error: any) {
    console.error('❌ [save-expiry] Errore:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Errore durante il salvataggio'
    }, { status: 500 });
  }
}
