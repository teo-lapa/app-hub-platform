import { NextRequest, NextResponse } from 'next/server';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';

/**
 * POST /api/smart-ordering-v2/toggle-preorder-tag
 *
 * Attiva o disattiva il tag "PRE-ORDINE" su un prodotto
 */
export async function POST(request: NextRequest) {
  try {
    const { productId, enable } = await request.json();

    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'productId è richiesto' },
        { status: 400 }
      );
    }

    // Get session
    const sessionId = request.cookies.get('odoo_session_id')?.value;
    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Session non trovata - Rifare login'
      }, { status: 401 });
    }

    const rpc = createOdooRPCClient(sessionId);

    console.log(`🔍 Toggle PRE-ORDINE per prodotto ${productId}, enable=${enable}`);

    // 1. Carica il tag "PRE-ORDINE"
    console.log('🔍 Cercando tag PRE-ORDINE...');
    const tags = await rpc.searchRead(
      'product.tag',
      [['name', 'ilike', 'PRE-ORDINE']],
      ['id', 'name'],
      1
    );
    console.log('🔍 Tag trovati:', tags);

    let preOrderTagId: number;

    if (tags.length === 0) {
      // Crea il tag se non esiste
      console.log('📌 Tag PRE-ORDINE non trovato, lo creo...');
      const newTagId = await rpc.callKw('product.tag', 'create', [{
        name: 'PRE-ORDINE',
        color: 5 // Colore viola in Odoo
      }]);
      preOrderTagId = newTagId;
      console.log(`✅ Tag PRE-ORDINE creato con ID: ${preOrderTagId}`);
    } else {
      preOrderTagId = tags[0].id;
    }

    // 2. Carica il product_tmpl_id dal product.product
    const products = await rpc.searchRead(
      'product.product',
      [['id', '=', productId]],
      ['product_tmpl_id']
    );

    if (products.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Prodotto non trovato' },
        { status: 404 }
      );
    }

    const templateId = products[0].product_tmpl_id[0];
    console.log(`🔍 Template ID: ${templateId}`);

    // 3. Carica i tag attuali del template
    const templates = await rpc.searchRead(
      'product.template',
      [['id', '=', templateId]],
      ['product_tag_ids']
    );

    if (templates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Template prodotto non trovato' },
        { status: 404 }
      );
    }

    const currentTags = templates[0].product_tag_ids || [];
    console.log(`🔍 Tag attuali del template ${templateId}:`, currentTags);

    // 4. Aggiorna i tag
    let newTags: number[];
    if (enable) {
      // Aggiungi il tag se non c'è già
      if (!currentTags.includes(preOrderTagId)) {
        newTags = [...currentTags, preOrderTagId];
        console.log(`➕ Aggiungendo tag ${preOrderTagId} ai tag esistenti:`, currentTags, '→', newTags);
      } else {
        newTags = currentTags; // Già presente
        console.log(`⚠️ Tag ${preOrderTagId} già presente, nessuna modifica`);
      }
    } else {
      // Rimuovi il tag
      newTags = currentTags.filter((id: number) => id !== preOrderTagId);
      console.log(`➖ Rimuovendo tag ${preOrderTagId} dai tag esistenti:`, currentTags, '→', newTags);
    }

    // 5. Scrivi i nuovi tag sul template
    console.log(`💾 Scrivendo su product.template ID ${templateId} i tag:`, newTags);
    const writeCommand = [[6, 0, newTags]];
    console.log(`💾 Comando Odoo write:`, { product_tag_ids: writeCommand });

    await rpc.callKw('product.template', 'write', [[templateId], {
      product_tag_ids: writeCommand // Odoo command: replace all tags
    }]);

    console.log(`✅ Write completato, verifico risultato...`);

    // 6. Verifica che il tag sia stato salvato
    const verifyTemplates = await rpc.searchRead(
      'product.template',
      [['id', '=', templateId]],
      ['product_tag_ids']
    );
    const savedTags = verifyTemplates[0]?.product_tag_ids || [];
    console.log(`🔍 Tag dopo il save:`, savedTags);
    console.log(`✅ Tag PRE-ORDINE ${enable ? 'aggiunto a' : 'rimosso da'} prodotto ${productId}`,
      `- Salvato correttamente: ${enable ? savedTags.includes(preOrderTagId) : !savedTags.includes(preOrderTagId)}`);

    return NextResponse.json({
      success: true,
      productId,
      hasPreOrderTag: enable,
      message: `Tag PRE-ORDINE ${enable ? 'attivato' : 'disattivato'}`
    });

  } catch (error: any) {
    console.error('❌ Error toggling pre-order tag:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
