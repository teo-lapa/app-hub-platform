import { create } from 'zustand';
import { AppStore, App } from '@/types';
import { mockApps } from '@/data/apps';

export const useAppStore = create<AppStore>((set, get) => ({
  apps: mockApps,
  filteredApps: mockApps,
  selectedCategory: 'Tutti',
  searchQuery: '',

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

  filterApps: () => {
    const { apps, selectedCategory, searchQuery } = get();

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

    set({ filteredApps: filtered });
  },
}));