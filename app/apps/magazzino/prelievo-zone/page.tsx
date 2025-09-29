'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Truck, MapPin, BarChart3, Settings, ChevronRight, Clock, CheckCircle2, Camera } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { AppHeader, MobileHomeButton } from '@/components/layout/AppHeader';
import { QRScanner } from '@/components/prelievo-zone/QRScanner';
import { NumericKeyboard } from '@/components/prelievo-zone/NumericKeyboard';
import { ZONES, Zone, Batch, StockLocation, Operation, WorkStats, DEFAULT_CONFIG } from '@/lib/types/picking';
import { getPickingClient } from '@/lib/odoo/pickingClient';
import toast from 'react-hot-toast';

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

  // Statistiche
  const [workStats, setWorkStats] = useState<WorkStats>({
    zonesCompleted: 0,
    totalOperations: 0,
    completedOperations: 0,
    startTime: undefined,
    currentZoneTime: 0,
    totalTime: 0
  });

  // Configurazione
  const [config, setConfig] = useState(DEFAULT_CONFIG);

  // Client Odoo
  const pickingClient = getPickingClient();

  // Check connessione all'avvio
  useEffect(() => {
    checkConnection();
    loadConfiguration();
    loadBatches();
  }, []);

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
  };

  const saveConfiguration = (newConfig: typeof config) => {
    setConfig(newConfig);
    localStorage.setItem('picking_config', JSON.stringify(newConfig));
    toast.success('Configurazione salvata');
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

  const selectBatch = (batch: Batch) => {
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

    toast.success(`Batch ${batch.name} selezionato`);
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
      // Carica ubicazioni reali da Odoo per la zona selezionata
      const odooLocations = await pickingClient.getZoneLocations(zone.name);

      console.log(`📍 Ubicazioni caricate per zona ${zone.name}:`, odooLocations.length);

      // Filtra solo le ubicazioni che hanno operazioni nel batch corrente
      if (currentBatch) {
        // Per ora mostriamo tutte le ubicazioni della zona
        // In futuro possiamo filtrare solo quelle con operazioni
        setLocations(odooLocations);
      } else {
        setLocations(odooLocations);
      }

      if (odooLocations.length === 0) {
        toast(`Nessuna ubicazione trovata nella zona ${zone.displayName}`, { icon: 'ℹ️' });
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

      // Carica operazioni reali da Odoo per l'ubicazione selezionata
      const odooOperations = await pickingClient.getLocationOperations(
        currentBatch.id,
        location.id
      );

      console.log(`📦 Operazioni caricate per ${location.name}:`, odooOperations.length);

      setCurrentOperations(odooOperations);

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
    // Aggiorna UI immediatamente
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
        selectLocation(location);
      } else {
        toast.error('Ubicazione non trovata');
      }
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
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
          className="glass-strong mx-4 mt-4 p-4 rounded-xl border border-white/20"
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" />
                <span className="text-sm">
                  Tempo: <strong>{formatTime(workStats.totalTime || 0)}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-green-400" />
                <span className="text-sm">
                  Operazioni: <strong>{workStats.completedOperations}/{workStats.totalOperations}</strong>
                </span>
              </div>
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
                  className="glass-strong p-6 rounded-xl hover:bg-white/20 transition-all text-left"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-lg">{batch.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {batch.scheduled_date && new Date(batch.scheduled_date).toLocaleDateString('it-IT')}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      batch.state === 'done' ? 'bg-green-500/20 text-green-400' :
                      batch.state === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {batch.state === 'done' ? 'Completato' :
                       batch.state === 'in_progress' ? 'In corso' : 'Bozza'}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm">
                    {batch.driver_id && (
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-muted-foreground" />
                        <span>{batch.driver_id[1]}</span>
                      </div>
                    )}
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
                  <div className="text-4xl mb-4">{zone.displayName.split(' ')[0]}</div>
                  <h3 className="text-xl font-semibold mb-2">{zone.displayName.substring(2)}</h3>
                  <p className="text-sm text-muted-foreground">
                    Clicca per iniziare il picking in questa zona
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
                onClick={() => {
                  setShowLocationList(false);
                  setShowZoneSelector(true);
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

            <h2 className="text-2xl font-bold mb-6">Ubicazioni disponibili</h2>

            <div className="space-y-3">
              {locations.map((location, index) => (
                <motion.button
                  key={location.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => selectLocation(location)}
                  className="w-full glass-strong p-4 rounded-xl hover:bg-white/20 transition-all flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <MapPin className="w-5 h-5 text-muted-foreground" />
                    <div className="text-left">
                      <h3 className="font-semibold">{location.name}</h3>
                      <p className="text-sm text-muted-foreground">{location.barcode}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </motion.button>
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
                  className="px-3 py-1 rounded-lg text-sm font-medium"
                  style={{ backgroundColor: `${currentZone?.color}20`, color: currentZone?.color }}
                >
                  {currentZone?.displayName}
                </div>
                <div className="px-3 py-1 rounded-lg text-sm font-medium bg-gray-700">
                  {currentLocation?.name}
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
                  className={`glass-strong p-4 rounded-xl ${
                    operation.qty_done >= operation.quantity
                      ? 'bg-green-500/10 border border-green-500/30'
                      : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{operation.productName}</h3>
                      <p className="text-sm text-muted-foreground">
                        {operation.productCode} {operation.productBarcode && `• ${operation.productBarcode}`}
                      </p>
                      {operation.customer && (
                        <p className="text-sm text-blue-400 mt-1">
                          Cliente: {operation.customer}
                        </p>
                      )}
                    </div>
                    {operation.qty_done >= operation.quantity && (
                      <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0" />
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="text-2xl font-bold">
                        {operation.qty_done} / {operation.quantity}
                      </span>
                      <span className="text-sm text-muted-foreground">{operation.uom}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const newQty = Math.max(0, operation.qty_done - 1);
                          updateOperation(operation.id, newQty);
                        }}
                        disabled={operation.qty_done === 0}
                        className="glass px-3 py-1 rounded-lg hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        -
                      </button>

                      <button
                        onClick={() => openNumericKeyboard(operation)}
                        className="glass px-4 py-2 rounded-lg hover:bg-white/20 transition-colors font-mono"
                      >
                        {operation.qty_done}
                      </button>

                      <button
                        onClick={() => {
                          const newQty = Math.min(operation.quantity, operation.qty_done + 1);
                          updateOperation(operation.id, newQty);
                        }}
                        disabled={operation.qty_done >= operation.quantity}
                        className="glass px-3 py-1 rounded-lg hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        +
                      </button>

                      {config.QR_VERIFICATION && (
                        <button
                          onClick={() => openProductScanner(operation)}
                          className="glass px-3 py-2 rounded-lg hover:bg-white/20 transition-colors"
                        >
                          <Camera className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Progress bar per singola operazione */}
                  <div className="mt-3 bg-gray-700 rounded-full h-1 overflow-hidden">
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
    </div>
  );
}