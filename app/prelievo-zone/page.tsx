'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Truck, MapPin, BarChart3, Settings, ChevronRight, Clock, CheckCircle2, Camera, Sun, Moon, RefreshCw, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { AppHeader, MobileHomeButton } from '@/components/layout/AppHeader';
import { QRScanner } from '@/components/prelievo-zone/QRScanner';
import { NumericKeyboard } from '@/components/prelievo-zone/NumericKeyboard';
import { ZONES, Zone, Batch, StockLocation, Operation, WorkStats, DEFAULT_CONFIG } from '@/lib/types/picking';
import { getPickingClient } from '@/lib/odoo/pickingClient';
import toast from 'react-hot-toast';
import './picking-styles.css';

export default function PrelievoZonePage() {
  const router = useRouter();
  const { user } = useAuthStore();

  // Stati principali
  const [currentBatch, setCurrentBatch] = useState<Batch | null>(null);
  const [currentZone, setCurrentZone] = useState<Zone | null>(null);
  const [currentLocation, setCurrentLocation] = useState<StockLocation | null>(null);
  const [currentOperations, setCurrentOperations] = useState<Operation[]>([]);

  // Liste dati
  const [batches, setBatches] = useState<Batch[]>([]);
  const [locations, setLocations] = useState<StockLocation[]>([]);

  // UI States
  const [isLoading, setIsLoading] = useState(false);
  const [showBatchSelector, setShowBatchSelector] = useState(true);
  const [showZoneSelector, setShowZoneSelector] = useState(false);
  const [showLocationList, setShowLocationList] = useState(false);
  const [showOperations, setShowOperations] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('disconnected');

  // Scanner e Keyboard states
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [scannerMode, setScannerMode] = useState<'product' | 'location'>('product');
  const [expectedProductCode, setExpectedProductCode] = useState<string | undefined>();
  const [showNumericKeyboard, setShowNumericKeyboard] = useState(false);
  const [selectedOperation, setSelectedOperation] = useState<Operation | null>(null);
  const [showProductSelector, setShowProductSelector] = useState(false);

  // Statistiche
  const [workStats, setWorkStats] = useState<WorkStats>({
    zonesCompleted: 0,
    totalOperations: 0,
    completedOperations: 0,
    startTime: undefined,
    currentZoneTime: 0,
    totalTime: 0
  });

  // Conteggi per zona usando gli ID
  const [zoneCounts, setZoneCounts] = useState<{ [key: string]: number }>({
    'secco': 0,
    'secco_sopra': 0,
    'pingu': 0,
    'frigo': 0
  });

  // Cache per operazioni già caricate
  const [operationsCache, setOperationsCache] = useState<{ [key: string]: Operation[] }>({});
  const [cacheTimestamps, setCacheTimestamps] = useState<{ [key: string]: number }>({});

  // Configurazione
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [darkMode, setDarkMode] = useState(true);

  // Client Odoo
  const pickingClient = getPickingClient();

  // Check connessione all'avvio
  useEffect(() => {
    checkConnection();
    loadConfiguration();

    // Carica cache dal localStorage
    try {
      const savedCache = localStorage.getItem('pickingOperationsCache');
      const savedTimestamps = localStorage.getItem('pickingCacheTimestamps');

      if (savedCache) {
        const cache = JSON.parse(savedCache);
        setOperationsCache(cache);
        console.log('💾 Cache caricata dal localStorage:', Object.keys(cache).length, 'entries');
      }

      if (savedTimestamps) {
        const timestamps = JSON.parse(savedTimestamps);
        setCacheTimestamps(timestamps);
      }
    } catch (e) {
      console.warn('Errore caricamento cache:', e);
    }

    // Carica batch solo se l'utente è disponibile, altrimenti usa token mock
    if (user || true) { // Per ora sempre carica
      loadBatches();
    }
  }, [user]);

  // Timer per statistiche
  useEffect(() => {
    if (workStats.startTime) {
      const interval = setInterval(() => {
        const now = new Date();
        const diff = Math.floor((now.getTime() - workStats.startTime!.getTime()) / 1000);
        setWorkStats(prev => ({ ...prev, totalTime: diff }));
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [workStats.startTime]);

  // Funzioni di utilità
  const checkConnection = async () => {
    try {
      // Qui andrà la chiamata reale a Odoo
      await new Promise(resolve => setTimeout(resolve, 1000));
      setConnectionStatus('connected');
    } catch (error) {
      setConnectionStatus('disconnected');
      toast.error('Connessione a Odoo non disponibile');
    }
  };

  const loadConfiguration = () => {
    // Carica configurazione da localStorage
    const savedConfig = localStorage.getItem('picking_config');
    if (savedConfig) {
      setConfig(JSON.parse(savedConfig));
    }

    // Carica modalità tema da localStorage
    const savedDarkMode = localStorage.getItem('picking_dark_mode');
    if (savedDarkMode !== null) {
      setDarkMode(JSON.parse(savedDarkMode));
    }
  };

  const saveConfiguration = (newConfig: typeof config) => {
    setConfig(newConfig);
    localStorage.setItem('picking_config', JSON.stringify(newConfig));
    toast.success('Configurazione salvata');
  };

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('picking_dark_mode', JSON.stringify(newMode));
    toast.success(`Modalità ${newMode ? 'scura' : 'chiara'} attivata`);
  };

  const loadBatches = async () => {
    console.log('🔄 Inizio caricamento batch...');
    setIsLoading(true);
    try {
      // Verifica utente autenticato
      console.log('👤 Utente corrente:', user);

      // Carica batch reali da Odoo
      console.log('📞 Chiamata a pickingClient.getBatches()...');
      const odoBatches = await pickingClient.getBatches();

      console.log('📦 Batch caricati da Odoo:', odoBatches.length, odoBatches);

      setBatches(odoBatches);

      if (odoBatches.length === 0) {
        console.log('⚠️ Nessun batch trovato');
        toast('Nessun batch disponibile al momento', { icon: 'ℹ️' });
      } else {
        console.log('✅ Batch caricati con successo');
      }
    } catch (error: any) {
      console.error('❌ Errore caricamento batch:', error);
      console.error('❌ Stack trace:', error.stack);

      // Se è un errore di autenticazione, reindirizza al login
      if (error.message?.includes('Session') || error.message?.includes('401')) {
        toast.error('Sessione scaduta, reindirizzamento al login...');
        router.push('/');
      } else {
        toast.error(`Errore nel caricamento dei batch: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
      console.log('🏁 Fine caricamento batch');
    }
  };

  const selectBatch = async (batch: Batch) => {
    setCurrentBatch(batch);
    setShowBatchSelector(false);
    setShowZoneSelector(true);

    // Inizia timer statistiche
    if (!workStats.startTime) {
      setWorkStats(prev => ({
        ...prev,
        startTime: new Date()
      }));
    }

    // Carica conteggi zone
    await loadZoneCounts(batch.id);

    toast.success(`Batch ${batch.name} selezionato`);
  };

  const loadZoneCounts = async (batchId: number) => {
    try {
      console.log('🔄 Caricamento conteggi zone per batch:', batchId);
      const counts = await pickingClient.getBatchZoneCounts(batchId);
      setZoneCounts(counts);
      console.log('✅ Conteggi zone caricati:', counts);
    } catch (error) {
      console.error('Errore caricamento conteggi zone:', error);
      toast.error('Errore nel caricamento dei conteggi zone');
    }
  };

  const selectZone = async (zone: Zone) => {
    setCurrentZone(zone);
    setShowZoneSelector(false);
    setShowLocationList(true);

    // Carica ubicazioni per la zona
    await loadZoneLocations(zone);

    toast.success(`Zona ${zone.displayName} selezionata`);
  };

  const loadZoneLocations = async (zone: Zone) => {
    setIsLoading(true);
    try {
      if (!currentBatch) {
        toast.error('Nessun batch selezionato');
        return;
      }

      // Carica solo le ubicazioni che hanno operazioni nel batch corrente per questa zona
      const odooLocations = await pickingClient.getZoneLocationsWithOperations(
        currentBatch.id,
        zone.id
      );

      console.log(`📍 Ubicazioni con operazioni caricate per zona ${zone.displayName}:`, odooLocations.length);

      // Ordina ubicazioni per ultimi caratteri/cifre (es. A01, A02, B01, C04)
      const sortedLocations = odooLocations.sort((a, b) => {
        // Estrai l'ultima parte del nome (dopo l'ultimo punto o slash)
        const getLastPart = (name: string) => {
          const parts = name.split(/[\/\.]/);
          return parts[parts.length - 1] || name;
        };

        const lastA = getLastPart(a.name);
        const lastB = getLastPart(b.name);

        return lastA.localeCompare(lastB, undefined, { numeric: true, sensitivity: 'base' });
      });

      setLocations(sortedLocations);

      if (odooLocations.length === 0) {
        toast(`Nessuna operazione da prelevare nella zona ${zone.displayName}`, { icon: 'ℹ️' });
      } else {
        toast.success(`${odooLocations.length} ubicazioni con operazioni trovate`);
      }
    } catch (error: any) {
      console.error('Errore caricamento ubicazioni:', error);
      toast.error('Errore nel caricamento delle ubicazioni');
    } finally {
      setIsLoading(false);
    }
  };

  const selectLocation = async (location: StockLocation) => {
    setCurrentLocation(location);
    setShowLocationList(false);
    setShowOperations(true);

    // Carica operazioni per l'ubicazione
    await loadLocationOperations(location);

    toast.success(`Ubicazione ${location.name} selezionata`);
  };

  const loadLocationOperations = async (location: StockLocation) => {
    setIsLoading(true);
    try {
      if (!currentBatch) {
        toast.error('Nessun batch selezionato');
        return;
      }

      // Controlla cache prima
      const cacheKey = `${currentBatch.id}-${location.id}`;
      const CACHE_EXPIRE_TIME = 5 * 60 * 1000; // 5 minuti
      const now = Date.now();

      if (operationsCache[cacheKey] && cacheTimestamps[cacheKey]) {
        const cacheAge = now - cacheTimestamps[cacheKey];

        if (cacheAge < CACHE_EXPIRE_TIME) {
          console.log(`🚀 Cache HIT per ${location.name}: ${operationsCache[cacheKey].length} operazioni (età: ${Math.round(cacheAge/1000)}s)`);
          setCurrentOperations(operationsCache[cacheKey]);
          setIsLoading(false);
          return;
        } else {
          console.log(`⏰ Cache EXPIRED per ${location.name} (età: ${Math.round(cacheAge/1000)}s) - ricaricamento`);
        }
      }

      console.log(`📡 Cache MISS - Caricamento da Odoo per ${location.name}`);

      // Carica operazioni reali da Odoo per l'ubicazione selezionata
      const odooOperations = await pickingClient.getLocationOperations(
        currentBatch.id,
        location.id
      );

      console.log(`📦 Operazioni caricate per ${location.name}:`, odooOperations.length);

      // Ordina operazioni alfabeticamente per nome prodotto
      const sortedOperations = odooOperations.sort((a, b) => {
        return a.productName.localeCompare(b.productName, 'it-IT');
      });

      // Salva in cache per future selezioni (usa versione ordinata)
      const newCache = {
        ...operationsCache,
        [cacheKey]: sortedOperations
      };
      const newTimestamps = {
        ...cacheTimestamps,
        [cacheKey]: now
      };
      setOperationsCache(newCache);
      setCacheTimestamps(newTimestamps);

      // Salva anche in localStorage per persistenza
      try {
        localStorage.setItem('pickingOperationsCache', JSON.stringify(newCache));
        localStorage.setItem('pickingCacheTimestamps', JSON.stringify(newTimestamps));
      } catch (e) {
        console.warn('Impossibile salvare in localStorage:', e);
      }

      setCurrentOperations(sortedOperations);

      // Aggiorna statistiche
      setWorkStats(prev => ({
        ...prev,
        totalOperations: prev.totalOperations + odooOperations.length
      }));

      if (odooOperations.length === 0) {
        toast(`Nessuna operazione da prelevare in ${location.name}`, { icon: 'ℹ️' });
      }
    } catch (error: any) {
      console.error('Errore caricamento operazioni:', error);
      toast.error('Errore nel caricamento delle operazioni');
    } finally {
      setIsLoading(false);
    }
  };

  const updateOperation = async (operationId: number, qtyDone: number) => {
    // Aggiorna UI immediatamente, permettendo quantità superiori a quella richiesta
    setCurrentOperations(prev => prev.map(op => {
      if (op.id === operationId) {
        const updated = { ...op, qty_done: qtyDone };

        // Se completata, aggiorna statistiche
        if (qtyDone >= op.quantity && op.qty_done < op.quantity) {
          setWorkStats(prevStats => ({
            ...prevStats,
            completedOperations: prevStats.completedOperations + 1
          }));
          toast.success(`✅ ${op.productName} completato!`);
        }

        return updated;
      }
      return op;
    }));

    // Salva su Odoo in background
    try {
      const success = await pickingClient.updateOperationQuantity(operationId, qtyDone);
      if (!success) {
        toast.error('Errore salvataggio quantità su Odoo');
        // Potremmo fare rollback qui se necessario
      }
    } catch (error) {
      console.error('Errore aggiornamento Odoo:', error);
      toast.error('Errore sincronizzazione con Odoo');
    }
  };

  // Handler per QR Scanner
  const handleQRScan = (code: string, type: 'product' | 'location') => {
    if (type === 'product') {
      // Trova l'operazione con questo codice prodotto
      const operation = currentOperations.find(
        op => op.productBarcode === code || op.productCode === code
      );

      if (operation) {
        // Segna come scansionato e apri tastiera
        setSelectedOperation(operation);
        setShowNumericKeyboard(true);
        toast.success(`Prodotto verificato: ${operation.productName}`);
      } else {
        toast.error('Prodotto non trovato in questa ubicazione');
      }
    } else {
      // Gestione scansione ubicazione
      const location = locations.find(
        loc => loc.barcode === code || loc.name === code
      );

      if (location) {
        toast.success(`QR Ubicazione scansionato: ${location.name}`);
        selectLocation(location);
      } else {
        toast.error('Ubicazione non trovata');
      }
    }
  };

  // Funzione per pulire la cache e forzare refresh
  const clearCache = () => {
    setOperationsCache({});
    setCacheTimestamps({});
    localStorage.removeItem('pickingOperationsCache');
    localStorage.removeItem('pickingCacheTimestamps');
    toast.success('Cache pulita - prossimi caricamenti saranno da Odoo');
    console.log('🧹 Cache pulita completamente');
  };

  const refreshCurrentLocation = async () => {
    if (currentLocation && currentBatch) {
      const cacheKey = `${currentBatch.id}-${currentLocation.id}`;
      // Rimuovi dalla cache
      const newCache = { ...operationsCache };
      const newTimestamps = { ...cacheTimestamps };
      delete newCache[cacheKey];
      delete newTimestamps[cacheKey];
      setOperationsCache(newCache);
      setCacheTimestamps(newTimestamps);

      // Ricarica
      await loadLocationOperations(currentLocation);
      toast.success(`Dati aggiornati per ${currentLocation.name}`);
    }
  };

  // Handler per tastiera numerica
  const handleNumericConfirm = (value: number) => {
    if (selectedOperation) {
      updateOperation(selectedOperation.id, value);
      setSelectedOperation(null);
    }
  };

  // Apri scanner per prodotto
  const openProductScanner = (operation: Operation) => {
    setSelectedOperation(operation);
    setExpectedProductCode(operation.productBarcode);
    setScannerMode('product');
    setShowQRScanner(true);
  };

  // Apri tastiera per operazione
  const openNumericKeyboard = (operation: Operation) => {
    setSelectedOperation(operation);
    setShowNumericKeyboard(true);
  };

  // Listener per scanner pistola quando sei nella lista ubicazioni
  useEffect(() => {
    if (!showLocationList) return;

    let scanBuffer = '';
    let scanTimeout: NodeJS.Timeout;

    const handleKeyPress = (e: KeyboardEvent) => {
      // Ignora se ci sono modali aperti
      if (showQRScanner || showNumericKeyboard || showProductSelector) return;

      // Enter significa fine scansione
      if (e.key === 'Enter' && scanBuffer.length > 0) {
        console.log('🔫 Codice scansionato dalla pistola:', scanBuffer);

        // Cerca l'ubicazione nella lista corrente
        const foundLocation = locations.find(
          loc => loc.barcode === scanBuffer ||
                 loc.name === scanBuffer ||
                 loc.name.includes(scanBuffer) ||
                 scanBuffer.includes(loc.name)
        );

        if (foundLocation) {
          console.log('✅ Ubicazione trovata:', foundLocation.name);
          toast.success(`📍 Apertura ${foundLocation.name}...`);
          selectLocation(foundLocation);
        } else {
          console.log('❌ Ubicazione non trovata nella zona corrente');
          toast.error('Ubicazione non trovata in questa zona');
        }

        scanBuffer = '';
        return;
      }

      // Accumula caratteri (ignora tasti speciali)
      if (e.key.length === 1) {
        scanBuffer += e.key;

        // Reset buffer dopo 100ms di inattività
        clearTimeout(scanTimeout);
        scanTimeout = setTimeout(() => {
          scanBuffer = '';
        }, 100);
      }
    };

    window.addEventListener('keypress', handleKeyPress);

    return () => {
      window.removeEventListener('keypress', handleKeyPress);
      clearTimeout(scanTimeout);
    };
  }, [showLocationList, locations, showQRScanner, showNumericKeyboard, showProductSelector]);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m ${secs}s`;
  };

  const calculateProgress = (): number => {
    if (workStats.totalOperations === 0) return 0;
    return Math.round((workStats.completedOperations / workStats.totalOperations) * 100);
  };

  // Genera e salva report zona completata
  const generateAndSaveZoneReport = async () => {
    if (!currentBatch || !currentZone || !user) {
      console.log('⚠️ Mancano dati per generare report');
      return;
    }

    try {
      const now = new Date();
      const dateStr = now.toLocaleString('it-IT');

      // Calcola tempo totale zona
      const zoneTime = workStats.currentZoneTime || 0;
      const zoneTimeStr = formatTime(zoneTime);

      // Conta prodotti prelevati e peso totale
      let productsCount = 0;
      let totalWeight = 0;
      const locationTimes: { [key: string]: number } = {};

      // Raccogli statistiche dalle operazioni completate
      currentOperations.forEach(op => {
        if (op.qty_done > 0) {
          productsCount++;
          // Qui potresti calcolare il peso se disponibile nei dati del prodotto
        }
      });

      // Genera report testuale
      const report = `📊 REPORT LAVORO - ${currentZone.displayName.toUpperCase()}

👤 Operatore: ${user.name || 'Operatore'}
📅 Data: ${dateStr}
⏱️ Tempo totale zona: ${zoneTimeStr}

📦 STATISTICHE:
- Prodotti prelevati: ${productsCount}
- Peso totale: ${totalWeight.toFixed(2)} kg
- Operazioni completate: ${workStats.completedOperations}`;

      console.log('📊 Report generato:\n', report);

      // Salva il report nel batch
      const saved = await pickingClient.saveBatchReport(currentBatch.id, report);

      if (saved) {
        toast.success('Report salvato nel batch! ✅');
        console.log('✅ Report salvato con successo nel batch');
      }

    } catch (error) {
      console.error('❌ Errore generazione/salvataggio report:', error);
      toast.error('Errore nel salvataggio del report');
    }
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      darkMode
        ? 'bg-gradient-to-br from-blue-900/90 via-slate-800/90 to-indigo-900/90'
        : 'bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 text-gray-900'
    }`}>
      {/* Header */}
      <AppHeader
        title="Prelievo per Zone"
        subtitle="Gestione picking ottimizzato per zone"
        icon={<Truck className="h-8 w-8 text-white" />}
        showHomeButton={true}
        showBackButton={false}
        rightElement={
          <div className="flex items-center gap-2">
            {/* Connection Status */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
              connectionStatus === 'connected'
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-red-500/20 text-red-400 border border-red-500/30'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-400 animate-pulse' : 'bg-red-400'
              }`} />
              <span className="text-sm font-medium hidden sm:inline">
                {connectionStatus === 'connected' ? 'Online' : 'Offline'}
              </span>
            </div>

            {/* Theme Toggle Button */}
            <button
              onClick={toggleDarkMode}
              className="glass p-2 rounded-lg hover:bg-white/20 transition-colors"
              title={darkMode ? 'Modalità chiara' : 'Modalità scura'}
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* Settings Button */}
            <button
              onClick={() => toast('Impostazioni in sviluppo', { icon: 'ℹ️' })}
              className="glass p-2 rounded-lg hover:bg-white/20 transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        }
      />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="glass-strong p-6 rounded-xl">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-center">Caricamento...</p>
          </div>
        </div>
      )}

      {/* Stats Bar */}
      {workStats.startTime && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${darkMode ? 'stats-bar-dark' : 'glass-strong'} mx-4 mt-4 p-4 md:p-6 rounded-xl border border-white/20 transition-all`}
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-6 flex-wrap">
              {/* Informazioni Batch */}
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-orange-400" />
                <span className="text-sm">
                  Batch: <strong>{currentBatch?.name}</strong>
                </span>
              </div>

              {/* Informazioni Autista */}
              {currentBatch?.x_studio_autista_del_giro && (
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-cyan-400" />
                  <span className="text-sm">
                    Autista: <strong>{currentBatch.x_studio_autista_del_giro[1]}</strong>
                  </span>
                </div>
              )}

              {/* Tempo */}
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" />
                <span className="text-sm">
                  Tempo: <strong>{formatTime(workStats.totalTime || 0)}</strong>
                </span>
              </div>

              {/* Operazioni */}
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-green-400" />
                <span className="text-sm">
                  Operazioni: <strong>{workStats.completedOperations}/{workStats.totalOperations}</strong>
                </span>
              </div>

              {/* Zone */}
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-purple-400" />
                <span className="text-sm">
                  Zone: <strong>{workStats.zonesCompleted}/4</strong>
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="flex-1 min-w-[200px] max-w-xs">
              <div className="bg-gray-700 rounded-full h-2 overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-blue-500 to-green-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${calculateProgress()}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1 text-center">
                {calculateProgress()}% completato
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Batch Selector */}
        {showBatchSelector && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <h2 className="text-2xl font-bold mb-6 text-center">Seleziona Batch</h2>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {batches.map(batch => (
                <motion.button
                  key={batch.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => selectBatch(batch)}
                  className={`${darkMode ? 'glass-picking-strong' : 'glass-strong'} p-6 rounded-xl hover:bg-white/20 transition-all text-left`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-lg">{batch.name}</h3>
                      <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-muted-foreground'}`}>
                        {batch.scheduled_date && new Date(batch.scheduled_date).toLocaleDateString('it-IT')}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      batch.state === 'done' ? 'bg-green-500/20 text-green-400' :
                      batch.state === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {batch.state === 'done' ? 'Completato' :
                       batch.state === 'in_progress' ? 'Pronto' :
                       batch.state === 'draft' ? 'Bozza' : 'Pronto'}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm">
                    {/* Autista */}
                    {batch.x_studio_autista_del_giro && (
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-cyan-400" />
                        <span>Autista: {batch.x_studio_autista_del_giro[1]}</span>
                      </div>
                    )}

                    {/* Targa auto */}
                    {batch.x_studio_auto_del_giro && (
                      <div className="flex items-center gap-2">
                        <span className="w-4 h-4 text-orange-400 flex items-center justify-center text-xs font-bold">🚗</span>
                        <span>Targa: {batch.x_studio_auto_del_giro[1]}</span>
                      </div>
                    )}

                    {/* Conteggi */}
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-muted-foreground" />
                      <span>{batch.picking_count || 0} ordini, {batch.product_count || 0} prodotti</span>
                    </div>
                  </div>

                  <ChevronRight className="w-5 h-5 mt-4 ml-auto text-muted-foreground" />
                </motion.button>
              ))}
            </div>

            {batches.length === 0 && !isLoading && (
              <div className="glass-strong rounded-xl p-12 text-center">
                <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Nessun batch disponibile</h3>
                <p className="text-muted-foreground">
                  Non ci sono batch assegnati al momento
                </p>
              </div>
            )}
          </motion.div>
        )}

        {/* Zone Selector */}
        {showZoneSelector && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <div className="mb-6">
              <button
                onClick={() => {
                  setShowZoneSelector(false);
                  setShowBatchSelector(true);
                }}
                className="glass px-4 py-2 rounded-lg hover:bg-white/20 transition-colors"
              >
                ← Torna ai Batch
              </button>
            </div>

            <h2 className="text-2xl font-bold mb-6 text-center">Seleziona Zona</h2>

            <div className="grid gap-4 md:grid-cols-2">
              {ZONES.map(zone => (
                <motion.button
                  key={zone.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => selectZone(zone)}
                  className="glass-strong p-8 rounded-xl hover:bg-white/20 transition-all"
                  style={{
                    borderLeft: `4px solid ${zone.color}`,
                    background: `linear-gradient(135deg, ${zone.color}10 0%, transparent 100%)`
                  }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="text-4xl">{zone.displayName.split(' ')[0]}</div>
                    <div className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-sm font-bold">
                      {zoneCounts[zone.id] || 0}
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{zone.displayName.substring(2)}</h3>
                  <p className="text-sm text-muted-foreground">
                    {zoneCounts[zone.id] || 0} prodotti da prelevare
                  </p>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Locations List */}
        {showLocationList && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <div className="mb-6 flex items-center justify-between">
              <button
                onClick={async () => {
                  // Genera e salva report prima di tornare alle zone
                  await generateAndSaveZoneReport();

                  setShowLocationList(false);
                  setShowZoneSelector(true);
                  setCurrentZone(null);
                }}
                className="glass px-4 py-2 rounded-lg hover:bg-white/20 transition-colors"
              >
                ← Torna alle Zone
              </button>

              <div
                className="px-4 py-2 rounded-lg font-semibold"
                style={{ backgroundColor: `${currentZone?.color}20`, color: currentZone?.color }}
              >
                {currentZone?.displayName}
              </div>
            </div>

            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Ubicazioni disponibili</h2>

              {/* Scanner QR Globale */}
              <button
                onClick={() => {
                  setScannerMode('location');
                  setShowQRScanner(true);
                }}
                className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white py-3 px-6 rounded-xl font-bold transition-all shadow-lg flex items-center gap-3"
              >
                <Camera className="w-6 h-6" />
                Scansiona Ubicazione
              </button>
            </div>

            <div className="space-y-3">
              {locations.map((location, index) => (
                <motion.div
                  key={location.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="w-full glass-strong p-4 rounded-xl flex items-center justify-between"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <MapPin className={`w-5 h-5 ${darkMode ? 'text-blue-300' : 'text-muted-foreground'}`} />
                    <div className="text-left flex-1">
                      <h3 className="font-semibold">{location.name}</h3>
                      <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-muted-foreground'}`}>
                        {(location as any).operationCount || 0} operazioni
                      </p>
                      {/* Preview prodotti - mostra primi 3 */}
                      {(location as any).productPreview && (location as any).productPreview.length > 0 && (
                        <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-muted-foreground'} line-clamp-2`}>
                          📦 {(location as any).productPreview.slice(0, 3).join(', ')}
                          {(location as any).productPreview.length > 3 && ` +${(location as any).productPreview.length - 3} altri`}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-sm font-bold mr-2">
                      {(location as any).operationCount || 0} op.
                    </div>
                    <button
                      onClick={() => selectLocation(location)}
                      className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                      <ChevronRight className="w-4 h-4" />
                      Apri
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>

            {locations.length === 0 && !isLoading && (
              <div className="glass-strong rounded-xl p-12 text-center">
                <MapPin className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Nessuna ubicazione</h3>
                <p className="text-muted-foreground">
                  Non ci sono ubicazioni con operazioni in questa zona
                </p>
              </div>
            )}
          </motion.div>
        )}

        {/* Operations List */}
        {showOperations && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <div className="mb-6 flex items-center justify-between">
              <button
                onClick={() => {
                  setShowOperations(false);
                  setShowLocationList(true);
                }}
                className="glass px-4 py-2 rounded-lg hover:bg-white/20 transition-colors"
              >
                ← Torna alle Ubicazioni
              </button>

              <div className="flex items-center gap-2">
                <div
                  className="px-4 py-2 rounded-xl text-lg font-black shadow-lg border-2"
                  style={{
                    backgroundColor: currentZone?.color,
                    color: '#ffffff',
                    borderColor: currentZone?.color,
                    textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                  }}
                >
                  {currentZone?.displayName}
                </div>
                <div className="px-4 py-2 rounded-lg text-base font-bold bg-gray-700">
                  📍 {currentLocation?.name?.split('/').pop() || currentLocation?.name}
                </div>
              </div>
            </div>

            <h2 className="text-2xl font-bold mb-6">Prodotti da prelevare</h2>

            <div className="space-y-4">
              {currentOperations.map((operation, index) => (
                <motion.div
                  key={operation.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`${darkMode ? 'card-product-dark' : 'glass-strong'} p-4 md:p-5 rounded-xl transition-all ${
                    operation.qty_done >= operation.quantity
                      ? 'bg-green-500/10 border border-green-500/30'
                      : ''
                  }`}
                >
                  <div className="flex items-start gap-4 mb-3">
                    {/* Foto prodotto */}
                    <div className="flex-shrink-0">
                      {operation.image ? (
                        <img
                          src={operation.image}
                          alt={operation.productName}
                          className="w-16 h-16 md:w-20 md:h-20 object-cover rounded-lg border border-gray-600"
                        />
                      ) : (
                        <div className="w-16 h-16 md:w-20 md:h-20 bg-gray-700 rounded-lg border border-gray-600 flex items-center justify-center text-2xl md:text-3xl">
                          📦
                        </div>
                      )}
                    </div>

                    <div className="flex-1">
                      <h3 className="font-semibold text-lg md:text-xl">{operation.productName}</h3>
                      <p className={`text-sm md:text-base ${darkMode ? 'text-gray-300' : 'text-muted-foreground'}`}>
                        {operation.productCode}
                      </p>

                      {/* Data di scadenza */}
                      {operation.expiry_date && (
                        <p className="text-sm md:text-base text-yellow-400 mt-1 flex items-center gap-1">
                          📅 Scadenza: {new Date(operation.expiry_date).toLocaleDateString('it-IT')}
                        </p>
                      )}

                      {/* Nome lotto se disponibile */}
                      {operation.lot_name && (
                        <p className={`text-sm md:text-base mt-1 ${darkMode ? 'text-gray-300' : 'text-gray-400'}`}>
                          Lotto: {operation.lot_name}
                        </p>
                      )}

                      {/* Cliente */}
                      {operation.customer && (
                        <p className="text-sm md:text-base text-blue-400 mt-1">
                          Cliente: {operation.customer}
                        </p>
                      )}
                    </div>

                    {operation.qty_done >= operation.quantity && (
                      <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0" />
                    )}
                  </div>

                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl md:text-3xl font-bold">
                        {operation.qty_done} / {operation.quantity}
                      </span>
                      <span className="text-lg md:text-xl font-semibold text-blue-400 bg-blue-400/10 px-2 py-1 rounded">{operation.uom}</span>
                    </div>
                  </div>

                  {/* Pulsanti operazione più compatti */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => openNumericKeyboard(operation)}
                      className="bg-blue-600 hover:bg-blue-700 text-white py-2 md:py-3 px-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 text-sm md:text-base"
                    >
                      ⌨️ Modifica
                    </button>

                    <button
                      onClick={() => {
                        // Quick complete senza validazione della quantità massima
                        if (operation.qty_done >= operation.quantity) {
                          toast('⚠️ Operazione già completata', { icon: '⚠️' });
                          return;
                        }

                        updateOperation(operation.id, operation.quantity);
                        toast.success(`✅ Operazione completata con quantità: ${operation.quantity}`);
                      }}
                      disabled={operation.qty_done >= operation.quantity}
                      className={`py-2 md:py-3 px-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-1 text-sm md:text-base ${
                        operation.qty_done >= operation.quantity
                          ? 'glass-strong text-gray-400 cursor-not-allowed'
                          : 'bg-green-600 hover:bg-green-700 text-white'
                      }`}
                    >
                      {operation.qty_done >= operation.quantity
                        ? '✓ OK'
                        : `✅ (${operation.quantity})`
                      }
                    </button>
                  </div>

                  {/* Progress bar ridotta (opzionale) */}
                  <div className="mt-2 bg-gray-700 rounded-full h-0.5 overflow-hidden opacity-60">
                    <motion.div
                      className="h-full bg-gradient-to-r from-blue-500 to-green-500"
                      initial={{ width: 0 }}
                      animate={{
                        width: `${(operation.qty_done / operation.quantity) * 100}%`
                      }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </motion.div>
              ))}
            </div>

            {currentOperations.length === 0 && !isLoading && (
              <div className="glass-strong rounded-xl p-12 text-center">
                <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Nessuna operazione</h3>
                <p className="text-muted-foreground">
                  Non ci sono prodotti da prelevare in questa ubicazione
                </p>
              </div>
            )}

            {/* Bottone conferma completamento */}
            {currentOperations.length > 0 &&
             currentOperations.every(op => op.qty_done >= op.quantity) && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6"
              >
                <button
                  onClick={() => {
                    toast.success('Ubicazione completata! ✅');
                    setShowOperations(false);
                    setShowLocationList(true);
                    setCurrentOperations([]);
                  }}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-4 px-6 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  Conferma e Continua
                </button>
              </motion.div>
            )}
          </motion.div>
        )}
      </div>

      {/* Mobile Home Button */}
      <MobileHomeButton />

      {/* QR Scanner Component */}
      <QRScanner
        isOpen={showQRScanner}
        onClose={() => {
          setShowQRScanner(false);
          setExpectedProductCode(undefined);
          setSelectedOperation(null);
        }}
        onScan={handleQRScan}
        scanMode={scannerMode}
        expectedCode={expectedProductCode}
        title={scannerMode === 'product' ? 'Scansiona Prodotto' : 'Scansiona Ubicazione'}
      />

      {/* Numeric Keyboard Component */}
      <NumericKeyboard
        isOpen={showNumericKeyboard}
        onClose={() => {
          setShowNumericKeyboard(false);
          setSelectedOperation(null);
        }}
        onConfirm={handleNumericConfirm}
        initialValue={selectedOperation?.qty_done || 0}
        maxValue={selectedOperation?.quantity}
        title="Quantità Prelevata"
        productName={selectedOperation?.productName}
      />

      {/* Product Selector Modal */}
      {showProductSelector && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setShowProductSelector(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-full max-w-lg glass-strong rounded-xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              🔢 Seleziona Prodotto
            </h3>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {currentOperations.map((operation) => (
                <motion.button
                  key={operation.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setSelectedOperation(operation);
                    setShowProductSelector(false);
                    setShowNumericKeyboard(true);
                  }}
                  className="w-full glass p-4 rounded-lg hover:bg-white/20 transition-all flex items-center gap-4 text-left"
                >
                  {/* Foto prodotto */}
                  {operation.image ? (
                    <img
                      src={operation.image}
                      alt={operation.productName}
                      className="w-12 h-12 object-cover rounded-lg border border-gray-600 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-gray-700 rounded-lg border border-gray-600 flex items-center justify-center text-lg flex-shrink-0">
                      📦
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold truncate">{operation.productName}</h4>
                    <p className="text-sm text-muted-foreground">
                      {operation.qty_done} / {operation.quantity} {operation.uom}
                    </p>
                  </div>

                  {operation.qty_done >= operation.quantity && (
                    <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                  )}
                </motion.button>
              ))}
            </div>

            <button
              onClick={() => setShowProductSelector(false)}
              className="w-full mt-4 glass-strong py-3 px-4 rounded-lg hover:bg-white/20 transition-colors"
            >
              Annulla
            </button>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}