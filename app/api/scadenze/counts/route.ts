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
    const sessionCookie = cookieStore.get('odoo_session');

    if (!sessionCookie?.value) {
      return NextResponse.json(
        {
          success: false,
          counts: {
            byUrgency: { expired: 0, expiring: 0, ok: 0, all: 0 },
            byZone: {}
          },
          error: 'Sessione non valida - effettua il login'
        } as GetExpiryCountsResponse,
        { status: 401 }
      );
    }

    const sessionData = JSON.parse(sessionCookie.value);

    // Crea client RPC
    const rpcClient = createOdooRPCClient(sessionData.sessionId);

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
        ['location_id.usage', '=', 'internal']
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
        all: 0
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

    console.log(`✅ Conteggi calcolati:`, counts);

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
          byUrgency: { expired: 0, expiring: 0, ok: 0, all: 0 },
          byZone: {}
        },
        error: error.message || 'Errore interno del server'
      } as GetExpiryCountsResponse,
      { status: 500 }
    );
  }
}
