'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Dexie, { Table } from 'dexie';
import dynamic from 'next/dynamic';
import type { Delivery, Product, Attachment, OfflineAction, VehicleCheckData, VehicleInfo, OpenIssue, VehicleCheckItem, VehicleCheckPhoto, VehicleCheckCategory } from './types';
import { VEHICLE_CHECK_CATEGORIES } from './vehicle-check-config';

const DeliveryMap = dynamic(() => import('./components/DeliveryMap'), { ssr: false });

// ==================== INDEXEDDB SETUP ====================
class DeliveryDatabase extends Dexie {
  attachments!: Table<Attachment>;
  deliveries!: Table<Delivery>;
  offline_actions!: Table<OfflineAction>;
  cache!: Table<{ key: string; data: any; timestamp: number }>;
  images!: Table<{ id: string; url: string; blob: Blob; timestamp: number }>;

  constructor() {
    super('LapaDeliveryDB');
    this.version(31).stores({
      attachments: '++id, picking_id, context, timestamp, uploaded',
      deliveries: 'id, scheduled_date, state, driver_id',
      offline_actions: '++id, timestamp, synced',
      cache: 'key, timestamp',
      images: 'id, url, timestamp'
    });
  }
}

const db = new DeliveryDatabase();

// ==================== MAIN COMPONENT ====================
export default function DeliveryPage() {
  // Estados principales
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [currentDelivery, setCurrentDelivery] = useState<Delivery | null>(null);
  const [view, setView] = useState<'list' | 'map' | 'stats' | 'scarico' | 'vehicle-check'>('list');
  const [loading, setLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);

  // Estados modales
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showScaricoModal, setShowScaricoModal] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showResoModal, setShowResoModal] = useState(false);
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);
  const [showCalculatorModal, setShowCalculatorModal] = useState(false);
  const [showRouteOrganizerModal, setShowRouteOrganizerModal] = useState(false);
  const [showCompletionOptionsModal, setShowCompletionOptionsModal] = useState(false);

  // Estados scarico
  const [scaricoProducts, setScaricoProducts] = useState<Product[]>([]);
  const [scaricoSearch, setScaricoSearch] = useState('');
  const [scaricoFilterSelected, setScaricoFilterSelected] = useState(false);

  // Estados firma
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [signatureNote, setSignatureNote] = useState('');
  const isDrawingRef = useRef(false);
  const [strokeCount, setStrokeCount] = useState(0);

  // Estados calcolatrice
  const [calcValue, setCalcValue] = useState('0');
  const [calcProductId, setCalcProductId] = useState<number | null>(null);
  const [calcProductName, setCalcProductName] = useState<string>('');
  const [calcMaxQty, setCalcMaxQty] = useState(0);

  // Estados allegati
  const [attachmentContext, setAttachmentContext] = useState<'signature' | 'photo' | 'payment' | 'reso'>('photo');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>({});

  // Estados pagamento
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'bank_transfer'>('cash');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentReceiptPhoto, setPaymentReceiptPhoto] = useState<string | null>(null);

  // Estados foto (cliente assente)
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [photoNote, setPhotoNote] = useState('');

  // Estados reso
  const [resoProducts, setResoProducts] = useState<any[]>([]);
  const [resoNote, setResoNote] = useState('');
  const [resoPhoto, setResoPhoto] = useState<string | null>(null);

  // Estados giustificazione scarico parziale
  const [showPartialJustificationModal, setShowPartialJustificationModal] = useState(false);
  const [partialJustificationText, setPartialJustificationText] = useState('');
  const [partialJustificationAudio, setPartialJustificationAudio] = useState<Blob | null>(null);
  const [isRecordingPartial, setIsRecordingPartial] = useState(false);
  const [audioRecorder, setAudioRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [partialProductsList, setPartialProductsList] = useState<string[]>([]);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Estados mappa
  const mapRef = useRef<any>(null);
  const [currentPosition, setCurrentPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [markers, setMarkers] = useState<any[]>([]);
  const [showPOI, setShowPOI] = useState(true);

  // Estados vehicle check
  const [vehicleCheckData, setVehicleCheckData] = useState<VehicleCheckData | null>(null);
  const [vehicleInfo, setVehicleInfo] = useState<VehicleInfo | null>(null);
  const [activeCheckCategory, setActiveCheckCategory] = useState<string>('motore');
  const [openIssues, setOpenIssues] = useState<OpenIssue[]>([]);
  const [needsWeeklyCheck, setNeedsWeeklyCheck] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<OpenIssue | null>(null);
  const [checkPhotos, setCheckPhotos] = useState<VehicleCheckPhoto[]>([]);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [currentPhotoItem, setCurrentPhotoItem] = useState<{ categoryId: string; itemId: string } | null>(null);

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const photoModalInputRef = useRef<HTMLInputElement>(null);
  const paymentReceiptInputRef = useRef<HTMLInputElement>(null);
  const vehicleCheckPhotoInputRef = useRef<HTMLInputElement>(null);

  // ==================== EFFECTS ====================
  useEffect(() => {
    initializeApp();
    setupOnlineListener();
    startGPS();

    // Expose navigateTo globally for map info windows
    (window as any).navigateToDelivery = (lat: number, lng: number) => {
      navigateTo(lat, lng);
    };

    return () => {
      delete (window as any).navigateToDelivery;
    };
  }, []);

  // Vehicle check effect - carica dati quando view cambia
  useEffect(() => {
    if (view === 'vehicle-check') {
      loadVehicleCheckInfo();
    }
  }, [view]);

  // ==================== INITIALIZATION ====================
  async function initializeApp() {
    setLoading(true);
    try {
      // CLEAR CACHE ALL'AVVIO per evitare dati vecchi
      console.log('🗑️ Pulizia cache vecchia...');
      await db.cache.clear();
      console.log('✅ Cache pulita');

      // Carica consegne (l'API ritorna anche il nome del driver)
      await loadDeliveries();
    } catch (err: any) {
      console.error('❌ [DELIVERY] Errore inizializzazione:', err);
      setError('Impossibile caricare le consegne');
      showToast('Errore caricamento consegne', 'error');
    } finally {
      setLoading(false);
    }
  }

  function setupOnlineListener() {
    window.addEventListener('online', () => {
      setIsOnline(true);
      showToast('Connessione ripristinata', 'success');
      syncOfflineActions();
      loadDeliveries();
    });
    window.addEventListener('offline', () => {
      setIsOnline(false);
      showToast('Modalità offline attiva', 'warning');
    });
  }

  function startGPS() {
    if (navigator.geolocation) {
      navigator.geolocation.watchPosition(
        (position) => {
          setCurrentPosition({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error('GPS error:', error);
          // Fallback position (Milan, Italy) if GPS fails on Android
          setCurrentPosition({ lat: 45.4642, lng: 9.1900 });
        },
        { enableHighAccuracy: true, timeout: 30000, maximumAge: 60000 }
      );
    } else {
      // Fallback if geolocation not available
      setCurrentPosition({ lat: 45.4642, lng: 9.1900 });
    }
  }

  // ==================== API CALLS ====================
  async function loadDeliveries() {
    setLoading(true);
    try {
      // SEMPRE carica dati FRESCHI dall'API (bypass cache)
      console.log('🔄 Caricamento FRESCO dall\'API...');
      await fetchAndUpdateDeliveries();

    } catch (err: any) {
      console.error('❌ Errore caricamento:', err);
      setError(err.message);

      // Solo in caso di errore, usa cache come fallback
      const cached = await db.deliveries.toArray();
      if (cached.length > 0) {
        console.log('⚠️ Caricamento da cache (fallback)');
        setDeliveries(cached);
        showToast('Caricati dati dalla cache (offline)', 'info');
      } else {
        showToast('Impossibile caricare le consegne', 'error');
      }
    } finally {
      setLoading(false);
    }
  }

  async function fetchAndUpdateDeliveries() {
    try {
      console.log('🔄 Aggiornamento consegne da server...');
      // Add timestamp to bypass ALL caches (browser + Vercel)
      const cacheBuster = `?t=${Date.now()}`;
      const response = await fetch(`/api/delivery/list${cacheBuster}`, {
        signal: AbortSignal.timeout(30000), // 30 second timeout for Android
        cache: 'no-store', // Force no caching
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Errore caricamento consegne');
      }

      const responseData = await response.json();

      // Check if response contains error field
      if (responseData.error) {
        throw new Error(responseData.error);
      }

      // Supporta sia il nuovo formato {deliveries, driver} che il vecchio array
      const data = responseData.deliveries || responseData;
      const driverInfo = responseData.driver;

      // Check if data is array
      if (!Array.isArray(data)) {
        throw new Error('Formato risposta non valido');
      }

      console.log('📦 Consegne ricevute:', data.length);
      if (driverInfo) {
        console.log('👤 Driver:', driverInfo.name);
        setSession({ name: driverInfo.name, vehicle_name: null });
      }

      // Aggiorna stato
      setDeliveries(data);

      // Salva in database locale
      await db.deliveries.clear();
      await db.deliveries.bulkPut(data);

      // Salva in cache con timestamp
      await db.cache.put({
        key: 'deliveries_list',
        data: data,
        timestamp: Date.now()
      });

      // Calcola ETA
      calculateETAsForDeliveries(data);

      console.log('✅ Dati salvati in cache locale');
    } catch (err: any) {
      console.error('❌ Errore aggiornamento:', err);
      throw err;
    }
  }

  async function syncOfflineActions() {
    const actions = await db.offline_actions.where({ synced: false }).toArray();
    for (const action of actions) {
      try {
        // Esegui azione
        if (action.action_type === 'validate') {
          await validateDeliveryOnServer(action.payload);
        } else if (action.action_type === 'payment') {
          await processPaymentOnServer(action.payload);
        } else if (action.action_type === 'reso') {
          await createResoOnServer(action.payload);
        }

        // Segna come sincronizzata
        await db.offline_actions.update(action.id!, { synced: true });
      } catch (err) {
        console.error('Sync failed for action:', action, err);
      }
    }

    showToast('Sincronizzazione completata', 'success');
  }

  // ==================== DELIVERIES LOGIC ====================
  function openDelivery(delivery: Delivery) {
    setCurrentDelivery(delivery);
    setShowDetailModal(true);
    loadAttachmentCounts(delivery.id);
  }

  function closeModal() {
    setShowDetailModal(false);
    setCurrentDelivery(null);
  }

  async function loadAttachmentCounts(deliveryId: number) {
    const counts: Record<string, number> = {};
    for (const ctx of ['signature', 'photo', 'payment', 'reso']) {
      const atts = await db.attachments
        .where({ picking_id: deliveryId, context: ctx as any })
        .count();
      counts[ctx] = atts;
    }
    setAttachmentCounts(counts);
  }

  // Helper per rimuovere HTML dai testi
  function stripHtml(html: string): string {
    if (!html) return '';
    // Rimuovi tutti i tag HTML
    const tmp = html.replace(/<[^>]*>/g, '');
    // Decodifica entità HTML comuni
    return tmp
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
  }

  function navigateTo(lat?: number, lng?: number) {
    if (!lat || !lng) {
      showToast('Coordinate non disponibili', 'error');
      return;
    }

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);

    let url;
    if (isIOS) {
      // Apple Maps con navigazione
      url = `maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`;
      console.log('🗺️ [iOS] Apertura Apple Maps:', url);
      window.location.href = url;

      // Fallback a Google Maps web dopo 1 secondo se Apple Maps non si apre
      setTimeout(() => {
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`, '_blank');
      }, 1000);
    } else if (isAndroid) {
      // OPZIONE 1: Prova prima l'app Google Maps nativa (più affidabile)
      url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
      console.log('🗺️ [Android] Apertura Google Maps:', url);

      // Su Android, questo URL funziona sia nell'app che nel browser
      window.location.href = url;

      // ALTERNATIVA: Se vuoi forzare l'app nativa con fallback
      // const intentUrl = `intent://maps.google.com/maps?daddr=${lat},${lng}&directionsmode=driving#Intent;scheme=https;package=com.google.android.apps.maps;end`;
      // window.location.href = intentUrl;
    } else {
      // Browser desktop - Google Maps web
      url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
      console.log('🗺️ [Desktop] Apertura Google Maps web:', url);
      window.open(url, '_blank');
    }

    showToast('Navigazione avviata', 'success');
  }

  // ==================== VEHICLE CHECK LOGIC ====================
  async function loadVehicleCheckInfo() {
    try {
      setLoading(true);
      const res = await fetch('/api/vehicle-check/get-info', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!res.ok) throw new Error('Errore caricamento dati veicolo');

      const data = await res.json();

      if (data.success) {
        setVehicleInfo(data.vehicle_info);
        setVehicleCheckData(data.check_data);
        setOpenIssues(data.open_issues || []);
        setNeedsWeeklyCheck(data.needs_weekly_check || false);
      } else {
        showToast(data.error || 'Errore caricamento dati', 'error');
      }
    } catch (error) {
      console.error('Errore loadVehicleCheckInfo:', error);
      showToast('Errore caricamento dati veicolo', 'error');
    } finally {
      setLoading(false);
    }
  }

  function markItemStatus(categoryId: string, itemId: string, status: 'ok' | 'issue') {
    if (!vehicleCheckData) return;

    const updatedCategories = vehicleCheckData.categories.map(cat => {
      if (cat.id === categoryId) {
        return {
          ...cat,
          items: cat.items.map(item => {
            if (item.id === itemId) {
              return {
                ...item,
                status,
                note: status === 'ok' ? '' : item.note // Clear note if OK
              };
            }
            return item;
          })
        };
      }
      return cat;
    });

    setVehicleCheckData({
      ...vehicleCheckData,
      categories: updatedCategories
    });
  }

  function updateItemNote(categoryId: string, itemId: string, note: string) {
    if (!vehicleCheckData) return;

    const updatedCategories = vehicleCheckData.categories.map(cat => {
      if (cat.id === categoryId) {
        return {
          ...cat,
          items: cat.items.map(item => {
            if (item.id === itemId) {
              return { ...item, note };
            }
            return item;
          })
        };
      }
      return cat;
    });

    setVehicleCheckData({
      ...vehicleCheckData,
      categories: updatedCategories
    });
  }

  function calculateSummary() {
    if (!vehicleCheckData) return { total: 0, ok: 0, issues: 0, unchecked: 0 };

    let total = 0;
    let ok = 0;
    let issues = 0;
    let unchecked = 0;

    // Conta solo le categorie VISIBILI (filtered), non tutte!
    const visibleCategoryIds = filteredVehicleCheckCategories.map(cat => cat.id);

    vehicleCheckData.categories.forEach(cat => {
      // Salta le categorie nascoste (es: FRIGO per veicoli non refrigerati)
      if (!visibleCategoryIds.includes(cat.id)) return;

      cat.items.forEach(item => {
        total++;
        if (item.status === 'ok') ok++;
        else if (item.status === 'issue') issues++;
        else unchecked++;
      });
    });

    return { total, ok, issues, unchecked };
  }

  async function saveVehicleCheck() {
    if (!vehicleCheckData || !vehicleInfo) return;

    const summary = calculateSummary();

    if (summary.unchecked > 0) {
      showToast(`Rimangono ${summary.unchecked} controlli non completati`, 'error');
      return;
    }

    try {
      setLoading(true);

      // Upload photos first
      const photosToUpload = checkPhotos.map(photo => ({
        photo_key: `${photo.category_id}_${photo.item_id}`,
        data: photo.data,
        item_id: photo.item_id,
        category_id: photo.category_id
      }));

      const res = await fetch('/api/vehicle-check/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicle_id: vehicleInfo.id,
          check_data: vehicleCheckData,
          photos: photosToUpload
        })
      });

      const data = await res.json();

      if (data.success) {
        showToast('Controllo veicolo salvato!', 'success');
        setView('list');
        // Reset check data
        setVehicleCheckData(null);
        setCheckPhotos([]);
        await loadVehicleCheckInfo();
      } else {
        showToast(data.error || 'Errore salvataggio controllo', 'error');
      }
    } catch (error) {
      console.error('Errore saveVehicleCheck:', error);
      showToast('Errore salvataggio controllo', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function resolveIssue() {
    if (!selectedIssue || !vehicleInfo) return;

    try {
      setLoading(true);

      const res = await fetch('/api/vehicle-check/resolve-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicle_id: vehicleInfo.id,
          issue_id: selectedIssue.id,
          resolved_date: new Date().toISOString()
        })
      });

      const data = await res.json();

      if (data.success) {
        showToast(`Problema "${selectedIssue.item}" risolto!`, 'success');

        // Rimuovi l'issue dalla lista locale
        setOpenIssues(prev => prev.filter(issue => issue.id !== selectedIssue.id));

        // Chiudi il modal
        setShowResolveModal(false);
        setSelectedIssue(null);

        // Ricarica i dati del veicolo per aggiornare tutto
        await loadVehicleCheckInfo();
      } else {
        showToast(data.error || 'Errore risoluzione problema', 'error');
      }
    } catch (error) {
      console.error('Errore resolveIssue:', error);
      showToast('Errore risoluzione problema', 'error');
    } finally {
      setLoading(false);
    }
  }

  // ==================== SCARICO LOGIC ====================
  async function openScaricoView(delivery: Delivery) {
    setCurrentDelivery(delivery);

    // Usa i prodotti dalla consegna - inizializza delivered a 0 se non presente
    const productsToDeliver = (delivery.products || []).map(p => ({
      ...p,
      delivered: p.delivered || 0,
      picked: false,
      completed: false
    }));
    setScaricoProducts(productsToDeliver);

    setView('scarico');
    setShowDetailModal(false);
  }

  function closeScaricoView() {
    setView('list');
    setScaricoProducts([]);
    setCurrentDelivery(null);
    loadDeliveries(); // Ricarica per aggiornare
  }

  function toggleProductPicked(productId: number) {
    setScaricoProducts(prev => prev.map(p => {
      if (p.id === productId) {
        const newPicked = !p.picked;
        // Se viene marcato come picked e delivered è 0, imposta qty richiesta
        const newDelivered = newPicked && p.delivered === 0 ? p.qty : (newPicked ? p.delivered : 0);
        return {
          ...p,
          picked: newPicked,
          completed: newPicked,
          delivered: newDelivered
        };
      }
      return p;
    }));
  }

  function updateProductDelivered(productId: number, qty: number) {
    setScaricoProducts(prev => prev.map(p => {
      if (p.id === productId) {
        // Permetti qualsiasi quantità (anche maggiore della richiesta)
        const newQty = Math.max(0, qty);
        return { ...p, delivered: newQty, picked: newQty > 0, completed: newQty > 0 };
      }
      return p;
    }));
  }

  // Categorizza prodotti
  const categorizedProducts = useMemo(() => {
    const categories: Record<string, { name: string; products: Product[]; color: string }> = {
      Frigo: { name: '❄️ Frigo', products: [], color: '#3b82f6' },
      Pingu: { name: '🧊 Pingu (Congelato)', products: [], color: '#06b6d4' },
      Secco: { name: '📦 Secco', products: [], color: '#f59e0b' },
      NonFood: { name: '🧹 Non Food', products: [], color: '#8b5cf6' }
    };

    scaricoProducts.forEach(product => {
      const category = product.category || 'Secco';
      if (categories[category]) {
        categories[category].products.push(product);
      } else {
        categories.Secco.products.push(product);
      }
    });

    return categories;
  }, [scaricoProducts]);

  // Stats scarico
  const scaricoStats = useMemo(() => {
    const total = scaricoProducts.reduce((sum, p) => sum + p.qty, 0);
    const delivered = scaricoProducts.reduce((sum, p) => sum + p.delivered, 0);
    const remaining = total - delivered;
    return { total, delivered, remaining };
  }, [scaricoProducts]);

  // ==================== CALCULATOR ====================
  function openCalculator(productId: number, maxQty: number, productName: string) {
    setCalcProductId(productId);
    setCalcProductName(productName);
    setCalcMaxQty(maxQty);
    setCalcValue('0');
    setShowCalculatorModal(true);
  }

  function calcPress(num: string) {
    setCalcValue(prev => {
      if (prev === '0') return num;
      return prev + num;
    });
  }

  function calcPressDecimal() {
    if (!calcValue.includes('.')) {
      setCalcValue(prev => prev + '.');
    }
  }

  function calcClear() {
    setCalcValue('0');
  }

  function calcBackspace() {
    setCalcValue(prev => {
      if (prev.length === 1) return '0';
      return prev.slice(0, -1);
    });
  }

  function calcConfirm() {
    if (!calcProductId) return;

    const value = parseFloat(calcValue);
    // Nessun limite massimo - permetti qualsiasi quantità

    updateProductDelivered(calcProductId, value);
    setShowCalculatorModal(false);
    setCalcProductId(null);
  }

  function calcCancel() {
    setShowCalculatorModal(false);
    setCalcProductId(null);
    setCalcValue('0');
  }

  // ==================== SIGNATURE ====================
  function openSignatureModal() {
    setShowSignatureModal(true);
    setTimeout(() => initSignatureCanvas(), 100);
  }

  function initSignatureCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear previous canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000000';

    let lastX = 0;
    let lastY = 0;

    const startDrawing = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      isDrawingRef.current = true;

      const rect = canvas.getBoundingClientRect();
      const touch = 'touches' in e ? e.touches[0] : e;

      lastX = touch.clientX - rect.left;
      lastY = touch.clientY - rect.top;

      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
    };

    const draw = (e: MouseEvent | TouchEvent) => {
      if (!isDrawingRef.current) return;
      e.preventDefault();

      const rect = canvas.getBoundingClientRect();
      const touch = 'touches' in e ? e.touches[0] : e;

      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;

      ctx.lineTo(x, y);
      ctx.stroke();

      lastX = x;
      lastY = y;
      setStrokeCount(prev => prev + 1);
    };

    const stopDrawing = () => {
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;
      ctx.closePath();
    };

    // Remove old listeners
    canvas.removeEventListener('touchstart', startDrawing as any);
    canvas.removeEventListener('touchmove', draw as any);
    canvas.removeEventListener('touchend', stopDrawing);
    canvas.removeEventListener('mousedown', startDrawing as any);
    canvas.removeEventListener('mousemove', draw as any);
    canvas.removeEventListener('mouseup', stopDrawing);
    canvas.removeEventListener('mouseleave', stopDrawing);

    // Add new listeners
    canvas.addEventListener('touchstart', startDrawing as any);
    canvas.addEventListener('touchmove', draw as any);
    canvas.addEventListener('touchend', stopDrawing);
    canvas.addEventListener('mousedown', startDrawing as any);
    canvas.addEventListener('mousemove', draw as any);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setStrokeCount(0);
    setSignatureData(null);
  }

  async function saveSignature() {
    if (strokeCount < 10) {
      showToast('Firma troppo breve, riprovare', 'error');
      return null;
    }

    const canvas = canvasRef.current;
    if (!canvas) return null;

    const dataUrl = canvas.toDataURL('image/png');

    // NON salvare in Odoo qui - sarà salvata in completeScarico per evitare duplicati
    console.log('✍️ Firma acquisita, sarà salvata alla conferma finale');
    showToast('✅ Firma acquisita!', 'success');

    // Salva SOLO in locale per backup
    if (currentDelivery) {
      try {
        await db.attachments.add({
          picking_id: currentDelivery.id,
          context: 'signature',
          data: dataUrl,
          timestamp: new Date(),
          uploaded: false // Sarà caricata in completeScarico
        });
      } catch (error) {
        console.error('❌ Errore salvataggio firma locale:', error);
      }
    }

    setSignatureData(dataUrl);
    return dataUrl;
  }

  async function confirmScaricoWithSignature() {
    const signature = await saveSignature();
    if (!signature) return;

    await completeScarico(signature);
    setShowSignatureModal(false);
    setSignatureNote('');
  }

  // ==================== PHOTO MODAL ====================
  async function handlePhotoModalCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !currentDelivery) return;

    try {
      const base64 = await fileToBase64(file);
      const compressed = await compressImage(base64);
      setPhotoData(compressed);

      // NON salvare in Odoo qui - sarà salvata in completeWithPhoto per evitare duplicati
      console.log('📸 Foto acquisita, sarà salvata alla conferma finale');
      showToast('✅ Foto acquisita!', 'success');

      // Salva SOLO in locale per backup
      try {
        await db.attachments.add({
          picking_id: currentDelivery.id,
          context: 'photo',
          data: compressed,
          timestamp: new Date(),
          uploaded: false // Sarà caricata in completeWithPhoto
        });
      } catch (error) {
        console.error('❌ Errore salvataggio foto locale:', error);
      }
    } catch (err) {
      showToast('Errore caricamento foto', 'error');
    }
  }

  async function completeWithPhoto() {
    if (!currentDelivery) return;

    if (!photoData) {
      showToast('Scatta una foto prima di confermare', 'error');
      return;
    }

    // Previeni chiamate multiple
    if (isValidating) {
      console.log('⚠️ Validazione già in corso, ignoro chiamata duplicata');
      return;
    }

    setIsValidating(true);
    setLoading(true);

    try {
      // Salva foto in attachments
      await db.attachments.add({
        picking_id: currentDelivery.id,
        context: 'photo',
        data: photoData,
        timestamp: new Date(),
        uploaded: false
      });

      // Prepara payload
      const payload = {
        picking_id: currentDelivery.id,
        products: scaricoProducts.map(p => ({
          move_line_id: p.move_line_id || p.id,  // ID della stock.move.line
          product_id: p.product_id,
          name: p.name,
          qty: p.qty,
          delivered: p.delivered || 0,
          picked: p.picked || false
        })),
        photo: photoData,
        notes: photoNote,
        completion_type: 'photo'
      };

      console.log('📸 [COMPLETE WITH PHOTO] Payload:', payload);

      if (isOnline) {
        await validateDeliveryOnServer(payload);
        showToast('✅ Consegna completata con foto!', 'success');
      } else {
        await db.offline_actions.add({
          action_type: 'validate',
          payload,
          timestamp: new Date(),
          synced: false
        });
        showToast('💾 Azione salvata per sincronizzazione', 'info');
      }

      // Upload allegati
      await uploadAllAttachments();

      // Reset e chiudi
      setPhotoData(null);
      setPhotoNote('');
      setShowPhotoModal(false);
      closeScaricoView();
      await loadDeliveries();

    } catch (error: any) {
      console.error('❌ [COMPLETE WITH PHOTO] Errore:', error);
      showToast('Errore: ' + error.message, 'error');
    } finally {
      setLoading(false);
      setIsValidating(false);
    }
  }

  // ==================== ATTACHMENTS ====================
  async function openAttachmentModal(context: 'signature' | 'photo' | 'payment' | 'reso') {
    if (!currentDelivery) return;

    setAttachmentContext(context);
    const atts = await db.attachments
      .where({ picking_id: currentDelivery.id, context })
      .toArray();
    setAttachments(atts);
    setShowAttachmentModal(true);
  }

  async function handlePhotoCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !currentDelivery) return;

    try {
      const base64 = await fileToBase64(file);
      const compressed = await compressImage(base64);

      await db.attachments.add({
        picking_id: currentDelivery.id,
        context: attachmentContext,
        data: compressed,
        timestamp: new Date(),
        uploaded: false
      });

      // Se è una foto RESO, salva anche nello stato
      if (attachmentContext === 'reso') {
        setResoPhoto(compressed);
      }

      // Ricarica attachments
      const atts = await db.attachments
        .where({ picking_id: currentDelivery.id, context: attachmentContext })
        .toArray();
      setAttachments(atts);

      await loadAttachmentCounts(currentDelivery.id);
      showToast('Foto salvata', 'success');
    } catch (err) {
      showToast('Errore salvataggio foto', 'error');
    }
  }

  async function deleteAttachment(attachmentId: number) {
    if (!confirm('Eliminare questo allegato?')) return;

    await db.attachments.delete(attachmentId);

    if (currentDelivery) {
      const atts = await db.attachments
        .where({ picking_id: currentDelivery.id, context: attachmentContext })
        .toArray();
      setAttachments(atts);
      await loadAttachmentCounts(currentDelivery.id);
    }

    showToast('Allegato eliminato', 'success');
  }

  async function uploadAllAttachments() {
    if (!currentDelivery) return;

    const toUpload = await db.attachments
      .where({ picking_id: currentDelivery.id, uploaded: false })
      .toArray();

    setLoading(true);
    try {
      for (const att of toUpload) {
        const response = await fetch('/api/delivery/upload-attachment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            picking_id: att.picking_id,
            context: att.context,
            data: att.data.split(',')[1],
            timestamp: att.timestamp
          })
        });

        if (response.ok) {
          const result = await response.json();
          await db.attachments.update(att.id!, {
            uploaded: true,
            odoo_attachment_id: result.attachment_id
          });
        }
      }

      showToast('Allegati caricati su Odoo', 'success');
      await loadAttachmentCounts(currentDelivery.id);
    } catch (err) {
      showToast('Errore upload allegati', 'error');
    } finally {
      setLoading(false);
    }
  }

  // ==================== VALIDATION ====================
  async function completeScarico(signatureDataParam?: string | null) {
    if (!currentDelivery) return;

    // Previeni chiamate multiple
    if (isValidating) {
      console.log('⚠️ Validazione già in corso, ignoro chiamata duplicata');
      return;
    }

    setIsValidating(true);
    setLoading(true);

    try {
      // Prepara payload con TUTTI i prodotti e le quantità delivered
      const payload = {
        picking_id: currentDelivery.id,
        products: scaricoProducts.map(p => ({
          move_line_id: p.move_line_id || p.id,  // ID della stock.move.line
          product_id: p.product_id,
          name: p.name,
          qty: p.qty,
          delivered: p.delivered || 0,
          picked: p.picked || false
        })),
        signature: signatureDataParam || signatureData,
        notes: signatureNote,
        completion_type: 'signature'
      };

      console.log('📦 [COMPLETE] Payload:', payload);

      if (isOnline) {
        await validateDeliveryOnServer(payload);
        showToast('✅ Consegna completata e salvata in Odoo!', 'success');
      } else {
        // Salva azione per sync successivo
        await db.offline_actions.add({
          action_type: 'validate',
          payload,
          timestamp: new Date(),
          synced: false
        });
        showToast('💾 Azione salvata per sincronizzazione', 'info');
      }

      // Upload allegati
      await uploadAllAttachments();

      // Chiudi vista e torna alla lista
      closeScaricoView();

      // Ricarica le consegne per aggiornare lo stato
      await loadDeliveries();

    } catch (error: any) {
      console.error('❌ [COMPLETE] Errore:', error);
      showToast('Errore: ' + error.message, 'error');
    } finally {
      setLoading(false);
      setIsValidating(false);
    }
  }

  // Controlla se ci sono prodotti non scaricati completamente
  function handleCheckPartialDelivery() {
    // Trova tutti i prodotti con problemi
    const problemProducts: string[] = [];

    scaricoProducts.forEach(p => {
      const delivered = p.delivered || 0;
      const requested = p.qty || 0;

      // Prodotto NON scaricato per niente
      if (delivered === 0 && requested > 0) {
        problemProducts.push(`${p.name} - NON SCARICATO (richiesto: ${requested})`);
      }
      // Prodotto scaricato PARZIALMENTE (meno del richiesto)
      else if (delivered > 0 && delivered < requested) {
        problemProducts.push(`${p.name} - PARZIALE (scaricato: ${delivered}, richiesto: ${requested})`);
      }
      // Prodotto scaricato IN PIÙ (più del richiesto)
      else if (delivered > requested) {
        problemProducts.push(`${p.name} - IN PIÙ (scaricato: ${delivered}, richiesto: ${requested})`);
      }
    });

    // Se ci sono prodotti con problemi, chiedi giustificazione
    if (problemProducts.length > 0) {
      console.log('⚠️ [PARTIAL DELIVERY] Rilevati prodotti con problemi:', problemProducts);
      setPartialProductsList(problemProducts);
      setShowPartialJustificationModal(true);
    } else {
      // Tutto perfetto, procedi normale
      setShowCompletionOptionsModal(true);
    }
  }

  // Funzioni per registrazione audio giustificazione
  async function startRecordingJustification() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        setPartialJustificationAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      setAudioChunks(chunks);
      setAudioRecorder(recorder);
      recorder.start();
      setIsRecordingPartial(true);
      setRecordingTime(0);

      // Timer per mostrare durata registrazione
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      console.log('🎤 Registrazione audio iniziata');
    } catch (error) {
      console.error('Errore avvio registrazione:', error);
      showToast('Errore accesso microfono', 'error');
    }
  }

  function stopRecordingJustification() {
    if (audioRecorder && isRecordingPartial) {
      audioRecorder.stop();
      setIsRecordingPartial(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      console.log('🎤 Registrazione audio fermata');
    }
  }

  function deleteJustificationAudio() {
    setPartialJustificationAudio(null);
    setRecordingTime(0);
  }

  async function confirmPartialJustification() {
    // Verifica che ci sia almeno un motivo (testo O audio)
    if (!partialJustificationText.trim() && !partialJustificationAudio) {
      showToast('⚠️ Devi fornire un motivo (testo o audio)!', 'error');
      return;
    }

    try {
      setLoading(true);

      // Salva la giustificazione nel chatter Odoo
      const formData = new FormData();
      formData.append('picking_id', currentDelivery!.id.toString());
      formData.append('driver_name', session?.user?.name || 'Autista');

      if (partialJustificationText.trim()) {
        formData.append('text_note', partialJustificationText);
      }

      if (partialJustificationAudio) {
        formData.append('audio_note', partialJustificationAudio, 'giustificazione.webm');
      }

      // Salva nel chatter via API
      const response = await fetch('/api/delivery/save-partial-justification', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Errore salvataggio giustificazione');
      }

      console.log('✅ Giustificazione scarico parziale salvata nel chatter');
      showToast('✅ Giustificazione salvata!', 'success');

      // Chiudi modal giustificazione e apri quello completion
      setShowPartialJustificationModal(false);
      setPartialJustificationText('');
      setPartialJustificationAudio(null);
      setShowCompletionOptionsModal(true);

    } catch (error: any) {
      console.error('❌ Errore salvataggio giustificazione:', error);
      showToast('Errore salvataggio: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function validateDeliveryOnServer(payload: any) {
    const response = await fetch('/api/delivery/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // IMPORTANTE: Invia cookie utente per autenticazione
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error('Errore validazione consegna');
    }

    return response.json();
  }

  // ==================== PAYMENT ====================
  function openPaymentModal() {
    if (!currentDelivery) return;
    setPaymentAmount(currentDelivery.amount_total?.toString() || '');
    setShowPaymentModal(true);
  }

  async function handlePaymentReceiptCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const base64 = await fileToBase64(file);
      const compressed = await compressImage(base64);
      setPaymentReceiptPhoto(compressed);
      showToast('Ricevuta caricata', 'success');
    } catch (err) {
      showToast('Errore caricamento ricevuta', 'error');
    }
  }

  async function processPayment() {
    if (!currentDelivery) return;

    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      showToast('Inserire importo valido', 'error');
      return;
    }

    if (!paymentNote || !paymentNote.trim()) {
      showToast('Inserire una nota per il pagamento', 'error');
      return;
    }

    if (!paymentReceiptPhoto) {
      showToast('Scatta una foto della ricevuta', 'error');
      return;
    }

    // Previeni chiamate multiple
    if (isValidating) {
      console.log('⚠️ Validazione già in corso, ignoro chiamata duplicata');
      return;
    }

    setIsValidating(true);
    setLoading(true);

    try {
      // Salva ricevuta in attachments
      await db.attachments.add({
        picking_id: currentDelivery.id,
        context: 'payment',
        data: paymentReceiptPhoto,
        timestamp: new Date(),
        uploaded: false
      });

      // Prepara payload completo con prodotti e dati pagamento
      const payload = {
        picking_id: currentDelivery.id,
        products: scaricoProducts.map(p => ({
          move_line_id: p.move_line_id || p.id,  // ID della stock.move.line
          product_id: p.product_id,
          name: p.name,
          qty: p.qty,
          delivered: p.delivered || 0,
          picked: p.picked || false
        })),
        completion_type: 'payment',
        notes: paymentNote,
        payment_data: {
          amount,
          payment_method: paymentMethod,
          receipt_photo: paymentReceiptPhoto
        }
      };

      console.log('💰 [PAYMENT] Invio payload completo per validazione:', payload);

      if (isOnline) {
        await validateDeliveryOnServer(payload);
        showToast('✅ Incasso registrato e consegna completata!', 'success');
      } else {
        await db.offline_actions.add({
          action_type: 'validate',
          payload,
          timestamp: new Date(),
          synced: false
        });
        showToast('💾 Pagamento salvato per sincronizzazione', 'info');
      }

      // Upload allegati
      await uploadAllAttachments();

      // Reset e chiudi
      setPaymentReceiptPhoto(null);
      setPaymentNote('');
      setShowPaymentModal(false);

      // Chiudi vista e torna alla lista
      closeScaricoView();

    } catch (error: any) {
      console.error('❌ [PAYMENT] Errore:', error);
      showToast('Errore: ' + error.message, 'error');
    } finally {
      setLoading(false);
      setIsValidating(false);
    }
  }

  async function processPaymentOnServer(payload: any) {
    const response = await fetch('/api/delivery/payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error('Errore registrazione pagamento');
    }

    return response.json();
  }

  // Nuova funzione: Prima valida la consegna, poi apre modal pagamento con importo
  async function handlePaymentCompletion() {
    if (!currentDelivery) {
      showToast('Errore: consegna non trovata', 'error');
      return;
    }

    // Previeni chiamate multiple
    if (isValidating) {
      console.log('⚠️ Validazione già in corso, ignoro chiamata duplicata');
      return;
    }

    setIsValidating(true);
    setLoading(true);

    try {
      // STEP 1: Valida la consegna (chiude il picking in Odoo)
      console.log('💰 [PAYMENT FLOW] STEP 1: Validazione consegna...');

      const validatePayload = {
        picking_id: currentDelivery.id,
        products: scaricoProducts.map(p => ({
          move_line_id: p.move_line_id || p.id,
          product_id: p.product_id,
          name: p.name,
          qty: p.qty,
          delivered: p.delivered || 0,
          picked: p.picked || false
        })),
        completion_type: 'validate_only', // Flag per validare senza completare
        notes: 'Validazione per incasso pagamento alla consegna'
      };

      if (isOnline) {
        await validateDeliveryOnServer(validatePayload);
        console.log('✅ [PAYMENT FLOW] Consegna validata con successo');
      } else {
        showToast('Devi essere online per registrare un pagamento', 'error');
        setLoading(false);
        setIsValidating(false);
        return;
      }

      // STEP 2: Apri direttamente il modal pagamento
      console.log('💰 [PAYMENT FLOW] STEP 2: Apertura modal pagamento (importo manuale)');

      // Aggiorna il currentDelivery come completato
      setCurrentDelivery({
        ...currentDelivery,
        state: 'done',
        completed: true
      });

      // STEP 3: Apri il modal pagamento con importo 0 (l'autista lo inserirà manualmente)
      setPaymentAmount('0');
      setShowPaymentModal(true);
      showToast('✅ Consegna validata! Inserisci l\'importo incassato\n💬 La fattura arriverà su WhatsApp', 'success');

      // Ricarica le consegne in background per aggiornare lo stato
      loadDeliveries();

    } catch (error: any) {
      console.error('❌ [PAYMENT FLOW] Errore:', error);
      showToast('Errore: ' + error.message, 'error');
    } finally {
      setLoading(false);
      setIsValidating(false);
    }
  }

  // ==================== RESO ====================
  async function openResoModal() {
    if (!currentDelivery) {
      console.log('❌ RESO: currentDelivery non trovato');
      return;
    }

    console.log('📦 RESO: Apertura modal per delivery:', currentDelivery.id);
    console.log('📦 RESO: Prodotti disponibili:', currentDelivery.products);

    // Prodotti già consegnati
    const delivered = currentDelivery.products || [];
    console.log('📦 RESO: Prodotti consegnati da processare:', delivered.length);

    setResoProducts(delivered.map(p => ({ ...p, reso_qty: 0 })));
    setResoNote('');
    setResoPhoto(null);
    setShowResoModal(true);
    console.log('✅ RESO: Modal aperto');
  }

  async function saveReso() {
    if (!currentDelivery) return;

    console.log('💾 RESO: Inizio salvataggio...');
    console.log('💾 RESO: Delivery ID:', currentDelivery.id);
    console.log('💾 RESO: Note:', resoNote);
    console.log('💾 RESO: Foto presente:', !!resoPhoto);

    if (!resoNote.trim()) {
      console.log('❌ RESO: Note mancanti');
      showToast('Inserisci il motivo del reso', 'error');
      return;
    }

    if (!resoPhoto) {
      console.log('❌ RESO: Foto mancante');
      showToast('Scatta una foto del danno', 'error');
      return;
    }

    // Previeni chiamate multiple
    if (isValidating) {
      console.log('⚠️ Validazione già in corso, ignoro chiamata duplicata');
      return;
    }

    setIsValidating(true);

    // Payload completo con array prodotti da rendere
    const payload = {
      original_picking_id: currentDelivery.id,
      note: resoNote,
      photo: resoPhoto,
      products: resoProducts.filter(p => p.reso_qty && p.reso_qty > 0).map(p => ({
        product_id: p.product_id,
        quantity: p.reso_qty
      }))
    };

    console.log('💾 RESO: Payload preparato:', {
      ...payload,
      photo: 'BASE64_DATA',
      products_count: payload.products.length
    });

    try {
      if (isOnline) {
        console.log('🌐 RESO: Salvataggio online...');
        await createResoOnServer(payload);
        console.log('✅ RESO: Salvato online con successo');
      } else {
        console.log('💤 RESO: Salvataggio offline...');
        await db.offline_actions.add({
          action_type: 'reso',
          payload,
          timestamp: new Date(),
          synced: false
        });
        console.log('✅ RESO: Salvato offline per sincronizzazione');
        showToast('Reso salvato per sincronizzazione', 'info');
      }

      setShowResoModal(false);
      setResoNote('');
      setResoPhoto(null);
      setResoProducts([]);
      showToast('Reso registrato', 'success');
      console.log('✅ RESO: Processo completato');
    } catch (error) {
      console.error('❌ RESO: Errore durante salvataggio:', error);
      showToast('Errore durante il salvataggio del reso', 'error');
    } finally {
      setIsValidating(false);
    }
  }

  async function createResoOnServer(payload: any) {
    const response = await fetch('/api/delivery/reso', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error('Errore creazione reso');
    }

    return response.json();
  }

  // ==================== STAMPA PDF ====================
  async function printDelivery(deliveryId: number) {
    const delivery = deliveries.find(d => d.id === deliveryId);
    if (!delivery) return;

    // Verifica che sia completata
    if (delivery.state !== 'done' && !delivery.completed) {
      showToast('⚠️ Puoi stampare solo consegne completate', 'warning');
      return;
    }

    setLoading(true);
    showToast('📥 Download PDF in corso...', 'info');

    try {
      // Chiama la nostra API che scarica il PDF da Odoo
      const response = await fetch('/api/delivery/print', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deliveryId: deliveryId,
          deliveryName: delivery.name
        })
      });

      if (!response.ok) {
        throw new Error('Errore nel download del PDF');
      }

      // Ottieni il blob del PDF
      const blob = await response.blob();

      // Crea un URL temporaneo per il blob
      const url = window.URL.createObjectURL(blob);

      // Crea un link temporaneo e simula il click per scaricare
      const a = document.createElement('a');
      a.href = url;
      a.download = `Consegna_${delivery.name}.pdf`;
      document.body.appendChild(a);
      a.click();

      // Pulisci
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showToast('✅ PDF scaricato', 'success');

    } catch (error: any) {
      console.error('❌ Errore stampa:', error);
      showToast('❌ Errore download PDF: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  // ==================== VEHICLE CHECK FUNCTIONS ====================

  function capturePhoto(categoryId: string, itemId: string) {
    setCurrentPhotoItem({ categoryId, itemId });
    vehicleCheckPhotoInputRef.current?.click();
  }

  async function handleVehicleCheckPhotoCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !currentPhotoItem) return;

    try {
      const base64 = await fileToBase64(file);
      const compressed = await compressImage(base64);

      const newPhoto: VehicleCheckPhoto = {
        id: `photo_${Date.now()}`,
        item_id: currentPhotoItem.itemId,
        category_id: currentPhotoItem.categoryId,
        data: compressed,
        preview: compressed,
        uploaded: false,
        timestamp: new Date()
      };

      setCheckPhotos(prev => [...prev, newPhoto]);
      showToast('Foto aggiunta con successo', 'success');

      // Reset
      setCurrentPhotoItem(null);
      if (vehicleCheckPhotoInputRef.current) {
        vehicleCheckPhotoInputRef.current.value = '';
      }
    } catch (err) {
      console.error('Error capturing photo:', err);
      showToast('Errore durante la cattura della foto', 'error');
    }
  }

  async function generateVehicleCheckPDF() {
    if (!vehicleCheckData || !vehicleInfo) {
      showToast('Nessun controllo veicolo disponibile', 'error');
      return;
    }

    try {
      showToast('Generazione PDF in corso...', 'info');

      const { jsPDF } = await import('jspdf');
      // @ts-ignore
      const { default: autoTable } = await import('jspdf-autotable');

      const doc = new jsPDF();

      // Header
      doc.setFontSize(18);
      doc.text('Controllo Veicolo - LAPA Delivery', 20, 20);

      // Info veicolo
      doc.setFontSize(12);
      doc.text(`Veicolo: ${vehicleInfo.name}`, 20, 35);
      doc.text(`Targa: ${vehicleInfo.license_plate || 'N/A'}`, 20, 42);
      doc.text(`Autista: ${session?.name || 'N/A'}`, 20, 49);
      doc.text(`Chilometraggio: ${vehicleCheckData.odometer || 'N/D'} km`, 20, 56);
      doc.text(`Data: ${new Date(vehicleCheckData.check_date).toLocaleDateString('it-IT')}`, 20, 63);

      // Summary
      doc.setFontSize(14);
      doc.text('Riepilogo Controllo', 20, 77);
      doc.setFontSize(10);
      doc.text(`Elementi OK: ${vehicleCheckData.summary.ok_count}`, 20, 85);
      doc.text(`Problemi Aperti: ${vehicleCheckData.summary.open_issues}`, 80, 85);
      doc.text(`Problemi Risolti: ${vehicleCheckData.summary.resolved_issues}`, 140, 85);

      // Filtra solo problemi aperti (status='issue' && !resolved)
      // Usa SOLO le categorie VISIBILI, non tutte (esclude FRIGO per veicoli non refrigerati)
      const visibleCategoryIds = filteredVehicleCheckCategories.map(c => c.id);
      const openIssuesList = vehicleCheckData.categories
        .filter(cat => visibleCategoryIds.includes(cat.id)) // Solo categorie visibili!
        .flatMap(cat =>
          cat.items
            .filter(item => item.status === 'issue' && !item.resolved)
            .map(item => [
              cat.name,
              item.label,
              item.note || '-'
            ])
        );

      if (openIssuesList.length > 0) {
        doc.setFontSize(14);
        doc.text('Problemi Aperti', 20, 100);

        autoTable(doc, {
          startY: 105,
          head: [['Categoria', 'Elemento', 'Nota']],
          body: openIssuesList,
          styles: { fontSize: 9 },
          headStyles: { fillColor: [239, 68, 68] }
        });
      } else {
        doc.setFontSize(12);
        doc.setTextColor(16, 185, 129);
        doc.text('Nessun problema aperto', 20, 105);
      }

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128);
        doc.text(
          `Pagina ${i} di ${pageCount} - Generato il ${new Date().toLocaleString('it-IT')}`,
          doc.internal.pageSize.width / 2,
          doc.internal.pageSize.height - 10,
          { align: 'center' }
        );
      }

      // Download
      const fileName = `Controllo_Veicolo_${vehicleInfo.license_plate || vehicleInfo.name}_${Date.now()}.pdf`;
      doc.save(fileName);

      showToast('PDF scaricato con successo', 'success');
    } catch (err) {
      console.error('Error generating PDF:', err);
      showToast('Errore durante la generazione del PDF', 'error');
    }
  }

  // ==================== ETA & OPTIMIZATION ====================
  async function calculateETAsForDeliveries(delivs: Delivery[]) {
    if (!currentPosition) return;

    const pending = delivs.filter(d => d.state === 'assigned');

    for (let i = 0; i < pending.length; i++) {
      const delivery = pending[i];
      if (!delivery.latitude || !delivery.longitude) continue;

      try {
        const origin = i === 0 ? currentPosition :
          { lat: pending[i-1].latitude!, lng: pending[i-1].longitude! };

        const eta = await calculateETA(origin, {
          lat: delivery.latitude,
          lng: delivery.longitude
        });

        setDeliveries(prev => prev.map(d =>
          d.id === delivery.id ? { ...d, eta } : d
        ));
      } catch (err) {
        console.error('ETA calculation failed', err);
      }
    }
  }

  async function calculateETA(origin: { lat: number; lng: number }, destination: { lat: number; lng: number }) {
    const response = await fetch('/api/delivery/calculate-eta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin, destination })
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.duration; // minuti
  }

  async function optimizeRoute() {
    if (!currentPosition) {
      showToast('GPS non disponibile', 'error');
      return;
    }

    setLoading(true);
    try {
      const pending = deliveries.filter(d => d.state === 'assigned');

      const response = await fetch('/api/delivery/optimize-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: currentPosition,
          deliveries: pending.map(d => ({
            id: d.id,
            lat: d.latitude,
            lng: d.longitude
          }))
        })
      });

      if (!response.ok) throw new Error('Ottimizzazione fallita');

      const { optimized_order } = await response.json();

      // Riordina deliveries
      const optimizedDeliveries = optimized_order.map((id: number, index: number) => {
        const delivery = deliveries.find(d => d.id === id);
        return { ...delivery, sequence: index + 1 };
      });

      const completed = deliveries.filter(d => d.state === 'done');
      setDeliveries([...optimizedDeliveries, ...completed]);

      // Ricalcola ETA
      await calculateETAsForDeliveries(optimizedDeliveries);

      showToast('Percorso ottimizzato!', 'success');
    } catch (err) {
      showToast('Errore ottimizzazione', 'error');
    } finally {
      setLoading(false);
    }
  }

  // ==================== MAP ====================
  function initMap() {
    // Map initialization will be done with react-google-maps
    // For now, placeholder
  }

  // ==================== UTILS ====================
  function showToast(message: string, type: 'success' | 'error' | 'warning' | 'info') {
    // Simple toast implementation
    const toast = document.createElement('div');
    toast.className = `fixed top-20 right-4 px-6 py-3 rounded-lg shadow-lg z-50 ${
      type === 'success' ? 'bg-green-500' :
      type === 'error' ? 'bg-red-500' :
      type === 'warning' ? 'bg-yellow-500' :
      'bg-blue-500'
    } text-white`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function compressImage(base64: string, maxWidth = 1920, quality = 0.8): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = base64;
    });
  }

  // ==================== FILTERED DELIVERIES ====================
  const filteredDeliveries = useMemo(() => {
    // Ordina: assigned prima, done dopo
    const sorted = [...deliveries].sort((a, b) => {
      if (a.state === 'assigned' && b.state === 'done') return -1;
      if (a.state === 'done' && b.state === 'assigned') return 1;
      return 0;
    });

    // Se showCompleted è false, mostra solo assigned
    if (!showCompleted) {
      return sorted.filter(d => d.state === 'assigned');
    }

    return sorted;
  }, [deliveries, showCompleted]);

  // ==================== FILTERED VEHICLE CHECK CATEGORIES ====================
  const filteredVehicleCheckCategories = useMemo(() => {
    // Se non c'è vehicleInfo, mostra tutte le categorie
    if (!vehicleInfo) {
      return VEHICLE_CHECK_CATEGORIES;
    }

    // Controlla se il veicolo è refrigerato
    const categoryName = vehicleInfo.category_name?.toLowerCase() || '';
    const isRefrigerated = categoryName.includes('refrigerat') || categoryName.includes('frigo');

    // Filtra categorie: mostra FRIGO solo per veicoli refrigerati
    return VEHICLE_CHECK_CATEGORIES.filter(cat => {
      if (cat.id === 'frigo' && !isRefrigerated) {
        return false;
      }
      return true;
    });
  }, [vehicleInfo]);

  // ==================== STATS ====================
  const stats = {
    total: deliveries.length,
    completed: deliveries.filter(d => d.state === 'done').length,
    pending: deliveries.filter(d => d.state === 'assigned').length,
    completedPercent: deliveries.length > 0
      ? Math.round((deliveries.filter(d => d.state === 'done').length / deliveries.length) * 100)
      : 0
  };

  // ==================== RENDER ====================
  return (
    <div className="min-h-[100dvh] bg-gray-50">
      {/* HEADER */}
      <header className="fixed top-0 left-0 right-0 h-[60px] bg-red-600 border-b border-red-700 flex items-center px-4 z-50 shadow-sm">
        <button
          onClick={() => window.location.href = '/'}
          className="mr-3 p-2 hover:bg-red-700 rounded-lg transition-colors"
          title="Torna alla Dashboard"
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-white">🚚 LAPA Delivery</h1>
        </div>
        <div className="flex items-center gap-3 text-sm text-white">
          <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400' : 'bg-yellow-400'}`} />
          <span className="font-medium">{session?.name || 'Driver'}</span>
          {session?.vehicle_name && (
            <span className="px-3 py-1 bg-white/20 text-white rounded-full text-xs font-semibold">
              {session.vehicle_name}
            </span>
          )}
        </div>
      </header>

      {/* STATS CARDS */}
      {view === 'list' && (
        <div className="fixed top-[60px] left-0 right-0 bg-white border-b border-gray-200 z-40">
          <div className="grid grid-cols-3 gap-3 p-4">
            <div className="bg-white rounded-lg p-3 text-center shadow-sm border border-gray-100">
              <div className="text-2xl font-bold text-indigo-600">{stats.total}</div>
              <div className="text-xs text-gray-500 mt-1">Totale</div>
            </div>
            <div className="bg-white rounded-lg p-3 text-center shadow-sm border border-gray-100">
              <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
              <div className="text-xs text-gray-500 mt-1">Completate</div>
            </div>
            <div className="bg-white rounded-lg p-3 text-center shadow-sm border border-gray-100">
              <div className="text-2xl font-bold text-orange-600">{stats.pending}</div>
              <div className="text-xs text-gray-500 mt-1">Pendenti</div>
            </div>
          </div>

          {/* Toggle completate */}
          {stats.completed > 0 && (
            <div className="px-4 pb-3">
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className={`w-full py-2 px-4 rounded-lg text-sm font-semibold transition-colors ${
                  showCompleted
                    ? 'bg-green-100 text-green-700 border border-green-300'
                    : 'bg-gray-100 text-gray-700 border border-gray-300'
                }`}
              >
                {showCompleted ? '✓ Mostrando completate' : 'Mostra completate'} ({stats.completed})
              </button>
            </div>
          )}
        </div>
      )}

      {/* MAIN CONTENT */}
      <main className={`${view === 'list' ? 'pt-[240px]' : 'pt-[60px]'} pb-[70px] overflow-y-auto`}>
        {/* LISTA CONSEGNE */}
        {view === 'list' && (
          <div className="space-y-3 p-4">
            {loading && <div className="text-center py-8 text-gray-500">Caricamento...</div>}

            {!loading && filteredDeliveries.length === 0 && stats.pending === 0 && (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📦</div>
                <div className="text-gray-600">Nessuna consegna pendente</div>
              </div>
            )}

            {!loading && filteredDeliveries.length === 0 && stats.pending > 0 && !showCompleted && (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">✅</div>
                <div className="text-gray-600">Tutte le consegne completate!</div>
                <button
                  onClick={() => setShowCompleted(true)}
                  className="mt-4 px-6 py-3 min-h-[48px] bg-green-500 text-white rounded-lg font-semibold"
                >
                  Mostra completate
                </button>
              </div>
            )}

            {filteredDeliveries.map((delivery, index) => (
              <motion.div
                key={delivery.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => openDelivery(delivery)}
                className={`bg-white rounded-xl p-4 shadow-sm border border-gray-100 cursor-pointer active:scale-[0.98] transition-transform ${
                  delivery.state === 'done' ? 'opacity-60 bg-blue-50' : ''
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                      {delivery.sequence || index + 1}
                    </div>
                    {delivery.note && (
                      <div className="text-xl" title="Attenzione: Nota presente">⚠️</div>
                    )}
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    delivery.state === 'done' ? 'bg-green-500 text-white' : 'bg-orange-500 text-white'
                  }`}>
                    {delivery.state === 'done' ? 'COMPLETATA' : 'IN CONSEGNA'}
                  </span>
                </div>

                {/* Customer */}
                <div className="font-semibold text-gray-900 mb-2">{delivery.customerName}</div>

                {/* Address */}
                <div className="text-sm text-gray-600 mb-2 flex items-start gap-2">
                  <span>📍</span>
                  <span>
                    {delivery.partner_street}
                    {delivery.partner_city && `, ${delivery.partner_city}`}
                    {delivery.partner_zip && ` ${delivery.partner_zip}`}
                  </span>
                </div>

                {/* Phone */}
                {delivery.partner_phone && (
                  <a href={`tel:${delivery.partner_phone}`} className="text-sm text-blue-600 mb-2 block">
                    📞 {delivery.partner_phone}
                  </a>
                )}

                {/* Salesperson */}
                {delivery.salesperson && (
                  <div className="text-sm text-gray-600 mb-2 bg-blue-50 p-2 rounded-lg border border-blue-200">
                    <span className="font-semibold text-blue-700">👤 Responsabile Vendite:</span> {delivery.salesperson}
                    <div className="text-xs text-gray-500 mt-1">Per problemi chiamare il responsabile di questo cliente</div>
                  </div>
                )}

                {/* Order info */}
                <div className="text-sm text-gray-500 mb-2">
                  Ordine: <span className="font-medium">{delivery.origin || delivery.name}</span>
                </div>

                {/* ETA */}
                {delivery.eta && delivery.state !== 'done' && (
                  <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold mb-2 ${
                    delivery.eta < 10 ? 'bg-green-100 text-green-700' :
                    delivery.eta < 30 ? 'bg-yellow-100 text-yellow-700' :
                    'bg-orange-100 text-orange-700'
                  }`}>
                    🕒 {delivery.eta} min
                  </div>
                )}

                {/* Products summary */}
                <div className="text-sm text-gray-600 mb-2">
                  📦 {delivery.products?.length || 0} articoli
                </div>

                {/* Amount */}
                {delivery.amount_total && (
                  <div className="text-lg font-bold text-gray-900 mb-2">
                    € {delivery.amount_total.toFixed(2)}
                  </div>
                )}

                {/* Payment status */}
                {delivery.payment_status && (
                  <div className={`inline-block px-2 py-1 rounded text-xs font-semibold mb-3 ${
                    delivery.payment_status === 'paid' ? 'bg-green-100 text-green-700' :
                    delivery.payment_status === 'to_pay' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {delivery.payment_status === 'paid' ? 'PAGATO' :
                     delivery.payment_status === 'to_pay' ? 'DA PAGARE' :
                     'PARZIALE'}
                  </div>
                )}

                {/* Actions */}
                {delivery.state !== 'done' && (
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigateTo(delivery.latitude, delivery.longitude);
                      }}
                      className="flex-1 bg-blue-600 text-white py-3 min-h-[48px] rounded-lg font-semibold text-sm hover:bg-blue-700 transition-colors"
                    >
                      🗺️ NAVIGA
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openScaricoView(delivery);
                      }}
                      className="flex-1 bg-green-600 text-white py-3 min-h-[48px] rounded-lg font-semibold text-sm hover:bg-green-700 transition-colors relative"
                    >
                      📦 SCARICO
                      {(delivery.products?.length || 0) > 0 && (
                        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold">
                          {delivery.products?.length || 0}
                        </span>
                      )}
                    </button>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {/* VISTA MAPPA */}
        {view === 'map' && (
          <div className="h-[calc(100dvh-130px)]">
            <DeliveryMap
              deliveries={deliveries}
              currentPosition={currentPosition}
              onMarkerClick={openScaricoView}
            />
          </div>
        )}

        {/* VISTA STATS */}
        {view === 'stats' && (
          <div className="p-4 space-y-4">
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="font-semibold text-lg mb-4">Statistiche Giornata</h3>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Consegne Totali</span>
                  <span className="font-bold text-xl">{stats.total}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Completate</span>
                  <span className="font-bold text-xl text-green-600">{stats.completed}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Percentuale</span>
                  <span className="font-bold text-xl text-indigo-600">{stats.completedPercent}%</span>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-4 mt-4">
                  <div
                    className="bg-green-600 h-4 rounded-full transition-all duration-500"
                    style={{ width: `${stats.completedPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}


        {/* VISTA SCARICO */}
        {view === 'scarico' && currentDelivery && (
          <div className="fixed inset-0 top-[60px] bottom-[70px] bg-white flex flex-col">
            {/* Header */}
            <div className="bg-white p-3 border-b flex items-center gap-3">
              <button onClick={closeScaricoView} className="w-10 h-10 flex items-center justify-center rounded-lg bg-red-500 text-white text-2xl font-bold hover:bg-red-600 shadow-md">←</button>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="font-semibold text-base">Scarico Prodotti</div>
                  {currentDelivery.note && (
                    <div className="text-xl" title={currentDelivery.note}>⚠️</div>
                  )}
                </div>
                <div className="text-sm text-gray-600">{currentDelivery.customerName}</div>
                {currentDelivery.note && (
                  <div className="text-xs italic text-yellow-700 bg-yellow-50 p-2 rounded mt-1">
                    📝 {stripHtml(currentDelivery.note)}
                  </div>
                )}
              </div>
            </div>

            {/* Products Grid per Categoria */}
            <div className="flex-1 overflow-y-auto p-3 pb-20">
              {Object.entries(categorizedProducts).map(([key, category]) => {
                if (category.products.length === 0) return null;
                return (
                  <div key={key}>
                    <div className="font-semibold py-2 border-b-2 mb-3" style={{color: category.color, borderColor: category.color + '33'}}>
                      {category.name} ({category.products.length})
                    </div>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2 mb-4">
                      {category.products.map(product => {
                        const isModified = product.delivered !== product.qty;
                        const isCompleted = currentDelivery?.state === 'done';
                        return (
                          <div
                            key={product.id}
                            onClick={() => !isCompleted && toggleProductPicked(product.id)}
                            className={`border rounded-lg p-2 ${!isCompleted ? 'cursor-pointer' : 'cursor-not-allowed opacity-75'} ${product.completed ? 'bg-green-50 border-green-500' : 'border-gray-300'}`}
                            style={{borderTopWidth: '3px', borderTopColor: category.color}}
                          >
                            {product.image ? (
                              <img src={`data:image/png;base64,${product.image}`} alt={product.name} className="w-full h-20 object-contain rounded mb-2 bg-white p-1" />
                            ) : (
                              <div className="w-full h-20 bg-gray-100 rounded mb-2 flex items-center justify-center text-3xl">📦</div>
                            )}
                            <div className="text-xs font-semibold mb-1 line-clamp-2 text-gray-900">{product.name}</div>
                            <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                              <span>RICHIESTO</span>
                              <span className="font-semibold">{product.qty}</span>
                            </div>
                            <div className="flex justify-between text-[10px] mb-2" style={{color: isModified ? '#f59e0b' : '#10b981'}}>
                              <span>CONSEGNATO</span>
                              <span className="font-bold text-base">{product.delivered}</span>
                            </div>
                            <button
                              onClick={(e) => {e.stopPropagation(); !isCompleted && openCalculator(product.id, product.qty, product.name);}}
                              disabled={isCompleted}
                              className="w-full py-1 text-xs rounded font-semibold"
                              style={{
                                background: isCompleted ? '#e5e7eb' : (isModified ? '#fef3c7' : '#f3f4f6'),
                                color: isCompleted ? '#9ca3af' : (isModified ? '#92400e' : '#374151'),
                                cursor: isCompleted ? 'not-allowed' : 'pointer'
                              }}
                            >
                              {isCompleted ? '🔒 Bloccato' : `✏️ Modifica: ${product.delivered}`}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer Stats + Completa */}
            <div className="fixed bottom-[70px] left-0 right-0 bg-white border-t p-3 flex items-center gap-3">
              <div className="flex-1 flex gap-4">
                <div className="text-center"><div className="text-xl font-bold text-gray-900">{scaricoStats.total.toFixed(2)}</div><div className="text-[10px] text-gray-500">Totali</div></div>
                <div className="text-center"><div className="text-xl font-bold text-green-600">{scaricoStats.delivered.toFixed(2)}</div><div className="text-[10px] text-gray-500">Scaricati</div></div>
                <div className="text-center"><div className="text-xl font-bold text-orange-500">{scaricoStats.remaining.toFixed(2)}</div><div className="text-[10px] text-gray-500">Mancanti</div></div>
              </div>
              {currentDelivery?.state !== 'done' && (
                <button onClick={handleCheckPartialDelivery} className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold text-sm">✅ Completa</button>
              )}
            </div>
          </div>
        )}

        {/* VISTA VEHICLE CHECK */}
        {view === 'vehicle-check' && (
          <div className="p-4 space-y-4">
            {/* Header Card */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-6 shadow-lg text-white">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-4xl">🚗</span>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold">Controllo Veicolo</h2>
                  <p className="text-indigo-100 text-sm">
                    {vehicleInfo ? `${vehicleInfo.name} - ${vehicleInfo.license_plate || 'N/A'}` : 'Caricamento...'}
                  </p>
                </div>
                {/* PDF Button */}
                {vehicleCheckData && (
                  <button
                    onClick={generateVehicleCheckPDF}
                    className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg transition-colors"
                    title="Genera PDF"
                  >
                    <span className="text-xl">📄</span>
                  </button>
                )}
              </div>

              {/* Campo Chilometri */}
              {vehicleCheckData && (
                <div className="mt-3">
                  <label className="block text-sm font-semibold text-white mb-1">
                    📏 Chilometraggio Attuale
                  </label>
                  <input
                    type="number"
                    value={vehicleCheckData.odometer || ''}
                    onChange={(e) => {
                      const value = e.target.value ? parseInt(e.target.value) : undefined;
                      setVehicleCheckData({
                        ...vehicleCheckData,
                        odometer: value
                      });
                    }}
                    placeholder="Es: 125000"
                    className="w-full px-3 py-2 rounded-lg bg-white text-gray-900 font-semibold text-base placeholder-gray-400 focus:ring-2 focus:ring-yellow-400 focus:outline-none"
                    min="0"
                  />
                </div>
              )}

              {vehicleCheckData && (
                <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-indigo-400">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{vehicleCheckData.summary.ok_count}</div>
                    <div className="text-xs text-indigo-200">OK</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{vehicleCheckData.summary.open_issues}</div>
                    <div className="text-xs text-indigo-200">Aperti</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{vehicleCheckData.summary.resolved_issues}</div>
                    <div className="text-xs text-indigo-200">Risolti</div>
                  </div>
                </div>
              )}
            </div>

            {/* Categories Tabs */}
            <div className="bg-white rounded-xl shadow-sm overflow-x-auto scrollbar-hide" style={{
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none'
            }}>
              <div className="flex gap-2 p-2 min-w-max">
                {filteredVehicleCheckCategories.map(cat => {
                  // Calcola quanti item sono completati (ok o issue) vs totali
                  const categoryData = vehicleCheckData?.categories.find(c => c.id === cat.id);
                  const totalItems = cat.items.length;
                  const completedItems = categoryData?.items.filter(item => item.status !== 'unchecked').length || 0;
                  const allCompleted = completedItems === totalItems;

                  return (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCheckCategory(cat.id)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-semibold text-sm whitespace-nowrap transition-all flex-shrink-0 ${
                        activeCheckCategory === cat.id
                          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                      style={activeCheckCategory === cat.id ? {} : { color: cat.color }}
                    >
                      <span className="text-lg">{cat.icon}</span>
                      <span className="flex items-center gap-1.5">
                        <span>{cat.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                          allCompleted
                            ? 'bg-green-500 text-white'
                            : activeCheckCategory === cat.id
                            ? 'bg-white/20 text-white'
                            : 'bg-orange-500 text-white'
                        }`}>
                          {completedItems}/{totalItems}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Check Items */}
            <div className="space-y-3 pb-32">
              {filteredVehicleCheckCategories
                .find(cat => cat.id === activeCheckCategory)
                ?.items.map(item => {
                  const checkItem = vehicleCheckData?.categories
                    .find(cat => cat.id === activeCheckCategory)
                    ?.items.find(ci => ci.id === item.id);

                  const itemPhotos = checkPhotos.filter(p => p.item_id === item.id);

                  // Cerca se c'è un problema precedente aperto per questo item
                  const previousIssue = openIssues.find(
                    issue => issue.category_id === activeCheckCategory && issue.item_id === item.id
                  );

                  return (
                    <div
                      key={item.id}
                      className="bg-white rounded-xl p-3 shadow-sm border-2"
                      style={{
                        borderColor: checkItem?.status === 'ok' ? '#10b981' :
                                    checkItem?.status === 'issue' ? '#ef4444' :
                                    previousIssue ? '#f59e0b' : '#d1d5db'
                      }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-base text-gray-900">{item.label}</h3>
                          {checkItem?.note && (
                            <p className="text-sm text-gray-600 mt-1">{checkItem.note}</p>
                          )}

                          {/* Previous Issue Badge */}
                          {previousIssue && (
                            <div className="mt-2 bg-orange-50 border-l-3 border-orange-500 p-2 rounded">
                              <div className="flex items-start gap-2">
                                <span className="text-orange-600 text-lg flex-shrink-0">⚠️</span>
                                <div className="flex-1">
                                  <div className="text-xs font-bold text-orange-800 uppercase">
                                    Problema Precedente
                                    {previousIssue.persistence_count && previousIssue.persistence_count > 1 && (
                                      <span className="ml-1 bg-red-600 text-white px-1.5 py-0.5 rounded-full text-[10px]">
                                        {previousIssue.persistence_count}x
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-orange-700 mt-0.5">
                                    {previousIssue.note || 'Nessuna nota'}
                                  </div>
                                  <div className="text-[10px] text-orange-600 mt-1">
                                    Rilevato: {new Date(previousIssue.reported_date).toLocaleDateString('it-IT')}
                                  </div>
                                </div>
                                <button
                                  onClick={() => {
                                    setSelectedIssue(previousIssue);
                                    setShowResolveModal(true);
                                  }}
                                  className="bg-green-600 text-white px-3 py-1 rounded-lg text-xs font-bold hover:bg-green-700 transition-colors flex-shrink-0"
                                >
                                  ✓ RISOLVI
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="text-3xl ml-2">
                          {checkItem?.status === 'ok' ? '✅' :
                           checkItem?.status === 'issue' ? '⚠️' : '⭕'}
                        </div>
                      </div>

                      {/* Photo Thumbnails */}
                      {itemPhotos.length > 0 && (
                        <div className="flex gap-2 mb-3 overflow-x-auto">
                          {itemPhotos.map(photo => (
                            <div
                              key={photo.id}
                              className="relative w-20 h-20 flex-shrink-0"
                            >
                              <img
                                src={photo.preview || photo.data}
                                alt="Check photo"
                                className="w-full h-full object-cover rounded-lg border-2 border-gray-200"
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 mb-2">
                        <button
                          onClick={() => markItemStatus(activeCheckCategory, item.id, 'ok')}
                          className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-semibold transition-colors ${
                            checkItem?.status === 'ok'
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-green-100'
                          }`}
                        >
                          ✅ OK
                        </button>
                        <button
                          onClick={() => markItemStatus(activeCheckCategory, item.id, 'issue')}
                          className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-semibold transition-colors ${
                            checkItem?.status === 'issue'
                              ? 'bg-red-500 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-red-100'
                          }`}
                        >
                          ⚠️ Problema
                        </button>
                        <button
                          onClick={() => capturePhoto(activeCheckCategory, item.id)}
                          className="bg-blue-500 text-white py-2.5 px-4 rounded-lg text-base font-semibold hover:bg-blue-600 transition-colors"
                        >
                          📷
                        </button>
                      </div>

                      {/* Note input - shown when status is 'issue' */}
                      {checkItem?.status === 'issue' && (
                        <textarea
                          value={checkItem.note || ''}
                          onChange={(e) => updateItemNote(activeCheckCategory, item.id, e.target.value)}
                          placeholder="Descrivi il problema..."
                          className="w-full p-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500"
                          rows={2}
                        />
                      )}
                    </div>
                  );
                })}
            </div>

            {/* Action Buttons - Fixed at bottom */}
            {vehicleCheckData && vehicleInfo && (() => {
              const summary = calculateSummary();
              const isCheckComplete = summary.unchecked === 0;
              const hasOdometer = vehicleCheckData.odometer && vehicleCheckData.odometer > 0;
              const canSave = isCheckComplete && hasOdometer;

              return canSave ? (
                <div className="fixed bottom-[80px] left-4 right-4 z-40">
                  <button
                    onClick={saveVehicleCheck}
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-4 px-6 rounded-xl font-bold text-lg shadow-xl hover:shadow-2xl transition-all flex items-center justify-center gap-2"
                  >
                    <span className="text-2xl">💾</span>
                    <span>Salva</span>
                  </button>
                </div>
              ) : null;
            })()}
          </div>
        )}
      </main>

      {/* BOTTOM NAVIGATION */}
      <nav className="fixed bottom-0 left-0 right-0 h-[70px] bg-white border-t border-gray-200 flex items-center justify-around z-50">
        <button
          onClick={() => setView('list')}
          className={`flex flex-col items-center gap-1 px-4 py-2 ${
            view === 'list' ? 'text-indigo-600' : 'text-gray-400'
          }`}
        >
          <span className="text-2xl">📋</span>
          <span className="text-xs font-semibold">Lista</span>
        </button>

        <button
          onClick={() => setView('map')}
          className={`flex flex-col items-center gap-1 px-4 py-2 ${
            view === 'map' ? 'text-indigo-600' : 'text-gray-400'
          }`}
        >
          <span className="text-2xl">🗺️</span>
          <span className="text-xs font-semibold">Mappa</span>
        </button>

        <button
          onClick={loadDeliveries}
          className="flex flex-col items-center gap-1 px-4 py-3 min-h-[56px] text-gray-400 hover:text-indigo-600"
        >
          <span className="text-2xl">🔄</span>
          <span className="text-xs font-semibold">Ricarica</span>
        </button>

        <button
          onClick={() => setView('stats')}
          className={`flex flex-col items-center gap-1 px-4 py-2 ${
            view === 'stats' ? 'text-indigo-600' : 'text-gray-400'
          }`}
        >
          <span className="text-2xl">📊</span>
          <span className="text-xs font-semibold">Stats</span>
        </button>

        <button
          onClick={() => setView('vehicle-check')}
          className={`flex flex-col items-center gap-1 px-4 py-2 ${
            view === 'vehicle-check' ? 'text-indigo-600' : 'text-gray-400'
          }`}
        >
          <span className="text-2xl">🚗</span>
          <span className="text-xs font-semibold">Check</span>
        </button>
      </nav>

      {/* MODALS */}

      {/* Modal Dettaglio Consegna */}
      <AnimatePresence>
        {showDetailModal && currentDelivery && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center md:justify-center"
            onClick={closeModal}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full md:max-w-md md:rounded-t-2xl rounded-t-2xl"
            >
              {/* Header */}
              <div className="bg-indigo-600 text-white p-3 flex items-center justify-between rounded-t-2xl">
                <h2 className="font-semibold text-base">{currentDelivery.customerName}</h2>
                <button onClick={closeModal} className="text-xl">✕</button>
              </div>

              <div className="p-4 space-y-3">
                {/* Nota in evidenza se presente */}
                {currentDelivery.note && (
                  <div className="bg-yellow-50 border-l-4 border-yellow-500 p-3 rounded">
                    <div className="flex items-start gap-2">
                      <div className="text-xl">⚠️</div>
                      <div>
                        <div className="font-semibold text-yellow-800 text-sm mb-1">ATTENZIONE - Nota importante:</div>
                        <div className="text-sm text-yellow-700">{stripHtml(currentDelivery.note)}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Info Cliente compatto */}
                <div className="text-sm text-gray-600 space-y-1">
                  <div>📍 {currentDelivery.partner_street}</div>
                  {currentDelivery.partner_city && (
                    <div>{currentDelivery.partner_city} {currentDelivery.partner_zip}</div>
                  )}
                  {currentDelivery.partner_phone && (
                    <a href={`tel:${currentDelivery.partner_phone}`} className="text-blue-600">
                      📞 {currentDelivery.partner_phone}
                    </a>
                  )}
                  <div className="font-semibold text-gray-900">
                    📦 {currentDelivery.products?.length || 0} prodotti
                  </div>
                </div>

                {/* Azioni - solo NAVIGA e SCARICO */}
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      closeModal();
                      navigateTo(currentDelivery.lat ?? currentDelivery.latitude, currentDelivery.lng ?? currentDelivery.longitude);
                    }}
                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700"
                  >
                    🗺️ NAVIGA
                  </button>
                  <button
                    onClick={() => {
                      closeModal();
                      openScaricoView(currentDelivery);
                    }}
                    className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700"
                  >
                    📦 APRI SCARICO
                  </button>
                  {/* RESI solo per consegne completate */}
                  {(currentDelivery.state === 'done' || currentDelivery.completed) && (
                    <>
                      <button
                        onClick={() => {
                          console.log('🔄 Click su GESTIONE RESI');
                          openResoModal(); // Apri modal Resi PRIMA
                          setShowDetailModal(false); // Chiudi SOLO il modal di dettaglio (senza cancellare currentDelivery)
                        }}
                        className="w-full bg-orange-600 text-white py-3 rounded-lg font-semibold hover:bg-orange-700"
                      >
                        🔄 GESTIONE RESI
                      </button>
                      <button
                        onClick={() => {
                          printDelivery(currentDelivery.id);
                        }}
                        className="w-full bg-gray-700 text-white py-3 rounded-lg font-semibold hover:bg-gray-800 flex items-center justify-center gap-2"
                      >
                        🖨️ STAMPA PDF
                      </button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Firma */}
      <AnimatePresence>
        {showSignatureModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={() => setShowSignatureModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl p-6 max-w-4xl w-full"
            >
              <h2 className="text-xl font-bold mb-4">Firma Cliente</h2>

              <canvas
                ref={canvasRef}
                width={800}
                height={400}
                className="border-2 border-dashed border-gray-300 rounded-lg w-full touch-none"
                style={{ maxHeight: '400px' }}
              />

              <div className="mt-4">
                <label className="block text-sm font-semibold mb-2">Note / Commento (opzionale)</label>
                <textarea
                  value={signatureNote}
                  onChange={(e) => setSignatureNote(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  rows={3}
                  placeholder="Aggiungi un commento o nota per questa consegna..."
                />
              </div>

              <div className="flex gap-3 mt-4">
                <button
                  onClick={clearSignature}
                  disabled={isValidating}
                  className={`flex-1 py-3 rounded-lg font-semibold ${
                    isValidating
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  🗑️ Cancella
                </button>
                <button
                  onClick={confirmScaricoWithSignature}
                  disabled={isValidating}
                  className={`flex-1 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 ${
                    isValidating
                      ? 'bg-green-400 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-700'
                  } text-white`}
                >
                  {isValidating ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                      />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    '✓ Conferma e Completa'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Completion Options - 3 Scelte */}
      <AnimatePresence>
        {showCompletionOptionsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={() => setShowCompletionOptionsModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl p-6 max-w-lg w-full"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">📦 Completa Consegna</h3>
                <button
                  onClick={() => setShowCompletionOptionsModal(false)}
                  className="text-2xl text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>

              <p className="text-center text-gray-600 mb-6">
                Scegli come completare la consegna:
              </p>

              {/* Opzione 1: Firma Cliente */}
              <button
                onClick={() => {
                  setShowCompletionOptionsModal(false);
                  openSignatureModal();
                }}
                className="w-full p-5 mb-3 bg-green-600 text-white rounded-lg font-semibold text-lg flex items-center justify-center gap-3 hover:bg-green-700"
              >
                <span className="text-2xl">✍️</span>
                <span>Firma Cliente</span>
              </button>

              {/* Opzione 2: Solo Foto (Cliente assente) */}
              <button
                onClick={() => {
                  setShowCompletionOptionsModal(false);
                  setShowPhotoModal(true);
                }}
                className="w-full p-5 mb-3 bg-blue-600 text-white rounded-lg font-semibold text-lg flex items-center justify-center gap-3 hover:bg-blue-700"
              >
                <span className="text-2xl">📸</span>
                <span>Solo Foto (Cliente assente)</span>
              </button>

              {/* Opzione 3: Incasso Pagamento */}
              <button
                onClick={() => {
                  setShowCompletionOptionsModal(false);
                  handlePaymentCompletion();
                }}
                className="w-full p-5 bg-orange-600 text-white rounded-lg font-semibold text-lg flex items-center justify-center gap-3 hover:bg-orange-700"
              >
                <span className="text-2xl">💰</span>
                <span>Incasso Pagamento</span>
              </button>

              <button
                onClick={() => setShowCompletionOptionsModal(false)}
                className="w-full mt-4 p-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300"
              >
                Annulla
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Giustificazione Scarico Parziale */}
      <AnimatePresence>
        {showPartialJustificationModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
            onClick={() => {}}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-xl font-bold text-orange-600">⚠️ Scarico Parziale</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {session?.user?.name || 'Autista'}, specifica il motivo
                  </p>
                </div>
              </div>

              <div className="text-sm text-gray-700 mb-4 bg-orange-50 p-3 rounded-lg border border-orange-200">
                <p className="mb-2">
                  <strong>Attenzione:</strong> Non hai scaricato correttamente tutti i prodotti.
                  Devi fornire un motivo (audio O testo) per procedere.
                </p>
                {partialProductsList.length > 0 && (
                  <div className="mt-3 bg-white p-2 rounded border border-orange-300">
                    <p className="font-semibold text-orange-700 mb-1">Prodotti con problemi:</p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      {partialProductsList.map((product, idx) => (
                        <li key={idx} className="text-gray-800">{product}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Opzione 1: Registrazione Audio */}
              <div className="mb-6">
                <label className="block text-sm font-semibold mb-2">🎤 Registra Audio</label>
                {!partialJustificationAudio ? (
                  <button
                    onClick={isRecordingPartial ? stopRecordingJustification : startRecordingJustification}
                    className={`w-full py-4 rounded-lg font-semibold text-lg flex items-center justify-center gap-2 ${
                      isRecordingPartial
                        ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                    disabled={loading}
                  >
                    <span className="text-2xl">{isRecordingPartial ? '⏹️' : '🎤'}</span>
                    <span>
                      {isRecordingPartial
                        ? `Registrando... ${recordingTime}s`
                        : 'Inizia Registrazione'
                      }
                    </span>
                  </button>
                ) : (
                  <div className="bg-green-50 border border-green-300 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">✅</span>
                        <span className="font-semibold text-green-700">Audio registrato ({recordingTime}s)</span>
                      </div>
                      <button
                        onClick={deleteJustificationAudio}
                        className="text-red-600 hover:text-red-800 font-semibold"
                      >
                        🗑️ Elimina
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Divisore OR */}
              <div className="flex items-center gap-2 mb-6">
                <div className="flex-1 h-px bg-gray-300"></div>
                <span className="text-gray-500 font-semibold">OPPURE</span>
                <div className="flex-1 h-px bg-gray-300"></div>
              </div>

              {/* Opzione 2: Nota Testo */}
              <div className="mb-6">
                <label className="block text-sm font-semibold mb-2">✍️ Scrivi Nota</label>
                <textarea
                  value={partialJustificationText}
                  onChange={(e) => setPartialJustificationText(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  rows={4}
                  placeholder="Es. Cliente ha rifiutato alcuni prodotti, merce danneggiata, ecc..."
                  disabled={loading}
                />
              </div>

              {/* Pulsanti Azione */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowPartialJustificationModal(false);
                    setPartialJustificationText('');
                    setPartialJustificationAudio(null);
                  }}
                  className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300"
                  disabled={loading}
                >
                  Annulla
                </button>
                <button
                  onClick={confirmPartialJustification}
                  className={`flex-1 py-3 rounded-lg font-semibold text-white ${
                    (partialJustificationText.trim() || partialJustificationAudio) && !loading
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-gray-400 cursor-not-allowed'
                  }`}
                  disabled={loading || (!partialJustificationText.trim() && !partialJustificationAudio)}
                >
                  {loading ? 'Salvataggio...' : '✅ Conferma e Procedi'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Foto (Cliente assente) */}
      <AnimatePresence>
        {showPhotoModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={() => setShowPhotoModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl p-6 max-w-lg w-full"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">📸 Solo Foto (Cliente assente)</h3>
                <button
                  onClick={() => setShowPhotoModal(false)}
                  className="text-2xl text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                Scatta una foto della consegna effettuata (es. pacco lasciato davanti alla porta)
              </p>

              {/* Pulsante Scatta Foto */}
              <button
                onClick={() => photoModalInputRef.current?.click()}
                className="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold text-lg mb-4 hover:bg-blue-700 flex items-center justify-center gap-2"
              >
                <span className="text-2xl">📷</span>
                <span>Scatta Foto</span>
              </button>

              {/* Anteprima Foto */}
              {photoData && (
                <div className="mb-4">
                  <div className="relative">
                    <img
                      src={photoData}
                      alt="Anteprima"
                      className="w-full h-48 object-cover rounded-lg border-2 border-green-500"
                    />
                    <button
                      onClick={() => setPhotoData(null)}
                      className="absolute top-2 right-2 bg-red-500 text-white px-3 py-1 rounded-lg text-sm font-semibold hover:bg-red-600"
                    >
                      🗑️ Rimuovi
                    </button>
                  </div>
                </div>
              )}

              {/* Note opzionali */}
              <div className="mb-4">
                <label className="block text-sm font-semibold mb-2">Note (opzionale)</label>
                <textarea
                  value={photoNote}
                  onChange={(e) => setPhotoNote(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  rows={3}
                  placeholder="Es. Lasciato davanti alla porta, cliente non presente..."
                />
              </div>

              {/* Pulsanti Azione */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setPhotoData(null);
                    setPhotoNote('');
                    setShowPhotoModal(false);
                  }}
                  disabled={isValidating}
                  className={`flex-1 py-3 rounded-lg font-semibold ${
                    isValidating
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Annulla
                </button>
                <button
                  onClick={completeWithPhoto}
                  disabled={!photoData || isValidating}
                  className={`flex-1 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 ${
                    isValidating
                      ? 'bg-green-400 cursor-not-allowed text-white'
                      : photoData
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {isValidating ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                      />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    '✓ Conferma e Completa'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Calcolatrice */}
      <AnimatePresence>
        {showCalculatorModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={() => setShowCalculatorModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl p-6 max-w-md w-full"
            >
              <div className="mb-4 text-center">
                <h3 className="text-lg font-bold text-gray-900 mb-1">Quantità Prelevata</h3>
                <p className="text-sm text-gray-600 break-words">{calcProductName}</p>
              </div>
              <div className="text-3xl font-bold text-right mb-6 p-4 bg-gray-100 rounded-lg text-gray-900">
                {calcValue}
              </div>

              <div className="grid grid-cols-3 gap-3">
                {['1','2','3','4','5','6','7','8','9','.','0','←'].map(btn => (
                  <button
                    key={btn}
                    onClick={() => {
                      if (btn === '←') calcBackspace();
                      else if (btn === '.') calcPressDecimal();
                      else calcPress(btn);
                    }}
                    className="h-16 bg-gray-200 hover:bg-gray-300 rounded-lg font-bold text-xl text-gray-900"
                  >
                    {btn}
                  </button>
                ))}
                <button
                  onClick={calcCancel}
                  className="h-16 bg-red-500 text-white rounded-lg font-bold text-lg hover:bg-red-600"
                >
                  ✕ Annulla
                </button>
                <button
                  onClick={calcClear}
                  className="h-16 bg-gray-400 text-white rounded-lg font-bold text-lg hover:bg-gray-500"
                >
                  C
                </button>
                <button
                  onClick={calcConfirm}
                  disabled={calcValue === '0' || parseFloat(calcValue) === 0}
                  className={`h-16 rounded-lg font-bold text-lg transition-all ${
                    calcValue === '0' || parseFloat(calcValue) === 0
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-green-600 text-white hover:bg-green-700 cursor-pointer'
                  }`}
                >
                  ✓ OK
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Allegati */}
      <AnimatePresence>
        {showAttachmentModal && currentDelivery && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={() => setShowAttachmentModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">
                  Allegati {attachmentContext === 'signature' ? 'Firma' :
                           attachmentContext === 'photo' ? 'Foto' :
                           attachmentContext === 'payment' ? 'Pagamento' : 'Reso'}
                </h2>
                <button onClick={() => setShowAttachmentModal(false)} className="text-2xl">✕</button>
              </div>

              <div className="space-y-3 mb-4">
                <button
                  onClick={() => photoInputRef.current?.click()}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold"
                >
                  📸 Scatta Foto
                </button>

                {attachments.filter(a => !a.uploaded).length > 0 && (
                  <button
                    onClick={uploadAllAttachments}
                    className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold"
                  >
                    📤 Upload Tutti ({attachments.filter(a => !a.uploaded).length})
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {attachments.map(att => (
                  <div key={att.id} className="relative group">
                    <img
                      src={att.data}
                      alt="Allegato"
                      className="w-full h-32 object-cover rounded-lg border border-gray-200"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                      <button
                        onClick={() => att.id && deleteAttachment(att.id)}
                        className="bg-red-600 text-white px-4 py-2 rounded-lg font-semibold"
                      >
                        🗑️ Elimina
                      </button>
                    </div>
                    <div className="text-xs text-center mt-1 text-gray-500">
                      {new Date(att.timestamp).toLocaleTimeString('it-IT')}
                      {att.uploaded && <span className="text-green-600 ml-1">✓</span>}
                    </div>
                  </div>
                ))}
              </div>

              {attachments.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  Nessun allegato presente
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Pagamento */}
      <AnimatePresence>
        {showPaymentModal && currentDelivery && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 overscroll-none"
            onClick={() => {}}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
              style={{ touchAction: 'pan-y' }}
            >
              <h2 className="text-xl font-bold mb-2">💰 Pagamento alla Consegna</h2>

              <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-sm text-orange-800">
                  <strong>⚠️ Obbligatorio:</strong> Devi inserire foto ricevuta E nota per confermare
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold mb-2">Metodo Pagamento</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      value="cash"
                      checked={paymentMethod === 'cash'}
                      onChange={(e) => setPaymentMethod(e.target.value as any)}
                    />
                    <span>💵 Contanti</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      value="card"
                      checked={paymentMethod === 'card'}
                      onChange={(e) => setPaymentMethod(e.target.value as any)}
                    />
                    <span>💳 Carta</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      value="bank_transfer"
                      checked={paymentMethod === 'bank_transfer'}
                      onChange={(e) => setPaymentMethod(e.target.value as any)}
                    />
                    <span>🏦 Bonifico</span>
                  </label>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold mb-2">Importo</label>
                <input
                  type="number"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg font-bold"
                  placeholder="0.00"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold mb-2">Note *</label>
                <textarea
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  rows={3}
                  placeholder="Descrivi il pagamento (obbligatorio)..."
                  required
                />
              </div>

              {/* Foto Ricevuta */}
              <div className="mb-4">
                <label className="block text-sm font-semibold mb-2">Foto Ricevuta *</label>
                <button
                  onClick={() => paymentReceiptInputRef.current?.click()}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold mb-3 hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  <span className="text-xl">📷</span>
                  <span>Scatta Foto Ricevuta</span>
                </button>

                {paymentReceiptPhoto && (
                  <div className="relative">
                    <img
                      src={paymentReceiptPhoto}
                      alt="Ricevuta"
                      className="w-full h-32 object-cover rounded-lg border-2 border-green-500"
                    />
                    <button
                      onClick={() => setPaymentReceiptPhoto(null)}
                      className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded text-xs font-semibold hover:bg-red-600"
                    >
                      🗑️
                    </button>
                    <div className="text-xs text-center mt-1 text-green-600 font-semibold">
                      ✓ Ricevuta caricata
                    </div>
                  </div>
                )}
              </div>

              {/* Solo pulsante Conferma - OBBLIGATORIO */}
              <button
                onClick={processPayment}
                disabled={!paymentReceiptPhoto || !paymentNote.trim() || isValidating}
                className={`w-full py-4 rounded-lg font-semibold text-lg flex items-center justify-center gap-2 ${
                  isValidating
                    ? 'bg-green-400 cursor-not-allowed text-white'
                    : paymentReceiptPhoto && paymentNote.trim()
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isValidating ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                    />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <span>💰</span>
                    <span>Conferma Pagamento</span>
                  </>
                )}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Reso */}
      <AnimatePresence>
        {showResoModal && currentDelivery && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={() => setShowResoModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            >
              <h2 className="text-xl font-bold mb-4">Gestione Resi</h2>

              <div className="mb-4">
                <label className="block text-sm font-semibold mb-2">Motivo Reso *</label>
                <textarea
                  value={resoNote}
                  onChange={(e) => setResoNote(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  rows={4}
                  placeholder="Descrivi il motivo del reso..."
                  required
                />
              </div>

              <button
                onClick={() => {
                  setAttachmentContext('reso');
                  photoInputRef.current?.click();
                }}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold mb-4"
              >
                📸 Scatta Foto Danno
              </button>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowResoModal(false)}
                  disabled={isValidating}
                  className={`flex-1 py-3 rounded-lg font-semibold ${
                    isValidating
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  Annulla
                </button>
                <button
                  onClick={saveReso}
                  disabled={isValidating}
                  className={`flex-1 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 ${
                    isValidating
                      ? 'bg-orange-400 cursor-not-allowed'
                      : 'bg-orange-600 hover:bg-orange-700'
                  } text-white`}
                >
                  {isValidating ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                      />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    '✓ Conferma Reso'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Risoluzione Problema Veicolo */}
      <AnimatePresence>
        {showResolveModal && selectedIssue && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={() => {
              setShowResolveModal(false);
              setSelectedIssue(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl"
            >
              <div className="text-center mb-6">
                <div className="text-6xl mb-4">✅</div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Risolvi Problema
                </h2>
                <p className="text-sm text-gray-600">
                  Conferma che il problema è stato risolto
                </p>
              </div>

              <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-lg mb-6">
                <div className="flex items-start gap-3">
                  <span className="text-orange-600 text-2xl flex-shrink-0">⚠️</span>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 mb-1">
                      {selectedIssue.item}
                    </h3>
                    <p className="text-sm text-gray-700 mb-2">
                      <span className="font-semibold">Categoria:</span> {selectedIssue.category}
                    </p>
                    {selectedIssue.note && (
                      <p className="text-sm text-gray-700 mb-2">
                        <span className="font-semibold">Nota:</span> {selectedIssue.note}
                      </p>
                    )}
                    <p className="text-xs text-gray-600">
                      Rilevato: {new Date(selectedIssue.reported_date).toLocaleDateString('it-IT', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </p>
                    {selectedIssue.persistence_count && selectedIssue.persistence_count > 1 && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="bg-red-600 text-white px-2 py-1 rounded-full text-xs font-bold">
                          Segnalato {selectedIssue.persistence_count} volte
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowResolveModal(false);
                    setSelectedIssue(null);
                  }}
                  disabled={loading}
                  className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-colors ${
                    loading
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Annulla
                </button>
                <button
                  onClick={resolveIssue}
                  disabled={loading}
                  className={`flex-1 py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                    loading
                      ? 'bg-green-400 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-700 active:scale-95'
                  } text-white shadow-lg`}
                >
                  {loading ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                      />
                      <span>Risolvendo...</span>
                    </>
                  ) : (
                    <>
                      <span className="text-xl">✓</span>
                      <span>Conferma Risoluzione</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden file input for photos */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handlePhotoCapture}
        className="hidden"
      />

      {/* Hidden file input for photo modal */}
      <input
        ref={photoModalInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handlePhotoModalCapture}
        className="hidden"
      />

      {/* Hidden file input for payment receipt */}
      <input
        ref={paymentReceiptInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handlePaymentReceiptCapture}
        className="hidden"
      />

      {/* Hidden file input for vehicle check photos */}
      <input
        ref={vehicleCheckPhotoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleVehicleCheckPhotoCapture}
        className="hidden"
      />

      {/* Floating Action Button - Optimize Route */}
      {view === 'list' && stats.pending > 1 && (
        <button
          onClick={optimizeRoute}
          className="fixed bottom-24 right-4 bg-indigo-600 text-white w-16 h-16 rounded-full shadow-lg flex items-center justify-center text-2xl hover:bg-indigo-700 transition-colors z-40"
          title="Ottimizza Percorso"
        >
          🎯
        </button>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl p-6 shadow-xl">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent mx-auto mb-3" />
            <div className="text-gray-700 font-semibold">Caricamento...</div>
          </div>
        </div>
      )}
    </div>
  );
}

