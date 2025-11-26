// Vehicle Check Configuration
// 6 categories with ~23 total items for weekly vehicle inspection

export interface CheckItem {
  id: string;
  label: string;
}

export interface CheckCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  items: CheckItem[];
}

export const VEHICLE_CHECK_CATEGORIES: CheckCategory[] = [
  {
    id: 'motore',
    name: 'MOTORE & MECCANICA',
    icon: '🔧',
    color: '#EF4444',
    items: [
      { id: 'olio', label: 'Livello olio motore' },
      { id: 'liquido_freni', label: 'Livello liquido freni' },
      { id: 'liquido_raffreddamento', label: 'Livello liquido refrigerante' },
      { id: 'cinghie', label: 'Cinghie (integrità, tensione)' },
      { id: 'freni', label: 'Freni (funzionamento, rumori)' }
    ]
  },
  {
    id: 'luci',
    name: 'LUCI & ELETTRICA',
    icon: '💡',
    color: '#FBBF24',
    items: [
      { id: 'fari', label: 'Fari anteriori (abbaglianti/anabbaglianti)' },
      { id: 'frecce', label: 'Frecce anteriori e posteriori' },
      { id: 'stop', label: 'Luci di stop' },
      { id: 'luci_targa', label: 'Luci targa' },
      { id: 'batteria', label: 'Batteria (spie avviso)' }
    ]
  },
  {
    id: 'carrozzeria',
    name: 'CARROZZERIA & VETRI',
    icon: '🚗',
    color: '#3B82F6',
    items: [
      { id: 'carrozzeria', label: 'Carrozzeria (ammaccature/graffi)' },
      { id: 'parabrezza', label: 'Parabrezza (crepe/scheggiature)' },
      { id: 'specchietti', label: 'Specchietti retrovisori' },
      { id: 'tergicristalli', label: 'Tergicristalli (funzionamento)' }
    ]
  },
  {
    id: 'pneumatici',
    name: 'PNEUMATICI',
    icon: '🛞',
    color: '#8B5CF6',
    items: [
      { id: 'pressione', label: 'Pressione pneumatici' },
      { id: 'usura', label: 'Usura battistrada' },
      { id: 'danni', label: 'Danni visibili (tagli, bolle)' }
    ]
  },
  {
    id: 'liquidi',
    name: 'LIQUIDI',
    icon: '🧴',
    color: '#10B981',
    items: [
      { id: 'carburante', label: 'Livello carburante' },
      { id: 'lavavetri', label: 'Liquido lavavetri' }
    ]
  },
  {
    id: 'sicurezza',
    name: 'SICUREZZA',
    icon: '🛡️',
    color: '#F97316',
    items: [
      { id: 'cinture', label: 'Cinture di sicurezza' },
      { id: 'estintore', label: 'Estintore (presente e carico)' },
      { id: 'pronto_soccorso', label: 'Kit pronto soccorso' },
      { id: 'triangolo', label: 'Triangolo emergenza' }
    ]
  },
  {
    id: 'frigo',
    name: 'FRIGO',
    icon: '❄️',
    color: '#06B6D4',
    items: [
      { id: 'temperatura', label: 'Temperatura frigo' },
      { id: 'compressore', label: 'Funzionamento compressore' },
      { id: 'guarnizioni', label: 'Guarnizioni sportelli' },
      { id: 'pulizia_frigo', label: 'Pulizia interna' }
    ]
  }
];

// Total items count
export const TOTAL_CHECK_ITEMS = VEHICLE_CHECK_CATEGORIES.reduce(
  (total, category) => total + category.items.length,
  0
);
