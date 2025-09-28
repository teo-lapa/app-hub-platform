import { App } from '@/lib/types';

export const mockApps: App[] = [
  {
    id: '1',
    name: 'Menu App',
    description: 'Gestisci il menu del tuo ristorante con facilità. Crea, modifica e organizza i piatti con foto e prezzi.',
    icon: '🍽️',
    badge: 'FREE',
    category: 'Business',
    url: '/apps/menu-app',
    requiredRole: 'cliente_gratuito',
    isPopular: true,
    controlStatus: 'in_review',
    createdAt: new Date('2023-01-15'),
    updatedAt: new Date('2023-12-01'),
  },
  {
    id: '2',
    name: 'Booking System',
    description: 'Sistema di prenotazioni completo per hotel, ristoranti e servizi. Gestisci calendari e disponibilità.',
    icon: '📅',
    badge: 'PRO',
    category: 'Business',
    url: '/apps/booking',
    requiredRole: 'cliente_premium',
    isNew: true,
    controlStatus: 'pending',
    createdAt: new Date('2023-03-10'),
    updatedAt: new Date('2023-12-15'),
  },
  {
    id: '3',
    name: 'AI Chat',
    description: 'Chatbot intelligente per il customer service. Integra AI avanzata per risposte automatiche.',
    icon: '🤖',
    badge: 'PRO',
    category: 'AI & Tech',
    url: '/apps/ai-chat',
    requiredRole: 'cliente_premium',
    isPopular: true,
    isNew: true,
    controlStatus: 'pending',
    createdAt: new Date('2023-06-20'),
    updatedAt: new Date('2023-12-20'),
  },
  {
    id: '4',
    name: 'Analytics Dashboard',
    description: 'Dashboard completo per analizzare le performance del tuo business con grafici interattivi.',
    icon: '📊',
    badge: 'FREE',
    category: 'Analytics',
    url: '/apps/analytics',
    requiredRole: 'cliente_gratuito',
    controlStatus: 'in_review',
    createdAt: new Date('2023-02-05'),
    updatedAt: new Date('2023-11-30'),
  },
  {
    id: '5',
    name: 'Task Manager',
    description: 'Organizza progetti e task del team. Collaborazione in tempo reale con notifiche e deadline.',
    icon: '✅',
    badge: 'FREE',
    category: 'Productivity',
    url: '/apps/tasks',
    requiredRole: 'cliente_gratuito',
    isPopular: true,
    controlStatus: 'in_review',
    createdAt: new Date('2023-04-12'),
    updatedAt: new Date('2023-12-10'),
  },
  {
    id: '6',
    name: 'Invoice Generator',
    description: 'Crea fatture professionali in pochi click. Template personalizzabili e invio automatico.',
    icon: '🧾',
    badge: 'COMING_SOON',
    category: 'Finance',
    url: '/apps/invoices',
    requiredRole: 'cliente_premium',
    controlStatus: 'pending',
    createdAt: new Date('2023-08-01'),
    updatedAt: new Date('2023-12-25'),
  },
  {
    id: '7',
    name: 'Gestione Inventario',
    description: 'Scanner QR/Barcode per ubicazioni e prodotti. Gestione inventario completa con conteggi e trasferimenti.',
    icon: '📍',
    badge: 'FREE',
    category: 'Business',
    url: '/inventario',
    requiredRole: 'cliente_gratuito',
    isPopular: true,
    isNew: true,
    controlStatus: 'in_review',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
  },
  {
    id: '8',
    name: 'Catalogo LAPA',
    description: 'Catalogo prodotti completo con ricerca avanzata. Visualizza tutti i prodotti del database Odoo con immagini, prezzi e disponibilità.',
    icon: '📦',
    badge: 'FREE',
    category: 'Business',
    url: '/catalogo-lapa',
    requiredRole: 'cliente_gratuito',
    isPopular: true,
    isNew: true,
    controlStatus: 'in_review',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
  },
];

export const categories = [
  'Tutti',
  'Business',
  'AI & Tech',
  'Analytics',
  'Productivity',
  'Finance'
];

export const getAppsByCategory = (category: string): App[] => {
  if (category === 'Tutti') return mockApps;
  return mockApps.filter(app => app.category === category);
};

export const getAppById = (id: string): App | undefined => {
  return mockApps.find(app => app.id === id);
};

export const getPopularApps = (): App[] => {
  return mockApps.filter(app => app.isPopular);
};

export const getNewApps = (): App[] => {
  return mockApps.filter(app => app.isNew);
};

export const getFreeApps = (): App[] => {
  return mockApps.filter(app => app.badge === 'FREE');
};

export const getProApps = (): App[] => {
  return mockApps.filter(app => app.badge === 'PRO');
};