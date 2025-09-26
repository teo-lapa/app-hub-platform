import { NextRequest, NextResponse } from 'next/server';
import { OdooMenuService } from '@/lib/odoo/services/menuService';
import { ApiResponse } from '@/types';

// GET /api/odoo/menu - Ottieni tutti gli item del menu
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('category');
    const search = searchParams.get('search');

    if (search) {
      // Ricerca negli item del menu
      const items = await OdooMenuService.searchMenuItems(search);
      return NextResponse.json<ApiResponse>({
        success: true,
        data: { items },
      });
    }

    if (categoryId) {
      // Filtro per categoria
      const items = await OdooMenuService.getMenuItems(parseInt(categoryId));
      return NextResponse.json<ApiResponse>({
        success: true,
        data: { items },
      });
    }

    // Tutti gli item
    const items = await OdooMenuService.getMenuItems();
    return NextResponse.json<ApiResponse>({
      success: true,
      data: { items },
    });

  } catch (error) {
    console.error('Error fetching menu from Odoo:', error);

    // Se Odoo non è configurato o non disponibile, restituisci dati mock
    if (error instanceof Error && error.message.includes('authentication failed')) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Odoo non configurato - utilizzando dati mock',
        data: { items: [], usingMockData: true }
      }, { status: 503 });
    }

    return NextResponse.json<ApiResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Errore sconosciuto',
    }, { status: 500 });
  }
}

// POST /api/odoo/menu - Crea un nuovo item del menu
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    if (!data.name || !data.price || !data.category_id) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Nome, prezzo e categoria sono obbligatori',
      }, { status: 400 });
    }

    const itemId = await OdooMenuService.createMenuItem(data);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { id: itemId },
      message: 'Item del menu creato con successo',
    });

  } catch (error) {
    console.error('Error creating menu item in Odoo:', error);

    return NextResponse.json<ApiResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Errore sconosciuto',
    }, { status: 500 });
  }
}