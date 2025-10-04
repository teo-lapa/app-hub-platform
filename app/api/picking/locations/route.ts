import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';

// Mappatura delle zone come nell'HTML
const ZONE_MAPPING: Record<string, string> = {
  'secco': 'SECCO',
  'secco-sopra': 'SECCO SOPRA',
  'pingu': 'PINGU',
  'frigo': 'FRIGO'
};

export async function POST(request: NextRequest) {
  try {
    const { zone, batchId } = await request.json();

    console.log(`📍 Recupero ubicazioni REALI per zona ${zone} da Odoo...`);

    // Recupera session da cookie
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('odoo_session');

    if (!sessionCookie?.value) {
      return NextResponse.json(
        { error: 'Sessione non valida - effettua il login' },
        { status: 401 }
      );
    }

    const sessionData = JSON.parse(sessionCookie.value);

    // Crea client RPC
    const rpcClient = createOdooRPCClient(sessionData.sessionId);

    // Se abbiamo un batch, recupera prima i picking e poi le move lines
    let locations: any[] = [];

    if (batchId) {
      // Recupera i picking del batch
      const pickings = await rpcClient.getBatchPickings(batchId);
      const pickingIds = pickings.map((p: any) => p.id);

      console.log(`📦 Trovati ${pickingIds.length} picking nel batch ${batchId}`);

      if (pickingIds.length > 0) {
        // Recupera tutte le move lines dei picking
        const moveLines = await rpcClient.getMoveLinesByLocation(pickingIds);

        console.log(`📋 Trovate ${moveLines.length} move lines totali`);

        // Estrai le ubicazioni uniche dalle move lines
        const locationMap = new Map();

        for (const line of moveLines) {
          if (line.location_id && Array.isArray(line.location_id)) {
            const [locationId, locationName] = line.location_id;

            // Filtra per zona se specificata
            if (zone && zone !== 'all') {
              const zoneName = ZONE_MAPPING[zone];
              if (zoneName && !locationName.includes(zoneName)) {
                continue;
              }
            }

            if (!locationMap.has(locationId)) {
              locationMap.set(locationId, {
                id: locationId,
                name: locationName,
                barcode: `LOC${locationId}`, // Barcode di default se non disponibile
                zone: zone || 'unknown',
                products: 0
              });
            }

            // Conta i prodotti per ubicazione
            locationMap.get(locationId).products++;
          }
        }

        locations = Array.from(locationMap.values());
        console.log(`✅ Trovate ${locations.length} ubicazioni con prodotti da prelevare`);
      }
    } else {
      // Se non abbiamo un batch, recupera tutte le ubicazioni della zona
      const zonePath = ZONE_MAPPING[zone] || zone;

      if (zonePath) {
        const odooLocations = await rpcClient.getLocationsByZone(zonePath);

        locations = odooLocations.map((loc: any) => ({
          id: loc.id,
          name: loc.complete_name || loc.name,
          barcode: loc.barcode || `LOC${loc.id}`,
          zone: zone,
          products: 0 // Non sappiamo quanti prodotti senza un batch specifico
        }));

        console.log(`✅ Trovate ${locations.length} ubicazioni nella zona ${zonePath}`);
      }
    }

    // Ordina per nome ubicazione
    locations.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({
      locations: locations,
      count: locations.length,
      source: 'odoo-rpc-live'
    });

  } catch (error: any) {
    console.error('❌ Errore recupero ubicazioni:', error);

    return NextResponse.json(
      {
        error: 'Errore nel recupero delle ubicazioni',
        details: error.message,
        locations: [],
        count: 0
      },
      { status: 500 }
    );
  }
}