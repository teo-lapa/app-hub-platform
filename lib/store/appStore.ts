import { create } from 'zustand';
import { AppStore, App } from '@/lib/types';
import { allApps as mockApps } from '@/lib/data/apps-with-indicators';

// Carica preferiti da localStorage
const loadFavorites = (): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem('favoriteApps');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

// Salva preferiti in localStorage
const saveFavorites = (favorites: string[]) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('favoriteApps', JSON.stringify(favorites));
  } catch (error) {
    console.error('Error saving favorites:', error);
  }
};

export const useAppStore = create<AppStore>((set, get) => ({
  apps: mockApps,
  filteredApps: mockApps,
  selectedCategory: 'Tutti',
  searchQuery: '',
  showUpgradeModal: false,
  favoriteApps: loadFavorites(),

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

  toggleFavorite: (appId: string) => {
    const { favoriteApps } = get();
    const newFavorites = favoriteApps.includes(appId)
      ? favoriteApps.filter(id => id !== appId)
      : [...favoriteApps, appId];

    saveFavorites(newFavorites);
    set({ favoriteApps: newFavorites });
    get().filterApps(); // Rifiltra per aggiornare l'ordinamento
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