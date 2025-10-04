'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Dexie, { Table } from 'dexie';
import dynamic from 'next/dynamic';
import type { Delivery, Product, Attachment, OfflineAction } from './types';

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
  const [view, setView] = useState<'list' | 'map' | 'stats' | 'scarico'>('list');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(true);

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

  // Estados mappa
  const mapRef = useRef<any>(null);
  const [currentPosition, setCurrentPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [markers, setMarkers] = useState<any[]>([]);
  const [showPOI, setShowPOI] = useState(true);

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const photoModalInputRef = useRef<HTMLInputElement>(null);
  const paymentReceiptInputRef = useRef<HTMLInputElement>(null);

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

  // ==================== INITIALIZATION ====================
  async function initializeApp() {
    setLoading(true);
    try {
      // CLEAR CACHE ALL'AVVIO per evitare dati vecchi
      console.log('🗑️ Pulizia cache vecchia...');
      await db.cache.clear();
      console.log('✅ Cache pulita');

      // Carica nome utente dall'API con timeout per Android
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const userResponse = await fetch('/api/auth/me', {
        signal: controller.signal
      }).catch(() => null);

      clearTimeout(timeoutId);

      let userName = 'Driver';
      if (userResponse?.ok) {
        const userData = await userResponse.json();
        userName = userData?.data?.user?.name || userData?.name || 'Driver';
      }

      console.log('👤 [DELIVERY] Nome driver caricato:', userName);
      setSession({ name: userName, vehicle_name: null });
      await loadDeliveries();
    } catch (err: any) {
      console.error('❌ [DELIVERY] Errore inizializzazione:', err);
      // Continue with default session even if user fetch fails
      setSession({ name: 'Driver', vehicle_name: null });
      // Try to load deliveries anyway
      try {
        await loadDeliveries();
      } catch (loadErr) {
        setError('Impossibile caricare le consegne');
        showToast('Errore caricamento consegne', 'error');
      }
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

      const data = await response.json();

      // Check if response contains error field
      if (data.error) {
        throw new Error(data.error);
      }

      // Check if data is array
      if (!Array.isArray(data)) {
        throw new Error('Formato risposta non valido');
      }

      console.log('📦 Consegne ricevute:', data.length);

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
    } else if (isAndroid) {
      // Google Maps app per Android
      url = `google.navigation:q=${lat},${lng}&mode=d`;
    } else {
      // Browser desktop - Google Maps web
      url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    }

    console.log('🗺️ Apertura navigazione:', url);

    // Prova ad aprire l'app nativa
    const opened = window.open(url, '_blank');

    // Fallback per browser
    if (!opened && !isIOS && !isAndroid) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`, '_blank');
    }

    showToast('Navigazione avviata', 'success');
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
        const newQty = Math.max(0, Math.min(qty, p.qty));
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
  function openCalculator(productId: number, maxQty: number) {
    setCalcProductId(productId);
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

    if (currentDelivery) {
      await db.attachments.add({
        picking_id: currentDelivery.id,
        context: 'signature',
        data: dataUrl,
        timestamp: new Date(),
        uploaded: false
      });
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
    if (!file) return;

    try {
      const base64 = await fileToBase64(file);
      const compressed = await compressImage(base64);
      setPhotoData(compressed);
      showToast('Foto caricata', 'success');
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
          id: p.id,
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

    setLoading(true);

    try {
      // Prepara payload con TUTTI i prodotti e le quantità delivered
      const payload = {
        picking_id: currentDelivery.id,
        products: scaricoProducts.map(p => ({
          id: p.id,
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
    }
  }

  async function validateDeliveryOnServer(payload: any) {
    const response = await fetch('/api/delivery/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

      const payload = {
        picking_id: currentDelivery.id,
        amount,
        payment_method: paymentMethod,
        note: paymentNote,
        receipt_photo: paymentReceiptPhoto
      };

      console.log('💰 [PAYMENT] Invio payload incasso:', payload);

      if (isOnline) {
        await processPaymentOnServer(payload);
        showToast('✅ Incasso registrato nel documento!', 'success');
      } else {
        await db.offline_actions.add({
          action_type: 'payment',
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

      // Completa anche la consegna
      await completeScarico(null);

    } catch (error: any) {
      console.error('❌ [PAYMENT] Errore:', error);
      showToast('Errore: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function processPaymentOnServer(payload: any) {
    const response = await fetch('/api/delivery/payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error('Errore registrazione pagamento');
    }

    return response.json();
  }

  // ==================== RESO ====================
  async function openResoModal() {
    if (!currentDelivery) return;

    // Prodotti già consegnati
    const delivered = currentDelivery.products || [];
    setResoProducts(delivered.map(p => ({ ...p, reso_qty: 0 })));
    setShowResoModal(true);
  }

  async function saveReso() {
    if (!currentDelivery) return;

    const productsToReturn = resoProducts.filter(p => p.reso_qty > 0);
    if (productsToReturn.length === 0) {
      showToast('Seleziona prodotti da rendere', 'error');
      return;
    }

    if (!resoNote.trim()) {
      showToast('Inserire motivo reso', 'error');
      return;
    }

    const payload = {
      original_picking_id: currentDelivery.id,
      partner_id: currentDelivery.partner_id?.[0],
      products: productsToReturn.map(p => ({
        product_id: p.product_id?.[0],
        quantity: p.reso_qty,
        name: p.product_id?.[1]
      })),
      note: resoNote
    };

    if (isOnline) {
      await createResoOnServer(payload);
    } else {
      await db.offline_actions.add({
        action_type: 'reso',
        payload,
        timestamp: new Date(),
        synced: false
      });
      showToast('Reso salvato per sincronizzazione', 'info');
    }

    setShowResoModal(false);
    showToast('Reso registrato', 'success');
  }

  async function createResoOnServer(payload: any) {
    const response = await fetch('/api/delivery/reso', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error('Errore creazione reso');
    }

    return response.json();
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
    <div className="min-h-screen bg-gray-50">
      {/* HEADER */}
      <header className="fixed top-0 left-0 right-0 h-[60px] bg-white border-b border-gray-200 flex items-center px-4 z-50 shadow-sm">
        <button
          onClick={() => window.location.href = '/'}
          className="mr-3 p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title="Torna alla Dashboard"
        >
          <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-gray-900">🚚 LAPA Delivery</h1>
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="font-medium">{session?.name || 'Driver'}</span>
          {session?.vehicle_name && (
            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
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
        </div>
      )}

      {/* MAIN CONTENT */}
      <main className={`${view === 'list' ? 'pt-[190px]' : 'pt-[60px]'} pb-[70px] overflow-y-auto`}>
        {/* LISTA CONSEGNE */}
        {view === 'list' && (
          <div className="space-y-3 p-4">
            {loading && <div className="text-center py-8 text-gray-500">Caricamento...</div>}

            {!loading && deliveries.length === 0 && (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📦</div>
                <div className="text-gray-600">Nessuna consegna per oggi</div>
              </div>
            )}

            {deliveries.map((delivery, index) => (
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
                      className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-semibold text-sm hover:bg-blue-700 transition-colors"
                    >
                      🗺️ NAVIGA
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openScaricoView(delivery);
                      }}
                      className="flex-1 bg-green-600 text-white py-2 rounded-lg font-semibold text-sm hover:bg-green-700 transition-colors relative"
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
          <div className="h-[calc(100vh-130px)]">
            <DeliveryMap
              deliveries={deliveries}
              currentPosition={currentPosition}
              onMarkerClick={openDelivery}
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
                            <div className="text-xs font-semibold mb-1 line-clamp-2">{product.name}</div>
                            <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                              <span>RICHIESTO</span>
                              <span className="font-semibold">{product.qty}</span>
                            </div>
                            <div className="flex justify-between text-[10px] mb-2" style={{color: isModified ? '#f59e0b' : '#10b981'}}>
                              <span>CONSEGNATO</span>
                              <span className="font-bold text-base">{product.delivered}</span>
                            </div>
                            <button
                              onClick={(e) => {e.stopPropagation(); !isCompleted && openCalculator(product.id, product.qty);}}
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
                <button onClick={() => setShowCompletionOptionsModal(true)} className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold text-sm">✅ Completa</button>
              )}
            </div>
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
          className="flex flex-col items-center gap-1 px-4 py-2 text-gray-400 hover:text-indigo-600"
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
                    <button
                      onClick={() => {
                        closeModal();
                        openResoModal();
                      }}
                      className="w-full bg-orange-600 text-white py-3 rounded-lg font-semibold hover:bg-orange-700"
                    >
                      🔄 GESTIONE RESI
                    </button>
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
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold"
                >
                  🗑️ Cancella
                </button>
                <button
                  onClick={confirmScaricoWithSignature}
                  className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold"
                >
                  ✓ Conferma e Completa
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
                  setShowPaymentModal(true);
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
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300"
                >
                  Annulla
                </button>
                <button
                  onClick={completeWithPhoto}
                  disabled={!photoData}
                  className={`flex-1 py-3 rounded-lg font-semibold ${
                    photoData
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  ✓ Conferma e Completa
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
              <div className="text-3xl font-bold text-right mb-6 p-4 bg-gray-100 rounded-lg text-gray-900">
                {calcValue}
              </div>

              <div className="grid grid-cols-4 gap-3">
                {['7','8','9','←','4','5','6','C','1','2','3','.','0','00'].map(btn => (
                  <button
                    key={btn}
                    onClick={() => {
                      if (btn === 'C') calcClear();
                      else if (btn === '←') calcBackspace();
                      else if (btn === '.') calcPressDecimal();
                      else calcPress(btn);
                    }}
                    className="h-14 bg-gray-200 hover:bg-gray-300 rounded-lg font-bold text-lg text-gray-900"
                  >
                    {btn}
                  </button>
                ))}
                <button
                  onClick={calcCancel}
                  className="col-span-2 h-14 bg-red-500 text-white rounded-lg font-bold text-lg hover:bg-red-600"
                >
                  ✕ Annulla
                </button>
                <button
                  onClick={calcConfirm}
                  className="col-span-2 h-14 bg-green-600 text-white rounded-lg font-bold text-lg hover:bg-green-700"
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
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={() => setShowPaymentModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl p-6 max-w-md w-full"
            >
              <h2 className="text-xl font-bold mb-4">Pagamento alla Consegna</h2>

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

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setPaymentReceiptPhoto(null);
                    setPaymentNote('');
                    setShowPaymentModal(false);
                  }}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold"
                >
                  Annulla
                </button>
                <button
                  onClick={processPayment}
                  disabled={!paymentReceiptPhoto || !paymentNote.trim()}
                  className={`flex-1 py-3 rounded-lg font-semibold ${
                    paymentReceiptPhoto && paymentNote.trim()
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  💰 Conferma Pagamento
                </button>
              </div>
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

              <div className="space-y-3 mb-4">
                {resoProducts.map(product => (
                  <div key={product.id} className="bg-gray-50 rounded-lg p-4">
                    <div className="font-semibold mb-2">{product.name}</div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Quantità da rendere:</span>
                      <input
                        type="number"
                        min="0"
                        max={product.quantity_done}
                        value={product.reso_qty || 0}
                        onChange={(e) => {
                          const qty = parseInt(e.target.value) || 0;
                          setResoProducts(prev => prev.map(p =>
                            p.id === product.id ? { ...p, reso_qty: Math.min(qty, p.quantity_done) } : p
                          ));
                        }}
                        className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-center"
                      />
                      <span className="text-sm text-gray-500">/ {product.quantity_done}</span>
                    </div>
                  </div>
                ))}
              </div>

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
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold"
                >
                  Annulla
                </button>
                <button
                  onClick={saveReso}
                  className="flex-1 bg-orange-600 text-white py-3 rounded-lg font-semibold"
                >
                  ✓ Conferma Reso
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

      {/* Floating Action Button - Optimize Route */}
      {view === 'list' && deliveries.filter(d => d.state === 'assigned').length > 1 && (
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
