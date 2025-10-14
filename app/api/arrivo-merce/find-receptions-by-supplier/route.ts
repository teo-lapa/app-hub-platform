import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';

interface ReceptionSearchParams {
  supplier_id: number;
  document_date?: string; // Format: YYYY-MM-DD
  document_number?: string;
  search_days?: number; // Default: 7
}

interface ReceptionSummary {
  id: number;
  name: string;
  scheduled_date: string | false;
  state: string;
  origin: string | false;
  products_count: number;
  total_qty: number;
  date_match_score: number; // 0-100: quanto è vicina alla data cercata
}

interface SearchResponse {
  found: boolean;
  count: number;
  receptions: ReceptionSummary[];
  suggested_action: 'use_first' | 'ask_user' | 'create_manual';
  search_params: {
    supplier_id: number;
    document_date?: string;
    search_days: number;
  };
}

/**
 * Calcola il punteggio di vicinanza tra due date (0-100)
 * 100 = stesso giorno
 * 75+ = entro 3 giorni
 * 50+ = entro 7 giorni
 * < 50 = oltre 7 giorni
 */
function calculateDateMatchScore(
  targetDate: string | null,
  scheduledDate: string | false
): number {
  if (!targetDate || !scheduledDate) return 0;

  const target = new Date(targetDate);
  const scheduled = new Date(scheduledDate);

  const diffTime = Math.abs(scheduled.getTime() - target.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 100; // Stesso giorno
  if (diffDays <= 1) return 90;
  if (diffDays <= 2) return 80;
  if (diffDays <= 3) return 75;
  if (diffDays <= 5) return 60;
  if (diffDays <= 7) return 50;
  if (diffDays <= 14) return 30;
  if (diffDays <= 30) return 15;
  return 5;
}

/**
 * Calcola la quantità totale da una lista di movimenti
 */
function calculateTotalQty(moves: any[]): number {
  return moves.reduce((sum, move) => sum + (move.product_uom_qty || 0), 0);
}

/**
 * API per cercare automaticamente ricezioni in attesa per un fornitore
 *
 * POST /api/arrivo-merce/find-receptions-by-supplier
 *
 * Body:
 * - supplier_id: number (required) - ID del fornitore in Odoo
 * - document_date?: string - Data fattura (YYYY-MM-DD) per filtrare per vicinanza temporale
 * - document_number?: string - Numero fattura per eventuale match con origin
 * - search_days?: number - Quanti giorni cercare (default: 7 se document_date fornita, altrimenti 30)
 */
export async function POST(request: NextRequest) {
  try {
    // Get user cookies to use their Odoo session
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
    }

    const body = await request.json();
    const {
      supplier_id,
      document_date,
      document_number,
      search_days
    }: ReceptionSearchParams = body;

    if (!supplier_id) {
      return NextResponse.json(
        { error: 'supplier_id mancante' },
        { status: 400 }
      );
    }

    console.log('🔍 Ricerca ricezioni per fornitore ID:', supplier_id);
    if (document_date) console.log('📅 Data documento:', document_date);
    if (document_number) console.log('📄 Numero documento:', document_number);

    // Determina il range di date per la ricerca
    let dateFrom: Date | null = null;
    let dateTo: Date | null = null;
    const effectiveSearchDays = search_days || (document_date ? 7 : 30);

    if (document_date) {
      // Se abbiamo una data documento, cerchiamo ±search_days
      const docDate = new Date(document_date);
      dateFrom = new Date(docDate);
      dateFrom.setDate(dateFrom.getDate() - effectiveSearchDays);
      dateTo = new Date(docDate);
      dateTo.setDate(dateTo.getDate() + effectiveSearchDays);
    } else {
      // Altrimenti cerchiamo gli ultimi 30 giorni
      dateTo = new Date();
      dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - effectiveSearchDays);
    }

    console.log('📆 Range di ricerca:', {
      from: dateFrom.toISOString().split('T')[0],
      to: dateTo.toISOString().split('T')[0],
      days: effectiveSearchDays
    });

    // Costruisci il domain per la ricerca
    const pickingDomain: any[] = [
      ['partner_id', '=', supplier_id],
      ['picking_type_code', '=', 'incoming'],
      ['state', 'in', ['assigned', 'confirmed', 'waiting']]
    ];

    // Aggiungi filtro date se abbiamo un range
    if (dateFrom && dateTo) {
      pickingDomain.push(
        ['scheduled_date', '>=', dateFrom.toISOString()],
        ['scheduled_date', '<=', dateTo.toISOString()]
      );
    }

    console.log('🔎 Domain di ricerca:', JSON.stringify(pickingDomain, null, 2));

    // Cerca le ricezioni
    const pickings = await callOdoo(cookies, 'stock.picking', 'search_read', [
      pickingDomain,
      [
        'id',
        'name',
        'partner_id',
        'scheduled_date',
        'state',
        'origin',
        'move_ids_without_package'
      ]
    ]);

    console.log('📦 Ricezioni trovate:', pickings.length);

    if (pickings.length === 0) {
      const response: SearchResponse = {
        found: false,
        count: 0,
        receptions: [],
        suggested_action: 'create_manual',
        search_params: {
          supplier_id,
          document_date,
          search_days: effectiveSearchDays
        }
      };
      return NextResponse.json(response);
    }

    // Per ogni ricezione, recupera i dettagli dei movimenti per contare prodotti e quantità
    const receptionSummaries: ReceptionSummary[] = [];

    for (const picking of pickings) {
      const moveIds = picking.move_ids_without_package || [];
      let moves: any[] = [];
      let productsCount = 0;
      let totalQty = 0;

      if (moveIds.length > 0) {
        moves = await callOdoo(cookies, 'stock.move', 'search_read', [
          [['id', 'in', moveIds]],
          ['id', 'product_id', 'product_uom_qty', 'state']
        ]);
        productsCount = moves.length;
        totalQty = calculateTotalQty(moves);
      }

      const dateMatchScore = calculateDateMatchScore(
        document_date || null,
        picking.scheduled_date
      );

      receptionSummaries.push({
        id: picking.id,
        name: picking.name,
        scheduled_date: picking.scheduled_date || false,
        state: picking.state,
        origin: picking.origin || false,
        products_count: productsCount,
        total_qty: totalQty,
        date_match_score: dateMatchScore
      });
    }

    // Ordina le ricezioni
    if (document_date) {
      // Se abbiamo una data documento, ordina per vicinanza alla data
      receptionSummaries.sort((a, b) => b.date_match_score - a.date_match_score);
      console.log('✅ Ricezioni ordinate per vicinanza alla data');
    } else {
      // Altrimenti ordina per scheduled_date DESC (più recente prima)
      receptionSummaries.sort((a, b) => {
        if (!a.scheduled_date) return 1;
        if (!b.scheduled_date) return -1;
        return new Date(b.scheduled_date).getTime() - new Date(a.scheduled_date).getTime();
      });
      console.log('✅ Ricezioni ordinate per data scheduled (più recente prima)');
    }

    // Determina l'azione suggerita
    let suggestedAction: 'use_first' | 'ask_user' | 'create_manual' = 'ask_user';
    if (receptionSummaries.length === 0) {
      suggestedAction = 'create_manual';
    } else if (receptionSummaries.length === 1) {
      suggestedAction = 'use_first';
    } else if (receptionSummaries.length >= 2 && receptionSummaries.length <= 5) {
      suggestedAction = 'ask_user';
    } else {
      // Se ci sono troppe ricezioni (>5), suggerisci comunque di chiedere all'utente
      suggestedAction = 'ask_user';
    }

    // Se abbiamo un document_number, cerchiamo un match esatto con origin
    if (document_number && receptionSummaries.length > 1) {
      const exactMatch = receptionSummaries.find(
        (r) => r.origin && r.origin.includes(document_number)
      );
      if (exactMatch) {
        // Sposta il match esatto in prima posizione
        const index = receptionSummaries.indexOf(exactMatch);
        receptionSummaries.splice(index, 1);
        receptionSummaries.unshift(exactMatch);
        suggestedAction = 'use_first';
        console.log('✅ Match esatto trovato per documento:', document_number);
      }
    }

    console.log('🎯 Azione suggerita:', suggestedAction);
    console.log('📊 Riepilogo prime 3 ricezioni:');
    receptionSummaries.slice(0, 3).forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.name} - ${r.products_count} prodotti, qty: ${r.total_qty}, score: ${r.date_match_score}`);
    });

    const response: SearchResponse = {
      found: true,
      count: receptionSummaries.length,
      receptions: receptionSummaries,
      suggested_action: suggestedAction,
      search_params: {
        supplier_id,
        document_date,
        search_days: effectiveSearchDays
      }
    };

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('❌ Errore find-receptions-by-supplier:', error);
    return NextResponse.json(
      {
        error: error.message || 'Errore durante la ricerca delle ricezioni',
        details: error.toString()
      },
      { status: 500 }
    );
  }
}
