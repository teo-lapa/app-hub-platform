import { NextRequest, NextResponse } from 'next/server';
import { createOdooRPC } from '@/lib/odoo-rpc';

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

    const rpc = await createOdooRPC();

    // 1. Carica il tag "PRE-ORDINE"
    const tags = await rpc.searchRead(
      'product.tag',
      [['name', 'ilike', 'PRE-ORDINE']],
      ['id', 'name'],
      1
    );

    let preOrderTagId: number;

    if (tags.length === 0) {
      // Crea il tag se non esiste
      console.log('📌 Tag PRE-ORDINE non trovato, lo creo...');
      const newTagId = await rpc.create('product.tag', {
        name: 'PRE-ORDINE',
        color: 5 // Colore viola in Odoo
      });
      preOrderTagId = newTagId;
      console.log(`✅ Tag PRE-ORDINE creato con ID: ${preOrderTagId}`);
    } else {
      preOrderTagId = tags[0].id;
    }

    // 2. Carica i tag attuali del prodotto
    const products = await rpc.searchRead(
      'product.product',
      [['id', '=', productId]],
      ['tag_ids']
    );

    if (products.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Prodotto non trovato' },
        { status: 404 }
      );
    }

    const currentTags = products[0].tag_ids || [];

    // 3. Aggiorna i tag
    let newTags: number[];
    if (enable) {
      // Aggiungi il tag se non c'è già
      if (!currentTags.includes(preOrderTagId)) {
        newTags = [...currentTags, preOrderTagId];
      } else {
        newTags = currentTags; // Già presente
      }
    } else {
      // Rimuovi il tag
      newTags = currentTags.filter((id: number) => id !== preOrderTagId);
    }

    // 4. Scrivi i nuovi tag
    await rpc.write('product.product', [productId], {
      tag_ids: [[6, 0, newTags]] // Odoo command: replace all tags
    });

    console.log(`✅ Tag PRE-ORDINE ${enable ? 'aggiunto a' : 'rimosso da'} prodotto ${productId}`);

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
