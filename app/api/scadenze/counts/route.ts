import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';
import { GetExpiryCountsResponse } from '@/lib/types/expiry';

/**
 * GET /api/scadenze/counts
 *
 * Endpoint ottimizzato per recuperare solo i conteggi dei prodotti in scadenza.
 * Non restituisce i dettagli dei prodotti, solo aggregati numerici.
 *
 * Performance: usa solo i campi necessari per il calcolo dei conteggi.
 */
export async function GET(request: NextRequest) {
  try {
    console.log('📊 Calcolo conteggi prodotti in scadenza...');

    // Recupera session da cookie
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('odoo_session_id');

    if (!sessionCookie?.value) {
      return NextResponse.json(
        {
          success: false,
          counts: {
            byUrgency: { expired: 0, expiring: 0, ok: 0, all: 0, 'no-movement-30': 0, 'no-movement-90': 0 },
            byZone: {}
          },
          error: 'Sessione non valida - effettua il login'
        } as GetExpiryCountsResponse,
        { status: 401 }
      );
    }

    const sessionId = sessionCookie.value;

    // Crea client RPC
    const rpcClient = createOdooRPCClient(sessionId);

    // STEP 1: Cerca tutti i lotti con expiration_date (solo campi necessari)
    console.log('📦 Recupero lotti con scadenza...');
    const lots = await rpcClient.searchRead(
      'stock.lot',
      [['expiration_date', '!=', false]],
      ['id', 'expiration_date'], // Solo campi necessari per calcolo urgency
      0,
      'expiration_date asc'
    );

    console.log(`✅ Trovati ${lots.length} lotti con scadenza`);

    if (lots.length === 0) {
      return NextResponse.json({
        success: true,
        counts: {
          byUrgency: { expired: 0, expiring: 0, ok: 0, all: 0 },
          byZone: {}
        }
      } as GetExpiryCountsResponse);
    }

    // STEP 2: Per ogni lotto, trova le quantità disponibili usando stock.quant
    const lotIds = lots.map((lot: any) => lot.id);
    console.log('📊 Recupero quantità disponibili per i lotti...');

    const quants = await rpcClient.searchRead(
      'stock.quant',
      [
        ['lot_id', 'in', lotIds],
        ['quantity', '>', 0],
        ['location_id.usage', '=', 'internal'],
        ['location_id', '!=', 648] // Escludi MERCE DETERIORATA (Scarti)
      ],
      ['id', 'lot_id', 'location_id'], // Solo campi necessari per conteggio
      0
    );

    console.log(`✅ Trovati ${quants.length} quants con quantità disponibile`);

    if (quants.length === 0) {
      return NextResponse.json({
        success: true,
        counts: {
          byUrgency: { expired: 0, expiring: 0, ok: 0, all: 0 },
          byZone: {}
        }
      } as GetExpiryCountsResponse);
    }

    // Crea mappa lotto ID -> lotto
    const lotMap = new Map(lots.map((l: any) => [l.id, l]));

    // STEP 3: Calcola oggi per determinare urgency
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiringThreshold = 7; // giorni

    // Inizializza contatori
    const counts = {
      byUrgency: {
        expired: 0,
        expiring: 0,
        ok: 0,
        all: 0,
        'no-movement-30': 0,
        'no-movement-90': 0
      },
      byZone: {
        frigo: 0,
        secco: 0,
        'secco-sopra': 0,
        pingu: 0
      }
    };

    // STEP 4: Processa ogni quant e aggiorna contatori
    for (const quant of quants) {
      const lotId = quant.lot_id[0];
      const lot = lotMap.get(lotId);
      if (!lot) continue;

      // Calcola giorni alla scadenza
      const expirationDate = new Date(lot.expiration_date);
      expirationDate.setHours(0, 0, 0, 0);
      const daysUntilExpiry = Math.floor((expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      // Determina urgency level
      let urgencyLevel: 'expired' | 'expiring' | 'ok';
      if (daysUntilExpiry < 0) {
        urgencyLevel = 'expired';
        counts.byUrgency.expired++;
      } else if (daysUntilExpiry <= expiringThreshold) {
        urgencyLevel = 'expiring';
        counts.byUrgency.expiring++;
      } else {
        urgencyLevel = 'ok';
        counts.byUrgency.ok++;
      }

      // Incrementa totale
      counts.byUrgency.all++;

      // Determina zona in base alla location
      const locationCompleteName = quant.location_id[1] || '';
      const lowerName = locationCompleteName.toLowerCase();

      // Mappa location -> zona (verifica buffer ID o nomi)
      if (lowerName.includes('frigo') || lowerName.includes('fr02')) {
        counts.byZone.frigo++;
      } else if (lowerName.includes('secco-sopra') || lowerName.includes('sc03')) {
        counts.byZone['secco-sopra']++;
      } else if (lowerName.includes('secco') || lowerName.includes('sc02')) {
        counts.byZone.secco++;
      } else if (lowerName.includes('pingu') || lowerName.includes('pn01')) {
        counts.byZone.pingu++;
      }
    }

    console.log(`✅ Conteggi calcolati (scadenze):`, counts);

    // STEP 5: Calcola prodotti non movimentati (30 giorni e 90 giorni)
    console.log('📊 Calcolo prodotti non movimentati...');

    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const ninetyDaysAgo = new Date(today);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Recupera tutti i prodotti con stock disponibile
    const allQuants = await rpcClient.searchRead(
      'stock.quant',
      [
        ['quantity', '>', 0],
        ['location_id.usage', '=', 'internal'],
        ['location_id', '!=', 648] // Escludi MERCE DETERIORATA (Scarti)
      ],
      ['id', 'product_id', 'location_id'],
      0
    );

    console.log(`✅ Trovati ${allQuants.length} quants totali`);

    // Mappa prodotto -> ultimo movimento
    const productLastMove = new Map<number, Date>();

    // Per ogni prodotto, trova l'ultimo movimento (IN o OUT)
    if (allQuants.length > 0) {
      const allProductIds = Array.from(new Set(allQuants.map((q: any) => q.product_id[0])));

      // Cerca TUTTI i movimenti completati (incoming, outgoing, internal)
      // per capire quando il prodotto è stato movimentato l'ultima volta
      const moveLines = await rpcClient.searchRead(
        'stock.move',
        [
          ['product_id', 'in', allProductIds],
          ['state', '=', 'done'],
          // Consideriamo sia IN (incoming) che OUT (outgoing)
          // Non includiamo 'internal' perché sono movimenti interni che non indicano vendita o carico
        ],
        ['id', 'product_id', 'date', 'picking_code'],
        0,
        'date desc'
      );

      console.log(`✅ Trovate ${moveLines.length} move lines completate (IN e OUT)`);

      // Costruisci mappa prodotto -> ultima data movimento (qualsiasi tipo)
      for (const move of moveLines) {
        const productId = move.product_id[0];
        const moveDate = new Date(move.date);
        const pickingCode = move.picking_code;

        // Consideriamo solo incoming (arrivi) e outgoing (vendite)
        if (pickingCode === 'incoming' || pickingCode === 'outgoing') {
          if (!productLastMove.has(productId) || moveDate > productLastMove.get(productId)!) {
            productLastMove.set(productId, moveDate);
          }
        }
      }
    }

    // Conta prodotti non movimentati
    for (const quant of allQuants) {
      const productId = quant.product_id[0];
      const lastMoveDate = productLastMove.get(productId);

      if (!lastMoveDate) {
        // Nessun movimento registrato -> conta come 90+ giorni
        counts.byUrgency['no-movement-90']++;
      } else {
        const daysSinceLastMove = Math.floor((today.getTime() - lastMoveDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysSinceLastMove >= 90) {
          counts.byUrgency['no-movement-90']++;
        } else if (daysSinceLastMove >= 30) {
          counts.byUrgency['no-movement-30']++;
        }
      }
    }

    console.log(`✅ Conteggi finali (con non movimentati):`, counts);

    return NextResponse.json({
      success: true,
      counts
    } as GetExpiryCountsResponse);

  } catch (error: any) {
    console.error('❌ Errore calcolo conteggi scadenze:', error);

    return NextResponse.json(
      {
        success: false,
        counts: {
          byUrgency: { expired: 0, expiring: 0, ok: 0, all: 0, 'no-movement-30': 0, 'no-movement-90': 0 },
          byZone: {}
        },
        error: error.message || 'Errore interno del server'
      } as GetExpiryCountsResponse,
      { status: 500 }
    );
  }
}
