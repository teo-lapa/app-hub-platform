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
  odoo_employee_id?: number; // ID employee Odoo per permessi Maestro AI
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
  visible?: boolean;  // Visibilità app (dall'API)
  visibilityGroup?: string;  // Gruppo visibilità (dall'API)
  developmentStatus?: string;  // Stato sviluppo (dall'API)
  groups?: any;  // Dati gruppi per gestione visibilità
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
  loadAppsForUser: (userRole?: string, userEmail?: string) => Promise<void>; // Carica app filtrate da API
  loadUserFavorites: (userId: string) => Promise<void>; // Carica preferiti da API
  toggleFavorite: (appId: string, userId?: string) => Promise<void>; // Aggiungi/rimuovi preferito
  isFavorite: (appId: string) => boolean; // Controlla se è preferito
  filterApps: () => void;
}

// ============================================
// VOICE RECORDINGS TYPES
// ============================================

export type VoiceRecordingCategory = 'arrivo_merce' | 'inventory' | 'note' | 'order' | 'other';
export type VoiceRecordingAIStatus = 'pending' | 'transcribing' | 'processing' | 'completed' | 'failed';

export interface ExtractedProduct {
  name: string;
  quantity?: number;
  weight?: number;
  unit?: string; // 'kg', 'g', 'pz', 'lt', etc.
  odoo_product_id?: number; // ID prodotto Odoo se matchato
  confidence?: number; // Confidence dell'AI (0-1)
}

export interface VoiceRecording {
  id: string;
  user_id: number;
  plaud_file_id?: string;
  name: string;
  description?: string;
  category: VoiceRecordingCategory;

  // Audio & Storage
  audio_url?: string;
  audio_format: string;
  duration?: number; // in secondi
  file_size?: number; // in bytes

  // AI Processing
  transcription?: string;
  summary?: string;
  ai_status: VoiceRecordingAIStatus;
  ai_error?: string;

  // Extracted Data
  extracted_products: ExtractedProduct[];

  // Odoo Integration
  odoo_picking_id?: number;
  odoo_partner_id?: number;

  // Metadata
  tags: string[];
  metadata: Record<string, any>;

  // Timestamps
  created_at: Date;
  updated_at: Date;
  processed_at?: Date;
}

export interface VoiceRecordingUploadRequest {
  name: string;
  description?: string;
  category: VoiceRecordingCategory;
  audio_file: File;
  tags?: string[];
}

export interface VoiceRecordingResponse {
  success: boolean;
  recording?: VoiceRecording;
  error?: string;
}

// ============================================
// PLAUD API TYPES
// ============================================

export interface PlaudAPIToken {
  api_token: string;
  expires_at?: number;
}

export interface PlaudFile {
  id: string;
  name: string;
  description?: string;
  start_time: string;
  end_time: string;
  duration: number;
  device_id?: string;
  audio_url?: string; // presigned URL
  ai_status?: string;
  ai_result_list?: any[];
  ai_data?: any;
}

export interface PlaudWebhookPayload {
  event_type: 'audio_transcribe.completed' | string;
  data: {
    file_id: string;
    [key: string]: any;
  };
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

// Waste Management Types
export interface WasteLocationProduct {
  id: number;              // Product ID
  name: string;            // Product name
  code: string;            // Product code (default_code)
  barcode: string;         // Product barcode/EAN
  image: string | null;    // Base64 image (data:image/png;base64,...)
  quantity: number;        // Available quantity
  uom: string;             // Unit of measure (e.g., "PZ", "KG")
  lot_id?: number;         // Lot ID (optional)
  lot_name?: string;       // Lot name/number (optional)
  expiration_date?: string;// Expiration date ISO format (optional)
  quant_id: number;        // Stock quant ID for reference
}

export interface WasteLocationProductsResponse {
  success: boolean;
  products: WasteLocationProduct[];
  metadata: {
    locationId: number;      // Requested location ID
    totalProducts: number;   // Total number of products
    totalQuants: number;     // Original number of quants
    withLots: number;        // Products with lot tracking
    withExpiration: number;  // Products with expiration date
  };
  error?: string;
}