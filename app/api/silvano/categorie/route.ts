import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * GET /api/silvano/categorie
 * Solo i 4 reparti principali (richiesta venditore), id Odoo fissi.
 * Il catalogo filtra con categ_id child_of → include tutte le sotto-categorie.
 */
export async function GET(_request: NextRequest) {
  const categorie = [
    { id: 6, name: 'Frigo' },
    { id: 8, name: 'Secco' },
    { id: 11, name: 'Congelatore' },
    { id: 19, name: 'Non Food' },
  ];
  return NextResponse.json({ success: true, count: categorie.length, categorie });
}
