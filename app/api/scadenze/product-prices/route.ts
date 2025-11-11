import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';

export interface ProductPricesResponse {
  success: boolean;
  prices?: {
    purchasePrice: number; // Prezzo d'acquisto (standard_price)
    listPrice: number; // Prezzo di listino base (list_price)
    minPrice: number; // Prezzo minimo tra tutti i listini
    maxPrice: number; // Prezzo massimo tra tutti i listini
    avgPrice: number; // Prezzo medio tra tutti i listini
    availableQuantity: number; // Quantità disponibile totale
  };
  error?: string;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const productId = searchParams.get('productId');

    if (!productId) {
      return NextResponse.json({
        success: false,
        error: 'productId richiesto'
      } as ProductPricesResponse, { status: 400 });
    }

    // Recupera session da cookie
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('odoo_session_id');

    if (!sessionCookie?.value) {
      return NextResponse.json({
        success: false,
        error: 'Sessione non valida'
      } as ProductPricesResponse, { status: 401 });
    }

    const sessionId = sessionCookie.value;
    const rpcClient = createOdooRPCClient(sessionId);

    console.log(`📊 Recupero prezzi per prodotto ${productId}...`);

    // STEP 1: Recupera informazioni base prodotto
    const products = await rpcClient.searchRead(
      'product.product',
      [['id', '=', parseInt(productId)]],
      ['id', 'name', 'standard_price', 'list_price', 'qty_available'],
      1
    );

    if (!products || products.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Prodotto non trovato'
      } as ProductPricesResponse, { status: 404 });
    }

    const product = products[0];

    // STEP 2: Recupera tutti i listini (product.pricelist.item) per questo prodotto
    const pricelistItems = await rpcClient.searchRead(
      'product.pricelist.item',
      [
        ['product_id', '=', parseInt(productId)],
        ['pricelist_id.active', '=', true]
      ],
      ['id', 'pricelist_id', 'fixed_price', 'price'],
      0
    );

    console.log(`✅ Trovati ${pricelistItems.length} listini per prodotto ${productId}`);

    // STEP 3: Calcola min, max, avg tra tutti i prezzi dei listini
    let prices: number[] = [];

    // Aggiungi il prezzo base di listino
    if (product.list_price && product.list_price > 0) {
      prices.push(product.list_price);
    }

    // Aggiungi i prezzi dai listini specifici
    for (const item of pricelistItems) {
      const price = item.fixed_price || item.price || 0;
      if (price > 0) {
        prices.push(price);
      }
    }

    // Se non ci sono prezzi, usa solo list_price
    if (prices.length === 0) {
      prices = [product.list_price || 0];
    }

    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;

    const response: ProductPricesResponse = {
      success: true,
      prices: {
        purchasePrice: product.standard_price || 0,
        listPrice: product.list_price || 0,
        minPrice: minPrice || 0,
        maxPrice: maxPrice || 0,
        avgPrice: avgPrice || 0,
        availableQuantity: product.qty_available || 0
      }
    };

    console.log(`✅ Prezzi calcolati:`, response.prices);

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('❌ Errore recupero prezzi prodotto:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Errore durante il recupero dei prezzi'
    } as ProductPricesResponse, { status: 500 });
  }
}
