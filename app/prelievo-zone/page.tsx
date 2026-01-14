'use client';

import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { Package, Truck, MapPin, BarChart3, Settings, ChevronRight, Clock, CheckCircle2, Camera, Sun, Moon, RefreshCw, Zap, Search, X, FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { AppHeader, MobileHomeButton } from '@/components/layout/AppHeader';
import { QRScanner } from '@/components/prelievo-zone/QRScanner';
import { NumericKeyboard } from '@/components/prelievo-zone/NumericKeyboard';
import { ZONES, Zone, Batch, StockLocation, Operation, WorkStats, DEFAULT_CONFIG } from '@/lib/types/picking';
import { getPickingClient } from '@/lib/odoo/pickingClient';
import toast from 'react-hot-toast';
import './picking-styles.css';

// Timer Component separato per evitare re-renders del componente principale
const TimerDisplay = memo(({ startTime }: { startTime: Date | undefined }) => {
  const [time, setTime] = useState(0);

  useEffect(() => {
    if (!startTime) return;
    let rafId: number;
    let lastUpdate = Date.now();

    const updateTimer = () => {
      const now = Date.now();
      if (now - lastUpdate >= 1000) {
        const diff = Math.floor((now - startTime.getTime()) / 1000);
        setTime(diff);
        lastUpdate = now;
      }
      rafId = requestAnimationFrame(updateTimer);
    };

    rafId = requestAnimationFrame(updateTimer);
    return () => cancelAnimationFrame(rafId);
  }, [startTime]);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m ${secs}s`;
  };

  return <span>{formatTime(time)}</span>;
});

TimerDisplay.displayName = 'TimerDisplay';

// Custom hook per debounce sessionStorage
const useDebouncedSessionStorage = (key: string, delay = 2000) => {
  const timeoutRef = useRef<NodeJS.Timeout>();

  return useCallback((value: any) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      sessionStorage.setItem(key, JSON.stringify(value));
    }, delay);
  }, [key, delay]);
};

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
  const [showCelebration, setShowCelebration] = useState(false);
  const [showCustomerNoteModal, setShowCustomerNoteModal] = useState(false);
  const [customerNoteText, setCustomerNoteText] = useState('');

  // Stati per picking singolo
  const [showSinglePickingModal, setShowSinglePickingModal] = useState(false);
  const [singlePickingSearch, setSinglePickingSearch] = useState('');
  const [singlePickingResults, setSinglePickingResults] = useState<any[]>([]);
  const [isSearchingPickings, setIsSearchingPickings] = useState(false);
  const [currentSinglePicking, setCurrentSinglePicking] = useState<any | null>(null);
  const [isSinglePickingMode, setIsSinglePickingMode] = useState(false);

  // Statistiche (totalTime rimosso - ora calcolato dal TimerDisplay)
  const [workStats, setWorkStats] = useState<WorkStats>({
    zonesCompleted: 0,
    totalOperations: 0,
    completedOperations: 0,
    startTime: undefined,
    currentZoneTime: 0,
    totalTime: 0 // Mantenuto per compatibilità ma non più aggiornato da effect
  });

  // Tracciamento tempi dettagliato per zona e operazioni
  const [zoneStartTime, setZoneStartTime] = useState<Date | null>(null);
  const [operationStartTimes, setOperationStartTimes] = useState<Record<number, Date>>({});
  const [operationDurations, setOperationDurations] = useState<Record<number, number>>({});

  // Conteggi per zona usando gli ID
  const [zoneCounts, setZoneCounts] = useState<{ [key: string]: number }>({
    'secco': 0,
    'secco_sopra': 0,
    'pingu': 0,
    'frigo': 0
  });

  // Cache PERSISTENTE usando useRef invece di useState (non viene persa quando cambi schermata!)
  const operationsCacheRef = useRef<{ [key: string]: Operation[] }>({});
  const cacheTimestampsRef = useRef<{ [key: string]: number }>({});
  const locationStatusCacheRef = useRef<{ [key: string]: { completedOps: number, totalOps: number, isFullyCompleted: boolean } }>({});

  // Configurazione
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [darkMode, setDarkMode] = useState(true);
  const [performanceMode, setPerformanceMode] = useState(true); // PERFORMANCE MODE ATTIVA di default

  // Client Odoo
  const pickingClient = getPickingClient();

  // Check connessione all'avvio
  useEffect(() => {
    checkConnection();
    loadConfiguration();

    // Carica cache dal sessionStorage (persiste durante la sessione del browser)
    try {
      const savedCache = sessionStorage.getItem('pickingOperationsCache');
      const savedTimestamps = sessionStorage.getItem('pickingCacheTimestamps');
      const savedLocationStatus = sessionStorage.getItem('pickingLocationStatusCache');

      if (savedCache) {
        operationsCacheRef.current = JSON.parse(savedCache);
        // console.log('📦 Cache caricata da sessionStorage:', Object.keys(operationsCacheRef.current).length, 'ubicazioni');
      }

      if (savedTimestamps) {
        cacheTimestampsRef.current = JSON.parse(savedTimestamps);
      }

      if (savedLocationStatus) {
        locationStatusCacheRef.current = JSON.parse(savedLocationStatus);
      }
    } catch (e) {
      // console.error('Errore caricamento cache:', e);
    }

    // Carica batch solo se l'utente è disponibile, altrimenti usa token mock
    if (user || true) { // Per ora sempre carica
      loadBatches();
    }
  }, [user]);

  // Timer rimosso - ora gestito dal componente TimerDisplay separato

  // Background refresh automatico ogni 30 secondi quando sei nella lista ubicazioni
  useEffect(() => {
    if (!showLocationList || !currentZone || !currentBatch) {
      return; // Early return if conditions not met
    }

    // console.log('🔄 [Auto-refresh] Attivato per zona:', currentZone.displayName);

    const refreshInterval = setInterval(async () => {
        // console.log('🔄 [Auto-refresh] Aggiornamento dati zona in background...');

        try {
          // Ricarica le ubicazioni per aggiornare i conteggi
          const odooLocations = await pickingClient.getZoneLocationsWithOperations(
            currentBatch.id,
            currentZone.id
          );

          // Ordina
          const sortedLocations = odooLocations.sort((a, b) => {
            const getLastPart = (name: string) => {
              const parts = name.split(/[\/\.]/);
              return parts[parts.length - 1] || name;
            };
            return getLastPart(a.name).localeCompare(getLastPart(b.name), undefined, { numeric: true, sensitivity: 'base' });
          });

          setLocations(sortedLocations);

          // Ricarica operazioni in PARALLELO (solo le prime 3 per non bloccare)
          const MAX_REFRESH = Math.min(3, sortedLocations.length); // Solo prime 3 ubicazioni
          const CONCURRENT_REFRESH = 1; // Max 1 richiesta parallela (sequenziale per non stressare Odoo)

          const refreshResults: any[] = [];

          // Carica in parallelo con limite di concorrenza
          for (let i = 0; i < MAX_REFRESH; i += CONCURRENT_REFRESH) {
            const batch = sortedLocations.slice(i, Math.min(i + CONCURRENT_REFRESH, MAX_REFRESH));

            const batchResults = await Promise.all(
              batch.map(async (location) => {
                try {
                  const cacheKey = `${currentBatch.id}-${location.id}`;
                  const operations = await pickingClient.getLocationOperations(currentBatch.id, location.id);
                  const sortedOperations = operations.sort((a, b) => a.productName.localeCompare(b.productName, 'it-IT'));

                  return {
                    cacheKey,
                    operations: sortedOperations,
                    locationId: location.id
                  };
                } catch (error) {
                  // console.error(`❌ Errore refresh ${location.name}:`, error);
                  return null;
                }
              })
            );

            refreshResults.push(...batchResults);
          }

          const results = refreshResults;

          // Aggiorna cache usando useRef
          const now = Date.now();

          results.forEach(result => {
            if (result) {
              operationsCacheRef.current[result.cacheKey] = result.operations;
              cacheTimestampsRef.current[result.cacheKey] = now;

              // Conta operazioni completate E parziali per il calcolo arancione
              const fullyCompletedOps = result.operations.filter((op: Operation) => op.qty_done >= op.quantity).length;
              const partialOps = result.operations.filter((op: Operation) => op.qty_done > 0 && op.qty_done < op.quantity).length;
              const completedOps = fullyCompletedOps + partialOps; // Include anche i parziali per l'arancione!
              const totalOps = result.operations.length;
              const isFullyCompleted = totalOps > 0 && fullyCompletedOps === totalOps;

              locationStatusCacheRef.current[result.locationId] = { completedOps, totalOps, isFullyCompleted };
            }
          });

          // Salva in sessionStorage
          sessionStorage.setItem('pickingOperationsCache', JSON.stringify(operationsCacheRef.current));
          sessionStorage.setItem('pickingCacheTimestamps', JSON.stringify(cacheTimestampsRef.current));
          sessionStorage.setItem('pickingLocationStatusCache', JSON.stringify(locationStatusCacheRef.current));

          // console.log('✅ [Auto-refresh] Dati aggiornati in background');
        } catch (error) {
          // console.error('❌ [Auto-refresh] Errore aggiornamento:', error);
        }
    }, 120000); // 120 secondi (2 minuti - ridotto carico su Odoo)

    return () => {
      // console.log('🛑 [Auto-refresh] Disattivato');
      clearInterval(refreshInterval);
    };
  }, [showLocationList, currentZone, currentBatch]);

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

    // Carica modalità performance da localStorage
    const savedPerformanceMode = localStorage.getItem('picking_performance_mode');
    if (savedPerformanceMode !== null) {
      setPerformanceMode(JSON.parse(savedPerformanceMode));
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

  const togglePerformanceMode = () => {
    const newMode = !performanceMode;
    setPerformanceMode(newMode);
    localStorage.setItem('picking_performance_mode', JSON.stringify(newMode));
    toast.success(`Modalità ${newMode ? 'Performance' : 'Normale'} attivata - ${newMode ? 'ZERO ANIMAZIONI ⚡' : 'Animazioni attive'}`);
  };

  const loadBatches = async () => {
    setIsLoading(true);
    try {
      const odoBatches = await pickingClient.getBatches();
      setBatches(odoBatches);

      if (odoBatches.length === 0) {
        toast('Nessun batch disponibile al momento', { icon: 'ℹ️' });
      }
    } catch (error: any) {
      // Gestisci errori generici
      toast.error(`Errore nel caricamento dei batch: ${error.message || 'Errore sconosciuto'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Funzioni per picking singolo
  const searchSinglePickings = async () => {
    if (singlePickingSearch.trim().length < 2) {
      toast('Inserisci almeno 2 caratteri per la ricerca', { icon: 'ℹ️' });
      return;
    }

    setIsSearchingPickings(true);
    try {
      const results = await pickingClient.searchSinglePickings(singlePickingSearch);
      setSinglePickingResults(results);

      if (results.length === 0) {
        toast('Nessun picking trovato', { icon: 'ℹ️' });
      }
    } catch (error: any) {
      toast.error(`Errore nella ricerca: ${error.message || 'Errore sconosciuto'}`);
    } finally {
      setIsSearchingPickings(false);
    }
  };

  const selectSinglePicking = async (picking: any) => {
    // Svuota cache
    operationsCacheRef.current = {};
    cacheTimestampsRef.current = {};
    locationStatusCacheRef.current = {};
    sessionStorage.removeItem('pickingOperationsCache');
    sessionStorage.removeItem('pickingCacheTimestamps');
    sessionStorage.removeItem('pickingLocationStatusCache');

    setCurrentSinglePicking(picking);
    setIsSinglePickingMode(true);
    setShowSinglePickingModal(false);
    setShowBatchSelector(false);
    setShowZoneSelector(false);
    setShowLocationList(true);

    // Reset statistiche
    setWorkStats({
      zonesCompleted: 0,
      totalOperations: 0,
      completedOperations: 0,
      startTime: new Date(),
      currentZoneTime: 0,
      totalTime: 0
    });

    // Carica ubicazioni per il picking singolo
    await loadSinglePickingLocations(picking.id);

    toast.success(`Picking ${picking.name} selezionato`);
  };

  const loadSinglePickingLocations = async (pickingId: number) => {
    try {
      const odooLocations = await pickingClient.getSinglePickingLocations(pickingId);

      // Ordina ubicazioni
      const sortedLocations = odooLocations.sort((a, b) => {
        const getLastPart = (name: string) => {
          const parts = name.split(/[\/\.]/);
          return parts[parts.length - 1] || name;
        };
        return getLastPart(a.name).localeCompare(getLastPart(b.name), undefined, { numeric: true, sensitivity: 'base' });
      });

      setLocations(sortedLocations);

      if (odooLocations.length === 0) {
        toast('Nessuna operazione da prelevare', { icon: 'ℹ️' });
      } else {
        toast.success(`✅ ${odooLocations.length} ubicazioni caricate!`);
      }
    } catch (error: any) {
      toast.error('Errore nel caricamento delle ubicazioni');
    }
  };

  const loadSinglePickingOperations = async (location: StockLocation) => {
    try {
      if (!currentSinglePicking) {
        toast.error('Nessun picking selezionato');
        return;
      }

      const cacheKey = `single-${currentSinglePicking.id}-${location.id}`;

      if (operationsCacheRef.current[cacheKey]) {
        setCurrentOperations(operationsCacheRef.current[cacheKey]);
        return;
      }

      setIsLoading(true);

      const odooOperations = await pickingClient.getSinglePickingLocationOperations(
        currentSinglePicking.id,
        location.id
      );

      const sortedOperations = odooOperations.sort((a, b) => {
        return a.productName.localeCompare(b.productName, 'it-IT');
      });

      // Salva in cache
      const now = Date.now();
      operationsCacheRef.current[cacheKey] = sortedOperations;
      cacheTimestampsRef.current[cacheKey] = now;

      const fullyCompletedOps = sortedOperations.filter(op => op.qty_done >= op.quantity).length;
      const partialOps = sortedOperations.filter(op => op.qty_done > 0 && op.qty_done < op.quantity).length;
      const completedOps = fullyCompletedOps + partialOps;
      const totalOps = sortedOperations.length;
      const isFullyCompleted = totalOps > 0 && fullyCompletedOps === totalOps;

      locationStatusCacheRef.current[location.id] = { completedOps, totalOps, isFullyCompleted };

      sessionStorage.setItem('pickingOperationsCache', JSON.stringify(operationsCacheRef.current));
      sessionStorage.setItem('pickingCacheTimestamps', JSON.stringify(cacheTimestampsRef.current));
      sessionStorage.setItem('pickingLocationStatusCache', JSON.stringify(locationStatusCacheRef.current));

      setCurrentOperations(sortedOperations);

      setWorkStats(prev => ({
        ...prev,
        totalOperations: prev.totalOperations + odooOperations.length
      }));

      if (odooOperations.length === 0) {
        toast(`Nessuna operazione da prelevare in ${location.name}`, { icon: 'ℹ️' });
      }
    } catch (error: any) {
      toast.error('Errore nel caricamento delle operazioni');
    } finally {
      setIsLoading(false);
    }
  };

  const exitSinglePickingMode = () => {
    setIsSinglePickingMode(false);
    setCurrentSinglePicking(null);
    setShowLocationList(false);
    setShowBatchSelector(true);
    setLocations([]);
    setCurrentOperations([]);
    setSinglePickingSearch('');
    setSinglePickingResults([]);
  };

  const selectBatch = async (batch: Batch) => {
    // IMPORTANTE: Svuota TUTTA la cache quando cambi batch!
    // Questo risolve il problema delle ubicazioni che rimangono verdi
    operationsCacheRef.current = {};
    cacheTimestampsRef.current = {};
    locationStatusCacheRef.current = {};
    sessionStorage.removeItem('pickingOperationsCache');
    sessionStorage.removeItem('pickingCacheTimestamps');
    sessionStorage.removeItem('pickingLocationStatusCache');

    console.log('🧹 Cache svuotata per nuovo batch:', batch.name);

    setCurrentBatch(batch);
    setShowBatchSelector(false);
    setShowZoneSelector(true);

    // Reset timer statistiche per nuovo batch
    setWorkStats({
      zonesCompleted: 0,
      totalOperations: 0,
      completedOperations: 0,
      startTime: new Date(),
      currentZoneTime: 0,
      totalTime: 0
    });

    // Carica conteggi zone
    await loadZoneCounts(batch.id);

    toast.success(`Batch ${batch.name} selezionato`);
  };

  const loadZoneCounts = async (batchId: number) => {
    try {
      const counts = await pickingClient.getBatchZoneCounts(batchId);
      setZoneCounts(counts);
    } catch (error) {
      toast.error('Errore nel caricamento dei conteggi zone');
    }
  };

  const selectZone = async (zone: Zone) => {
    setCurrentZone(zone);
    setShowZoneSelector(false);
    setShowLocationList(true);

    // Inizia tracciamento tempo zona
    setZoneStartTime(new Date());

    // Carica ubicazioni per la zona E precarica TUTTE le operazioni
    await loadZoneLocations(zone);

    toast.success(`Zona ${zone.displayName} selezionata`);
  };

  const loadZoneLocations = async (zone: Zone) => {
    // NO setIsLoading(true) - l'utente può vedere subito le ubicazioni!
    try {
      if (!currentBatch) {
        toast.error('Nessun batch selezionato');
        return;
      }

      // Step 1: Carica le ubicazioni
      const odooLocations = await pickingClient.getZoneLocationsWithOperations(
        currentBatch.id,
        zone.id
      );

      // Ordina ubicazioni per ultimi caratteri/cifre (es. A01, A02, B01, C04)
      const sortedLocations = odooLocations.sort((a, b) => {
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
        return;
      }

      toast.success(`✅ ${odooLocations.length} ubicazioni caricate! Prefetch in background... ⚡`);

      // PREFETCH INTELLIGENTE IN BACKGROUND - Prime 3 ubicazioni
      // Non blocca l'utente ma prepopola la cache per accesso istantaneo!
      setTimeout(async () => {
        try {
          const PREFETCH_COUNT = Math.min(3, sortedLocations.length);
          // console.log(`🔄 [Prefetch] Caricamento in background delle prime ${PREFETCH_COUNT} ubicazioni...`);

          for (let i = 0; i < PREFETCH_COUNT; i++) {
            const location = sortedLocations[i];
            const cacheKey = `${currentBatch.id}-${location.id}`;

            // Salta se già in cache
            if (operationsCacheRef.current[cacheKey]) {
              // console.log(`⏭️ [Prefetch] ${location.name} già in cache, skip`);
              continue;
            }

            try {
              const operations = await pickingClient.getLocationOperations(currentBatch.id, location.id);
              const sortedOperations = operations.sort((a, b) => a.productName.localeCompare(b.productName, 'it-IT'));

              // Salva in cache
              const now = Date.now();
              operationsCacheRef.current[cacheKey] = sortedOperations;
              cacheTimestampsRef.current[cacheKey] = now;

              // Calcola stato (includi operazioni parziali per l'arancione)
              const fullyCompletedOps = sortedOperations.filter(op => op.qty_done >= op.quantity).length;
              const partialOps = sortedOperations.filter(op => op.qty_done > 0 && op.qty_done < op.quantity).length;
              const completedOps = fullyCompletedOps + partialOps;
              const totalOps = sortedOperations.length;
              const isFullyCompleted = totalOps > 0 && fullyCompletedOps === totalOps;
              locationStatusCacheRef.current[location.id] = { completedOps, totalOps, isFullyCompleted };

              // Salva in sessionStorage
              sessionStorage.setItem('pickingOperationsCache', JSON.stringify(operationsCacheRef.current));
              sessionStorage.setItem('pickingCacheTimestamps', JSON.stringify(cacheTimestampsRef.current));
              sessionStorage.setItem('pickingLocationStatusCache', JSON.stringify(locationStatusCacheRef.current));

              // console.log(`✅ [Prefetch] ${location.name} caricata (${i + 1}/${PREFETCH_COUNT})`);

              // Pausa di 500ms tra ogni chiamata per non sovraccaricare Odoo
              if (i < PREFETCH_COUNT - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
              }
            } catch (error) {
              // console.error(`❌ [Prefetch] Errore caricando ${location.name}:`, error);
            }
          }

          // console.log(`🎉 [Prefetch] Completato! ${PREFETCH_COUNT} ubicazioni pronte in cache`);
        } catch (error) {
          // console.error('❌ [Prefetch] Errore generale:', error);
        }
      }, 100); // Inizia dopo 100ms per non bloccare l'UI

    } catch (error: any) {
      toast.error('Errore nel caricamento delle ubicazioni');
    }
  };

  const selectLocation = async (location: StockLocation) => {
    setCurrentLocation(location);
    setShowLocationList(false);
    setShowOperations(true);

    // Carica operazioni per l'ubicazione (gestisce sia batch che picking singolo)
    if (isSinglePickingMode) {
      await loadSinglePickingOperations(location);
    } else {
      await loadLocationOperations(location);
    }

    toast.success(`Ubicazione ${location.name} selezionata`);
  };

  const loadLocationOperations = async (location: StockLocation) => {
    try {
      if (!currentBatch) {
        toast.error('Nessun batch selezionato');
        return;
      }

      // Controlla cache SEMPRE - se esiste, usala SUBITO!
      const cacheKey = `${currentBatch.id}-${location.id}`;

      if (operationsCacheRef.current[cacheKey]) {
        // console.log('✅ [CACHE HIT] Usando cache per ubicazione:', location.name);
        setCurrentOperations(operationsCacheRef.current[cacheKey]);
        // NO setIsLoading, è ISTANTANEO!
        return;
      }

      // Se non c'è in cache (non dovrebbe mai succedere), carica da Odoo
      // console.log('⚠️ [CACHE MISS] Cache non trovata per ubicazione:', location.name, '- Caricamento da Odoo...');
      setIsLoading(true);

      const odooOperations = await pickingClient.getLocationOperations(
        currentBatch.id,
        location.id
      );

      // Ordina operazioni alfabeticamente per nome prodotto
      const sortedOperations = odooOperations.sort((a, b) => {
        return a.productName.localeCompare(b.productName, 'it-IT');
      });

      // Salva in cache usando useRef
      const now = Date.now();
      operationsCacheRef.current[cacheKey] = sortedOperations;
      cacheTimestampsRef.current[cacheKey] = now;

      // Calcola e salva stato completamento nella cache (includi parziali)
      const fullyCompletedOps = sortedOperations.filter(op => op.qty_done >= op.quantity).length;
      const partialOps = sortedOperations.filter(op => op.qty_done > 0 && op.qty_done < op.quantity).length;
      const completedOps = fullyCompletedOps + partialOps;
      const totalOps = sortedOperations.length;
      const isFullyCompleted = totalOps > 0 && fullyCompletedOps === totalOps;

      locationStatusCacheRef.current[location.id] = { completedOps, totalOps, isFullyCompleted };

      // Salva in sessionStorage
      sessionStorage.setItem('pickingOperationsCache', JSON.stringify(operationsCacheRef.current));
      sessionStorage.setItem('pickingCacheTimestamps', JSON.stringify(cacheTimestampsRef.current));
      sessionStorage.setItem('pickingLocationStatusCache', JSON.stringify(locationStatusCacheRef.current));

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
      toast.error('Errore nel caricamento delle operazioni');
    } finally {
      setIsLoading(false);
    }
  };

  const updateOperation = async (operationId: number, qtyDone: number) => {
    // Aggiorna UI immediatamente, permettendo quantità superiori a quella richiesta
    setCurrentOperations(prev => {
      const updated = prev.map(op => {
        if (op.id === operationId) {
          const updatedOp = { ...op, qty_done: qtyDone };

          // Se completata, aggiorna statistiche E salva durata
          if (qtyDone >= op.quantity && op.qty_done < op.quantity) {
            setWorkStats(prevStats => ({
              ...prevStats,
              completedOperations: prevStats.completedOperations + 1
            }));

            // Calcola e salva durata operazione
            if (operationStartTimes[operationId]) {
              const duration = Math.floor((Date.now() - operationStartTimes[operationId].getTime()) / 1000);
              setOperationDurations(prev => ({
                ...prev,
                [operationId]: duration
              }));
            }

            toast.success(`✅ ${op.productName} completato!`);
          }

          return updatedOp;
        }
        return op;
      });

      // Aggiorna cache stato ubicazione corrente E la cache delle operazioni
      if (currentLocation && currentBatch) {
        const fullyCompletedOps = updated.filter(op => op.qty_done >= op.quantity).length;
        const partialOps = updated.filter(op => op.qty_done > 0 && op.qty_done < op.quantity).length;
        const completedOps = fullyCompletedOps + partialOps;
        const totalOps = updated.length;
        const isFullyCompleted = totalOps > 0 && fullyCompletedOps === totalOps;

        locationStatusCacheRef.current[currentLocation.id] = { completedOps, totalOps, isFullyCompleted };

        // IMPORTANTE: Aggiorna anche la cache delle operazioni con i nuovi dati!
        const cacheKey = `${currentBatch.id}-${currentLocation.id}`;
        operationsCacheRef.current[cacheKey] = updated;
        cacheTimestampsRef.current[cacheKey] = Date.now();

        // Salva in sessionStorage
        sessionStorage.setItem('pickingLocationStatusCache', JSON.stringify(locationStatusCacheRef.current));
        sessionStorage.setItem('pickingOperationsCache', JSON.stringify(operationsCacheRef.current));
        sessionStorage.setItem('pickingCacheTimestamps', JSON.stringify(cacheTimestampsRef.current));

        // console.log(`✅ Cache aggiornata per ${currentLocation.name}: ${completedOps}/${totalOps} completati (${isFullyCompleted ? 'TUTTO FATTO' : 'in corso'})`);

        // Se ubicazione completata al 100%, chiudi e apri la prossima
        if (isFullyCompleted) {
          setTimeout(() => {
            openNextLocation();
          }, 1000); // Delay di 1 secondo per far vedere il completamento
        }
      }

      return updated;
    });

    // Salva su Odoo in background
    try {
      const success = await pickingClient.updateOperationQuantity(operationId, qtyDone);
      if (!success) {
        toast.error('Errore salvataggio quantità su Odoo');
      }
    } catch (error) {
      toast.error('Errore sincronizzazione con Odoo');
    }
  };

  // Funzione per tornare alla lista e scrollare alla prossima ubicazione
  const openNextLocation = async () => {
    if (!currentLocation) return;

    toast.success('✅ Ubicazione completata!');

    // Torna alla lista ubicazioni
    setShowOperations(false);
    setShowLocationList(true);

    // NON ricaricare loadZoneLocations - troppo lento e resetta tutto!
    // Usa solo la cache locale che già hai aggiornato

    // Trova l'indice dell'ubicazione corrente
    const currentIndex = locations.findIndex(loc => loc.id === currentLocation.id);

    if (currentIndex === -1) return;

    // Trova la prossima ubicazione non completata
    let nextLocationIndex = -1;
    let allCompleted = true; // Flag per controllare se TUTTE sono completate

    for (let i = 0; i < locations.length; i++) {
      const loc = locations[i];
      const cachedStatus = locationStatusCacheRef.current[loc.id];
      const isCompleted = cachedStatus?.isFullyCompleted || false;

      if (!isCompleted) {
        allCompleted = false;

        // Se è dopo la corrente e non completata, è la prossima
        if (i > currentIndex && nextLocationIndex === -1) {
          nextLocationIndex = i;
        }
      }
    }

    // Scrolla alla prossima ubicazione dopo un breve delay
    setTimeout(() => {
      if (nextLocationIndex !== -1) {
        const locationCards = document.querySelectorAll('.location-card');
        if (locationCards[nextLocationIndex]) {
          locationCards[nextLocationIndex].scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });

          // Highlight temporaneo della card
          locationCards[nextLocationIndex].classList.add('highlight-pulse');
          setTimeout(() => {
            locationCards[nextLocationIndex].classList.remove('highlight-pulse');
          }, 2000);
        }
      } else if (allCompleted) {
        // SOLO se TUTTE le ubicazioni sono completate - CELEBRAZIONE!
        // console.log('🎉 TUTTE LE UBICAZIONI COMPLETATE!');
        setShowCelebration(true);

        // Vibrazione di successo
        if ('vibrate' in navigator) {
          navigator.vibrate([200, 100, 200, 100, 400]);
        }

        // Chiudi celebrazione dopo 5 secondi
        setTimeout(() => {
          setShowCelebration(false);
        }, 5000);
      }
    }, 500);
  };

  // Handler per QR Scanner - memoizzato per evitare ri-creazione
  const handleQRScan = useCallback((code: string, type: 'product' | 'location'): boolean => {
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
        return true;
      } else {
        toast.error('Prodotto non trovato in questa ubicazione');
        return false;
      }
    } else {
      // Gestione scansione ubicazione
      const location = locations.find(
        loc => loc.barcode === code ||
               loc.name === code ||
               loc.name.includes(code) ||
               code.includes(loc.name)
      );

      if (location) {
        toast.success(`📍 Ubicazione trovata: ${location.name}`);
        selectLocation(location);
        return true;
      } else {
        toast.error('❌ Ubicazione non trovata in questa zona');
        return false;
      }
    }
  }, [currentOperations, locations, selectLocation]);

  // Funzione per pulire la cache e forzare refresh
  const clearCache = () => {
    operationsCacheRef.current = {};
    cacheTimestampsRef.current = {};
    locationStatusCacheRef.current = {};
    sessionStorage.removeItem('pickingOperationsCache');
    sessionStorage.removeItem('pickingCacheTimestamps');
    sessionStorage.removeItem('pickingLocationStatusCache');
    toast.success('Cache pulita - prossimi caricamenti saranno da Odoo');
  };

  const refreshCurrentLocation = async () => {
    if (currentLocation && currentBatch) {
      const cacheKey = `${currentBatch.id}-${currentLocation.id}`;
      // Rimuovi dalla cache
      delete operationsCacheRef.current[cacheKey];
      delete cacheTimestampsRef.current[cacheKey];

      // Salva in sessionStorage
      sessionStorage.setItem('pickingOperationsCache', JSON.stringify(operationsCacheRef.current));
      sessionStorage.setItem('pickingCacheTimestamps', JSON.stringify(cacheTimestampsRef.current));

      // Ricarica
      await loadLocationOperations(currentLocation);
      toast.success(`Dati aggiornati per ${currentLocation.name}`);
    }
  };

  // Handler per tastiera numerica - memoizzato
  const handleNumericConfirm = useCallback((value: number) => {
    if (selectedOperation) {
      updateOperation(selectedOperation.id, value);
      setSelectedOperation(null);
    }
  }, [selectedOperation]);

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

  // State per input scanner invisibile
  const [scannerInput, setScannerInput] = useState('');
  const scannerInputRef = useRef<HTMLInputElement>(null);
  const [scannerError, setScannerError] = useState<string | null>(null);

  // Auto-focus sull'input scanner quando si apre la lista ubicazioni
  useEffect(() => {
    if (!showLocationList || !scannerInputRef.current) {
      return; // Early return if conditions not met
    }

    // Focus immediato
    scannerInputRef.current.focus();

    // Ri-focus periodico per evitare perdita focus su tablet
    const refocusInterval = setInterval(() => {
      if (scannerInputRef.current && document.activeElement !== scannerInputRef.current) {
        scannerInputRef.current.focus();
      }
    }, 500);

    return () => clearInterval(refocusInterval);
  }, [showLocationList]);

  // Handler per input scanner pistola
  const handleScannerInput = (value: string) => {
    if (value.trim().length === 0) return;

    // Cerca l'ubicazione nella lista corrente
    const foundLocation = locations.find(
      loc => loc.barcode === value ||
             loc.name === value ||
             loc.name.includes(value) ||
             value.includes(loc.name)
    );

    if (foundLocation) {
      toast.success(`📍 Apertura ${foundLocation.name}...`);
      selectLocation(foundLocation);
    } else {
      // Mostra errore visivo grande sulla schermata
      setScannerError(`❌ Ubicazione "${value}" non trovata in questa zona!`);

      // Vibrazione per feedback errore (se supportata)
      if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200]);
      }

      // Toast come backup
      toast.error('Ubicazione non trovata in questa zona');

      // Rimuovi errore dopo 3 secondi
      setTimeout(() => {
        setScannerError(null);
      }, 3000);
    }

    // Reset input
    setScannerInput('');
    if (scannerInputRef.current) {
      scannerInputRef.current.focus();
    }
  };

  // Helper per animazioni condizionali - PERFORMANCE MODE (non più necessario senza framer-motion)
  // Funzione rimossa - animazioni ora gestite da CSS

  // Helper per rimuovere tag HTML dal messaggio cliente
  const stripHtmlTags = (html: string): string => {
    if (!html) return '';
    // Rimuove tutti i tag HTML e decodifica entità HTML
    return html
      .replace(/<[^>]*>/g, '') // Rimuove tag HTML
      .replace(/&nbsp;/g, ' ') // Sostituisce &nbsp; con spazio
      .replace(/&amp;/g, '&')  // Decodifica &amp;
      .replace(/&lt;/g, '<')   // Decodifica &lt;
      .replace(/&gt;/g, '>')   // Decodifica &gt;
      .replace(/&quot;/g, '"') // Decodifica &quot;
      .trim();
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m ${secs}s`;
  };

  // Memoizza il calcolo del progresso per evitare ricalcoli inutili
  const progress = useMemo(() => {
    if (workStats.totalOperations === 0) return 0;
    return Math.round((workStats.completedOperations / workStats.totalOperations) * 100);
  }, [workStats.completedOperations, workStats.totalOperations]);

  // Genera e salva report zona completata - VERSIONE DETTAGLIATA
  const generateAndSaveZoneReport = async () => {
    if (!currentBatch || !currentZone || !user) {
      return;
    }

    try {
      const now = new Date();
      const dateStr = now.toLocaleString('it-IT');

      // Calcola tempo totale zona (da zoneStartTime a ora)
      const zoneTime = zoneStartTime
        ? Math.floor((now.getTime() - zoneStartTime.getTime()) / 1000)
        : (workStats.currentZoneTime || 0);
      const zoneTimeStr = formatTime(zoneTime);

      // Raccogli statistiche dettagliate dalle operazioni
      let totalProducts = 0;
      let totalQuantity = 0;
      let totalWeight = 0;
      const productsByLocation = new Map<string, { products: any[], qty: number, time?: number }>();

      // Raggruppa operazioni per ubicazione
      currentOperations.forEach(op => {
        if (op.qty_done > 0) {
          totalProducts++;
          totalQuantity += op.qty_done;

          const locationKey = op.locationName || 'Sconosciuta';
          if (!productsByLocation.has(locationKey)) {
            productsByLocation.set(locationKey, { products: [], qty: 0, time: 0 });
          }

          const loc = productsByLocation.get(locationKey)!;
          const opDuration = operationDurations[op.id] || 0;

          loc.products.push({
            name: op.productName,
            code: op.productCode,
            qty: op.qty_done,
            uom: op.uom,
            duration: opDuration // Aggiungi durata operazione
          });
          loc.qty += op.qty_done;
          if (loc.time !== undefined) {
            loc.time += opDuration; // Somma tempo ubicazione
          }
        }
      });

      // Calcola metriche performance
      const locationsCount = productsByLocation.size;
      const avgTimePerLocation = locationsCount > 0 ? zoneTime / locationsCount : 0;
      const pickingSpeed = zoneTime > 0 ? (totalProducts / (zoneTime / 60)).toFixed(1) : '0';

      // Genera report in formato testo plain per chatter (no HTML)
      let reportText = `📦 REPORT PRELIEVO - ${currentZone.displayName.toUpperCase()}
👤 Operatore: ${user.name || 'Operatore'}
📅 Data: ${dateStr}
⏱️ Tempo totale: ${zoneTimeStr}

📊 STATISTICHE GENERALI
• Prodotti prelevati: ${totalProducts} articoli
• Quantità totale: ${totalQuantity} pz
• Ubicazioni visitate: ${locationsCount}
• Tempo medio per ubicazione: ${formatTime(Math.floor(avgTimePerLocation))}
• Velocità picking: ${pickingSpeed} articoli/min

📍 DETTAGLIO PER UBICAZIONE`;

      // Aggiungi dettaglio per ogni ubicazione
      Array.from(productsByLocation.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .forEach(([locationName, data]) => {
          const locationTimeStr = data.time ? formatTime(data.time) : '0s';
          reportText += `

📍 ${locationName}
   ${data.products.length} prodotti • ${data.qty} pz totali • ⏱️ ${locationTimeStr}`;
          data.products.forEach(p => {
            const durationStr = p.duration ? ` (⏱️ ${formatTime(p.duration)})` : '';
            reportText += `
   • ${p.name} (${p.code || 'N/A'}) - ${p.qty} ${p.uom}${durationStr}`;
          });
        });

      // Invia nel chatter
      const saved = await pickingClient.postBatchChatterMessage(currentBatch.id, reportText);

      if (saved) {
        toast.success('✅ Report salvato nel chatter del batch!');
      } else {
        toast.error('⚠️ Errore salvataggio report (ma il lavoro è salvato)');
      }

    } catch (error) {
      console.error('Errore generazione report:', error);
      toast.error('⚠️ Errore nel salvataggio del report');
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

            {/* Pulsante Picking Singolo */}
            <button
              onClick={() => setShowSinglePickingModal(true)}
              className="glass px-3 py-2 rounded-lg hover:bg-white/20 transition-colors flex items-center gap-2 border border-purple-500/50"
              title="Cerca Picking Singolo"
            >
              <FileText className="w-5 h-5 text-purple-400" />
              <span className="text-sm font-medium hidden sm:inline text-purple-400">Pick Singolo</span>
            </button>

            {/* Performance Mode Toggle Button */}
            <button
              onClick={togglePerformanceMode}
              className={`glass p-2 rounded-lg hover:bg-white/20 transition-colors ${
                performanceMode ? 'bg-green-500/30 border border-green-500' : ''
              }`}
              title={performanceMode ? 'Modalità Performance ATTIVA ⚡' : 'Modalità Normale'}
            >
              <Zap className={`w-5 h-5 ${performanceMode ? 'text-green-400' : 'text-gray-400'}`} />
            </button>

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
        <div
          className={`fade-in ${darkMode ? 'stats-bar-dark' : 'glass-strong'} mx-4 mt-4 p-4 md:p-6 rounded-xl border border-white/20 transition-all`}
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-6 flex-wrap">
              {/* Informazioni Batch/Picking */}
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-orange-400" />
                <span className="text-sm">
                  {isSinglePickingMode ? (
                    <>Pick: <strong>{currentSinglePicking?.name}</strong></>
                  ) : (
                    <>Batch: <strong>{currentBatch?.name}</strong></>
                  )}
                </span>
              </div>

              {/* Informazioni Autista/Cliente */}
              {isSinglePickingMode ? (
                currentSinglePicking?.partner_name && (
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-cyan-400" />
                    <span className="text-sm">
                      Cliente: <strong>{currentSinglePicking.partner_name}</strong>
                    </span>
                  </div>
                )
              ) : (
                currentBatch?.x_studio_autista_del_giro && (
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-cyan-400" />
                    <span className="text-sm">
                      Autista: <strong>{currentBatch.x_studio_autista_del_giro[1]}</strong>
                    </span>
                  </div>
                )
              )}

              {/* Tempo */}
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" />
                <span className="text-sm">
                  Tempo: <strong><TimerDisplay startTime={workStats.startTime} /></strong>
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
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1 text-center">
                {progress}% completato
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Batch Selector */}
        {showBatchSelector && (
          <div className="scale-in">
            <h2 className="text-2xl font-bold mb-6 text-center">Seleziona Batch</h2>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {batches.map(batch => (
                <button
                  key={batch.id}
                  onClick={() => selectBatch(batch)}
                  className={`${darkMode ? 'glass-picking-strong' : 'glass-strong'} p-6 rounded-xl hover:bg-white/20 hover:scale-[1.02] active:scale-[0.98] transition-all text-left`}
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

                    {/* Messaggi clienti */}
                    {batch.customer_notes_count && batch.customer_notes_count > 0 && (
                      <div className="flex items-center gap-2 bg-yellow-500/20 px-3 py-2 rounded-lg border border-yellow-500/30">
                        <span
                          className="text-lg"
                          style={{ animation: 'heartbeat 1.5s ease-in-out infinite' }}
                        >
                          ⚠️
                        </span>
                        <span className="font-semibold text-yellow-400">
                          {batch.customer_notes_count} {batch.customer_notes_count === 1 ? 'cliente con messaggio' : 'clienti con messaggi'}
                        </span>
                      </div>
                    )}
                  </div>

                  <ChevronRight className="w-5 h-5 mt-4 ml-auto text-muted-foreground" />
                </button>
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
          </div>
        )}

        {/* Zone Selector */}
        {showZoneSelector && (
          <div className="slide-in-right"
            
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
                <button
                  key={zone.id}
                  
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
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Locations List */}
        {showLocationList && (
          <div className="slide-in-right"

          >
            <div className="mb-6 flex items-center justify-between">
              <button
                onClick={async () => {
                  if (isSinglePickingMode) {
                    // Esci dalla modalità picking singolo
                    exitSinglePickingMode();
                  } else {
                    // Genera e salva report prima di tornare alle zone
                    await generateAndSaveZoneReport();

                    // Reset tempi zona per la prossima zona
                    setZoneStartTime(null);
                    setOperationStartTimes({});
                    setOperationDurations({});

                    setShowLocationList(false);
                    setShowZoneSelector(true);
                    setCurrentZone(null);
                  }
                }}
                className="glass px-4 py-2 rounded-lg hover:bg-white/20 transition-colors"
              >
                {isSinglePickingMode ? '← Torna ai Batch' : '← Torna alle Zone'}
              </button>

              {isSinglePickingMode ? (
                <div className="px-4 py-2 rounded-lg font-semibold bg-purple-500/20 text-purple-400 border border-purple-500/30">
                  📦 {currentSinglePicking?.name} - {currentSinglePicking?.partner_name}
                </div>
              ) : (
                <div
                  className="px-4 py-2 rounded-lg font-semibold"
                  style={{ backgroundColor: `${currentZone?.color}20`, color: currentZone?.color }}
                >
                  {currentZone?.displayName}
                </div>
              )}
            </div>

            {/* Input invisibile per scanner pistola */}
            <input
              ref={scannerInputRef}
              type="text"
              value={scannerInput}
              onChange={(e) => setScannerInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleScannerInput(scannerInput);
                }
              }}
              onBlur={(e) => {
                // Ripristina focus immediatamente se perso
                setTimeout(() => {
                  if (scannerInputRef.current) {
                    scannerInputRef.current.focus();
                  }
                }, 100);
              }}
              className="fixed top-0 left-0 opacity-0 w-1 h-1 pointer-events-none -z-10"
              autoFocus
              autoComplete="off"
              inputMode="none"
              placeholder="Scanner input"
            />

            {/* Overlay errore scanner pistola */}
            {scannerError && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 fade-in"
                onClick={() => setScannerError(null)}
              >
                <div
                  className="bg-red-500/95 text-white p-8 rounded-2xl shadow-2xl max-w-lg text-center"
                >
                  <div className="text-6xl mb-4">❌</div>
                  <h3 className="text-2xl font-bold mb-3">Ubicazione Non Trovata!</h3>
                  <p className="text-lg mb-4">{scannerError}</p>
                  <p className="text-sm opacity-90">Scansiona un'ubicazione valida per questa zona</p>
                </div>
              </div>
            )}

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

            <div className="space-y-4">
              {locations.map((location, index) => {
                const locData = location as any;

                // Usa la cache dello stato se disponibile, altrimenti usa i dati dalla location
                const cachedStatus = locationStatusCacheRef.current[location.id];
                const isCompleted = cachedStatus?.isFullyCompleted || locData.isFullyCompleted || false;
                const completedOps = cachedStatus?.completedOps || locData.completedOps || 0;
                const totalOps = cachedStatus?.totalOps || locData.totalOps || locData.operationCount || 0;
                const remaining = totalOps - completedOps;

                return (
                  <div
                    key={location.id}
                    
                    className={`location-card w-full p-4 rounded-xl flex items-center justify-between gap-4 transition-all ${
                      isCompleted
                        ? 'bg-green-500/30 border-4 border-green-500'
                        : remaining > 0 && completedOps > 0
                        ? 'bg-orange-500/20 border-4 border-orange-500'
                        : 'glass-strong border-4 border-blue-500/50'
                    }`}
                  >
                    {/* STATO VISIVO ENORME - ICONA */}
                    <div className="flex-shrink-0">
                      {isCompleted ? (
                        <div className="w-24 h-24 rounded-2xl bg-green-500 flex flex-col items-center justify-center shadow-2xl">
                          <CheckCircle2 className="w-12 h-12 text-white mb-1" />
                          <span className="text-white font-black text-xs">OK</span>
                        </div>
                      ) : remaining > 0 && completedOps > 0 ? (
                        <div className="w-24 h-24 rounded-2xl bg-orange-500 flex flex-col items-center justify-center shadow-2xl">
                          <div className="text-white font-black text-3xl">{remaining}</div>
                          <span className="text-white font-bold text-xs">DA FARE</span>
                        </div>
                      ) : (
                        <div className="w-24 h-24 rounded-2xl bg-red-500 flex flex-col items-center justify-center shadow-2xl">
                          <div className="text-white font-black text-3xl">{totalOps}</div>
                          <span className="text-white font-bold text-xs">DA FARE</span>
                        </div>
                      )}
                    </div>

                    {/* INFO UBICAZIONE */}
                    <div className="flex-1">
                      <h3 className="font-bold text-xl mb-2">{location.name.split('/').pop() || location.name}</h3>

                      {/* STATO TESTUALE GRANDE */}
                      {isCompleted ? (
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-2xl font-black text-green-400">✓ TUTTO FATTO</span>
                        </div>
                      ) : remaining > 0 && completedOps > 0 ? (
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-2xl font-black text-orange-400">⚠️ {remaining} PRODOTTI DA PRELEVARE</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-2xl font-black text-red-400">🔴 {totalOps} PRODOTTI DA PRELEVARE</span>
                        </div>
                      )}

                      {/* Dettaglio contatore */}
                      <p className="text-lg text-gray-300">
                        {completedOps}/{totalOps} completati
                      </p>

                      {/* Preview prodotti - UNO SOTTO L'ALTRO */}
                      {locData.productPreview && locData.productPreview.length > 0 && (
                        <div className={`text-sm mt-3 space-y-1 ${darkMode ? 'text-gray-400' : 'text-muted-foreground'}`}>
                          {locData.productPreview.slice(0, 3).map((productName: string, idx: number) => (
                            <div key={idx} className="flex items-start gap-2">
                              <span className="text-xs">📦</span>
                              <span className="line-clamp-1 flex-1">{productName}</span>
                            </div>
                          ))}
                          {locData.productPreview.length > 3 && (
                            <div className="text-xs text-gray-500 italic">
                              ... e altri {locData.productPreview.length - 3} prodotti
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* PULSANTE */}
                    <button
                      onClick={() => selectLocation(location)}
                      className={`py-4 px-8 rounded-xl font-black text-xl transition-all shadow-2xl ${
                        isCompleted
                          ? 'bg-green-600 hover:bg-green-700 text-white'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                    >
                      <ChevronRight className="w-6 h-6" />
                    </button>
                  </div>
                );
              })}
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
          </div>
        )}

        {/* Operations List */}
        {showOperations && (
          <div className="slide-in-right"

          >
            <div className="mb-6 flex items-center justify-between">
              <button
                onClick={() => {
                  setShowOperations(false);
                  setShowLocationList(true);
                  // NON ricaricare - la cache è già aggiornata!
                }}
                className="glass px-4 py-2 rounded-lg hover:bg-white/20 transition-colors"
              >
                ← Torna alle Ubicazioni
              </button>

              <div className="flex items-center gap-2">
                {isSinglePickingMode ? (
                  <div className="px-4 py-2 rounded-xl text-lg font-black shadow-lg border-2 bg-purple-600 text-white border-purple-600">
                    📦 {currentSinglePicking?.name}
                  </div>
                ) : (
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
                )}
                <div className="px-4 py-2 rounded-lg text-base font-bold bg-gray-700">
                  📍 {currentLocation?.name?.split('/').pop() || currentLocation?.name}
                </div>
              </div>
            </div>

            <h2 className="text-2xl font-bold mb-6">Prodotti da prelevare</h2>

            <div className="space-y-4">
              {currentOperations.map((operation, index) => (
                <div
                  key={operation.id}
                  
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
                        <p className="text-sm md:text-base text-blue-400 mt-1 flex items-center gap-2">
                          Cliente: {operation.customer}
                          {operation.note && (
                            <span
                              className="text-xl cursor-pointer hover:scale-125 transition-transform"
                              onClick={() => {
                                setCustomerNoteText(operation.note || '');
                                setShowCustomerNoteModal(true);
                              }}
                              style={{
                                animation: 'heartbeat 1.5s ease-in-out infinite'
                              }}
                            >
                              ⚠️
                            </span>
                          )}
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

                        // Traccia inizio operazione se non già tracciata
                        if (!operationStartTimes[operation.id]) {
                          setOperationStartTimes(prev => ({
                            ...prev,
                            [operation.id]: new Date()
                          }));
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
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-300"
                      style={{ width: `${(operation.qty_done / operation.quantity) * 100}%` }}
                    />
                  </div>
                </div>
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
              <div
                
                className="mt-6"
              >
                <button
                  onClick={() => {
                    toast.success('Ubicazione completata! ✅');
                    setShowOperations(false);
                    setShowLocationList(true);
                    setCurrentOperations([]);
                    // NON ricaricare - la cache è già aggiornata!
                  }}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-4 px-6 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  Conferma e Continua
                </button>
              </div>
            )}
          </div>
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
        <div
          
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setShowProductSelector(false)}
        >
          <div
            
            className="w-full max-w-lg glass-strong rounded-xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              🔢 Seleziona Prodotto
            </h3>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {currentOperations.map((operation) => (
                <button
                  key={operation.id}
                  
                  onClick={() => {
                    // Traccia inizio operazione se non già tracciata
                    if (!operationStartTimes[operation.id]) {
                      setOperationStartTimes(prev => ({
                        ...prev,
                        [operation.id]: new Date()
                      }));
                    }

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
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowProductSelector(false)}
              className="w-full mt-4 glass-strong py-3 px-4 rounded-lg hover:bg-white/20 transition-colors"
            >
              Annulla
            </button>
          </div>
        </div>
      )}

      {/* CELEBRATION MODAL - Tutte le ubicazioni completate! */}
      
        {showCelebration && (
          <div
            
            className="fixed inset-0 z-[100] bg-gradient-to-br from-green-900/95 via-emerald-900/95 to-teal-900/95 flex items-center justify-center p-4 overflow-hidden"
            onClick={() => setShowCelebration(false)}
          >
            {/* Fuochi d'artificio animati - DISABILITATI in performance mode */}
            {!performanceMode && (
              <div className="fireworks-container">
                {[...Array(20)].map((_, i) => (
                  <div
                    key={i}
                    className="firework"
                    style={{
                      left: `${Math.random() * 100}%`,
                      top: `${Math.random() * 100}%`,
                      animationDelay: `${Math.random() * 2}s`
                    }}
                  />
                ))}
              </div>
            )}

            {/* Contenuto celebrativo */}
            <div
              
              className="relative z-10 text-center"
            >
              {/* Trofeo animato */}
              <div
                {...(performanceMode ? {} : {
                  animate: {
                    rotate: [0, -10, 10, -10, 0],
                    scale: [1, 1.1, 1, 1.1, 1]
                  },
                  transition: {
                    duration: 2,
                    repeat: Infinity,
                    repeatType: "loop" as const
                  }
                })}
                className="text-9xl mb-6"
              >
                🏆
              </div>

              {/* Messaggio principale */}
              <h1
                
                className="text-6xl md:text-8xl font-black text-white mb-4"
                style={{ textShadow: '0 4px 20px rgba(0,0,0,0.5)' }}
              >
                FANTASTICO!
              </h1>

              <p
                
                className="text-3xl md:text-4xl font-bold text-green-100 mb-8"
              >
                🎉 Zona {currentZone?.displayName} Completata! 🎉
              </p>

              {/* Emoji celebrative */}
              <div
                
                className="flex justify-center gap-4 text-5xl mb-8"
              >
                <span {...(performanceMode ? {} : { animate: { y: [0, -20, 0] }, transition: { duration: 1, repeat: Infinity, delay: 0 } })}>⭐</span>
                <span {...(performanceMode ? {} : { animate: { y: [0, -20, 0] }, transition: { duration: 1, repeat: Infinity, delay: 0.2 } })}>✨</span>
                <span {...(performanceMode ? {} : { animate: { y: [0, -20, 0] }, transition: { duration: 1, repeat: Infinity, delay: 0.4 } })}>🎊</span>
                <span {...(performanceMode ? {} : { animate: { y: [0, -20, 0] }, transition: { duration: 1, repeat: Infinity, delay: 0.6 } })}>🎈</span>
              </div>

              {/* Statistiche */}
              <div
                
                className="bg-white/20 backdrop-blur-lg rounded-2xl p-6 mb-8 inline-block"
              >
                <div className="grid grid-cols-2 gap-6 text-white">
                  <div>
                    <div className="text-5xl font-black">{workStats.completedOperations}</div>
                    <div className="text-lg">Operazioni</div>
                  </div>
                  <div>
                    <div className="text-5xl font-black">{formatTime(workStats.totalTime || 0)}</div>
                    <div className="text-lg">Tempo</div>
                  </div>
                </div>
              </div>

              {/* Pulsante */}
              <button
                
                
                onClick={() => setShowCelebration(false)}
                className="bg-white text-green-700 font-black text-2xl py-4 px-12 rounded-full shadow-2xl hover:bg-green-50 transition-colors"
              >
                Continua 🚀
              </button>
            </div>
          </div>
        )}

      {/* MODAL MESSAGGIO CLIENTE */}
      {showCustomerNoteModal && (
        <div
          className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4"
          onClick={() => setShowCustomerNoteModal(false)}
        >
          <div
            className={`w-full max-w-2xl ${darkMode ? 'glass-picking-strong' : 'glass-strong'} rounded-2xl p-6 md:p-8 shadow-2xl`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-3 mb-6 border-b border-white/20 pb-4">
              <span className="text-4xl animate-pulse" style={{ animation: 'heartbeat 1.5s ease-in-out infinite' }}>⚠️</span>
              <h2 className="text-2xl md:text-3xl font-bold">Messaggio del Cliente</h2>
            </div>

            {/* Contenuto messaggio */}
            <div className="bg-yellow-500/10 border-2 border-yellow-500/30 rounded-xl p-6 mb-6">
              <p className="text-lg md:text-xl leading-relaxed whitespace-pre-wrap">
                {stripHtmlTags(customerNoteText)}
              </p>
            </div>

            {/* Pulsante chiudi */}
            <button
              onClick={() => setShowCustomerNoteModal(false)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 px-6 rounded-xl font-bold text-lg transition-colors shadow-lg"
            >
              OK, Ho Capito ✓
            </button>
          </div>
        </div>
      )}

      {/* MODAL RICERCA PICKING SINGOLO */}
      {showSinglePickingModal && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setShowSinglePickingModal(false)}
        >
          <div
            className={`w-full max-w-2xl ${darkMode ? 'glass-picking-strong' : 'glass-strong'} rounded-2xl p-6 md:p-8 shadow-2xl max-h-[90vh] overflow-hidden flex flex-col`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6 border-b border-white/20 pb-4">
              <div className="flex items-center gap-3">
                <FileText className="w-8 h-8 text-purple-400" />
                <h2 className="text-2xl md:text-3xl font-bold">Picking Singolo</h2>
              </div>
              <button
                onClick={() => setShowSinglePickingModal(false)}
                className="p-2 rounded-lg hover:bg-white/20 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Barra di ricerca */}
            <div className="flex gap-3 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={singlePickingSearch}
                  onChange={(e) => setSinglePickingSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      searchSinglePickings();
                    }
                  }}
                  placeholder="Cerca per nome picking o riferimento (es. WH/OUT/00123)"
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  autoFocus
                />
              </div>
              <button
                onClick={searchSinglePickings}
                disabled={isSearchingPickings}
                className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isSearchingPickings ? (
                  <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <Search className="w-5 h-5" />
                )}
                Cerca
              </button>
            </div>

            {/* Risultati */}
            <div className="flex-1 overflow-y-auto space-y-3">
              {singlePickingResults.length === 0 && !isSearchingPickings && (
                <div className="text-center py-12 text-gray-400">
                  <Search className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">Cerca un picking per nome o riferimento</p>
                  <p className="text-sm mt-2">Es: WH/OUT/00123, SO0001</p>
                </div>
              )}

              {singlePickingResults.map((picking) => (
                <button
                  key={picking.id}
                  onClick={() => selectSinglePicking(picking)}
                  className="w-full glass p-4 rounded-xl hover:bg-white/20 transition-all text-left border border-purple-500/30"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-bold text-lg text-purple-400">{picking.name}</h3>
                      <p className="text-sm text-gray-300">{picking.partner_name}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      picking.state === 'assigned' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                    }`}>
                      {picking.state === 'assigned' ? 'Pronto' : picking.state}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    {picking.origin && (
                      <span>Rif: {picking.origin}</span>
                    )}
                    <span>{picking.product_count} prodotti</span>
                    {picking.scheduled_date && (
                      <span>{new Date(picking.scheduled_date).toLocaleDateString('it-IT')}</span>
                    )}
                  </div>

                  {picking.note && (
                    <div className="mt-2 flex items-center gap-2 text-yellow-400 text-sm">
                      <span>⚠️</span>
                      <span>Ha un messaggio</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}