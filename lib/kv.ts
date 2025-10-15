import { kv } from '@vercel/kv';

/**
 * Vercel KV Database Helper
 *
 * Struttura dati:
 * - app_visibility:{appId} -> { excludedUsers: string[], excludedCustomers: string[] }
 * - user_favorites:{userId} -> string[] (array di appId preferiti)
 */

// ============================================
// APP VISIBILITY (Chi può vedere quali app)
// ============================================

export type VisibilityGroup = 'all' | 'internal' | 'portal' | 'none';

export interface AppVisibility {
  appId: string;
  excludedUsers: string[];      // User IDs esclusi
  excludedCustomers: string[];  // Customer IDs esclusi
  visible?: boolean;            // App visibile o nascosta
  visibilityGroup?: VisibilityGroup;  // Gruppo visibilità
  developmentStatus?: 'in_sviluppo' | 'pronta';  // Stato sviluppo app
}

/**
 * Salva le impostazioni di visibilità per un'app
 */
export async function saveAppVisibility(appId: string, visibility: Omit<AppVisibility, 'appId'>) {
  const key = `app_visibility:${appId}`;
  await kv.set(key, visibility);
  return { success: true, key };
}

/**
 * Recupera le impostazioni di visibilità per un'app
 */
export async function getAppVisibility(appId: string): Promise<AppVisibility | null> {
  const key = `app_visibility:${appId}`;
  const data = await kv.get<Omit<AppVisibility, 'appId'>>(key);

  if (!data) {
    return null;
  }

  return {
    appId,
    ...data
  };
}

/**
 * Recupera tutte le impostazioni di visibilità (OTTIMIZZATO)
 */
export async function getAllAppVisibilities(): Promise<AppVisibility[]> {
  const keys = await kv.keys('app_visibility:*');

  if (keys.length === 0) {
    return [];
  }

  // ✅ Usa mget per recuperare tutti i valori in UNA SOLA chiamata
  const values = await kv.mget<Array<Omit<AppVisibility, 'appId'>>>(...keys);

  const visibilities: AppVisibility[] = [];
  keys.forEach((key, index) => {
    const data = values[index];
    if (data) {
      const appId = key.replace('app_visibility:', '');
      visibilities.push({ appId, ...data });
    }
  });

  return visibilities;
}

/**
 * Verifica se un utente può vedere un'app
 */
export async function canUserSeeApp(appId: string, userId: string): Promise<boolean> {
  const visibility = await getAppVisibility(appId);

  if (!visibility) {
    return true; // Se non ci sono restrizioni, tutti possono vedere
  }

  // Controlla se l'utente è escluso
  return !visibility.excludedUsers.includes(userId) &&
         !visibility.excludedCustomers.includes(userId);
}

// ============================================
// USER FAVORITES (App preferite per utente)
// ============================================

/**
 * Salva i preferiti di un utente
 */
export async function saveUserFavorites(userId: string, favoriteAppIds: string[]) {
  const key = `user_favorites:${userId}`;
  await kv.set(key, favoriteAppIds);
  return { success: true, key };
}

/**
 * Recupera i preferiti di un utente
 */
export async function getUserFavorites(userId: string): Promise<string[]> {
  const key = `user_favorites:${userId}`;
  const favorites = await kv.get<string[]>(key);
  return favorites || [];
}

/**
 * Aggiungi un'app ai preferiti
 */
export async function addFavorite(userId: string, appId: string) {
  const favorites = await getUserFavorites(userId);

  if (!favorites.includes(appId)) {
    favorites.push(appId);
    await saveUserFavorites(userId, favorites);
  }

  return { success: true, favorites };
}

/**
 * Rimuovi un'app dai preferiti
 */
export async function removeFavorite(userId: string, appId: string) {
  const favorites = await getUserFavorites(userId);
  const newFavorites = favorites.filter(id => id !== appId);
  await saveUserFavorites(userId, newFavorites);

  return { success: true, favorites: newFavorites };
}

/**
 * Toggle preferito (aggiungi o rimuovi)
 */
export async function toggleFavorite(userId: string, appId: string) {
  const favorites = await getUserFavorites(userId);

  if (favorites.includes(appId)) {
    return await removeFavorite(userId, appId);
  } else {
    return await addFavorite(userId, appId);
  }
}
