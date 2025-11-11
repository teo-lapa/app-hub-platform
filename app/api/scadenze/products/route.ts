import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';
import { GetExpiryProductsResponse, ExpiryProduct, ExpirySummary } from '@/lib/types/expiry';

// Mappatura location -> zona
const ZONE_MAP: Record<number, string> = {
  28: 'frigo',
  29: 'secco',
  30: 'secco-sopra',
  31: 'pingu'
};

export async function GET(request: NextRequest) {
  try {
    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const urgency = searchParams.get('urgency') || 'all';
    const zone = searchParams.get('zone') || undefined;
    const days = parseInt(searchParams.get('days') || '7');

    console.log('🔍 Ricerca prodotti:', { urgency, zone, days });

    // Se urgency è no-movement-30 o no-movement-90, usa logica diversa
    if (urgency === 'no-movement-30' || urgency === 'no-movement-90') {
      return await getNoMovementProducts(request, urgency, zone);
    }

    // Recupera session da cookie
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('odoo_session_id');

    if (!sessionCookie?.value) {
      return NextResponse.json(
        {
          success: false,
          products: [],
          summary: { total: 0, totalValue: 0, byUrgency: { expired: 0, expiring: 0, ok: 0 } },
          error: 'Sessione non valida - effettua il login'
        } as GetExpiryProductsResponse,
        { status: 401 }
      );
    }

    const sessionId = sessionCookie.value;

    // Crea client RPC
    const rpcClient = createOdooRPCClient(sessionId);

    // STEP 1: Cerca tutti i lotti con expiration_date
    console.log('📦 Recupero lotti con scadenza...');
    const lots = await rpcClient.searchRead(
      'stock.lot',
      [['expiration_date', '!=', false]],
      ['id', 'name', 'product_id', 'expiration_date'],
      0,
      'expiration_date asc'
    );

    console.log(`✅ Trovati ${lots.length} lotti con scadenza`);

    if (lots.length === 0) {
      return NextResponse.json({
        success: true,
        products: [],
        summary: {
          total: 0,
          totalValue: 0,
          byUrgency: { expired: 0, expiring: 0, ok: 0 },
          byZone: {}
        }
      } as GetExpiryProductsResponse);
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
        ['location_id', '!=', 648], // Escludi MERCE DETERIORATA (Scarti)
        ['location_id.complete_name', 'not ilike', '%FURGONI%'] // Escludi ubicazioni furgoni
      ],
      ['id', 'product_id', 'lot_id', 'location_id', 'quantity'],
      0
    );

    console.log(`✅ Trovati ${quants.length} quants con quantità disponibile`);

    if (quants.length === 0) {
      return NextResponse.json({
        success: true,
        products: [],
        summary: {
          total: 0,
          totalValue: 0,
          byUrgency: { expired: 0, expiring: 0, ok: 0 },
          byZone: {}
        }
      } as GetExpiryProductsResponse);
    }

    // STEP 3: Recupera informazioni complete sui prodotti
    const productIds = Array.from(new Set(quants.map((q: any) => q.product_id[0])));
    console.log(`📦 Recupero informazioni per ${productIds.length} prodotti...`);

    const products = await rpcClient.searchRead(
      'product.product',
      [['id', 'in', productIds]],
      ['id', 'name', 'default_code', 'barcode', 'image_128', 'uom_id', 'standard_price'],
      0
    );

    // Crea mappa prodotto ID -> prodotto
    const productMap = new Map(products.map((p: any) => [p.id, p]));

    // Crea mappa lotto ID -> lotto
    const lotMap = new Map(lots.map((l: any) => [l.id, l]));

    // STEP 4: Calcola oggi e costruisci ExpiryProduct[]
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expiryProducts: ExpiryProduct[] = [];

    for (const quant of quants) {
      const lotId = quant.lot_id[0];
      const lot = lotMap.get(lotId);
      if (!lot) continue;

      const productId = quant.product_id[0];
      const product = productMap.get(productId);
      if (!product) continue;

      // Calcola giorni alla scadenza
      const expirationDate = new Date(lot.expiration_date);
      expirationDate.setHours(0, 0, 0, 0);
      const daysUntilExpiry = Math.floor((expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      // Determina urgency level
      let urgencyLevel: 'expired' | 'expiring' | 'ok';
      if (daysUntilExpiry < 0) {
        urgencyLevel = 'expired';
      } else if (daysUntilExpiry <= days) {
        urgencyLevel = 'expiring';
      } else {
        urgencyLevel = 'ok';
      }

      // Filtra per urgency
      if (urgency !== 'all' && urgencyLevel !== urgency) {
        continue;
      }

      // Estrai location info
      const locationId = quant.location_id[0];
      const locationCompleteName = quant.location_id[1] || '';

      // Estrai nome location (ultima parte)
      const locationParts = locationCompleteName.split('/');
      const locationName = locationParts[locationParts.length - 1] || locationCompleteName;

      // Determina zona in base alla location
      // Cerca nel complete_name i buffer ID per mappare la zona
      let zoneId: string | undefined = undefined;

      // Cerca nel nome completo della location per trovare la zona
      // Es: "Physical Locations/Frigo/..." -> frigo
      const lowerName = locationCompleteName.toLowerCase();
      if (lowerName.includes('frigo') || lowerName.includes('fr02')) {
        zoneId = 'frigo';
      } else if (lowerName.includes('secco-sopra') || lowerName.includes('sc03')) {
        zoneId = 'secco-sopra';
      } else if (lowerName.includes('secco') || lowerName.includes('sc02')) {
        zoneId = 'secco';
      } else if (lowerName.includes('pingu') || lowerName.includes('pn01')) {
        zoneId = 'pingu';
      }

      // Filtra per zona se specificata
      if (zone && zoneId !== zone) {
        continue;
      }

      // Calcola valore stimato
      const standardPrice = product.standard_price || 0;
      const estimatedValue = standardPrice * quant.quantity;

      // Costruisci ExpiryProduct
      const expiryProduct: ExpiryProduct = {
        id: product.id, // ID del prodotto, NON del quant!
        name: product.name || '',
        code: product.default_code || '',
        barcode: product.barcode || '',
        image: product.image_128 || undefined,
        quantity: quant.quantity,
        uom: product.uom_id?.[1] || 'Pz',

        // Lotto e scadenza
        lotId: lot.id,
        lotName: lot.name,
        expirationDate: lot.expiration_date.split(' ')[0], // YYYY-MM-DD
        daysUntilExpiry,

        // Ubicazione
        locationId,
        locationName,
        locationCompleteName,
        zoneId,

        // Urgenza
        urgencyLevel,

        // Valore
        estimatedValue
      };

      expiryProducts.push(expiryProduct);
    }

    console.log(`✅ Elaborati ${expiryProducts.length} prodotti in scadenza`);

    // STEP 5: Costruisci summary
    const summary: ExpirySummary = {
      total: expiryProducts.length,
      totalValue: expiryProducts.reduce((sum, p) => sum + (p.estimatedValue || 0), 0),
      byUrgency: {
        expired: expiryProducts.filter(p => p.urgencyLevel === 'expired').length,
        expiring: expiryProducts.filter(p => p.urgencyLevel === 'expiring').length,
        ok: expiryProducts.filter(p => p.urgencyLevel === 'ok').length
      },
      byZone: {}
    };

    // Conta per zona
    for (const product of expiryProducts) {
      if (product.zoneId) {
        summary.byZone![product.zoneId] = (summary.byZone![product.zoneId] || 0) + 1;
      }
    }

    // Ordina per giorni alla scadenza (prima quelli più vicini)
    expiryProducts.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

    return NextResponse.json({
      success: true,
      products: expiryProducts,
      summary
    } as GetExpiryProductsResponse);

  } catch (error: any) {
    console.error('❌ Errore recupero prodotti in scadenza:', error);

    return NextResponse.json(
      {
        success: false,
        products: [],
        summary: {
          total: 0,
          totalValue: 0,
          byUrgency: { expired: 0, expiring: 0, ok: 0 }
        },
        error: error.message || 'Errore interno del server'
      } as GetExpiryProductsResponse,
      { status: 500 }
    );
  }
}

/**
 * Gestisce la ricerca di prodotti non movimentati (30 o 90 giorni)
 */
async function getNoMovementProducts(
  request: NextRequest,
  urgency: 'no-movement-30' | 'no-movement-90',
  zone?: string
) {
  try {
    const daysThreshold = urgency === 'no-movement-30' ? 30 : 90;
    console.log(`📦 Ricerca prodotti non movimentati da ${daysThreshold} giorni...`);

    // Recupera session da cookie
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('odoo_session_id');

    if (!sessionCookie?.value) {
      return NextResponse.json(
        {
          success: false,
          products: [],
          summary: { total: 0, totalValue: 0, byUrgency: { expired: 0, expiring: 0, ok: 0 } },
          error: 'Sessione non valida - effettua il login'
        } as GetExpiryProductsResponse,
        { status: 401 }
      );
    }

    const sessionId = sessionCookie.value;
    const rpcClient = createOdooRPCClient(sessionId);

    // STEP 1: Recupera tutti i quants con stock disponibile
    const quants = await rpcClient.searchRead(
      'stock.quant',
      [
        ['quantity', '>', 0],
        ['location_id.usage', '=', 'internal'],
        ['location_id', '!=', 648], // Escludi MERCE DETERIORATA (Scarti)
        ['location_id.complete_name', 'not ilike', '%FURGONI%'] // Escludi ubicazioni furgoni
      ],
      ['id', 'product_id', 'location_id', 'quantity'],
      0
    );

    console.log(`✅ Trovati ${quants.length} quants con stock`);

    if (quants.length === 0) {
      return NextResponse.json({
        success: true,
        products: [],
        summary: {
          total: 0,
          totalValue: 0,
          byUrgency: { expired: 0, expiring: 0, ok: 0 },
          byZone: {}
        }
      } as GetExpiryProductsResponse);
    }

    // STEP 2: Recupera informazioni prodotti
    const productIds = Array.from(new Set(quants.map((q: any) => q.product_id[0])));
    console.log(`📦 Recupero informazioni per ${productIds.length} prodotti...`);

    const products = await rpcClient.searchRead(
      'product.product',
      [['id', 'in', productIds]],
      ['id', 'name', 'default_code', 'barcode', 'image_128', 'uom_id', 'standard_price'],
      0
    );

    const productMap = new Map(products.map((p: any) => [p.id, p]));

    // STEP 3: Trova ultimo movimento per ogni prodotto (IN o OUT)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const moveLines = await rpcClient.searchRead(
      'stock.move',
      [
        ['product_id', 'in', productIds],
        ['state', '=', 'done'],
        // Consideriamo sia IN (incoming/arrivi) che OUT (outgoing/vendite)
      ],
      ['id', 'product_id', 'date', 'picking_code'],
      0,
      'date desc'
    );

    console.log(`✅ Trovate ${moveLines.length} move lines completate (IN e OUT)`);

    // Costruisci mappa prodotto -> ultima data movimento (IN o OUT)
    const productLastMove = new Map<number, Date>();
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

    // STEP 4: Filtra prodotti per soglia di giorni
    const expiryProducts: ExpiryProduct[] = [];

    for (const quant of quants) {
      const productId = quant.product_id[0];
      const product = productMap.get(productId);
      if (!product) continue;

      const lastMoveDate = productLastMove.get(productId);
      let daysSinceLastMove: number;

      if (!lastMoveDate) {
        // Nessun movimento registrato -> considera come 365+ giorni
        daysSinceLastMove = 365;
      } else {
        daysSinceLastMove = Math.floor((today.getTime() - lastMoveDate.getTime()) / (1000 * 60 * 60 * 24));
      }

      // Filtra in base alla soglia
      if (urgency === 'no-movement-30') {
        // Prodotti fermi da 30-89 giorni
        if (daysSinceLastMove < 30 || daysSinceLastMove >= 90) continue;
      } else if (urgency === 'no-movement-90') {
        // Prodotti fermi da 90+ giorni
        if (daysSinceLastMove < 90) continue;
      }

      // Estrai location info
      const locationId = quant.location_id[0];
      const locationCompleteName = quant.location_id[1] || '';
      const locationParts = locationCompleteName.split('/');
      const locationName = locationParts[locationParts.length - 1] || locationCompleteName;

      // Determina zona
      let zoneId: string | undefined = undefined;
      const lowerName = locationCompleteName.toLowerCase();
      if (lowerName.includes('frigo') || lowerName.includes('fr02')) {
        zoneId = 'frigo';
      } else if (lowerName.includes('secco-sopra') || lowerName.includes('sc03')) {
        zoneId = 'secco-sopra';
      } else if (lowerName.includes('secco') || lowerName.includes('sc02')) {
        zoneId = 'secco';
      } else if (lowerName.includes('pingu') || lowerName.includes('pn01')) {
        zoneId = 'pingu';
      }

      // Filtra per zona se specificata
      if (zone && zoneId !== zone) {
        continue;
      }

      // Calcola valore stimato
      const standardPrice = product.standard_price || 0;
      const estimatedValue = standardPrice * quant.quantity;

      // Costruisci ExpiryProduct (usa formato compatibile)
      const expiryProduct: ExpiryProduct = {
        id: product.id, // ID del prodotto, NON del quant!
        name: product.name || '',
        code: product.default_code || '',
        barcode: product.barcode || '',
        image: product.image_128 || undefined,
        quantity: quant.quantity,
        uom: product.uom_id?.[1] || 'Pz',

        // Per prodotti non movimentati, usiamo una data fittizia
        lotId: 0,
        lotName: `Fermo ${daysSinceLastMove}gg`,
        expirationDate: lastMoveDate ? lastMoveDate.toISOString().split('T')[0] : '1970-01-01',
        daysUntilExpiry: -daysSinceLastMove, // Negativo per indicare giorni di fermo

        // Ubicazione
        locationId,
        locationName,
        locationCompleteName,
        zoneId,

        // Urgenza (usa 'ok' come placeholder, ma il frontend saprà che è no-movement)
        urgencyLevel: 'ok',

        // Valore
        estimatedValue
      };

      expiryProducts.push(expiryProduct);
    }

    console.log(`✅ Trovati ${expiryProducts.length} prodotti non movimentati da ${daysThreshold}+ giorni`);

    // STEP 5: Costruisci summary
    const summary: ExpirySummary = {
      total: expiryProducts.length,
      totalValue: expiryProducts.reduce((sum, p) => sum + (p.estimatedValue || 0), 0),
      byUrgency: {
        expired: 0,
        expiring: 0,
        ok: expiryProducts.length
      },
      byZone: {}
    };

    // Conta per zona
    for (const product of expiryProducts) {
      if (product.zoneId) {
        summary.byZone![product.zoneId] = (summary.byZone![product.zoneId] || 0) + 1;
      }
    }

    // Ordina per giorni di fermo (prima quelli più vecchi)
    expiryProducts.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

    return NextResponse.json({
      success: true,
      products: expiryProducts,
      summary
    } as GetExpiryProductsResponse);

  } catch (error: any) {
    console.error('❌ Errore recupero prodotti non movimentati:', error);

    return NextResponse.json(
      {
        success: false,
        products: [],
        summary: {
          total: 0,
          totalValue: 0,
          byUrgency: { expired: 0, expiring: 0, ok: 0 }
        },
        error: error.message || 'Errore interno del server'
      } as GetExpiryProductsResponse,
      { status: 500 }
    );
  }
}
