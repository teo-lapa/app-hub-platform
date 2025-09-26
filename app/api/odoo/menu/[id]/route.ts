import { NextRequest, NextResponse } from 'next/server';
import { OdooMenuService } from '@/lib/odoo/services/menuService';
import { ApiResponse } from '@/types';

// GET /api/odoo/menu/[id] - Ottieni un singolo item del menu
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);

    if (isNaN(id)) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'ID non valido',
      }, { status: 400 });
    }

    const item = await OdooMenuService.getMenuItem(id);

    if (!item) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Item del menu non trovato',
      }, { status: 404 });
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { item },
    });

  } catch (error) {
    console.error('Error fetching menu item from Odoo:', error);

    return NextResponse.json<ApiResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Errore sconosciuto',
    }, { status: 500 });
  }
}

// PUT /api/odoo/menu/[id] - Aggiorna un item del menu
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    const data = await request.json();

    if (isNaN(id)) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'ID non valido',
      }, { status: 400 });
    }

    const success = await OdooMenuService.updateMenuItem(id, data);

    if (!success) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Impossibile aggiornare l\'item del menu',
      }, { status: 500 });
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      message: 'Item del menu aggiornato con successo',
    });

  } catch (error) {
    console.error('Error updating menu item in Odoo:', error);

    return NextResponse.json<ApiResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Errore sconosciuto',
    }, { status: 500 });
  }
}

// DELETE /api/odoo/menu/[id] - Elimina (disattiva) un item del menu
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);

    if (isNaN(id)) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'ID non valido',
      }, { status: 400 });
    }

    const success = await OdooMenuService.deleteMenuItem(id);

    if (!success) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Impossibile eliminare l\'item del menu',
      }, { status: 500 });
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      message: 'Item del menu eliminato con successo',
    });

  } catch (error) {
    console.error('Error deleting menu item in Odoo:', error);

    return NextResponse.json<ApiResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Errore sconosciuto',
    }, { status: 500 });
  }
}