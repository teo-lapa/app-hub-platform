'use client';

import { useState, useEffect } from 'react';
import {
  Package,
  ShoppingCart,
  Phone,
  Users,
  Truck,
  MapPin,
  Warehouse,
  Route,
  BarChart3,
  ArrowLeft,
  Home,
  ExternalLink,
  Search,
  Grid3X3,
  List,
  Eye,
  EyeOff
} from 'lucide-react';
import Link from 'next/link';

interface App {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: string;
  color: string;
  path: string;
}

const apps: App[] = [
  {
    id: 'app-per-inventario',
    name: 'Gestione Inventario',
    description: 'Controllo ubicazioni e gestione magazzino',
    icon: <Package className="h-8 w-8" />,
    category: 'Magazzino',
    color: 'from-emerald-500 to-teal-600',
    path: '/api/gestione-apps/app-per-inventario'
  },
  {
    id: 'catalogo-venditori-completo',
    name: 'Catalogo Venditori',
    description: 'Catalogo completo per la forza vendita',
    icon: <ShoppingCart className="h-8 w-8" />,
    category: 'Vendite',
    color: 'from-blue-500 to-indigo-600',
    path: '/api/gestione-apps/catalogo-venditori-completo'
  },
  {
    id: 'centralino-ai-lapa-agenti',
    name: 'Centralino AI',
    description: 'Sistema di gestione chiamate con AI',
    icon: <Phone className="h-8 w-8" />,
    category: 'Comunicazioni',
    color: 'from-purple-500 to-violet-600',
    path: '/api/gestione-apps/centralino-ai-lapa-agenti'
  },
  {
    id: 'clientivision',
    name: 'ClientiVision',
    description: 'Gestione e analisi clienti',
    icon: <Users className="h-8 w-8" />,
    category: 'CRM',
    color: 'from-rose-500 to-pink-600',
    path: '/api/gestione-apps/clientivision'
  },
  {
    id: 'controllo-consegne-per-venditore',
    name: 'Controllo Consegne',
    description: 'Monitoraggio consegne per venditore',
    icon: <Truck className="h-8 w-8" />,
    category: 'Logistica',
    color: 'from-orange-500 to-red-600',
    path: '/api/gestione-apps/controllo-consegne-per-venditore'
  },
  {
    id: 'controllo-diretto',
    name: 'Controllo Diretto',
    description: 'Supervisione diretta operazioni',
    icon: <BarChart3 className="h-8 w-8" />,
    category: 'Controlli',
    color: 'from-cyan-500 to-blue-600',
    path: '/api/gestione-apps/controllo-diretto'
  },
  {
    id: 'dashboard-gestione-app-lapa',
    name: 'Dashboard Gestione',
    description: 'Centro di controllo principale',
    icon: <Grid3X3 className="h-8 w-8" />,
    category: 'Dashboard',
    color: 'from-slate-500 to-gray-600',
    path: '/api/gestione-apps/dashboard-gestione-app-lapa'
  },
  {
    id: 'lapa-dashboard-venditori',
    name: 'Dashboard Venditori',
    description: 'Pannello di controllo venditori',
    icon: <BarChart3 className="h-8 w-8" />,
    category: 'Vendite',
    color: 'from-green-500 to-emerald-600',
    path: '/api/gestione-apps/lapa-dashboard-venditori'
  },
  {
    id: 'lapa-delivery',
    name: 'LAPA Delivery',
    description: 'Gestione sistema delivery',
    icon: <Truck className="h-8 w-8" />,
    category: 'Logistica',
    color: 'from-yellow-500 to-orange-600',
    path: '/api/gestione-apps/lapa-delivery'
  },
  {
    id: 'mappa-controllo-lapa',
    name: 'Mappa Controllo',
    description: 'Controllo geografico operazioni',
    icon: <MapPin className="h-8 w-8" />,
    category: 'Logistica',
    color: 'from-indigo-500 to-purple-600',
    path: '/api/gestione-apps/mappa-controllo-lapa'
  },
  {
    id: 'operazioni-di-magazzino',
    name: 'Operazioni Magazzino',
    description: 'Gestione operazioni di magazzino',
    icon: <Warehouse className="h-8 w-8" />,
    category: 'Magazzino',
    color: 'from-teal-500 to-cyan-600',
    path: '/api/gestione-apps/operazioni-di-magazzino'
  },
  {
    id: 'pick-residui',
    name: 'Pick Residui',
    description: 'Gestione picking residui',
    icon: <Package className="h-8 w-8" />,
    category: 'Magazzino',
    color: 'from-red-500 to-rose-600',
    path: '/api/gestione-apps/pick-residui'
  },
  {
    id: 'prelievo-per-zone',
    name: 'Prelievo per Zone',
    description: 'Organizzazione prelievi per zona',
    icon: <MapPin className="h-8 w-8" />,
    category: 'Magazzino',
    color: 'from-lime-500 to-green-600',
    path: '/api/gestione-apps/prelievo-per-zone'
  },
  {
    id: 'sistema-di-ordini-intelligente-lapa',
    name: 'Sistema Ordini AI',
    description: 'Gestione ordini intelligente',
    icon: <BarChart3 className="h-8 w-8" />,
    category: 'Vendite',
    color: 'from-violet-500 to-purple-600',
    path: '/api/gestione-apps/sistema-di-ordini-intelligente-lapa'
  },
  {
    id: 'sistemare-ritorni-dal-furgone',
    name: 'Gestione Ritorni',
    description: 'Sistemazione ritorni dal furgone',
    icon: <Truck className="h-8 w-8" />,
    category: 'Logistica',
    color: 'from-amber-500 to-yellow-600',
    path: '/api/gestione-apps/sistemare-ritorni-dal-furgone'
  },
  {
    id: 'smart-route-ai',
    name: 'Smart Route AI',
    description: 'Ottimizzazione percorsi con AI',
    icon: <Route className="h-8 w-8" />,
    category: 'Logistica',
    color: 'from-pink-500 to-rose-600',
    path: '/api/gestione-apps/smart-route-ai'
  },
  {
    id: 'super-utente-magazzino',
    name: 'Super User Magazzino',
    description: 'Controllo avanzato magazzino',
    icon: <Warehouse className="h-8 w-8" />,
    category: 'Magazzino',
    color: 'from-gray-500 to-slate-600',
    path: '/api/gestione-apps/super-utente-magazzino'
  }
];

