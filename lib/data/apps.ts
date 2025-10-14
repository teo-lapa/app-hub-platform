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
    name: 'Ordini Fornitori Intelligenti',
    description: 'Sistema AI per gestione automatica ordini fornitori. Analizza vendite, calcola fabbisogni e crea ordini ottimizzati per fornitore.',
    icon: '🛒',
    badge: 'PRO',
    category: 'Business',
    url: '/ordini-fornitori',
    requiredRole: 'cliente_premium',
    isNew: true,
    isPopular: true,
    controlStatus: 'approved',
    createdAt: new Date('2025-01-15'),
    updatedAt: new Date('2025-01-15'),
  },
  {
    id: '8',
    name: 'LAPA Delivery',
    description: 'Sistema completo per gestione consegne. GPS tracking, firma digitale, scarico prodotti, pagamenti e resi. Ottimizzazione percorso automatica con ETA in tempo reale.',
    icon: '🚚',
    badge: 'PRO',
    category: 'Business',
    url: '/delivery',
    requiredRole: 'cliente_premium',
    isNew: true,
    isPopular: true,
    controlStatus: 'approved',
    createdAt: new Date('2025-01-20'),
    updatedAt: new Date('2025-01-20'),
  },
  {
    id: '9',
    name: 'Gestione Inventario',
    description: 'Scanner ubicazioni, conteggio prodotti con lotti e scadenze. Aggiornamento stock in tempo reale su Odoo.',
    icon: '📦',
    badge: 'PRO',
    category: 'Business',
    url: '/inventario',
    requiredRole: 'cliente_premium',
    isNew: true,
    isPopular: true,
    controlStatus: 'approved',
    createdAt: new Date('2025-01-22'),
    updatedAt: new Date('2025-01-22'),
  },
  {
    id: '10',
    name: 'Gestione Ubicazioni',
    description: 'Trasferisci prodotti dal buffer alle ubicazioni di stoccaggio. Gestione zone (Secco, Frigo, Pingu) con scanner barcode e tracking lotti.',
    icon: '🏭',
    badge: 'PRO',
    category: 'Business',
    url: '/ubicazioni',
    requiredRole: 'cliente_premium',
    isNew: true,
    isPopular: true,
    controlStatus: 'approved',
    createdAt: new Date('2025-01-23'),
    updatedAt: new Date('2025-01-23'),
  },
  {
    id: '11',
    name: 'Controllo Diretto',
    description: 'Controllo veloce dei prelievi raggruppati per prodotto. Vedi totali richiesti vs prelevati senza girare per le ubicazioni.',
    icon: '✅',
    badge: 'PRO',
    category: 'Business',
    url: '/controllo-diretto',
    requiredRole: 'cliente_premium',
    isNew: true,
    isPopular: true,
    controlStatus: 'approved',
    createdAt: new Date('2025-01-24'),
    updatedAt: new Date('2025-01-24'),
  },
  {
    id: '12',
    name: 'Arrivo Merce',
    description: 'Sistema intelligente per ricezione merce. Carica la fattura (PDF o foto), il sistema la analizza con AI e compila automaticamente la ricezione in Odoo con lotti e scadenze.',
    icon: '📥',
    badge: 'PRO',
    category: 'Business',
    url: '/arrivo-merce',
    requiredRole: 'cliente_premium',
    isNew: true,
    isPopular: true,
    controlStatus: 'approved',
    createdAt: new Date('2025-10-09'),
    updatedAt: new Date('2025-10-09'),
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