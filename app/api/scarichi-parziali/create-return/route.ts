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

    // STEP 3.5: Leggi i lotti dal picking originale
    console.log('🔍 Ricerca lotti dal picking originale...');

    const moveLines = await callOdoo(sessionId, 'stock.move.line', 'search_read', [[
      ['picking_id', '=', pickingOriginale.id],
      ['state', '!=', 'cancel']
    ]], {
      fields: ['product_id', 'lot_id', 'lot_name', 'quantity', 'location_id']
    });

    // Crea mapping product_id -> lot info
    const productLotMap = new Map();
    for (const ml of moveLines) {
      if (ml.lot_id && ml.product_id) {
        productLotMap.set(ml.product_id[0], {
          lot_id: ml.lot_id[0],
          lot_name: ml.lot_id[1]
        });
        console.log(`  📦 Prodotto ${ml.product_id[1]} → Lotto ${ml.lot_id[1]}`);
      }
    }

    // STEP 4: Cerca l'ubicazione Deposito
    console.log('🔍 Ricerca ubicazione Deposito...');

    const depositoLocations = await callOdoo(sessionId, 'stock.location', 'search_read', [[
      ['complete_name', '=', 'WH/Deposito'],
      ['usage', '=', 'internal']
    ]], {
      fields: ['id', 'name', 'complete_name']
    });

    if (depositoLocations.length === 0) {
      throw new Error('Ubicazione WH/Deposito non trovata');
    }

    const depositoLocationId = depositoLocations[0].id;
    console.log(`📦 Ubicazione Deposito: ${depositoLocations[0].complete_name} (ID: ${depositoLocationId})`);

    // STEP 5: Prepara lista prodotti da rientrare
    const productsToReturn: Array<{ productId: number; productName: string; qty: number; uom: any }> = [];

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

      productsToReturn.push({
        productId: move.product_id[0],
        productName: move.product_id[1],
        qty: quantitaDaRientro,
        uom: move.product_uom
      });

      console.log(`  ✓ ${move.product_id[1]} (${quantitaDaRientro} ${prodottoNonScaricato.uom})`);
    }

    if (productsToReturn.length === 0) {
      throw new Error('Nessun prodotto da rientrare');
    }

    // STEP 6: Crea un unico internal transfer verso Deposito
    console.log(`📤 Creazione transfer verso Deposito (${productsToReturn.length} prodotti)`);

    // Crea stock.picking (Internal Transfer: Furgone → Deposito)
    const pickingId = await callOdoo(sessionId, 'stock.picking', 'create', [{
      picking_type_id: 5, // Internal Transfer
      location_id: vanLocationId,
      location_dest_id: depositoLocationId,
      origin: `RESO_${ordine.numeroOrdineResiduo}`,
      note: `Reso scarico parziale - Cliente: ${ordine.cliente}\nSales Order: ${ordine.salesOrder}\nCreato: ${new Date().toLocaleString('it-IT')}`
    }]);

    console.log(`✅ Picking ${pickingId} creato`);

    // Crea stock.move per ogni prodotto
    const movesCreated = [];

    for (const product of productsToReturn) {
      const moveId = await callOdoo(sessionId, 'stock.move', 'create', [{
        name: product.productName,
        picking_id: pickingId,
        product_id: product.productId,
        product_uom_qty: product.qty,
        product_uom: product.uom[0],
        location_id: vanLocationId,
        location_dest_id: depositoLocationId
      }]);

      movesCreated.push({ moveId, product });
      console.log(`  ✓ Move ${moveId} creato: ${product.productName} x${product.qty}`);
    }

    // Conferma il picking
    try {
      await callOdoo(sessionId, 'stock.picking', 'action_confirm', [[pickingId]]);
      console.log(`✅ Picking ${pickingId} confermato`);

      // STEP 7: Crea manualmente le stock.move.line con qty_done e lotti già impostati
      console.log('📝 Creazione operazioni dettagliate...');

      for (const { moveId, product } of movesCreated) {
        const lotInfo = productLotMap.get(product.productId);

        const moveLineData: any = {
          move_id: moveId,
          picking_id: pickingId,
          product_id: product.productId,
          product_uom_id: product.uom[0],
          location_id: vanLocationId,
          location_dest_id: depositoLocationId,
          quantity: product.qty,
          qty_done: product.qty  // Imposta qty_done subito con la quantità richiesta
        };

        // Se esiste un lotto, impostalo
        if (lotInfo) {
          moveLineData.lot_id = lotInfo.lot_id;
          console.log(`  ✓ Creazione move line: ${product.productName} x${product.qty}, lotto=${lotInfo.lot_name}`);
        } else {
          console.log(`  ✓ Creazione move line: ${product.productName} x${product.qty} (nessun lotto)`);
        }

        await callOdoo(sessionId, 'stock.move.line', 'create', [moveLineData]);
      }

      console.log(`✅ Operazioni dettagliate create con successo!`);

      // Assegna il picking (ora dovrebbe riconoscere le move.line già create)
      await callOdoo(sessionId, 'stock.picking', 'action_assign', [[pickingId]]);
      console.log(`✅ Picking ${pickingId} assegnato`);

    } catch (error) {
      console.warn(`⚠️  Errore conferma/assegnazione picking ${pickingId}:`, error);
    }

    console.log(`✅ Transfer creato con successo!`);

    return NextResponse.json({
      success: true,
      transfer: {
        pickingId,
        productsCount: productsToReturn.length,
        movesCreated: movesCreated.length
      },
      message: `Reso creato con successo da ${vanLocationName} verso Deposito`
    });

  } catch (error: any) {
    console.error('❌ Errore creazione reso:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Errore del server'
    }, { status: 500 });
  }
}