const categories = Array.from(new Set(apps.map(app => app.category)));

export default function GestioneAppsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tutte');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [appVisibility, setAppVisibility] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  // Carica stato visibilità all'avvio
  useEffect(() => {
    loadVisibility();
  }, []);

  const loadVisibility = async () => {
    try {
      const response = await fetch('/api/apps/visibility');
      const data = await response.json();

      if (data.success) {
        const visibility: Record<string, boolean> = {};
        data.apps.forEach((app: any) => {
          visibility[app.id] = app.visible;
        });
        setAppVisibility(visibility);
      }
    } catch (error) {
      console.error('Errore caricamento visibilità:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleVisibility = async (appId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const newVisibility = !appVisibility[appId];

    // Aggiorna subito UI
    setAppVisibility(prev => ({
      ...prev,
      [appId]: newVisibility
    }));

    // Salva su server
    try {
      const allApps = apps.map(app => ({
        id: app.id,
        name: app.name,
        icon: '📱',
        category: app.category,
        visible: app.id === appId ? newVisibility : (appVisibility[app.id] !== false)
      }));

      await fetch('/api/apps/visibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apps: allApps })
      });
    } catch (error) {
      console.error('Errore salvataggio:', error);
      // Ripristina in caso di errore
      setAppVisibility(prev => ({
        ...prev,
        [appId]: !newVisibility
      }));
    }
  };

  const filteredApps = apps.filter(app => {
    const matchesSearch = app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         app.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'Tutte' || app.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="bg-slate-900/80 backdrop-blur-sm border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center space-x-4">
                {/* Pulsante Indietro */}
                <Link
                  href="/"
                  className="flex items-center space-x-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg border border-slate-600 transition-colors group"
                >
                  <ArrowLeft className="h-5 w-5 text-slate-300 group-hover:text-white" />
                  <Home className="h-5 w-5 text-slate-300 group-hover:text-white" />
                  <span className="text-slate-300 group-hover:text-white font-medium">Home</span>
                </Link>

                <div className="flex items-center space-x-3">
                  <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-3 rounded-xl">
                    <Grid3X3 className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-white">Gestione Apps LAPA</h1>
                    <p className="text-slate-300">Hub di controllo applicazioni aziendali</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 lg:mt-0">
                <div className="bg-slate-800/50 px-4 py-2 rounded-lg border border-slate-600">
                  <div className="text-sm text-slate-300">
                    <span className="font-semibold text-blue-400">{apps.length}</span> applicazioni disponibili
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Controlli */}
        <div className="mb-8 space-y-4">
          {/* Barra di ricerca */}
          <div className="max-w-2xl">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cerca applicazioni..."
                className="block w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* Filtri e controlli visualizzazione */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCategory('Tutte')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedCategory === 'Tutte'
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50'
                }`}
              >
                Tutte
              </button>
              {categories.map(category => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedCategory === category
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50'
                }`}
              >
                <Grid3X3 className="h-5 w-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === 'list'
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50'
                }`}
              >
                <List className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Griglia/Lista App */}
        {filteredApps.length > 0 ? (
          <div className={viewMode === 'grid'
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
            : 'space-y-4'
          }>
            {filteredApps.map((app) => {
              const isVisible = appVisibility[app.id] !== false;
              return (
                <div
                  key={app.id}
                  className={`group relative ${viewMode === 'grid'
                    ? 'bg-slate-800/40 backdrop-blur-sm rounded-xl border p-6 transition-all duration-300'
                    : 'bg-slate-800/40 backdrop-blur-sm rounded-xl border p-4 transition-all duration-300 flex items-center space-x-4'
                  } ${isVisible ? 'border-slate-600/50 hover:border-blue-500/50' : 'border-red-500/50 opacity-60'}`}
                >
                  {/* Toggle visibilità in alto a destra */}
                  <button
                    onClick={(e) => toggleVisibility(app.id, e)}
                    className={`absolute top-3 right-3 p-2 rounded-lg transition-all z-10 ${
                      isVisible
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30'
                        : 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                    }`}
                    title={isVisible ? 'Nascondi app' : 'Mostra app'}
                  >
                    {isVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>

                  <a
                    href={app.path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1"
                  >
                    <div className={`bg-gradient-to-r ${app.color} ${viewMode === 'grid' ? 'p-4 rounded-xl mb-4 inline-block' : 'p-3 rounded-lg'}`}>
                      {app.icon}
                    </div>

                    <div className={viewMode === 'grid' ? '' : 'flex-1'}>
                      <h3 className={`font-semibold text-white group-hover:text-blue-400 transition-colors ${viewMode === 'grid' ? 'text-lg mb-2' : 'text-base mb-1'}`}>
                        {app.name}
                      </h3>
                      <p className={`text-slate-400 ${viewMode === 'grid' ? 'text-sm mb-3' : 'text-sm'}`}>
                        {app.description}
                      </p>

                      <div className={`flex items-center ${viewMode === 'grid' ? 'justify-between' : 'justify-end space-x-3'}`}>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-300">
                          {app.category}
                        </span>
                        {viewMode === 'grid' && (
                          <ExternalLink className="h-4 w-4 text-slate-400 group-hover:text-blue-400 transition-colors" />
                        )}
                      </div>
                    </div>

                    {viewMode === 'list' && (
                      <ExternalLink className="h-5 w-5 text-slate-400 group-hover:text-blue-400 transition-colors" />
                    )}
                  </a>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <Search className="h-16 w-16 text-slate-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-300 mb-2">Nessuna app trovata</h3>
            <p className="text-slate-400">
              Prova con termini di ricerca diversi o cambia categoria
            </p>
          </div>
        )}
      </div>
    </div>
  );
}