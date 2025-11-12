import { create } from 'zustand';
import { AppStore, App } from '@/lib/types';
import { allApps as mockApps } from '@/lib/data/apps-with-indicators';

// Carica le app filtrate in base all'utente corrente
const loadAppsFromAPI = async (userRole?: string, userId?: number): Promise<App[]> => {
  try {
    // Costruisci URL con parametri se disponibili
    const params = new URLSearchParams();
    if (userRole) params.append('role', userRole);
    if (userId) params.append('userId', String(userId));

    const url = `/api/apps/visibility${params.toString() ? `?${params.toString()}` : ''}`;
    console.log(`🔄 Loading apps from API: ${url}`);

    const response = await fetch(url);
    const data = await response.json();

    if (data.success && data.apps) {
      console.log(`✅ Loaded ${data.apps.length} apps from API`);
      return data.apps;
    }

    console.warn('⚠️ API returned no apps, falling back to mockApps');
    return mockApps;
  } catch (error) {
    console.error('❌ Error loading apps from API, falling back to mockApps:', error);
    return mockApps;
  }
};

// Carica preferiti da Vercel KV tramite API
const loadFavoritesFromAPI = async (userId: string): Promise<string[]> => {
  try {
    const response = await fetch(`/api/user/favorites?userId=${userId}`);
    const data = await response.json();

    if (data.success) {
      return data.favorites || [];
    }
    return [];
  } catch (error) {
    console.error('❌ Error loading favorites from API:', error);
    return [];
  }
};

// Salva preferiti su Vercel KV tramite API
const saveFavoritesToAPI = async (userId: string, favorites: string[]) => {
  try {
    await fetch('/api/user/favorites', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, favorites })
    });
  } catch (error) {
    console.error('❌ Error saving favorites to API:', error);
  }
};

export const useAppStore = create<AppStore>((set, get) => ({
  apps: mockApps,
  filteredApps: mockApps,
  selectedCategory: 'Tutti',
  searchQuery: '',
  showUpgradeModal: false,
  favoriteApps: [],  // Inizia vuoto, verrà caricato con loadUserFavorites()

  setApps: (apps: App[]) => {
    set({ apps });
    get().filterApps();
  },

  setCategory: (category: string) => {
    set({ selectedCategory: category });
    get().filterApps();
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
    get().filterApps();
  },

  setShowUpgradeModal: (show: boolean) => {
    set({ showUpgradeModal: show });
  },

  // Carica le app filtrate per l'utente corrente dall'API
  loadAppsForUser: async (userRole?: string, userId?: number) => {
    const apps = await loadAppsFromAPI(userRole, userId);
    set({ apps });
    get().filterApps();
  },

  // Carica i preferiti dell'utente dall'API
  loadUserFavorites: async (userId: string) => {
    const favorites = await loadFavoritesFromAPI(userId);
    set({ favoriteApps: favorites });
    get().filterApps();
  },

  // Toggle preferito e salva su API
  toggleFavorite: async (appId: string, userId?: string) => {
    const { favoriteApps } = get();
    const newFavorites = favoriteApps.includes(appId)
      ? favoriteApps.filter(id => id !== appId)
      : [...favoriteApps, appId];

    set({ favoriteApps: newFavorites });
    get().filterApps(); // Rifiltra per aggiornare l'ordinamento

    // Salva su API se userId è disponibile
    if (userId) {
      await saveFavoritesToAPI(userId, newFavorites);
    }
  },

  isFavorite: (appId: string) => {
    return get().favoriteApps.includes(appId);
  },

  filterApps: () => {
    const { apps, selectedCategory, searchQuery, favoriteApps } = get();

    let filtered = apps;

    // Filtro per categoria
    if (selectedCategory !== 'Tutti') {
      filtered = filtered.filter(app => app.category === selectedCategory);
    }

    // Filtro per ricerca
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(app =>
        app.name.toLowerCase().includes(query) ||
        app.description.toLowerCase().includes(query) ||
        app.category.toLowerCase().includes(query)
      );
    }

    // Ordina: preferiti prima, poi il resto
    filtered.sort((a, b) => {
      const aIsFav = favoriteApps.includes(a.id);
      const bIsFav = favoriteApps.includes(b.id);

      if (aIsFav && !bIsFav) return -1;
      if (!aIsFav && bIsFav) return 1;
      return 0; // Mantieni ordine originale per gli altri
    });

    set({ filteredApps: filtered });
  },
}));