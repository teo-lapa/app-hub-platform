import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';
import { normalizeVat, normalizeName, extractKeywords, fuzzyMatchScore } from '@/lib/suppliers/normalization';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Get user cookies to use their Odoo session
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
    }

    const body = await request.json();
    const { supplier_name, supplier_vat, document_number, document_date, picking_id } = body;

    // Se è fornito picking_id, carica direttamente quella ricezione
    if (picking_id) {
      console.log('🔍 Caricamento diretto ricezione ID:', picking_id);

      const pickings = await callOdoo(cookies, 'stock.picking', 'search_read', [
        [['id', '=', picking_id]],
        [
          'id',
          'name',
          'partner_id',
          'scheduled_date',
          'state',
          'origin',
          'move_line_ids_without_package',
          'move_ids_without_package'
        ]
      ]);

      if (pickings.length === 0) {
        return NextResponse.json({ error: 'Ricezione non trovata' }, { status: 404 });
      }

      const selectedPicking = pickings[0];

      // Recupera partner info
      const partners = await callOdoo(cookies, 'res.partner', 'search_read', [
        [['id', '=', selectedPicking.partner_id[0]]],
        ['id', 'name', 'vat']
      ]);

      const partner = partners[0];

      // Continua con il caricamento dei dettagli (move_lines, etc)
      const moveIds = selectedPicking.move_ids_without_package || [];
      console.log('📦 Move IDs trovati:', moveIds.length);

      let moves = [];
      if (moveIds.length > 0) {
        moves = await callOdoo(cookies, 'stock.move', 'search_read', [
          [['id', 'in', moveIds]],
          [
            'id',
            'product_id',
            'product_uom',
            'product_uom_qty',
            'quantity',
            'move_line_ids',
            'location_id',
            'location_dest_id',
            'state'
          ]
        ]);
        console.log('✅ Movimenti stock trovati:', moves.length);
      }

      // Recupera tutte le move_line_ids per ottenere lotti e scadenze
      const allMoveLineIds: number[] = [];
      moves.forEach((move: any) => {
        if (move.move_line_ids && Array.isArray(move.move_line_ids)) {
          allMoveLineIds.push(...move.move_line_ids);
        }
      });

      console.log('📋 Move Line IDs da recuperare:', allMoveLineIds.length);

      let moveLines: any[] = [];
      if (allMoveLineIds.length > 0) {
        moveLines = await callOdoo(cookies, 'stock.move.line', 'search_read', [
          [['id', 'in', allMoveLineIds]],
          [
            'id',
            'move_id',
            'product_id',
            'product_uom_id',
            'lot_id',
            'lot_name',
            'qty_done',
            'quantity',
            'location_id',
            'location_dest_id'
          ]
        ]);
        console.log('✅ Move Lines recuperate:', moveLines.length);
      }

      // Recupera informazioni sui lotti (per le scadenze)
      const lotIds = moveLines
        .filter((ml: any) => ml.lot_id && ml.lot_id[0])
        .map((ml: any) => ml.lot_id[0]);

      let lots: any[] = [];
      if (lotIds.length > 0) {
        lots = await callOdoo(cookies, 'stock.lot', 'search_read', [
          [['id', 'in', lotIds]],
          ['id', 'name', 'expiration_date', 'use_date', 'removal_date', 'alert_date']
        ]);
        console.log('✅ Lotti recuperati:', lots.length);
      }

      // Recupera anche informazioni sui prodotti
      const productIds = moves.map((m: any) => m.product_id[0]);
      const products = await callOdoo(cookies, 'product.product', 'search_read', [
        [['id', 'in', productIds]],
        [
          'id',
          'name',
          'display_name',
          'default_code',
          'product_tmpl_id',
          'product_template_variant_value_ids'
        ]
      ]);

      // Arricchisci le move lines con prodotti e lotti
      const enrichedMoveLines = moveLines.map((ml: any) => {
        const product = products.find((p: any) => p.id === ml.product_id[0]);
        const lot = ml.lot_id && ml.lot_id[0] ? lots.find((l: any) => l.id === ml.lot_id[0]) : null;

        return {
          id: ml.id,
          move_id: ml.move_id,
          product_id: ml.product_id,
          product_name: product?.display_name || ml.product_id[1],
          product_code: product?.default_code || '',
          product_tmpl_id: product?.product_tmpl_id || [],
          variant_ids: product?.product_template_variant_value_ids || [],
          product_uom_id: ml.product_uom_id,
          qty_done: ml.qty_done || 0,
          product_uom_qty: ml.quantity || 0,
          lot_id: ml.lot_id,
          lot_name: ml.lot_name || (lot ? lot.name : false),
          expiry_date: lot ? (lot.expiration_date || lot.use_date || false) : false,
          location_id: ml.location_id,
          location_dest_id: ml.location_dest_id
        };
      });

      console.log('📋 Move Lines arricchite:', enrichedMoveLines.length);

      return NextResponse.json({
        success: true,
        picking: {
          id: selectedPicking.id,
          name: selectedPicking.name,
          partner_id: selectedPicking.partner_id,
          partner_name: partner.name,
          scheduled_date: selectedPicking.scheduled_date,
          state: selectedPicking.state,
          origin: selectedPicking.origin
        },
        move_lines: enrichedMoveLines,
        alternatives: []
      });
    }

    // Flusso normale con supplier_name
    if (!supplier_name) {
      return NextResponse.json({ error: 'supplier_name o picking_id mancante' }, { status: 400 });
    }

    console.log('🔍 Ricerca ricezione per fornitore:', supplier_name);
    if (supplier_vat) {
      console.log('🔑 P.IVA:', supplier_vat);
    }

    let partners: any[] = [];

    // Step 1: Se abbiamo la P.IVA, cerca prima per quella (è univoca!)
    if (supplier_vat) {
      console.log('🔍 Ricerca per P.IVA:', supplier_vat);
      const normalizedInputVat = normalizeVat(supplier_vat);
      console.log('🔍 P.IVA normalizzata:', normalizedInputVat);

      // Recupera tutti i fornitori con P.IVA
      const allPartnersWithVat = await callOdoo(cookies, 'res.partner', 'search_read', [
        [['vat', '!=', false], ['supplier_rank', '>', 0]],
        ['id', 'name', 'supplier_rank', 'vat']
      ]);

      console.log(`🔍 Trovati ${allPartnersWithVat.length} fornitori con P.IVA in Odoo`);

      // Filtra per P.IVA normalizzata
      partners = allPartnersWithVat.filter((partner: any) => {
        const partnerVat = normalizeVat(partner.vat);
        return partnerVat === normalizedInputVat;
      });

      if (partners.length > 0) {
        console.log('✅ Partner trovato tramite P.IVA normalizzata!', partners[0].name);
      } else {
        console.log('⚠️ Nessun partner trovato con P.IVA normalizzata');
      }
    }

    // Step 2: Se non abbiamo trovato con P.IVA, cerca per nome
    if (partners.length === 0) {
      console.log('🔍 Ricerca per nome fornitore...');

      // Normalizza il nome e estrai keywords
      const normalizedName = normalizeName(supplier_name);
      const keywords = extractKeywords(supplier_name);

      console.log('🔑 Nome normalizzato:', normalizedName);
      console.log('🔑 Parole chiave estratte:', keywords);

      // STEP 2A: Cerca con keywords (rimuove forme societarie e parole comuni)
      if (keywords.length > 2) {
        partners = await callOdoo(cookies, 'res.partner', 'search_read', [
          [['name', 'ilike', keywords], ['supplier_rank', '>', 0]],
          ['id', 'name', 'supplier_rank', 'vat']
        ]);
        console.log(`   Trovati ${partners.length} fornitori con keywords`);
      }

      // STEP 2B: Se non trova con keywords, prova con nome normalizzato (senza forme societarie)
      if (partners.length === 0 && normalizedName.length > 2) {
        partners = await callOdoo(cookies, 'res.partner', 'search_read', [
          [['name', 'ilike', normalizedName], ['supplier_rank', '>', 0]],
          ['id', 'name', 'supplier_rank', 'vat']
        ]);
        console.log(`   Trovati ${partners.length} fornitori con nome normalizzato`);
      }

      // STEP 2C: Se ancora non trova, prova con nome originale
      if (partners.length === 0) {
        console.log('⚠️ Nessun risultato con normalizzazione, provo con nome originale...');
        partners = await callOdoo(cookies, 'res.partner', 'search_read', [
          [['name', 'ilike', supplier_name], ['supplier_rank', '>', 0]],
          ['id', 'name', 'supplier_rank', 'vat']
        ]);
        console.log(`   Trovati ${partners.length} fornitori con nome originale`);
      }

      // STEP 2D: Se abbiamo multipli risultati, ordina per score di similarità
      if (partners.length > 1) {
        console.log('🎯 Multipli fornitori trovati, calcolo score di similarità...');

        partners = partners.map((p: any) => ({
          ...p,
          similarity_score: fuzzyMatchScore(supplier_name, p.name)
        })).sort((a: any, b: any) => b.similarity_score - a.similarity_score);

        console.log('   Top 3 match:');
        partners.slice(0, 3).forEach((p: any, i: number) => {
          console.log(`   ${i + 1}. ${p.name} (score: ${(p.similarity_score * 100).toFixed(0)}%)`);
        });
      }
    }

    console.log('🏢 Partner trovati:', partners.length);

    if (partners.length === 0) {
      return NextResponse.json({
        error: 'Fornitore non trovato',
        suggestion: supplier_vat
          ? `Nessun fornitore trovato con P.IVA "${supplier_vat}" o nome "${supplier_name}"`
          : `Nessun fornitore trovato con nome simile a "${supplier_name}"`
      }, { status: 404 });
    }

    // Prendi il primo partner (o quello con rank più alto)
    const partner = partners.sort((a: any, b: any) => b.supplier_rank - a.supplier_rank)[0];
    console.log('✅ Partner selezionato:', partner.name, '(ID:', partner.id, ')');

    // Step 2: Cerca le ricezioni in arrivo per questo fornitore di OGGI
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    const pickingDomain: any[] = [
      ['partner_id', '=', partner.id],
      ['picking_type_code', '=', 'incoming'],
      ['scheduled_date', '>=', todayStart.toISOString()],
      ['scheduled_date', '<=', todayEnd.toISOString()],
      ['state', 'not in', ['done', 'cancel']]
    ];

    console.log('📅 Ricerca ricezioni di oggi per fornitore:', partner.name);

    const pickings = await callOdoo(cookies, 'stock.picking', 'search_read', [
      pickingDomain,
      [
        'id',
        'name',
        'partner_id',
        'scheduled_date',
        'state',
        'origin',
        'move_line_ids_without_package',
        'move_ids_without_package'
      ]
    ]);

    console.log('📦 Ricezioni trovate:', pickings.length);

    if (pickings.length === 0) {
      return NextResponse.json({
        error: 'Nessuna ricezione in arrivo trovata',
        suggestion: `Nessuna ricezione in stato "Pronto" o "In attesa" trovata per il fornitore "${partner.name}"`,
        partner_found: partner
      }, { status: 404 });
    }

    // Se abbiamo il numero documento, proviamo a trovare match esatto
    let selectedPicking = pickings[0];
    if (document_number && pickings.length > 1) {
      const exactMatch = pickings.find((p: any) =>
        p.origin && p.origin.includes(document_number)
      );
      if (exactMatch) {
        selectedPicking = exactMatch;
        console.log('✅ Match esatto trovato per documento:', document_number);
      }
    }

    // Ordina per data scheduled (più recente prima)
    if (pickings.length > 1 && !document_number) {
      pickings.sort((a: any, b: any) =>
        new Date(b.scheduled_date).getTime() - new Date(a.scheduled_date).getTime()
      );
      selectedPicking = pickings[0];
    }

    console.log('✅ Ricezione selezionata:', selectedPicking.name, '(ID:', selectedPicking.id, ')');

    // Step 3: Recupera i movimenti stock (stock.move) - sono i prodotti da ricevere
    const moveIds = selectedPicking.move_ids_without_package || [];
    console.log('📦 Move IDs trovati:', moveIds.length);

    let moves = [];
    if (moveIds.length > 0) {
      moves = await callOdoo(cookies, 'stock.move', 'search_read', [
        [['id', 'in', moveIds]],
        [
          'id',
          'product_id',
          'product_uom',
          'product_uom_qty',
          'quantity',
          'move_line_ids',
          'location_id',
          'location_dest_id',
          'state'
        ]
      ]);
      console.log('✅ Movimenti stock trovati:', moves.length);
    }

    // Recupera tutte le move_line_ids per ottenere lotti e scadenze
    const allMoveLineIds: number[] = [];
    moves.forEach((move: any) => {
      if (move.move_line_ids && Array.isArray(move.move_line_ids)) {
        allMoveLineIds.push(...move.move_line_ids);
      }
    });

    console.log('📋 Move Line IDs da recuperare:', allMoveLineIds.length);

    let moveLines: any[] = [];
    if (allMoveLineIds.length > 0) {
      moveLines = await callOdoo(cookies, 'stock.move.line', 'search_read', [
        [['id', 'in', allMoveLineIds]],
        [
          'id',
          'move_id',
          'product_id',
          'product_uom_id',
          'lot_id',
          'lot_name',
          'qty_done',
          'quantity',
          'location_id',
          'location_dest_id'
        ]
      ]);
      console.log('✅ Move Lines recuperate:', moveLines.length);
    }

    // Recupera informazioni sui lotti (per le scadenze)
    const lotIds = moveLines
      .filter((ml: any) => ml.lot_id && ml.lot_id[0])
      .map((ml: any) => ml.lot_id[0]);

    let lots: any[] = [];
    if (lotIds.length > 0) {
      lots = await callOdoo(cookies, 'stock.lot', 'search_read', [
        [['id', 'in', lotIds]],
        ['id', 'name', 'expiration_date', 'use_date', 'removal_date', 'alert_date']
      ]);
      console.log('✅ Lotti recuperati:', lots.length);
    }

    // Recupera anche informazioni sui prodotti
    const productIds = moves.map((m: any) => m.product_id[0]);
    const products = await callOdoo(cookies, 'product.product', 'search_read', [
      [['id', 'in', productIds]],
      [
        'id',
        'name',
        'display_name',
        'default_code',
        'product_tmpl_id',
        'product_template_variant_value_ids'
      ]
    ]);

    // Arricchisci le move lines con prodotti e lotti
    const enrichedMoveLines = moveLines.map((ml: any) => {
      const product = products.find((p: any) => p.id === ml.product_id[0]);
      const lot = ml.lot_id && ml.lot_id[0] ? lots.find((l: any) => l.id === ml.lot_id[0]) : null;

      return {
        id: ml.id,
        move_id: ml.move_id,
        product_id: ml.product_id,
        product_name: product?.display_name || ml.product_id[1],
        product_code: product?.default_code || '',
        product_tmpl_id: product?.product_tmpl_id || [],
        variant_ids: product?.product_template_variant_value_ids || [],
        product_uom_id: ml.product_uom_id,
        qty_done: ml.qty_done || 0,
        product_uom_qty: ml.quantity || 0,
        lot_id: ml.lot_id,
        lot_name: ml.lot_name || (lot ? lot.name : false),
        expiry_date: lot ? (lot.expiration_date || lot.use_date || false) : false,
        location_id: ml.location_id,
        location_dest_id: ml.location_dest_id
      };
    });

    console.log('📋 Move Lines arricchite:', enrichedMoveLines.length);

    return NextResponse.json({
      success: true,
      picking: {
        id: selectedPicking.id,
        name: selectedPicking.name,
        partner_id: selectedPicking.partner_id,
        partner_name: partner.name,
        scheduled_date: selectedPicking.scheduled_date,
        state: selectedPicking.state,
        origin: selectedPicking.origin
      },
      move_lines: enrichedMoveLines,
      alternatives: pickings.length > 1 ? pickings.map((p: any) => ({
        id: p.id,
        name: p.name,
        scheduled_date: p.scheduled_date,
        state: p.state,
        origin: p.origin
      })) : []
    });

  } catch (error: any) {
    console.error('❌ Errore find-reception:', error);
    return NextResponse.json({
      error: error.message || 'Errore durante la ricerca della ricezione',
      details: error.toString()
    }, { status: 500 });
  }
}
