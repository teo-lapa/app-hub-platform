import { NextRequest, NextResponse } from 'next/server';
import { callOdoo } from '@/lib/odoo-auth';

export async function POST(request: NextRequest) {
  try {
    const { customerName, startDate, endDate } = await request.json();

    if (!customerName) {
      return NextResponse.json(
        { error: 'Nome cliente mancante' },
        { status: 400 }
      );
    }

    const cookies = request.cookies.get('odoo_session_id')?.value || null;

    console.log(`[Analisi Clienti] Ricerca cliente: ${customerName}`);

    // Step 1: Cerca il cliente
    const partners = await callOdoo(
      cookies,
      'res.partner',
      'search_read',
      [[['name', '=', customerName]]],
      {
        fields: ['id', 'name', 'customer_rank', 'email', 'phone', 'city', 'country_id', 'vat']
      }
    );

    if (!partners || partners.length === 0) {
      return NextResponse.json(
        { error: `Cliente "${customerName}" non trovato` },
        { status: 404 }
      );
    }

    const partner = partners[0];
    console.log(`[Analisi Clienti] Cliente trovato: ${partner.name} (ID: ${partner.id})`);

    // Step 2: Cerca ordini del cliente nel periodo
    const ordini = await callOdoo(
      cookies,
      'sale.order',
      'search_read',
      [[
        ['partner_id', '=', partner.id],
        ['state', 'in', ['sale', 'done']],
        ['date_order', '>=', startDate],
        ['date_order', '<=', endDate]
      ]],
      {
        fields: [
          'id', 'name', 'date_order', 'commitment_date',
          'amount_total', 'amount_untaxed', 'amount_tax',
          'state', 'order_line', 'user_id', 'pricelist_id'
        ],
        order: 'date_order asc'
      }
    );

    console.log(`[Analisi Clienti] Trovati ${ordini.length} ordini`);

    if (ordini.length === 0) {
      return NextResponse.json({
        cliente: partner,
        ordini: [],
        prodotti: [],
        statistiche: {
          totaleOrdinato: 0,
          numeroOrdini: 0,
          imponibileMedio: 0,
          prodottiUnici: 0,
          prodottiConVariazioni: 0
        },
        topProdotti: [],
        prodottiConPiuVariazioni: [],
        simulazioneImpatti: []
      });
    }

    // Step 3: Estrai tutte le righe ordini
    const lineIds = ordini.flatMap((o: any) => o.order_line || []);

    const righeOrdini = await callOdoo(
      cookies,
      'sale.order.line',
      'search_read',
      [[['id', 'in', lineIds]]],
      {
        fields: [
          'id', 'order_id', 'product_id', 'name',
          'product_uom_qty', 'qty_delivered', 'qty_invoiced',
          'price_unit', 'discount', 'price_subtotal', 'price_total'
        ]
      }
    );

    console.log(`[Analisi Clienti] Trovate ${righeOrdini.length} righe ordini`);

    // Step 4: Mappa order_id -> data ordine
    const orderDateMap: Record<number, string> = {};
    ordini.forEach((o: any) => {
      orderDateMap[o.id] = o.date_order;
    });

    // Step 5: Raggruppa per prodotto e analizza variazioni
    const prodottiMap: Record<number, any[]> = {};

    righeOrdini.forEach((riga: any) => {
      if (!riga.product_id) return;

      const productId = riga.product_id[0];
      const productName = riga.product_id[1];
      const orderId = riga.order_id[0];
      const dataOrdine = orderDateMap[orderId];

      if (!prodottiMap[productId]) {
        prodottiMap[productId] = [];
      }

      prodottiMap[productId].push({
        product_id: productId,
        product_name: productName,
        order_id: orderId,
        order_name: riga.order_id[1],
        data_ordine: dataOrdine,
        qty: riga.product_uom_qty,
        qty_delivered: riga.qty_delivered,
        price_unit: riga.price_unit,
        discount: riga.discount,
        subtotal: riga.price_subtotal,
        total: riga.price_total
      });
    });

    // Step 6: Calcola statistiche per prodotto
    const prodottiAnalisi = Object.entries(prodottiMap).map(([productId, entries]) => {
      // Ordina per data
      const entriesSorted = entries.sort((a, b) =>
        a.data_ordine.localeCompare(b.data_ordine)
      );

      const prezzi = entriesSorted.map(e => e.price_unit);
      const prezzoMin = Math.min(...prezzi);
      const prezzoMax = Math.max(...prezzi);
      const prezzoMedio = prezzi.reduce((a, b) => a + b, 0) / prezzi.length;
      const prezzoPrimo = entriesSorted[0].price_unit;
      const prezzoUltimo = entriesSorted[entriesSorted.length - 1].price_unit;

      // Calcola variazioni
      const variazioni: any[] = [];
      for (let i = 1; i < entriesSorted.length; i++) {
        const prevPrice = entriesSorted[i - 1].price_unit;
        const currPrice = entriesSorted[i].price_unit;
        if (prevPrice !== currPrice) {
          const variazionePct = ((currPrice - prevPrice) / prevPrice) * 100;
          variazioni.push({
            da_data: entriesSorted[i - 1].data_ordine,
            a_data: entriesSorted[i].data_ordine,
            da_prezzo: prevPrice,
            a_prezzo: currPrice,
            variazione_chf: currPrice - prevPrice,
            variazione_pct: variazionePct
          });
        }
      }

      const qtyTotale = entriesSorted.reduce((sum, e) => sum + e.qty, 0);
      const subtotale = entriesSorted.reduce((sum, e) => sum + e.subtotal, 0);

      return {
        product_id: parseInt(productId),
        product_name: entriesSorted[0].product_name,
        num_ordini: entriesSorted.length,
        qty_totale: qtyTotale,
        prezzo_primo: prezzoPrimo,
        prezzo_ultimo: prezzoUltimo,
        prezzo_min: prezzoMin,
        prezzo_max: prezzoMax,
        prezzo_medio: prezzoMedio,
        num_variazioni: variazioni.length,
        subtotale: subtotale,
        variazioni: variazioni
      };
    });

    // Ordina per subtotale decrescente
    prodottiAnalisi.sort((a, b) => b.subtotale - a.subtotale);

    // Step 7: Calcola statistiche generali
    const totaleOrdinato = ordini.reduce((sum: number, o: any) => sum + o.amount_total, 0);
    const imponibileMedio = ordini.reduce((sum: number, o: any) => sum + o.amount_untaxed, 0) / ordini.length;
    const prodottiConVariazioni = prodottiAnalisi.filter(p => p.num_variazioni > 0).length;

    // Step 8: Top 10 prodotti
    const topProdotti = prodottiAnalisi.slice(0, 10);

    // Step 9: Prodotti con più variazioni
    const prodottiConPiuVariazioni = prodottiAnalisi
      .filter(p => p.num_variazioni > 0)
      .sort((a, b) => b.num_variazioni - a.num_variazioni)
      .slice(0, 10);

    // Step 10: Simulazione impatti
    const percentuali = [-10, -5, 0, 5, 10];
    const simulazioneImpatti = percentuali.map(pct => {
      const nuovoTotale = totaleOrdinato * (1 + pct / 100);
      const differenza = nuovoTotale - totaleOrdinato;
      return {
        scenario: pct === 0 ? 'Situazione Attuale' : `Variazione ${pct > 0 ? '+' : ''}${pct}%`,
        percentuale: pct,
        nuovo_totale: nuovoTotale,
        differenza: differenza,
        differenza_pct: pct
      };
    });

    // Step 11: Prepara risposta
    const response = {
      cliente: {
        id: partner.id,
        name: partner.name,
        email: partner.email || '',
        phone: partner.phone || '',
        city: partner.city || '',
        country: partner.country_id ? partner.country_id[1] : '',
        vat: partner.vat || '',
        customer_rank: partner.customer_rank || 0
      },
      periodo: {
        inizio: startDate,
        fine: endDate
      },
      statistiche: {
        totaleOrdinato,
        numeroOrdini: ordini.length,
        imponibileMedio,
        prodottiUnici: prodottiAnalisi.length,
        prodottiConVariazioni,
        righeOrdiniTotali: righeOrdini.length
      },
      ordini: ordini.map((o: any) => ({
        id: o.id,
        name: o.name,
        date_order: o.date_order,
        commitment_date: o.commitment_date,
        amount_total: o.amount_total,
        amount_untaxed: o.amount_untaxed,
        amount_tax: o.amount_tax,
        state: o.state,
        num_righe: o.order_line?.length || 0,
        venditore: o.user_id ? o.user_id[1] : '',
        listino: o.pricelist_id ? o.pricelist_id[1] : ''
      })),
      prodotti: prodottiAnalisi,
      topProdotti,
      prodottiConPiuVariazioni,
      simulazioneImpatti
    };

    console.log(`[Analisi Clienti] Analisi completata con successo`);

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('[Analisi Clienti] Errore:', error);
    return NextResponse.json(
      { error: error.message || 'Errore durante l\'analisi' },
      { status: 500 }
    );
  }
}
