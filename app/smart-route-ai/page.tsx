'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { ArrowLeft, RefreshCw, Zap, Truck, MapPin, Clock, Package, TrendingDown } from 'lucide-react';
import Link from 'next/link';

// Leaflet deve essere caricato dinamicamente per evitare errori SSR
const MapComponent = dynamic(() => import('./components/MapComponent'), { ssr: false });

interface Vehicle {
  id: number;
  name: string;
  plate: string;
  driver: string;
  driverId: number;
  employeeId: number | null;
  capacity: number;
  selected: boolean;
}

interface Picking {
  id: number;
  name: string;
  partnerId: number;
  partnerName: string;
  address: string;
  lat: number;
  lng: number;
  weight: number;
  scheduledDate: string;
  state: string;
}

interface Route {
  vehicle: Vehicle;
  pickings: Picking[];
  totalWeight: number;
  totalDistance: number;
  geoName?: string;
}

type Algorithm = 'geographic' | 'clarke-wright' | 'nearest';

export default function SmartRouteAIPage() {
  // State
  const [loading, setLoading] = useState(false);
  const [odooConnected, setOdooConnected] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [pickings, setPickings] = useState<Picking[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<Algorithm>('geographic');
  const [dynamicCapacity, setDynamicCapacity] = useState(1500);
  const [capacityInput, setCapacityInput] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [debugLogs, setDebugLogs] = useState<Array<{type: string, message: string, time: string}>>([]);
  const [toast, setToast] = useState<{message: string, type: string} | null>(null);
  const [optimizationTime, setOptimizationTime] = useState<string>('-');

  // Stats
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalWeight: 0,
    totalVehicles: 0,
    foundPickings: 0,
    withCoordinates: 0,
    unassignedOrders: 0,
    createdRoutes: 0,
    efficiency: '-'
  });

  // Refs
  const toastTimeout = useRef<NodeJS.Timeout>();

  // Debug log function
  const debugLog = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const log = {
      type,
      message,
      time: new Date().toLocaleTimeString('it-IT')
    };
    setDebugLogs(prev => [...prev.slice(-50), log]); // Keep last 50 logs
    console.log(`[${type.toUpperCase()}] ${message}`);
  };

  // Show toast notification
  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setToast({ message, type });
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    toastTimeout.current = setTimeout(() => setToast(null), 5000);
  };

  // Initialize: check Odoo connection and set today's date
  useEffect(() => {
    checkOdooConnection();
    const today = new Date().toISOString().split('T')[0];
    setDateFrom(today);
    setDateTo(today);
  }, []);

  // Check Odoo connection
  async function checkOdooConnection() {
    try {
      const response = await fetch('/api/smart-route-ai/session');
      const data = await response.json();

      if (data.connected && data.userId) {
        setOdooConnected(true);
        debugLog(`Connesso a Odoo - User ID: ${data.userId}`, 'success');
        // Auto-load vehicles
        loadVehicles();
      } else {
        setOdooConnected(false);
        debugLog('Non connesso a Odoo', 'warning');
      }
    } catch (error: any) {
      setOdooConnected(false);
      debugLog(`Errore verifica connessione: ${error.message}`, 'error');
    }
  }

  // Load vehicles from Odoo
  async function loadVehicles() {
    try {
      debugLog('Caricamento flotta veicoli...', 'info');
      setLoading(true);

      const response = await fetch('/api/smart-route-ai/vehicles');
      if (!response.ok) throw new Error('Errore caricamento veicoli');

      const data = await response.json();
      setVehicles(data.vehicles || []);

      debugLog(`Caricati ${data.vehicles?.length || 0} veicoli`, 'success');
      updateStats({ totalVehicles: data.vehicles?.length || 0 });

    } catch (error: any) {
      debugLog(`Errore caricamento veicoli: ${error.message}`, 'error');
      showToast('Errore caricamento veicoli', 'error');
    } finally {
      setLoading(false);
    }
  }

  // Import pickings from Odoo
  async function importPickings() {
    if (!dateFrom || !dateTo) {
      showToast('Seleziona le date', 'warning');
      return;
    }

    setLoading(true);
    debugLog(`Importazione WH/PICK dal ${dateFrom} al ${dateTo}...`, 'info');

    try {
      const response = await fetch('/api/smart-route-ai/pickings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dateFrom, dateTo })
      });

      if (!response.ok) throw new Error('Errore importazione picking');

      const data = await response.json();
      setPickings(data.pickings || []);

      debugLog(`Trovati ${data.pickings?.length || 0} WH/PICK`, 'success');

      updateStats({
        foundPickings: data.pickings?.length || 0,
        withCoordinates: data.withCoordinates || 0,
        totalOrders: data.pickings?.length || 0,
        totalWeight: data.pickings?.reduce((sum: number, p: Picking) => sum + p.weight, 0) || 0
      });

      calculateDynamicCapacity(data.pickings || []);
      showToast(`Importati ${data.pickings?.length || 0} picking`, 'success');

    } catch (error: any) {
      debugLog(`Errore importazione: ${error.message}`, 'error');
      showToast('Errore importazione picking', 'error');
    } finally {
      setLoading(false);
    }
  }

  // Calculate dynamic capacity
  function calculateDynamicCapacity(pickingsList: Picking[] = pickings) {
    const selectedCount = vehicles.filter(v => v.selected).length || vehicles.length || 1;

    if (pickingsList.length === 0) {
      setDynamicCapacity(1500);
    } else {
      const totalWeight = pickingsList.reduce((sum, p) => sum + p.weight, 0);
      // Formula: (Peso totale / Veicoli selezionati) + 10% margine
      const newCapacity = Math.ceil((totalWeight / selectedCount) * 1.1);
      setDynamicCapacity(newCapacity);
    }
  }

  // Update capacity manually
  function updateCapacity() {
    const newCapacity = parseFloat(capacityInput);

    if (isNaN(newCapacity) || newCapacity <= 0) {
      showToast('Inserisci una capacità valida', 'error');
      return;
    }

    setDynamicCapacity(newCapacity);
    setCapacityInput('');
    showToast(`Capacità aggiornata a ${newCapacity} kg`, 'success');
  }

  // Toggle vehicle selection
  function toggleVehicleSelection(vehicleId: number) {
    setVehicles(prev => prev.map(v =>
      v.id === vehicleId ? { ...v, selected: !v.selected } : v
    ));

    // Recalculate capacity when selection changes
    setTimeout(() => calculateDynamicCapacity(), 100);
  }

  // Optimize routes
  async function optimizeRoutes() {
    if (pickings.length === 0) {
      showToast('Nessun picking da ottimizzare', 'error');
      return;
    }

    const selectedVehicles = vehicles.filter(v => v.selected);
    if (selectedVehicles.length === 0) {
      showToast('Seleziona almeno un veicolo', 'error');
      return;
    }

    setLoading(true);
    debugLog(`Ottimizzazione con algoritmo: ${selectedAlgorithm}`, 'info');
    const startTime = Date.now();

    try {
      const response = await fetch('/api/smart-route-ai/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickings,
          vehicles: selectedVehicles,
          algorithm: selectedAlgorithm,
          capacity: dynamicCapacity
        })
      });

      if (!response.ok) throw new Error('Errore ottimizzazione');

      const data = await response.json();
      setRoutes(data.routes || []);

      const endTime = Date.now();
      const time = ((endTime - startTime) / 1000).toFixed(2);
      setOptimizationTime(`${time}s`);

      updateStats({
        createdRoutes: data.routes?.length || 0,
        unassignedOrders: data.unassigned || 0
      });

      debugLog(`Ottimizzazione completata in ${time}s`, 'success');
      showToast(`Ottimizzazione completata in ${time}s`, 'success');

    } catch (error: any) {
      debugLog(`Errore ottimizzazione: ${error.message}`, 'error');
      showToast('Errore durante ottimizzazione', 'error');
    } finally {
      setLoading(false);
    }
  }

  // Create batches in Odoo
  async function createBatches() {
    if (routes.length === 0) {
      showToast('Nessun percorso da creare', 'error');
      return;
    }

    setLoading(true);
    debugLog('Creazione batch in Odoo...', 'info');

    try {
      const response = await fetch('/api/smart-route-ai/create-batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routes })
      });

      if (!response.ok) throw new Error('Errore creazione batch');

      const data = await response.json();

      debugLog(`Creati ${data.created} batch in Odoo`, 'success');
      showToast(`Creati ${data.created} batch con successo`, 'success');

      // Ask to reset
      setTimeout(() => {
        if (confirm('Batch creati con successo! Vuoi pulire e ricominciare?')) {
          clearRoutes();
        }
      }, 1000);

    } catch (error: any) {
      debugLog(`Errore creazione batch: ${error.message}`, 'error');
      showToast('Errore creazione batch', 'error');
    } finally {
      setLoading(false);
    }
  }

  // Clear routes
  function clearRoutes() {
    setRoutes([]);
    setPickings([]);
    setOptimizationTime('-');
    updateStats({
      totalOrders: 0,
      totalWeight: 0,
      foundPickings: 0,
      withCoordinates: 0,
      unassignedOrders: 0,
      createdRoutes: 0
    });
    showToast('Percorsi puliti', 'info');
  }

  // Update stats helper
  function updateStats(newStats: Partial<typeof stats>) {
    setStats(prev => ({ ...prev, ...newStats }));
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            {/* Title */}
            <div className="flex items-center gap-4">
              <Link href="/" className="hover:bg-white/10 p-2 rounded-lg transition-colors">
                <ArrowLeft className="h-6 w-6" />
              </Link>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
                  🚚 Smart Route AI
                </h1>
                <p className="text-sm text-white/80">Ottimizzazione Percorsi con Odoo</p>
              </div>
            </div>

            {/* Connection Status */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${
              odooConnected ? 'bg-green-500' : 'bg-red-500'
            }`}>
              <span>{odooConnected ? '✓' : '⚠️'}</span>
              <span>{odooConnected ? 'Connesso' : 'Non connesso'}</span>
            </div>

            {/* Stats Bar */}
            <div className="flex gap-6 text-sm">
              <div className="text-center">
                <div className="text-2xl font-bold">{stats.totalOrders}</div>
                <div className="text-xs text-white/80">Ordini</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{stats.totalWeight}</div>
                <div className="text-xs text-white/80">Peso (kg)</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{stats.totalVehicles}</div>
                <div className="text-xs text-white/80">Veicoli</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{optimizationTime}</div>
                <div className="text-xs text-white/80">Tempo Ottim.</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-col lg:flex-row h-[calc(100vh-120px)]">
        {/* Sidebar */}
        <div className="w-full lg:w-96 bg-gray-50 border-r border-gray-200 overflow-y-auto p-4 space-y-4">

          {/* Dynamic Capacity */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span>⚖️</span> Capacità Dinamica
            </h3>
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg p-4 text-center mb-3">
              <div className="text-3xl font-bold">{dynamicCapacity}</div>
              <div className="text-sm opacity-90">kg per veicolo</div>
              <div className="text-xs opacity-75 mt-1">(Peso totale ÷ Veicoli) + 10%</div>
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                value={capacityInput}
                onChange={(e) => setCapacityInput(e.target.value)}
                placeholder="Override manuale"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <button
                onClick={updateCapacity}
                className="px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm font-semibold hover:bg-yellow-600 transition-colors"
              >
                ✏️
              </button>
            </div>
          </div>

          {/* Import Pickings */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span>📥</span> Importa WH/PICK
            </h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={importPickings}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-cyan-500 text-white rounded-lg text-sm font-semibold hover:bg-cyan-600 transition-colors disabled:opacity-50"
                >
                  📦 Importa
                </button>
                <button
                  onClick={importPickings}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm font-semibold hover:bg-yellow-600 transition-colors disabled:opacity-50"
                >
                  🔄 Aggiorna
                </button>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600">WH/PICK trovati:</span>
                  <span className="font-semibold">{stats.foundPickings}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Con coordinate:</span>
                  <span className="font-semibold">{stats.withCoordinates}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Vehicles List */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span>🚛</span> Flotta Veicoli
            </h3>
            <div className="max-h-64 overflow-y-auto space-y-2 mb-3">
              {vehicles.length === 0 ? (
                <div className="text-center text-gray-500 text-sm py-8">
                  Nessun veicolo disponibile
                </div>
              ) : (
                vehicles.map(vehicle => (
                  <div
                    key={vehicle.id}
                    onClick={() => toggleVehicleSelection(vehicle.id)}
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      vehicle.selected
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={vehicle.selected}
                        onChange={() => {}}
                        className="w-4 h-4"
                      />
                      <div className="flex-1">
                        <div className={`font-semibold text-sm ${vehicle.selected ? 'text-indigo-900' : 'text-gray-900'}`}>
                          {vehicle.name}
                        </div>
                        <div className={`text-xs ${vehicle.selected ? 'text-indigo-700' : 'text-gray-600'}`}>
                          {vehicle.driver}
                        </div>
                      </div>
                      <div className="text-xs bg-cyan-500 text-white px-2 py-1 rounded-full font-semibold">
                        {dynamicCapacity} kg
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <button
              onClick={loadVehicles}
              disabled={loading}
              className="w-full px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-semibold hover:bg-green-600 transition-colors disabled:opacity-50"
            >
              🔄 Carica Veicoli
            </button>
          </div>

          {/* Optimization */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span>🎯</span> Ottimizzazione
            </h3>

            {/* Algorithm Selector */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <button
                onClick={() => setSelectedAlgorithm('geographic')}
                className={`px-2 py-2 text-xs font-semibold rounded-lg border-2 transition-all ${
                  selectedAlgorithm === 'geographic'
                    ? 'border-indigo-500 bg-indigo-500 text-white'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                📍 Geografico
              </button>
              <button
                onClick={() => setSelectedAlgorithm('clarke-wright')}
                className={`px-2 py-2 text-xs font-semibold rounded-lg border-2 transition-all ${
                  selectedAlgorithm === 'clarke-wright'
                    ? 'border-indigo-500 bg-indigo-500 text-white'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                🔗 C-W
              </button>
              <button
                onClick={() => setSelectedAlgorithm('nearest')}
                className={`px-2 py-2 text-xs font-semibold rounded-lg border-2 transition-all ${
                  selectedAlgorithm === 'nearest'
                    ? 'border-indigo-500 bg-indigo-500 text-white'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                📏 Nearest
              </button>
            </div>

            <div className="flex gap-2 mb-3">
              <button
                onClick={optimizeRoutes}
                disabled={loading || pickings.length === 0}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Zap className="h-4 w-4" />
                Ottimizza
              </button>
              <button
                onClick={clearRoutes}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-semibold hover:bg-red-600 transition-colors"
              >
                🗑️ Pulisci
              </button>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-600">Non assegnati:</span>
                <span className="font-semibold">{stats.unassignedOrders}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Percorsi creati:</span>
                <span className="font-semibold">{stats.createdRoutes}</span>
              </div>
            </div>
          </div>

          {/* Create Batches */}
          {routes.length > 0 && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-500 rounded-lg shadow p-4">
              <h3 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
                <span>📋</span> Crea Batch in Odoo
              </h3>
              <div className="text-sm text-green-700 mb-3">
                {routes.length} percorsi pronti per la creazione
              </div>
              <button
                onClick={createBatches}
                disabled={loading}
                className="w-full px-4 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                ✅ Crea Batch e Assegna
              </button>
            </div>
          )}

          {/* Routes List */}
          {routes.length > 0 && (
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span>🗺️</span> Percorsi Ottimizzati
              </h3>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {routes.map((route, index) => (
                  <div
                    key={index}
                    className="p-3 bg-gray-50 border border-gray-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-all cursor-pointer"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <div className="font-semibold text-sm">{route.geoName || `Percorso ${index + 1}`}</div>
                      <div className="text-xs bg-indigo-500 text-white px-2 py-1 rounded-full">
                        {route.pickings.length}
                      </div>
                    </div>
                    <div className="text-xs text-gray-600 space-y-1">
                      <div className="flex items-center gap-2">
                        <Truck className="h-3 w-3" />
                        {route.vehicle.name} - {route.vehicle.driver}
                      </div>
                      <div className="flex justify-between">
                        <span>Peso: {route.totalWeight} kg</span>
                        <span>Distanza: {route.totalDistance.toFixed(1)} km</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Debug Toggle */}
          <button
            onClick={() => setDebugMode(!debugMode)}
            className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-semibold hover:bg-gray-900 transition-colors"
          >
            🐛 {debugMode ? 'Nascondi' : 'Mostra'} Debug
          </button>
        </div>

        {/* Map Area */}
        <div className="flex-1 relative">
          <MapComponent
            pickings={pickings}
            routes={routes}
            vehicles={vehicles}
          />
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 px-6 py-4 rounded-lg shadow-xl text-white font-semibold flex items-center gap-3 z-50 animate-slide-in ${
          toast.type === 'success' ? 'bg-green-600' :
          toast.type === 'error' ? 'bg-red-600' :
          toast.type === 'warning' ? 'bg-yellow-600' :
          'bg-gray-800'
        }`}>
          <span>
            {toast.type === 'success' ? '✓' :
             toast.type === 'error' ? '✗' :
             toast.type === 'warning' ? '⚠' : 'ℹ'}
          </span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Debug Panel */}
      {debugMode && (
        <div className="fixed bottom-6 left-6 w-96 max-h-80 bg-gray-900 text-green-400 font-mono text-xs rounded-lg shadow-xl overflow-y-auto z-50 p-4">
          <div className="font-bold text-white mb-2">🐛 Debug Log</div>
          {debugLogs.map((log, index) => (
            <div key={index} className={`mb-1 ${
              log.type === 'error' ? 'text-red-400' :
              log.type === 'success' ? 'text-green-400' :
              log.type === 'warning' ? 'text-yellow-400' :
              'text-cyan-400'
            }`}>
              [{log.time}] {log.message}
            </div>
          ))}
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 text-center shadow-2xl">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <div className="text-lg font-semibold text-gray-900">Caricamento...</div>
          </div>
        </div>
      )}
    </div>
  );
}
