import { NextRequest, NextResponse } from 'next/server';
import { callOdooAsAdmin } from '@/lib/odoo/admin-session';

export const runtime = 'nodejs';

/**
 * POST /api/catalogo-lapa/update-product-image
 *
 * Aggiorna l'immagine di un prodotto su Odoo
 *
 * Body:
 * - productId: number - ID del prodotto Odoo
 * - imageBase64: string - Immagine in base64 (senza prefisso data:image)
 */
export async function POST(request: NextRequest) {
  try {
    const { productId, imageBase64 } = await request.json();

    // Validazione input
    if (!productId || typeof productId !== 'number') {
      return NextResponse.json(
        { success: false, error: 'productId è obbligatorio e deve essere un numero' },
        { status: 400 }
      );
    }

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return NextResponse.json(
        { success: false, error: 'imageBase64 è obbligatorio' },
        { status: 400 }
      );
    }

    console.log('🖼️ [UPDATE-PRODUCT-IMAGE] Aggiornamento immagine prodotto:', {
      productId,
      imageSize: imageBase64.length
    });

    // Rimuovi eventuale prefisso data:image se presente
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    // Aggiorna il prodotto su Odoo con la nuova immagine
    const result = await callOdooAsAdmin(
      'product.product',
      'write',
      [[productId], {
        image_1920: cleanBase64 // Odoo usa image_1920 per l'immagine principale
      }]
    );

    if (!result) {
      throw new Error('Errore durante l\'aggiornamento del prodotto su Odoo');
    }

    console.log('✅ [UPDATE-PRODUCT-IMAGE] Immagine aggiornata con successo');

    return NextResponse.json({
      success: true,
      message: 'Immagine aggiornata con successo',
      productId
    });

  } catch (error: any) {
    console.error('❌ [UPDATE-PRODUCT-IMAGE] Errore:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Errore durante l\'aggiornamento dell\'immagine',
        details: error.message
      },
      { status: 500 }
    );
  }
}
