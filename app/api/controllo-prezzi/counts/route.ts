import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/controllo-prezzi/counts
 *
 * Ritorna i conteggi dei prodotti per ogni categoria di prezzo
 */
export async function GET(request: NextRequest) {
  try {
    // TODO: Implementare la logica per contare i prodotti per categoria
    // Per ora ritorna dati mock

    const counts = {
      byCategory: {
        below_critical: 12, // Prezzi < Punto Critico
        critical_to_avg: 8,  // Prezzi tra PC e Media
        above_avg: 45,       // Prezzi > Media
        blocked: 3,          // Richieste di blocco
        all: 68,             // Totale
      }
    };

    return NextResponse.json({
      success: true,
      counts
    });

  } catch (error: any) {
    console.error('Error in GET /api/controllo-prezzi/counts:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore nel caricamento dei conteggi'
      },
      { status: 500 }
    );
  }
}
