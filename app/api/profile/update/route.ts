import { NextRequest, NextResponse } from 'next/server';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';
import { verifyToken } from '@/lib/auth';

/**
 * POST /api/profile/update
 * Aggiorna il profilo utente su Odoo
 */
export async function POST(request: NextRequest) {
  try {
    // Verifica autenticazione
    const token = request.headers.get('authorization')?.replace('Bearer ', '') ||
                  request.cookies.get('token')?.value;

    if (!token) {
      return NextResponse.json({
        success: false,
        error: 'Non autenticato',
      }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({
        success: false,
        error: 'Token non valido',
      }, { status: 401 });
    }

    const body = await request.json();
    const { contact_id, name, email, phone, image_base64 } = body;

    if (!contact_id) {
      return NextResponse.json({
        success: false,
        error: 'contact_id richiesto',
      }, { status: 400 });
    }

    const odoo = createOdooRPCClient();

    // Prepara i dati da aggiornare
    const updateData: Record<string, string | boolean> = {};

    if (name && name.trim()) {
      updateData.name = name.trim();
    }

    if (email && email.trim()) {
      updateData.email = email.trim();
    }

    if (phone !== undefined) {
      updateData.phone = phone.trim();
    }

    // Immagine in base64 (senza prefisso data:image/...)
    if (image_base64) {
      // Rimuovi il prefisso data:image/xxx;base64, se presente
      let cleanBase64 = image_base64;
      if (image_base64.includes(',')) {
        cleanBase64 = image_base64.split(',')[1];
      }
      updateData.image_1920 = cleanBase64; // Odoo usa image_1920 per l'immagine principale
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Nessun dato da aggiornare',
      }, { status: 400 });
    }

    console.log(`[Profile Update] Updating contact ${contact_id} with fields:`, Object.keys(updateData));

    // Aggiorna il contatto su Odoo
    await odoo.callKw('res.partner', 'write', [[contact_id], updateData]);

    // Ricarica i dati aggiornati
    const updatedContact = await odoo.searchRead(
      'res.partner',
      [['id', '=', contact_id]],
      ['id', 'name', 'email', 'phone', 'image_128'],
      1
    );

    if (!updatedContact || updatedContact.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Contatto non trovato dopo aggiornamento',
      }, { status: 404 });
    }

    console.log(`[Profile Update] Successfully updated contact ${contact_id}`);

    return NextResponse.json({
      success: true,
      message: 'Profilo aggiornato con successo',
      data: {
        contact: updatedContact[0],
      },
    });

  } catch (error) {
    console.error('[Profile Update] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore nell\'aggiornamento del profilo',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
