export type UserRole = 'visitor' | 'cliente_gratuito' | 'cliente_premium' | 'dipendente' | 'admin';

export type AppStatus = 'FREE' | 'PRO' | 'COMING_SOON' | 'AZIENDALE';

export type AppControlStatus = 'pending' | 'approved' | 'rejected' | 'in_review';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  telefono?: string;
  azienda?: string;
  indirizzo?: string;
  citta?: string;
  cap?: string;
  partitaIva?: string;
  codiceCliente?: string;
  note?: string;
  abilitato: boolean;
  appPermessi: string[]; // Array di ID delle app accessibili
  createdAt: Date;
  lastLogin?: Date;
  updatedAt: Date;
}

export interface App {
  id: string;
  name: string;
  description: string;
  icon: string;
  badge: AppStatus;
  category: string;
  url: string;
  requiredRole: UserRole;
  isNew?: boolean;
  isPopular?: boolean;
  controlStatus?: AppControlStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  updateProfile: (data: {
    name: string;
    email: string;
    password?: string;
    telefono?: string;
    azienda?: string;
    indirizzo?: string;
    citta?: string;
    cap?: string;
    partitaIva?: string;
    codiceCliente?: string;
    note?: string;
    role?: UserRole;
    abilitato?: boolean;
    appPermessi?: string[];
  }) => Promise<void>;
  checkAuth: () => Promise<void>;
  // Funzioni admin
  getAllUsers: () => Promise<User[]>;
  createUserAsAdmin: (userData: any) => Promise<User>;
  updateUserAsAdmin: (id: string, updates: any) => Promise<User>;
  deleteUserAsAdmin: (id: string) => Promise<void>;
}

export interface AppStore {
  apps: App[];
  filteredApps: App[];
  selectedCategory: string;
  searchQuery: string;
  showUpgradeModal: boolean;
  favoriteApps: string[]; // Array di ID delle app preferite
  setApps: (apps: App[]) => void;
  setCategory: (category: string) => void;
  setSearchQuery: (query: string) => void;
  setShowUpgradeModal: (show: boolean) => void;
  toggleFavorite: (appId: string) => void; // Aggiungi/rimuovi preferito
  isFavorite: (appId: string) => boolean; // Controlla se è preferito
  filterApps: () => void;
}

export interface UIState {
  theme: 'light' | 'dark' | 'system';
  sidebarOpen: boolean;
  showUpgradeModal: boolean;
  selectedApp: App | null;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  toggleSidebar: () => void;
  setShowUpgradeModal: (show: boolean) => void;
  setSelectedApp: (app: App | null) => void;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  name: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}