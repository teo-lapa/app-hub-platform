'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TeamSelector } from './components/TeamSelector';
import { StatsGrid } from './components/StatsGrid';
import { ClientFilters } from './components/ClientFilters';
import { ClientGrid } from './components/ClientGrid';
import { ClientPopup } from './components/ClientPopup';
import { AdvancedDashboard } from './components/AdvancedDashboard';
import { FinancialDashboard } from './components/FinancialDashboard';
import { useOdooData } from './hooks/useOdooData';
import { MobileNavigation } from '@/components/mobile/MobileNavigation';

export default function DashboardVenditori() {
  const router = useRouter();
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showAdvancedDashboard, setShowAdvancedDashboard] = useState(false);
  const [showFinancialDashboard, setShowFinancialDashboard] = useState(false);

  const {
    user,
    teams,
    clients,
    stats,
    loading,
    error,
    connectionStatus,
    loadClientsForTeam
  } = useOdooData();

  // Carica clienti quando cambia il team
  useEffect(() => {
    if (selectedTeam) {
      loadClientsForTeam(selectedTeam);
    }
  }, [selectedTeam]);

  // Filtra clienti
  const filteredClients = clients.filter(client => {
    // Filtro per status
    if (activeFilter !== 'all') {
      if (activeFilter === 'active' && client.status !== 'active') return false;
      if (activeFilter === 'warning' && client.status !== 'warning') return false;
      if (activeFilter === 'inactive' && client.status !== 'inactive') return false;
      if (activeFilter === 'inactive_5weeks' && client.lastOrderDays < 35) return false;
      if (activeFilter === 'decreasing_5weeks' && client.trend !== 'decreasing') return false;
    }

    // Filtro per ricerca
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        client.name.toLowerCase().includes(query) ||
        client.email?.toLowerCase().includes(query) ||
        client.address?.toLowerCase().includes(query)
      );
    }

    return true;
  });

  const handleClientClick = (client: any) => {
    setSelectedClient(client);
  };

  const handleOpenAdvanced = () => {
    setShowAdvancedDashboard(true);
  };

  const handleOpenFinancial = () => {
    setShowFinancialDashboard(true);
  };

  return (
    <div className="min-h-screen-dynamic bg-slate-50 pb-20 md:pb-8">
      {/* Header */}
      <header className="bg-white shadow-md rounded-xl mb-4 sm:mb-6 md:mb-8 p-3 sm:p-4 md:p-5">
        <div className="max-w-7xl mx-auto">
          {/* First row - Home button and title */}
          <div className="flex items-center justify-between gap-2 sm:gap-3 mb-3 md:mb-4">
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-1 min-w-0">
              {/* Home Button */}
              <button
                onClick={() => router.push('/dashboard')}
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 md:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors text-xs sm:text-sm md:text-base min-h-touch shrink-0"
                title="Torna alla home"
              >
                <span>🏠</span>
                <span className="hidden xs:inline">Home</span>
              </button>

              <div className="text-sm sm:text-lg md:text-2xl font-bold text-blue-600 truncate">
                📊 <span className="hidden sm:inline">Gestione Clienti Vendite</span>
                <span className="sm:hidden">Clienti</span>
              </div>
            </div>

            {/* Connection Status - Hidden on mobile, shown on tablet+ */}
            <div
              className={`hidden sm:flex items-center gap-2 px-3 py-2 rounded-full text-xs md:text-sm font-semibold shrink-0 ${
                connectionStatus === 'connected'
                  ? 'bg-green-100 text-green-700 border-2 border-green-500'
                  : 'bg-red-100 text-red-700 border-2 border-red-500'
              }`}
            >
              <span>{connectionStatus === 'connected' ? '✓' : '🔄'}</span>
              <span className="hidden md:inline">{connectionStatus === 'connected' ? 'Connesso' : 'Connessione...'}</span>
            </div>
          </div>

          {/* Second row - Team selector and user info */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 md:gap-4">
            <div className="flex-1">
              <TeamSelector
                teams={teams}
                selectedTeam={selectedTeam}
                onTeamChange={setSelectedTeam}
              />
            </div>

            {/* User Info */}
            <div className="flex items-center gap-2 sm:gap-3 bg-slate-100 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm shrink-0">
              <div>
                <div className="font-semibold truncate max-w-[150px] sm:max-w-none">{user?.name || 'Caricamento...'}</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-3 sm:px-4">
        {/* Team Banner */}
        {selectedTeam && (
          <div className="bg-gradient-to-br from-blue-600 to-emerald-600 text-white p-3 sm:p-4 md:p-6 rounded-xl mb-4 sm:mb-5 md:mb-6 shadow-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 md:gap-6 items-center">
              <div>
                <h3 className="text-base sm:text-xl md:text-2xl font-bold mb-1 sm:mb-2">
                  {teams.find(t => t.id === selectedTeam)?.name}
                </h3>
                <p className="opacity-90 text-xs sm:text-sm md:text-base">
                  {teams.find(t => t.id === selectedTeam)?.description || 'Seleziona un team'}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:gap-3 md:gap-6">
                <div className="text-center">
                  <div className="text-lg sm:text-2xl md:text-3xl font-bold">
                    {teams.find(t => t.id === selectedTeam)?.memberCount || 0}
                  </div>
                  <div className="text-xs sm:text-sm opacity-90">Membri</div>
                </div>
                <div className="text-center">
                  <div className="text-lg sm:text-2xl md:text-3xl font-bold">
                    <span className="hidden sm:inline">CHF </span>
                    {Math.round(teams.find(t => t.id === selectedTeam)?.invoicedTarget || 0).toLocaleString()}
                  </div>
                  <div className="text-xs sm:text-sm opacity-90">Target</div>
                </div>
                <div className="text-center">
                  <div className="text-lg sm:text-2xl md:text-3xl font-bold">
                    <span className="hidden sm:inline">CHF </span>
                    {Math.round(teams.find(t => t.id === selectedTeam)?.invoiced || 0).toLocaleString()}
                  </div>
                  <div className="text-xs sm:text-sm opacity-90">
                    <span className="hidden xs:inline">Fatturato</span>
                    <span className="xs:hidden">Fatt.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <StatsGrid stats={stats} loading={loading} />

        {/* Filters */}
        <ClientFilters
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        {/* Client Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <div className="text-slate-500">Caricamento dashboard...</div>
          </div>
        ) : error ? (
          <div className="text-center py-12 px-6 bg-red-50 border-2 border-red-200 rounded-xl text-red-600">
            {error}
          </div>
        ) : (
          <ClientGrid
            clients={filteredClients}
            onClientClick={handleClientClick}
          />
        )}
      </div>

      {/* Popups */}
      {selectedClient && (
        <ClientPopup
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
          onOpenAdvanced={handleOpenAdvanced}
          onOpenFinancial={handleOpenFinancial}
        />
      )}

      {showAdvancedDashboard && selectedClient && (
        <AdvancedDashboard
          client={selectedClient}
          onClose={() => setShowAdvancedDashboard(false)}
        />
      )}

      {showFinancialDashboard && selectedClient && (
        <FinancialDashboard
          client={selectedClient}
          onClose={() => setShowFinancialDashboard(false)}
        />
      )}

      {/* Mobile Navigation */}
      <div className="md:hidden">
        <MobileNavigation />
      </div>
    </div>
  );
}
