import { NextRequest, NextResponse } from 'next/server';
import { getOdooClient } from '@/lib/odoo-client';

export async function POST(req: NextRequest) {
  try {
    const { locationId } = await req.json();

    if (!locationId) {
      return NextResponse.json({
        success: false,
        error: 'Location ID richiesto'
      });
    }

    const client = await getOdooClient();

    // Cerca quants nell'ubicazione
    const quants = await client.searchRead(
      'stock.quant',
      [
        ['location_id', '=', locationId],
        ['quantity', '>', 0]
      ],
      [
        'id', 'product_id', 'location_id', 'lot_id', 'quantity',
        'inventory_quantity', 'inventory_date', 'inventory_diff_quantity',
        'user_id', 'product_uom_id'
      ],
      100
    );

    if (!quants || quants.length === 0) {
      return NextResponse.json({
        success: true,
        products: []
      });
    }

    // Raggruppa per prodotto
    const productMap = new Map<number, any>();

    for (const quant of quants) {
      const productId = quant.product_id[0];

      if (!productMap.has(productId)) {
        // Carica dettagli prodotto
        const products = await client.searchRead(
          'product.product',
          [['id', '=', productId]],
          ['id', 'name', 'default_code', 'barcode', 'image_128'],
          1
        );

        if (products && products.length > 0) {
          const product = products[0];
          productMap.set(productId, {
            id: productId,
            name: quant.product_id[1],
            code: product.default_code,
            barcode: product.barcode,
            image: product.image_128 ? `data:image/png;base64,${product.image_128}` : null,
            totalQty: 0,
            uom: quant.product_uom_id ? quant.product_uom_id[1] : 'Unit',
            lots: [],
            isCounted: false,
            isCountedRecent: false,
            lastCountDate: null,
            lastCountUser: null,
            inventoryQuantity: null,
            inventoryDiff: null
          });
        }
      }

      const productData = productMap.get(productId);
      if (productData) {
        productData.totalQty += quant.quantity;

        // Aggiorna info conteggio
        if (quant.inventory_quantity !== null && quant.inventory_quantity !== false) {
          productData.inventoryQuantity = quant.inventory_quantity;
          productData.inventoryDiff = quant.inventory_diff_quantity || 0;

          if (quant.inventory_date) {
            productData.lastCountDate = quant.inventory_date;
            productData.isCounted = true;

            // Verifica se contato negli ultimi 5 giorni
            const countDate = new Date(quant.inventory_date);
            const today = new Date();
            const fiveDaysAgo = new Date(today.getTime() - (5 * 24 * 60 * 60 * 1000));
            productData.isCountedRecent = countDate >= fiveDaysAgo;
          }

          if (quant.user_id && quant.user_id[1]) {
            productData.lastCountUser = quant.user_id[1];
          }
        }

        // Gestisci lotti
        if (quant.lot_id) {
          const existingLot = productData.lots.find((l: any) => l.id === quant.lot_id[0]);
          if (existingLot) {
            existingLot.qty += quant.quantity;
          } else {
            // Carica dettagli lotto
            const lots = await client.searchRead(
              'stock.lot',
              [['id', '=', quant.lot_id[0]]],
              ['id', 'name', 'expiration_date'],
              1
            );

            const lotData = {
              id: quant.lot_id[0],
              name: quant.lot_id[1],
              qty: quant.quantity,
              expiry_date: lots && lots[0] ? lots[0].expiration_date : null,
              inventoryQuantity: quant.inventory_quantity,
              lastCountDate: quant.inventory_date,
              lastCountUser: quant.user_id ? quant.user_id[1] : null,
              inventoryDiff: quant.inventory_diff_quantity || null,
              isCountedRecent: false
            };

            if (lotData.lastCountDate) {
              const countDate = new Date(lotData.lastCountDate);
              const today = new Date();
              const fiveDaysAgo = new Date(today.getTime() - (5 * 24 * 60 * 60 * 1000));
              lotData.isCountedRecent = countDate >= fiveDaysAgo;
            }

            productData.lots.push(lotData);
          }
        } else {
          const noLot = productData.lots.find((l: any) => !l.id);
          if (noLot) {
            noLot.qty += quant.quantity;
          } else {
            productData.lots.push({
              id: null,
              name: 'Senza lotto',
              qty: quant.quantity
            });
          }
        }
      }
    }

    const products = Array.from(productMap.values());

    return NextResponse.json({
      success: true,
      products
    });

  } catch (error) {
    console.error('Errore caricamento prodotti:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore nel caricamento dei prodotti'
    });
  }
}