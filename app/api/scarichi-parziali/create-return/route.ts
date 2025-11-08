import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const ODOO_URL = process.env.ODOO_URL || 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';

async function callOdoo(sessionId: string, model: string, method: string, args: any[] = [], kwargs: any = {}) {
  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `session_id=${sessionId}`
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model,
        method,
        args,
        kwargs
      },
      id: Math.floor(Math.random() * 1000000000)
    })
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`Errore ${model}.${method}: ${JSON.stringify(data.error)}`);
  }

  return data.result;
}

interface ProductNotDelivered {
  nome: string;
  quantitaRichiesta: number;
  quantitaEffettiva: number;
  uom: string;
}

interface ResidualOrder {
  numeroOrdineResiduo: string;
  cliente: string;
  dataPrevisita: string;
  salesOrder: string;
  outCompletato: string;
  prodottiNonScaricati: ProductNotDelivered[];
  messaggiScaricoParziale: any[];
  haScarichiParziali: boolean;
}

// Determina la zona buffer in base al nome del prodotto
function determineBufferZone(productName: string): 'frigo' | 'pingu' | 'sopra' {
  const nameLower = productName.toLowerCase();

  // Frozen products → Pingu
  if (
    nameLower.includes('gelato') ||
    nameLower.includes('surgelat') ||
    nameLower.includes('congelat') ||
    nameLower.includes('frozen')
  ) {
    return 'pingu';
  }

  // Refrigerated products → Frigo
  if (
    nameLower.includes('mozzarella') ||
    nameLower.includes('burrata') ||
    nameLower.includes('fiordilatte') ||
    nameLower.includes('bufala') ||
    nameLower.includes('formaggio') ||
    nameLower.includes('formaggi') ||
    nameLower.includes('parmigiano') ||
    nameLower.includes('grana') ||
    nameLower.includes('gorgonzola') ||
    nameLower.includes('scamorza') ||
    nameLower.includes('ricotta') ||
    nameLower.includes('mascarpone') ||
    nameLower.includes('pecorino') ||
    nameLower.includes('salame') ||
    nameLower.includes('salami') ||
    nameLower.includes('prosciutto') ||
    nameLower.includes('pancetta') ||
    nameLower.includes('guanciale') ||
    nameLower.includes('speck') ||
    nameLower.includes('mortadella') ||
    nameLower.includes('bresaola') ||
    nameLower.includes('coppa') ||
    nameLower.includes('salsiccia') ||
    nameLower.includes('nduja') ||
    nameLower.includes('culatta') ||
    nameLower.includes('finocchiona') ||
    nameLower.includes('lardo') ||
    nameLower.includes('tartufo') ||
    nameLower.includes('pesto') ||
    nameLower.includes('sugo') ||
    nameLower.includes('ragu')
  ) {
    return 'frigo';
  }

  // Dry goods → Sopra
  return 'sopra';
}

