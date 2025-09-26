export type UserRole = 'visitor' | 'free_user' | 'pro_user' | 'admin';

export type AppStatus = 'FREE' | 'PRO' | 'COMING_SOON';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  createdAt: Date;
  lastLogin?: Date;
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
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  updateProfile: (data: { name: string; email: string; password?: string }) => Promise<void>;
  checkAuth: () => Promise<void>;
}

export interface AppStore {
  apps: App[];
  filteredApps: App[];
  selectedCategory: string;
  searchQuery: string;
  showUpgradeModal: boolean;
  setApps: (apps: App[]) => void;
  setCategory: (category: string) => void;
  setSearchQuery: (query: string) => void;
  setShowUpgradeModal: (show: boolean) => void;
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