import { NextRequest, NextResponse } from 'next/server';
import { getUserFavorites, toggleFavorite, saveUserFavorites } from '@/lib/kv';

export const dynamic = 'force-dynamic';

/**
 * GET: Recupera i preferiti dell'utente
 * Query params: userId (required)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'userId è richiesto'
      }, { status: 400 });
    }

    const favorites = await getUserFavorites(userId);

    return NextResponse.json({
      success: true,
      favorites
    });

  } catch (error: any) {
    console.error('❌ Errore GET favorites:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * POST: Toggle preferito (aggiungi o rimuovi)
 * Body: { userId, appId }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, appId } = await request.json();

    if (!userId || !appId) {
      return NextResponse.json({
        success: false,
        error: 'userId e appId sono richiesti'
      }, { status: 400 });
    }

    const result = await toggleFavorite(userId, appId);

    return NextResponse.json({
      success: true,
      favorites: result.favorites,
      message: 'Preferiti aggiornati'
    });

  } catch (error: any) {
    console.error('❌ Errore POST toggle favorite:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * PUT: Salva l'intera lista di preferiti
 * Body: { userId, favorites: string[] }
 */
export async function PUT(request: NextRequest) {
  try {
    const { userId, favorites } = await request.json();

    if (!userId || !Array.isArray(favorites)) {
      return NextResponse.json({
        success: false,
        error: 'userId e favorites (array) sono richiesti'
      }, { status: 400 });
    }

    await saveUserFavorites(userId, favorites);

    return NextResponse.json({
      success: true,
      favorites,
      message: 'Preferiti salvati con successo'
    });

  } catch (error: any) {
    console.error('❌ Errore PUT favorites:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
