import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

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
    const { supplier_name, supplier_vat, document_number, document_date } = body;

    if (!supplier_name) {
      return NextResponse.json({ error: 'supplier_name mancante' }, { status: 400 });
    }

    console.log('🔍 Ricerca ricezione per fornitore:', supplier_name);
    if (supplier_vat) {
      console.log('🔑 P.IVA:', supplier_vat);
    }

    let partners: any[] = [];

    // Step 1: Se abbiamo la P.IVA, cerca prima per quella (è univoca!)
    if (supplier_vat) {
      console.log('🔍 Ricerca per P.IVA:', supplier_vat);
      partners = await callOdoo(cookies, 'res.partner', 'search_read', [
        [['vat', '=', supplier_vat]],
        ['id', 'name', 'supplier_rank', 'vat']
      ]);

      if (partners.length > 0) {
        console.log('✅ Partner trovato tramite P.IVA!');
      }
    }

    // Step 2: Se non abbiamo trovato con P.IVA, cerca per nome
    if (partners.length === 0) {
      console.log('🔍 Ricerca per nome fornitore...');

      // Estrai le prime 2-3 parole chiave per una ricerca più flessibile
      const supplierKeywords = supplier_name
        .replace(/\s+(SRL|SPA|SAS|SNC|SOCIETA|S\.R\.L\.|S\.P\.A\.).*$/i, '') // Rimuovi forme societarie
        .trim();

      console.log('🔑 Parole chiave per ricerca:', supplierKeywords);

      // Prova prima con le parole chiave
      partners = await callOdoo(cookies, 'res.partner', 'search_read', [
        [['name', 'ilike', supplierKeywords], ['supplier_rank', '>', 0]],
        ['id', 'name', 'supplier_rank', 'vat']
      ]);

      // Se non trova nulla, prova con il nome completo
      if (partners.length === 0) {
        console.log('⚠️ Nessun risultato con parole chiave, provo con nome completo...');
        partners = await callOdoo(cookies, 'res.partner', 'search_read', [
          [['name', 'ilike', supplier_name], ['supplier_rank', '>', 0]],
          ['id', 'name', 'supplier_rank', 'vat']
        ]);
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

    // Step 3: Recupera le righe dettagliate (stock.move.line)
    const moveLineIds = selectedPicking.move_line_ids_without_package || [];

    let moveLines = [];
    if (moveLineIds.length > 0) {
      moveLines = await callOdoo(cookies, 'stock.move.line', 'search_read', [
        [['id', 'in', moveLineIds]],
        [
          'id',
          'product_id',
          'product_uom_id',
          'qty_done',
          'lot_id',
          'lot_name',
          'move_id',
          'location_id',
          'location_dest_id'
        ]
      ]);
    }

    // Recupera anche informazioni sui prodotti
    const productIds = moveLines.map((ml: any) => ml.product_id[0]);
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

    // Recupera informazioni sui lotti (per date di scadenza)
    const lotIds = moveLines
      .filter((ml: any) => ml.lot_id && ml.lot_id[0])
      .map((ml: any) => ml.lot_id[0]);

    let lots: any[] = [];
    if (lotIds.length > 0) {
      lots = await callOdoo(cookies, 'stock.lot', 'search_read', [
        [['id', 'in', lotIds]],
        ['id', 'name', 'expiration_date', 'use_date', 'removal_date', 'alert_date']
      ]);
    }

    // Arricchisci le move lines con i dati prodotto e lotto
    const enrichedMoveLines = moveLines.map((ml: any) => {
      const product = products.find((p: any) => p.id === ml.product_id[0]);
      const lot = ml.lot_id && ml.lot_id[0] ? lots.find((l: any) => l.id === ml.lot_id[0]) : null;

      return {
        ...ml,
        product_name: product?.display_name || ml.product_id[1],
        product_code: product?.default_code || '',
        product_tmpl_id: product?.product_tmpl_id || [],
        variant_ids: product?.product_template_variant_value_ids || [],
        expiry_date: lot?.expiration_date || lot?.use_date || false
      };
    });

    console.log('📋 Righe dettagliate:', enrichedMoveLines.length);

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