export async function POST(request: NextRequest) {
  try {
    // Autentica con sessione utente
    const cookieStore = cookies();
    const sessionId = cookieStore.get('odoo_session_id')?.value;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Non autenticato' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { ordine } = body as { ordine: ResidualOrder };

    if (!ordine || !ordine.prodottiNonScaricati || ordine.prodottiNonScaricati.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Nessun prodotto da rientrare' },
        { status: 400 }
      );
    }

    console.log(`🔄 Creazione reso per ordine ${ordine.numeroOrdineResiduo}`);

    // STEP 1: Cerca il picking residuo originale per ottenere l'autista/furgone
    const pickingsOriginali = await callOdoo(sessionId, 'stock.picking', 'search_read', [[
      ['name', '=', ordine.numeroOrdineResiduo]
    ]], {
      fields: ['id', 'name', 'location_id', 'move_ids_without_package']
    });

    if (pickingsOriginali.length === 0) {
      throw new Error(`Ordine residuo ${ordine.numeroOrdineResiduo} non trovato in Odoo`);
    }

    const pickingOriginale = pickingsOriginali[0];

    // STEP 2: Trova la location del furgone (dovrebbe essere WH/Furgoni/NomeAutista)
    const vanLocationId = pickingOriginale.location_id[0];
    const vanLocationName = pickingOriginale.location_id[1];

    console.log(`📍 Location furgone: ${vanLocationName} (ID: ${vanLocationId})`);

    // STEP 3: Leggi i dettagli dei move_ids per ottenere product_id
    const moveIds = pickingOriginale.move_ids_without_package;

    if (!moveIds || moveIds.length === 0) {
      throw new Error('Nessun prodotto trovato nell\'ordine residuo');
    }

    const moves = await callOdoo(sessionId, 'stock.move', 'read', [moveIds], {
      fields: ['product_id', 'product_uom_qty', 'quantity', 'product_uom']
    });

    console.log(`📦 Trovati ${moves.length} prodotti nell'ordine residuo`);

    // STEP 4: Cerca le ubicazioni buffer
    console.log('🔍 Ricerca ubicazioni buffer...');

    const bufferLocations = await callOdoo(sessionId, 'stock.location', 'search_read', [[
      ['complete_name', 'ilike', 'WH/Deposito/'],
      ['usage', '=', 'internal']
    ]], {
      fields: ['id', 'name', 'complete_name']
    });

    console.log(`📦 Trovate ${bufferLocations.length} ubicazioni buffer`);

    // Mappa zone buffer → ID
    const bufferZoneIds: { [key: string]: number | null } = {
      frigo: null,
      pingu: null,
      sopra: null
    };

    for (const location of bufferLocations) {
      const name = location.complete_name.toLowerCase();

      if (name.includes('frigo')) {
        bufferZoneIds.frigo = location.id;
      } else if (name.includes('pingu')) {
        bufferZoneIds.pingu = location.id;
      } else if (name.includes('sopra')) {
        bufferZoneIds.sopra = location.id;
      }
    }

    console.log('📍 Mapping ubicazioni buffer:', bufferZoneIds);

    // STEP 5: Raggruppa prodotti per zona buffer
    const productsByZone: {
      [key: string]: Array<{ productId: number; productName: string; qty: number; uom: any }>;
    } = {
      frigo: [],
      pingu: [],
      sopra: []
    };

    for (const move of moves) {
      // Trova il prodotto corrispondente in prodottiNonScaricati
      const prodottoNonScaricato = ordine.prodottiNonScaricati.find(
        p => p.nome === move.product_id[1]
      );

      if (!prodottoNonScaricato) {
        console.log(`⚠️  Prodotto ${move.product_id[1]} non trovato in prodottiNonScaricati, skip`);
        continue;
      }

      const quantitaDaRientro = prodottoNonScaricato.quantitaRichiesta - prodottoNonScaricato.quantitaEffettiva;

      if (quantitaDaRientro <= 0) {
        console.log(`⚠️  Prodotto ${move.product_id[1]} ha quantità da rientro <= 0, skip`);
        continue;
      }

      // Determina zona buffer
      const zone = determineBufferZone(move.product_id[1]);

      productsByZone[zone].push({
        productId: move.product_id[0],
        productName: move.product_id[1],
        qty: quantitaDaRientro,
        uom: move.product_uom
      });

      console.log(`  ✓ ${move.product_id[1]} → ${zone.toUpperCase()} (${quantitaDaRientro} ${prodottoNonScaricato.uom})`);
    }

    // STEP 6: Crea un internal transfer per ogni zona buffer
    const createdTransfers = [];

    for (const [zoneName, zoneProducts] of Object.entries(productsByZone)) {
      if (zoneProducts.length === 0) continue;

      const bufferLocationId = bufferZoneIds[zoneName];

      if (!bufferLocationId) {
        console.warn(`⚠️  Ubicazione buffer non trovata per zona: ${zoneName}, skip...`);
        continue;
      }

      console.log(`📤 Creazione transfer per zona ${zoneName} (${zoneProducts.length} prodotti)`);

      // Crea stock.picking (Internal Transfer: Furgone → Buffer)
      const pickingId = await callOdoo(sessionId, 'stock.picking', 'create', [{
        picking_type_id: 5, // Internal Transfer
        location_id: vanLocationId,
        location_dest_id: bufferLocationId,
        origin: `RESO_${ordine.numeroOrdineResiduo}_${zoneName.toUpperCase()}`,
        note: `Reso scarico parziale - Cliente: ${ordine.cliente}\nSales Order: ${ordine.salesOrder}\nCreato: ${new Date().toLocaleString('it-IT')}`
      }]);

      console.log(`✅ Picking ${pickingId} creato per zona ${zoneName}`);

      // Crea stock.move per ogni prodotto
      const movesCreated = [];

      for (const product of zoneProducts) {
        const moveId = await callOdoo(sessionId, 'stock.move', 'create', [{
          name: product.productName,
          picking_id: pickingId,
          product_id: product.productId,
          product_uom_qty: product.qty,
          product_uom: product.uom[0],
          location_id: vanLocationId,
          location_dest_id: bufferLocationId
        }]);

        movesCreated.push(moveId);
        console.log(`  ✓ Move ${moveId} creato: ${product.productName} x${product.qty}`);
      }

      // Conferma il picking
      try {
        await callOdoo(sessionId, 'stock.picking', 'action_confirm', [[pickingId]]);
        console.log(`✅ Picking ${pickingId} confermato`);

        // Assegna quantità
        await callOdoo(sessionId, 'stock.picking', 'action_assign', [[pickingId]]);
        console.log(`✅ Picking ${pickingId} assegnato`);

        // Valida il picking (completa il trasferimento)
        // NOTA: Potrebbe essere necessario impostare le quantità effettive prima
        // Per ora lo lasciamo in stato "Ready" per validazione manuale

      } catch (error) {
        console.warn(`⚠️  Errore conferma/assegnazione picking ${pickingId}:`, error);
      }

      createdTransfers.push({
        pickingId,
        zone: zoneName,
        productsCount: zoneProducts.length,
        movesCreated: movesCreated.length
      });
    }

    console.log(`✅ Completato! ${createdTransfers.length} transfer creati`);

    return NextResponse.json({
      success: true,
      transfers: createdTransfers,
      message: `${createdTransfers.length} resi creati con successo da ${vanLocationName} verso buffer`
    });

  } catch (error: any) {
    console.error('❌ Errore creazione reso:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Errore del server'
    }, { status: 500 });
  }
}
