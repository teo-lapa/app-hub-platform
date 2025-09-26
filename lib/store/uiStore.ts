import { create } from 'zustand';
import { UIState, App } from '@/types';

export const useUIStore = create<UIState>((set) => ({
  theme: 'system',
  sidebarOpen: false,
  showUpgradeModal: false,
  selectedApp: null,

  setTheme: (theme: 'light' | 'dark' | 'system') => {
    set({ theme });
  },

  toggleSidebar: () => {
    set((state) => ({ sidebarOpen: !state.sidebarOpen }));
  },

  setShowUpgradeModal: (show: boolean) => {
    set({ showUpgradeModal: show });
  },

  setSelectedApp: (app: App | null) => {
    set({ selectedApp: app });
  },
}));