'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { ArrowLeft, RefreshCw, Zap, Truck, MapPin, Clock, Package, TrendingDown, Menu, X } from 'lucide-react';
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
  batchId: number | null;
  batchName: string | null;
  batchVehicleName: string | null;
  batchDriverName: string | null;
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
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [vehiclesExpanded, setVehiclesExpanded] = useState(false);
  const [batches, setBatches] = useState<Array<{id: number, name: string, state: string, vehicleName: string | null, driverName: string | null, totalWeight: number, pickingCount: number}>>([]);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [selectedPickingForMove, setSelectedPickingForMove] = useState<{id: number, currentBatch: string, date: string} | null>(null);
  const [showVehicleBatchModal, setShowVehicleBatchModal] = useState(false);
  const [selectedVehicleForBatch, setSelectedVehicleForBatch] = useState<{id: number, name: string, plate: string, driver: string, driverId: number, employeeId: number | null} | null>(null);
  const [showBatchStateModal, setShowBatchStateModal] = useState(false);
  const [selectedBatchForStateChange, setSelectedBatchForStateChange] = useState<{id: number, name: string, currentState: string, nextState: string, hasVehicle: boolean} | null>(null);
  const [selectedVehicleForStateChange, setSelectedVehicleForStateChange] = useState<{id: number, name: string, plate: string, driver: string, driverId: number, employeeId: number | null} | null>(null);
  const [batchPickings, setBatchPickings] = useState<Array<{id: number, name: string, partnerName: string, scheduledDate: string, weight: number, products: Array<{id: number, productName: string, quantity: number, uom: string, weight: number}>}>>([]);
  const [expandedPickingId, setExpandedPickingId] = useState<number | null>(null);
  const [loadingPickings, setLoadingPickings] = useState(false);

  // Route colors - well distinguished colors
  const ROUTE_COLORS = [
    '#4f46e5', // indigo
    '#db2777', // pink
    '#059669', // emerald
    '#d97706', // amber/orange
    '#dc2626', // red
    '#16a34a', // green
    '#ea580c', // orange
    '#7c3aed', // violet
    '#2563eb', // blue
    '#8b5cf6', // purple
    '#0891b2', // cyan
    '#ca8a04', // yellow
    '#be123c', // rose
    '#0d9488', // teal
    '#c026d3', // fuchsia
  ];

  // Create a stable mapping of batch ID to color index
  const [batchColorMap, setBatchColorMap] = useState<Map<number, number>>(new Map());

  // Update color map when batches change
  useEffect(() => {
    const newMap = new Map<number, number>();
    const sortedBatches = [...batches].sort((a, b) => a.id - b.id);

    sortedBatches.forEach((batch, index) => {
      newMap.set(batch.id, index % ROUTE_COLORS.length);
    });

    setBatchColorMap(newMap);
  }, [batches]);

  // Function to get consistent color for a batch
  const getBatchColor = (batchId: number) => {
    const colorIndex = batchColorMap.get(batchId);
    if (colorIndex !== undefined) {
      return ROUTE_COLORS[colorIndex];
    }
    // Fallback
    return ROUTE_COLORS[0];
  };

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

  // Auto-load today's pickings when connected and dates are set
  useEffect(() => {
    if (odooConnected && dateFrom && dateTo && pickings.length === 0) {
      importPickings();
    }
  }, [odooConnected, dateFrom, dateTo]);

  // Expose showBatchSelector to global window for map popup
  useEffect(() => {
    (window as any).showBatchSelector = (pickingId: number, currentBatch: string, date: string) => {
      setSelectedPickingForMove({ id: pickingId, currentBatch, date });
      setShowBatchModal(true);
    };

    return () => {
      delete (window as any).showBatchSelector;
    };
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

      // Load batches for the selected date
      await loadBatches(dateFrom);

    } catch (error: any) {
      debugLog(`Errore importazione: ${error.message}`, 'error');
      showToast('Errore importazione picking', 'error');
    } finally {
      setLoading(false);
    }
  }
  // Load batches for a specific date
  async function loadBatches(date: string) {
    try {
      debugLog(`Loading batches for ${date}...`, 'info');
      
      const response = await fetch(`/api/smart-route-ai/batches?date=${date}`);
      if (!response.ok) throw new Error('Error loading batches');
      
      const data = await response.json();
      setBatches(data.batches || []);
      
      debugLog(`Loaded ${data.batches?.length || 0} batches`, 'success');
    } catch (error: any) {
      debugLog(`Error loading batches: ${error.message}`, 'error');
    }
  }

  // Move picking to another batch
  async function movePickingToBatch(pickingId: number, targetBatchId: number) {
    try {
      debugLog(`Moving picking ${pickingId} to batch ${targetBatchId}...`, 'info');
      setLoading(true);

      const response = await fetch('/api/smart-route-ai/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pickingId, targetBatchId })
      });

      if (!response.ok) throw new Error('Error moving picking');

      debugLog('Picking moved successfully', 'success');
      showToast('Picking spostato con successo', 'success');
      
      // Reload pickings to reflect the change
      await importPickings();
      setShowBatchModal(false);
      setSelectedPickingForMove(null);

    } catch (error: any) {
      debugLog(`Error moving picking: ${error.message}`, 'error');
      showToast('Errore spostamento picking', 'error');
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

  // Assign vehicle to batch
  async function assignVehicleToBatch(batchId: number, vehicleId: number, driverId: number, employeeId: number | null) {
    try {
      debugLog(`Assigning vehicle ${vehicleId} to batch ${batchId}...`, 'info');
      setLoading(true);

      const response = await fetch('/api/smart-route-ai/batches/assign-vehicle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          batchId, 
          vehicleId,
          driverId,
          employeeId
        })
      });

      if (!response.ok) throw new Error('Error assigning vehicle');

      debugLog('Vehicle assigned to batch successfully', 'success');
      showToast('Veicolo assegnato al batch', 'success');
      
      // Mark vehicle as selected
      setVehicles(prev => prev.map(v =>
        v.id === vehicleId ? { ...v, selected: true } : v
      ));

      setShowVehicleBatchModal(false);
      setSelectedVehicleForBatch(null);

    } catch (error: any) {
      debugLog(`Error assigning vehicle: ${error.message}`, 'error');
      showToast('Errore assegnazione veicolo', 'error');
    } finally {
      setLoading(false);
    }
  }

  // Load pickings for a batch - filtra dai picking già caricati
  function loadBatchPickings(batchId: number) {
    setLoadingPickings(true);

    // Filtra i picking già caricati che appartengono a questo batch
    const batchPickingsFiltered = pickings
      .filter(p => p.batchId === batchId)
      .map(p => ({
        id: p.id,
        name: p.name,
        partnerName: p.partnerName,
        scheduledDate: p.scheduledDate,
        weight: p.weight,
        products: p.products
      }));

    setBatchPickings(batchPickingsFiltered);
    setExpandedPickingId(null);
    setLoadingPickings(false);
  }

  // Handle batch click to advance state
  async function handleBatchClick(batch: {id: number, name: string, state: string, vehicleName: string | null, driverName: string | null}) {
    // Determine next state
    let nextState: string;
    let nextStateLabel: string;

    if (batch.state === 'draft') {
      nextState = 'in_progress';
      nextStateLabel = 'In corso';
    } else if (batch.state === 'in_progress') {
      nextState = 'done';
      nextStateLabel = 'Completato';
    } else {
      showToast('Impossibile avanzare da questo stato', 'error');
      return;
    }

    // Check if batch has vehicle assigned
    const hasVehicle = !!batch.vehicleName;

    // Show confirmation modal
    setSelectedBatchForStateChange({
      id: batch.id,
      name: batch.name,
      currentState: batch.state,
      nextState: nextStateLabel,
      hasVehicle: hasVehicle
    });
    setSelectedVehicleForStateChange(null); // Reset vehicle selection

    // Load pickings for this batch
    loadBatchPickings(batch.id);

    setShowBatchStateModal(true);
  }

  // Confirm batch state change
  async function confirmBatchStateChange() {
    if (!selectedBatchForStateChange) return;

    // If changing from draft to in_progress and no vehicle assigned, require vehicle selection
    if (selectedBatchForStateChange.currentState === 'draft' &&
        !selectedBatchForStateChange.hasVehicle &&
        !selectedVehicleForStateChange) {
      showToast('Seleziona un veicolo prima di confermare', 'warning');
      return;
    }

    try {
      debugLog(`Advancing batch ${selectedBatchForStateChange.id} to ${selectedBatchForStateChange.nextState}...`, 'info');
      setLoading(true);

      // First, assign vehicle if selected
      if (selectedVehicleForStateChange) {
        const assignResponse = await fetch('/api/smart-route-ai/batches/assign-vehicle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            batchId: selectedBatchForStateChange.id,
            vehicleId: selectedVehicleForStateChange.id,
            driverId: selectedVehicleForStateChange.driverId,
            employeeId: selectedVehicleForStateChange.employeeId
          })
        });

        if (!assignResponse.ok) throw new Error('Error assigning vehicle');
        debugLog('Vehicle assigned to batch', 'success');
      }

      // Then update batch state
      const response = await fetch('/api/smart-route-ai/batches/update-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchId: selectedBatchForStateChange.id
        })
      });

      if (!response.ok) throw new Error('Error updating batch state');

      const result = await response.json();

      debugLog(`Batch state updated to ${result.newState}`, 'success');
      showToast(`Batch passato a ${selectedBatchForStateChange.nextState}`, 'success');

      // Reload batches to reflect new state
      await loadBatches(dateFrom);

      setShowBatchStateModal(false);
      setSelectedBatchForStateChange(null);
      setSelectedVehicleForStateChange(null);

    } catch (error: any) {
      debugLog(`Error updating batch state: ${error.message}`, 'error');
      showToast('Errore aggiornamento stato batch', 'error');
    } finally {
      setLoading(false);
    }
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
        <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-3">
          <div className="flex items-center justify-between gap-2">
            {/* Title */}
            <div className="flex items-center gap-2">
              <Link href="/" className="hover:bg-white/10 p-1.5 sm:p-2 rounded-lg transition-colors">
                <ArrowLeft className="h-4 w-4 sm:h-6 sm:w-6" />
              </Link>
              <div>
                <h1 className="text-base sm:text-xl md:text-2xl font-bold flex items-center gap-1">
                  🚚 Smart Route AI
                </h1>
                <p className="text-[10px] sm:text-xs text-white/80 hidden sm:block">Ottimizzazione Percorsi con Odoo</p>
              </div>
            </div>

            {/* Connection Status */}
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] sm:text-xs font-semibold ${
              odooConnected ? 'bg-green-500' : 'bg-red-500'
            }`}>
              <span>{odooConnected ? '✓' : '⚠️'}</span>
              <span className="hidden sm:inline">{odooConnected ? 'Connesso' : 'Non connesso'}</span>
            </div>

            {/* Stats Bar */}
            <div className="flex gap-2 sm:gap-4 text-[10px] sm:text-xs">
              <div className="text-center">
                <div className="text-sm sm:text-xl font-bold">{stats.totalOrders}</div>
                <div className="text-[8px] sm:text-[10px] text-white/80">Ordini</div>
              </div>
              <div className="text-center">
                <div className="text-sm sm:text-xl font-bold">{stats.totalWeight.toFixed(2)}</div>
                <div className="text-[8px] sm:text-[10px] text-white/80">Peso</div>
              </div>
              <div className="text-center hidden sm:block">
                <div className="text-xl font-bold">{stats.totalVehicles}</div>
                <div className="text-[10px] text-white/80">Veicoli</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-col lg:flex-row h-[calc(100vh-60px)] sm:h-[calc(100vh-70px)] md:h-[calc(100vh-88px)] relative">
        {/* Toggle Button for Mobile/Desktop */}
        <button
          onClick={() => setSidebarVisible(!sidebarVisible)}
          className="fixed top-14 sm:top-16 md:top-20 left-2 sm:left-4 z-[1001] bg-indigo-600 text-white p-2 sm:p-3 rounded-full shadow-lg hover:bg-indigo-700 transition-all"
          aria-label="Toggle Sidebar"
        >
          {sidebarVisible ? <X className="h-4 w-4 sm:h-5 sm:w-5" /> : <Menu className="h-4 w-4 sm:h-5 sm:w-5" />}
        </button>

        {/* Sidebar */}
        {sidebarVisible && (
          <div className="
            fixed lg:relative
            top-0 left-0
            w-full lg:w-96
            h-full lg:h-auto
            bg-gray-50 border-r border-gray-200
            overflow-y-auto p-4 space-y-4
            z-[1000]
          ">

          {/* Statistics */}
          {batches.length > 0 && (
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span>📊</span> Statistiche Giri
              </h3>

              {(() => {
                // Helper: Haversine distance calculation
                const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
                  const R = 6371; // Earth radius in km
                  const dLat = (lat2 - lat1) * Math.PI / 180;
                  const dLon = (lon2 - lon1) * Math.PI / 180;
                  const a =
                    Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                    Math.sin(dLon/2) * Math.sin(dLon/2);
                  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                  return R * c;
                };

                // Depot coordinates (LAPA Embrach)
                const DEPOT_LAT = 47.5168872;
                const DEPOT_LNG = 8.5971149;

                // Calculate stats for each batch
                const batchStats = batches.map(batch => {
                  // Get pickings for this batch
                  const batchPickings = pickings.filter(p =>
                    p.batchId === batch.id && p.lat && p.lng
                  );

                  let totalDistance = 0;
                  if (batchPickings.length > 0) {
                    // Distance from depot to first picking
                    totalDistance += calculateDistance(
                      DEPOT_LAT, DEPOT_LNG,
                      batchPickings[0].lat, batchPickings[0].lng
                    );

                    // Distance between consecutive pickings
                    for (let i = 0; i < batchPickings.length - 1; i++) {
                      totalDistance += calculateDistance(
                        batchPickings[i].lat, batchPickings[i].lng,
                        batchPickings[i + 1].lat, batchPickings[i + 1].lng
                      );
                    }

                    // Distance from last picking back to depot
                    totalDistance += calculateDistance(
                      batchPickings[batchPickings.length - 1].lat,
                      batchPickings[batchPickings.length - 1].lng,
                      DEPOT_LAT, DEPOT_LNG
                    );
                  }

                  // Estimate time: distance / average speed (35 km/h) * 60 min + 10 min per delivery
                  const estimatedTime = batchPickings.length > 0
                    ? Math.round((totalDistance / 35) * 60) + (batchPickings.length * 10)
                    : 0;

                  return {
                    ...batch,
                    totalDistance,
                    estimatedTime
                  };
                });

                // Calculate global totals
                const globalWeight = batchStats.reduce((sum, b) => sum + b.totalWeight, 0);
                const globalDistance = batchStats.reduce((sum, b) => sum + b.totalDistance, 0);
                const globalTime = batchStats.reduce((sum, b) => sum + b.estimatedTime, 0);

                return (
                  <>
                    {/* Global Stats */}
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg p-4 mb-3">
                      <div className="text-sm opacity-90 mb-2">Totale Tutti i Giri:</div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <div className="text-2xl font-bold">{globalWeight}</div>
                          <div className="text-xs opacity-75">kg</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold">{globalDistance.toFixed(1)}</div>
                          <div className="text-xs opacity-75">km</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold">{Math.floor(globalTime / 60)}h {globalTime % 60}m</div>
                          <div className="text-xs opacity-75">tempo</div>
                        </div>
                      </div>
                    </div>

                    {/* Per Batch Stats */}
                    {batchStats.filter(b => b.state !== 'done' && b.state !== 'cancel').length > 0 && (
                      <div className="max-h-64 overflow-y-auto space-y-2">
                        <div className="text-xs font-semibold text-gray-600 mb-2">Per Giro:</div>
                        {batchStats.filter(b => b.state !== 'done' && b.state !== 'cancel').map((batch) => (
                          <div key={batch.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                            <div className="font-semibold text-sm text-gray-900 mb-2">{batch.name}</div>
                            <div className="grid grid-cols-3 gap-2 text-center text-xs">
                              <div>
                                <div className="font-bold text-gray-900">{batch.totalWeight}</div>
                                <div className="text-gray-500">kg</div>
                              </div>
                              <div>
                                <div className="font-bold text-gray-900">{batch.totalDistance.toFixed(1)}</div>
                                <div className="text-gray-500">km</div>
                              </div>
                              <div>
                                <div className="font-bold text-gray-900">{Math.floor(batch.estimatedTime / 60)}h {batch.estimatedTime % 60}m</div>
                                <div className="text-gray-500">tempo</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}

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
                  <span className="font-semibold text-gray-900">{stats.foundPickings}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Con coordinate:</span>
                  <span className="font-semibold text-gray-900">{stats.withCoordinates}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Vehicles List - Collapsible */}
          <div className="bg-white rounded-lg shadow p-4">
            <button
              onClick={() => setVehiclesExpanded(!vehiclesExpanded)}
              className="w-full flex items-center justify-between hover:bg-gray-50 rounded-lg p-2 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span>🚛</span>
                <span className="font-semibold text-gray-900">Flotta Veicoli</span>
                <span className="text-xs text-gray-500">({vehicles.length})</span>
              </div>
              <span className="text-gray-400">
                {vehiclesExpanded ? '▼' : '▶'}
              </span>
            </button>

            {vehiclesExpanded && (
              <div className="max-h-64 overflow-y-auto space-y-2 mt-3">
                {vehicles.length === 0 ? (
                  <div className="text-center text-gray-500 text-sm py-8">
                    Nessun veicolo disponibile
                  </div>
                ) : (
                  vehicles.map(vehicle => (
                    <div
                      key={vehicle.id}
                      onClick={() => {
                        setSelectedVehicleForBatch(vehicle);
                        setShowVehicleBatchModal(true);
                      }}
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
                            {(() => {
                              // Extract model from name (first part before /)
                              const nameParts = vehicle.name.split('/');
                              const model = nameParts[0]?.trim() || 'Veicolo';
                              return `${model} ${vehicle.plate}`;
                            })()}
                          </div>
                          <div className={`text-xs ${vehicle.selected ? 'text-indigo-700' : 'text-gray-600'}`}>
                            {(() => {
                              // Format: "COMPANY, FirstName LastName" -> extract full name
                              const parts = vehicle.driver.split(',');
                              const namePart = parts.length > 1 ? parts[1].trim() : vehicle.driver;
                              return namePart;
                            })()}
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
            )}
          </div>

          {/* Batch List */}
          {batches.filter(b => b.state !== 'done' && b.state !== 'cancel').length > 0 && (
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span>📦</span> Batch
              </h3>
              <div className="space-y-2">
                {batches.filter(b => b.state !== 'done' && b.state !== 'cancel').map((batch) => {
                  // Get consistent color based on batch ID
                  const color = getBatchColor(batch.id);

                  // Determine state badge
                  let stateBadge = '';
                  let stateColor = '';
                  if (batch.state === 'draft') {
                    stateBadge = 'Bozza';
                    stateColor = 'bg-yellow-100 text-yellow-800';
                  } else if (batch.state === 'in_progress') {
                    stateBadge = 'In corso';
                    stateColor = 'bg-blue-100 text-blue-800';
                  } else if (batch.state === 'done') {
                    stateBadge = 'Completato';
                    stateColor = 'bg-green-100 text-green-800';
                  }

                  return (
                    <div
                      key={batch.id}
                      onClick={() => handleBatchClick(batch)}
                      className="p-3 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md"
                      style={{
                        borderColor: color,
                        backgroundColor: `${color}10`
                      }}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="font-semibold text-sm text-gray-900 mb-1">
                            {batch.name}
                          </div>
                          <div className={`text-xs px-2 py-0.5 rounded-full inline-block ${stateColor}`}>
                            {stateBadge}
                          </div>
                        </div>
                        <div className="text-xs font-semibold px-2 py-1 rounded" style={{
                          backgroundColor: color,
                          color: 'white'
                        }}>
                          {batch.totalWeight} kg
                        </div>
                      </div>

                      {batch.vehicleName && (
                        <div className="text-xs text-gray-600 mb-1">
                          🚗 {batch.vehicleName}
                        </div>
                      )}

                      {batch.driverName && (
                        <div className="text-xs text-gray-600 mb-1">
                          👤 {batch.driverName}
                        </div>
                      )}

                      <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-200">
                        {batch.pickingCount} consegne • Clicca per avanzare
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
        </div>
        )}


        {/* Map Area */}
        <div className="flex-1 relative w-full">
          <div className="absolute inset-0">
            <MapComponent
              pickings={pickings}
              routes={routes}
              vehicles={vehicles}
              batches={batches}
              batchColorMap={batchColorMap}
              routeColors={ROUTE_COLORS}
            />
          </div>
        </div>

        {/* Overlay when sidebar is open on mobile */}
        {sidebarVisible && (
          <div
            className="fixed inset-0 bg-black/50 z-[999] lg:hidden"
            onClick={() => setSidebarVisible(false)}
          />
        )}
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

                  {/* Vehicle-Batch Assignment Modal */}
      {showVehicleBatchModal && selectedVehicleForBatch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[2000]" onClick={() => setShowVehicleBatchModal(false)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Assegna Veicolo a Batch</h3>
              <button
                onClick={() => setShowVehicleBatchModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border-2 border-indigo-200">
              <div className="text-sm text-gray-600 mb-1">Veicolo selezionato:</div>
              <div className="font-bold text-indigo-900">
                {(() => {
                  const nameParts = selectedVehicleForBatch.name.split('/');
                  const model = nameParts[0]?.trim() || 'Veicolo';
                  return `${model} ${selectedVehicleForBatch.plate}`;
                })()}
              </div>
              <div className="text-sm text-indigo-700 mt-1">
                Autista: {(() => {
                  const parts = selectedVehicleForBatch.driver.split(',');
                  const namePart = parts.length > 1 ? parts[1].trim() : selectedVehicleForBatch.driver;
                  return namePart.split(' ')[0];
                })()}
              </div>
            </div>

            <div className="mb-4">
              <div className="text-sm font-semibold text-gray-700 mb-2">
                Seleziona il batch da assegnare a questo veicolo:
              </div>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {batches.filter(b => b.state !== 'done' && b.state !== 'cancel').length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    <div className="text-4xl mb-2">📦</div>
                    <div>Nessun batch disponibile</div>
                    <div className="text-xs mt-1">Importa prima i picking per caricare i batch</div>
                  </div>
                ) : (
                  batches.filter(b => b.state !== 'done' && b.state !== 'cancel').map(batch => {
                    const batchColor = getBatchColor(batch.id);
                    return (
                      <button
                        key={batch.id}
                        onClick={() => assignVehicleToBatch(
                          batch.id,
                          selectedVehicleForBatch.id,
                          selectedVehicleForBatch.driverId,
                          selectedVehicleForBatch.employeeId
                        )}
                        className="w-full p-3 text-left border-2 rounded-lg hover:opacity-80 transition-all group"
                        style={{
                          borderColor: batchColor,
                          backgroundColor: `${batchColor}10`
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold" style={{ color: batchColor }}>
                              {batch.name}
                            </div>
                            <div className="text-xs text-gray-600 capitalize">
                              {batch.state === 'draft' ? 'Bozza' : 'Pronto'}
                            </div>
                          </div>
                          <div style={{ color: batchColor }} className="opacity-0 group-hover:opacity-100 transition-opacity font-bold">
                            ✓
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <button
              onClick={() => setShowVehicleBatchModal(false)}
              className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
            >
              Annulla
            </button>
          </div>
        </div>
      )}

      {/* Batch State Change Confirmation Modal */}
      {showBatchStateModal && selectedBatchForStateChange && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[2000] p-4 overflow-y-auto" onClick={() => setShowBatchStateModal(false)}>
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full my-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Conferma Cambio Stato</h3>
              <button
                onClick={() => setShowBatchStateModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-6">
              <div className="text-center mb-4">
                <div className="text-5xl mb-3">⚠️</div>
                <div className="text-lg font-semibold text-gray-900 mb-2">
                  {selectedBatchForStateChange.name}
                </div>
                <div className="text-sm text-gray-600">
                  Vuoi passare questo batch al prossimo stato?
                </div>
              </div>

              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border-2 border-blue-200 mb-4">
                <div className="flex items-center justify-center gap-4">
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-1">Stato attuale</div>
                    <div className="font-bold text-gray-900 capitalize">
                      {selectedBatchForStateChange.currentState === 'draft'
                        ? 'Bozza'
                        : selectedBatchForStateChange.currentState === 'in_progress'
                        ? 'In corso'
                        : 'Completato'}
                    </div>
                  </div>
                  <div className="text-2xl text-blue-500">→</div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-1">Nuovo stato</div>
                    <div className="font-bold text-indigo-900">
                      {selectedBatchForStateChange.nextState}
                    </div>
                  </div>
                </div>
              </div>

              {/* Vehicle Selection - Show only if changing from draft and no vehicle assigned */}
              {selectedBatchForStateChange.currentState === 'draft' && !selectedBatchForStateChange.hasVehicle && (
                <div className="mb-4">
                  <div className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <span>🚗</span> Seleziona veicolo e autista:
                  </div>
                  {selectedVehicleForStateChange ? (
                    <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border-2 border-indigo-200 relative">
                      <button
                        onClick={() => setSelectedVehicleForStateChange(null)}
                        className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <div className="font-bold text-indigo-900">
                        {(() => {
                          const nameParts = selectedVehicleForStateChange.name.split('/');
                          const model = nameParts[0]?.trim() || 'Veicolo';
                          return `${model} ${selectedVehicleForStateChange.plate}`;
                        })()}
                      </div>
                      <div className="text-sm text-indigo-700 mt-1">
                        Autista: {(() => {
                          const parts = selectedVehicleForStateChange.driver.split(',');
                          const namePart = parts.length > 1 ? parts[1].trim() : selectedVehicleForStateChange.driver;
                          return namePart;
                        })()}
                      </div>
                    </div>
                  ) : (
                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {vehicles.length === 0 ? (
                        <div className="text-center text-gray-500 py-4 text-sm">
                          Nessun veicolo disponibile
                        </div>
                      ) : (
                        vehicles.map(vehicle => (
                          <button
                            key={vehicle.id}
                            onClick={() => setSelectedVehicleForStateChange(vehicle)}
                            className="w-full p-3 text-left border-2 border-gray-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-all"
                          >
                            <div className="font-semibold text-sm text-gray-900">
                              {(() => {
                                const nameParts = vehicle.name.split('/');
                                const model = nameParts[0]?.trim() || 'Veicolo';
                                return `${model} ${vehicle.plate}`;
                              })()}
                            </div>
                            <div className="text-xs text-gray-600">
                              {(() => {
                                const parts = vehicle.driver.split(',');
                                const namePart = parts.length > 1 ? parts[1].trim() : vehicle.driver;
                                return namePart;
                              })()}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Batch Pickings List */}
              <div className="mb-4">
                <div className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <span>📦</span> Consegne in questo batch ({batchPickings.length}):
                </div>
                {loadingPickings ? (
                  <div className="text-center text-gray-500 py-4 text-sm">
                    <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    Caricamento consegne...
                  </div>
                ) : batchPickings.length === 0 ? (
                  <div className="text-center text-gray-500 py-4 text-sm">
                    Nessuna consegna in questo batch
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {batchPickings.map((picking) => (
                      <div key={picking.id} className="border-2 border-gray-200 rounded-lg overflow-hidden">
                        <button
                          onClick={() => setExpandedPickingId(expandedPickingId === picking.id ? null : picking.id)}
                          className="w-full p-3 text-left hover:bg-gray-50 transition-all"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="font-semibold text-sm text-gray-900">
                              {picking.partnerName}
                            </div>
                            <div className="text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full font-semibold">
                              {picking.weight} kg
                            </div>
                          </div>
                          <div className="text-xs text-gray-600">
                            📅 {new Date(picking.scheduledDate).toLocaleDateString('it-IT')}
                          </div>
                          <div className="text-xs text-indigo-600 mt-1 flex items-center gap-1">
                            {expandedPickingId === picking.id ? '▼' : '▶'}
                            {picking.products.length} prodotti
                          </div>
                        </button>

                        {/* Expanded Product List */}
                        {expandedPickingId === picking.id && (
                          <div className="border-t-2 border-gray-200 bg-gray-50 p-3 space-y-2">
                            {picking.products.map((product) => (
                              <div key={product.id} className="flex items-center justify-between text-xs p-2 bg-white rounded border border-gray-200">
                                <div className="flex-1">
                                  <div className="font-semibold text-gray-900">
                                    {product.productName}
                                  </div>
                                  <div className="text-gray-600">
                                    Quantità: {product.quantity} {product.uom}
                                  </div>
                                </div>
                                <div className="text-gray-700 font-semibold">
                                  {product.weight.toFixed(2)} kg
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowBatchStateModal(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={confirmBatchStateChange}
                disabled={loading}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg font-semibold hover:from-indigo-600 hover:to-purple-600 transition-all disabled:opacity-50"
              >
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Selection Modal */}
      {showBatchModal && selectedPickingForMove && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[2000]" onClick={() => setShowBatchModal(false)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Sposta Picking</h3>
              <button
                onClick={() => setShowBatchModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600">Batch attuale:</div>
              <div className="font-semibold text-gray-900">{selectedPickingForMove.currentBatch}</div>
            </div>

            <div className="mb-4">
              <div className="text-sm font-semibold text-gray-700 mb-2">Seleziona batch di destinazione:</div>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {batches
                  .filter(b => b.name !== selectedPickingForMove.currentBatch && b.state !== 'done' && b.state !== 'cancel')
                  .map(batch => {
                    const batchColor = getBatchColor(batch.id);
                    return (
                      <button
                        key={batch.id}
                        onClick={() => movePickingToBatch(selectedPickingForMove.id, batch.id)}
                        className="w-full p-3 text-left border-2 rounded-lg hover:opacity-80 transition-all group"
                        style={{
                          borderColor: batchColor,
                          backgroundColor: `${batchColor}10`
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold" style={{ color: batchColor }}>
                              {batch.name}
                            </div>
                            <div className="text-xs text-gray-600 capitalize">
                              {batch.state === 'draft' ? 'Bozza' : 'Pronto'}
                            </div>
                          </div>
                          <div style={{ color: batchColor }} className="opacity-0 group-hover:opacity-100 transition-opacity font-bold">
                            →
                          </div>
                        </div>
                      </button>
                    );
                  })}
                {batches.filter(b => b.name !== selectedPickingForMove.currentBatch && b.state !== 'done' && b.state !== 'cancel').length === 0 && (
                  <div className="text-center text-gray-500 py-4">
                    Nessun altro batch disponibile per questa data
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setShowBatchModal(false)}
              className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
            >
              Annulla
            </button>
          </div>
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

