'use client';

import { useState, useEffect, useRef } from 'react';
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

  constructor() {
    super('LapaDeliveryDB');
    this.version(1).stores({
      attachments: '++id, picking_id, context, timestamp, uploaded',
      deliveries: 'id, scheduled_date, state',
      offline_actions: '++id, timestamp, synced'
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

  // Estados scarico
  const [scaricoProducts, setScaricoProducts] = useState<Product[]>([]);
  const [scaricoSearch, setScaricoSearch] = useState('');
  const [scaricoFilterSelected, setScaricoFilterSelected] = useState(false);

  // Estados firma
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
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

  useEffect(() => {
    if (view === 'map') {
      initMap();
    }
  }, [view]);

  // ==================== INITIALIZATION ====================
  async function initializeApp() {
    setLoading(true);
    try {
      const sessionData = await getSession();
      setSession(sessionData);
      await loadDeliveries();
    } catch (err: any) {
      setError(err.message);
      showToast('Errore di inizializzazione', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function getSession() {
    const response = await fetch('/api/auth/current-user');
    if (!response.ok) throw new Error('Sessione non valida');
    return response.json();
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
        (error) => console.error('GPS error:', error),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
      );
    }
  }

  // ==================== API CALLS ====================
  async function loadDeliveries() {
    setLoading(true);
    try {
      const response = await fetch('/api/delivery/list');
      if (!response.ok) throw new Error('Errore caricamento consegne');
      const data = await response.json();

      // Calcola backorder per ogni prodotto
      const processedDeliveries = data.map((d: Delivery) => ({
        ...d,
        move_lines: d.move_lines.map(p => ({
          ...p,
          backorder_qty: p.product_uom_qty - p.quantity_done,
          to_deliver: false
        }))
      }));

      setDeliveries(processedDeliveries);

      // Salva in cache locale
      await db.deliveries.bulkPut(processedDeliveries);

      // Calcola ETA per tutte
      calculateETAsForDeliveries(processedDeliveries);
    } catch (err: any) {
      setError(err.message);
      // Carica da cache se offline
      const cached = await db.deliveries.toArray();
      if (cached.length > 0) {
        setDeliveries(cached);
        showToast('Caricati dati dalla cache', 'info');
      }
    } finally {
      setLoading(false);
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

  function navigateTo(lat?: number, lng?: number) {
    if (!lat || !lng) return;

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);

    let url;
    if (isIOS) {
      url = `maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`;
    } else if (isAndroid) {
      url = `google.navigation:q=${lat},${lng}`;
    } else {
      url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    }

    window.location.href = url;
    setTimeout(() => {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
    }, 1000);
  }

  // ==================== SCARICO LOGIC ====================
  async function openScaricoView(delivery: Delivery) {
    setCurrentDelivery(delivery);

    // Filtra solo prodotti con backorder
    const productsToDeliver = delivery.move_lines.filter(p => (p.backorder_qty || 0) > 0);
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

  function updateScaricoQty(productId: number, qty: number) {
    setScaricoProducts(prev => prev.map(p => {
      if (p.id === productId) {
        const maxQty = p.backorder_qty || 0;
        const newQty = Math.max(0, Math.min(qty, maxQty));
        return { ...p, quantity_done: (p.quantity_done || 0) + newQty };
      }
      return p;
    }));
  }

  function toggleProductSelection(productId: number) {
    setScaricoProducts(prev => prev.map(p =>
      p.id === productId ? { ...p, to_deliver: !p.to_deliver } : p
    ));
  }

  function selectAllProducts() {
    setScaricoProducts(prev => prev.map(p => ({ ...p, to_deliver: true })));
  }

  function deselectAllProducts() {
    setScaricoProducts(prev => prev.map(p => ({ ...p, to_deliver: false })));
  }

  const filteredScaricoProducts = scaricoProducts.filter(p => {
    const matchSearch = !scaricoSearch ||
      p.product_id[1].toLowerCase().includes(scaricoSearch.toLowerCase()) ||
      p.product_code?.toLowerCase().includes(scaricoSearch.toLowerCase());
    const matchFilter = !scaricoFilterSelected || p.to_deliver;
    return matchSearch && matchFilter;
  });

  const scaricoStats = {
    selected: scaricoProducts.filter(p => p.to_deliver).length,
    total: scaricoProducts.length,
    pieces: scaricoProducts.filter(p => p.to_deliver).reduce((sum, p) => sum + (p.backorder_qty || 0), 0)
  };

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
    if (value > calcMaxQty) {
      showToast(`Quantità massima: ${calcMaxQty}`, 'error');
      return;
    }

    updateScaricoQty(calcProductId, value);
    setShowCalculatorModal(false);
    setCalcProductId(null);
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

    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000000';

    let lastX = 0;
    let lastY = 0;

    const startDrawing = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      setIsDrawing(true);

      const rect = canvas.getBoundingClientRect();
      const touch = 'touches' in e ? e.touches[0] : e;

      lastX = touch.clientX - rect.left;
      lastY = touch.clientY - rect.top;

      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
    };

    const draw = (e: MouseEvent | TouchEvent) => {
      if (!isDrawing) return;
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
      if (!isDrawing) return;
      setIsDrawing(false);
      ctx.closePath();
    };

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

    await completeScarico();
    setShowSignatureModal(false);
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
  async function completeScarico() {
    if (!currentDelivery) return;

    const selectedProducts = scaricoProducts.filter(p => p.to_deliver);
    if (selectedProducts.length === 0) {
      showToast('Seleziona almeno un prodotto', 'error');
      return;
    }

    const payload = {
      picking_id: currentDelivery.id,
      products: selectedProducts.map(p => ({
        move_id: p.id,
        quantity_done: p.quantity_done
      }))
    };

    if (isOnline) {
      await validateDeliveryOnServer(payload);
    } else {
      // Salva azione per sync successivo
      await db.offline_actions.add({
        action_type: 'validate',
        payload,
        timestamp: new Date(),
        synced: false
      });
      showToast('Azione salvata per sincronizzazione', 'info');
    }

    // Upload allegati
    await uploadAllAttachments();

    closeScaricoView();
    showToast('Consegna completata!', 'success');
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

  async function processPayment() {
    if (!currentDelivery) return;

    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      showToast('Inserire importo valido', 'error');
      return;
    }

    const payload = {
      picking_id: currentDelivery.id,
      sale_id: currentDelivery.sale_id?.[0],
      amount,
      payment_method: paymentMethod,
      note: paymentNote
    };

    if (isOnline) {
      await processPaymentOnServer(payload);
    } else {
      await db.offline_actions.add({
        action_type: 'payment',
        payload,
        timestamp: new Date(),
        synced: false
      });
      showToast('Pagamento salvato per sincronizzazione', 'info');
    }

    setShowPaymentModal(false);
    showToast('Pagamento registrato', 'success');
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
    const delivered = currentDelivery.move_lines.filter(p => p.quantity_done > 0);
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
      partner_id: currentDelivery.partner_id[0],
      products: productsToReturn.map(p => ({
        product_id: p.product_id[0],
        quantity: p.reso_qty,
        name: p.product_id[1]
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
                  <div className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                    {delivery.sequence || index + 1}
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    delivery.state === 'done' ? 'bg-green-500 text-white' : 'bg-orange-500 text-white'
                  }`}>
                    {delivery.state === 'done' ? 'COMPLETATA' : 'IN CONSEGNA'}
                  </span>
                </div>

                {/* Customer */}
                <div className="font-semibold text-gray-900 mb-2">{delivery.partner_id[1]}</div>

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
                  📦 {delivery.move_lines.length} articoli
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
                      {delivery.move_lines.filter(p => (p.backorder_qty || 0) > 0).length > 0 && (
                        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold">
                          {delivery.move_lines.filter(p => (p.backorder_qty || 0) > 0).length}
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
          <div className="h-full flex flex-col bg-white">
            {/* Scarico Header */}
            <div className="bg-indigo-600 text-white p-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold">Scarico Prodotti</h2>
                <button
                  onClick={closeScaricoView}
                  className="text-white text-2xl"
                >
                  ✕
                </button>
              </div>
              <div className="text-sm opacity-90">{currentDelivery.partner_id[1]}</div>
              <div className="text-sm opacity-75">{currentDelivery.name}</div>
            </div>

            {/* Search & Filters */}
            <div className="p-4 border-b border-gray-200">
              <input
                type="text"
                value={scaricoSearch}
                onChange={(e) => setScaricoSearch(e.target.value)}
                placeholder="🔍 Cerca prodotto..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-2"
              />

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={scaricoFilterSelected}
                    onChange={(e) => setScaricoFilterSelected(e.target.checked)}
                    className="rounded"
                  />
                  Solo da scaricare
                </label>

                <div className="text-sm font-semibold text-gray-700">
                  {scaricoStats.selected} di {scaricoStats.total} selezionati
                </div>
              </div>

              <div className="flex gap-2 mt-2">
                <button
                  onClick={selectAllProducts}
                  className="flex-1 px-3 py-1 bg-green-100 text-green-700 rounded text-sm font-semibold"
                >
                  Seleziona Tutti
                </button>
                <button
                  onClick={deselectAllProducts}
                  className="flex-1 px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm font-semibold"
                >
                  Deseleziona Tutti
                </button>
              </div>
            </div>

            {/* Products List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {filteredScaricoProducts.map(product => (
                <div key={product.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-start gap-3 mb-3">
                    <input
                      type="checkbox"
                      checked={product.to_deliver || false}
                      onChange={() => toggleProductSelection(product.id)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">{product.product_id[1]}</div>
                      {product.product_code && (
                        <div className="text-sm text-gray-500">Codice: {product.product_code}</div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-sm mb-3">
                    <div>
                      <div className="text-gray-500">Ordinata</div>
                      <div className="font-semibold">{product.product_uom_qty}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Consegnata</div>
                      <div className="font-semibold">{product.quantity_done}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Backorder</div>
                      <div className="font-semibold text-orange-600">{product.backorder_qty || 0}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateScaricoQty(product.id, -1)}
                      className="w-10 h-10 bg-red-100 text-red-700 rounded-lg font-bold"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      value={product.quantity_done || 0}
                      onClick={() => openCalculator(product.id, product.backorder_qty || 0)}
                      readOnly
                      className="flex-1 text-center py-2 border border-gray-300 rounded-lg font-semibold"
                    />
                    <button
                      onClick={() => updateScaricoQty(product.id, 1)}
                      className="w-10 h-10 bg-green-100 text-green-700 rounded-lg font-bold"
                    >
                      +
                    </button>
                  </div>

                  <textarea
                    placeholder="Note prodotto..."
                    value={product.note || ''}
                    onChange={(e) => {
                      setScaricoProducts(prev => prev.map(p =>
                        p.id === product.id ? { ...p, note: e.target.value } : p
                      ));
                    }}
                    className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    rows={2}
                  />
                </div>
              ))}
            </div>

            {/* Bottom Actions */}
            <div className="border-t border-gray-200 p-4 bg-white">
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={openSignatureModal}
                  className="bg-indigo-600 text-white py-3 rounded-lg font-semibold text-sm hover:bg-indigo-700"
                >
                  ✍️ Con Firma
                </button>
                <button
                  onClick={() => {
                    setAttachmentContext('photo');
                    photoInputRef.current?.click();
                  }}
                  className="bg-blue-600 text-white py-3 rounded-lg font-semibold text-sm hover:bg-blue-700"
                >
                  📸 Solo Foto
                </button>
                <button
                  onClick={openPaymentModal}
                  className="bg-green-600 text-white py-3 rounded-lg font-semibold text-sm hover:bg-green-700"
                >
                  💰 Pagamento
                </button>
              </div>
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
              className="bg-white w-full md:max-w-2xl md:rounded-t-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="sticky top-0 bg-indigo-600 text-white p-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">{currentDelivery.partner_id[1]}</h2>
                <button onClick={closeModal} className="text-2xl">✕</button>
              </div>

              <div className="p-4 space-y-4">
                {/* Info Cliente */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold mb-2">Informazioni Cliente</h3>
                  <div className="space-y-1 text-sm">
                    <div>📍 {currentDelivery.partner_street}</div>
                    {currentDelivery.partner_city && (
                      <div>{currentDelivery.partner_city} {currentDelivery.partner_zip}</div>
                    )}
                    {currentDelivery.partner_phone && (
                      <a href={`tel:${currentDelivery.partner_phone}`} className="text-blue-600">
                        📞 {currentDelivery.partner_phone}
                      </a>
                    )}
                  </div>
                </div>

                {/* Info Ordine */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold mb-2">Informazioni Ordine</h3>
                  <div className="space-y-1 text-sm">
                    <div>Picking: {currentDelivery.name}</div>
                    {currentDelivery.origin && <div>Ordine: {currentDelivery.origin}</div>}
                    {currentDelivery.amount_total && (
                      <div className="text-lg font-bold">Totale: € {currentDelivery.amount_total.toFixed(2)}</div>
                    )}
                  </div>
                </div>

                {/* Prodotti */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold mb-2">Prodotti ({currentDelivery.move_lines.length})</h3>
                  <div className="space-y-2">
                    {currentDelivery.move_lines.map(product => (
                      <div key={product.id} className="text-sm flex justify-between">
                        <span>{product.product_id[1]}</span>
                        <span className="font-semibold">x{product.product_uom_qty}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Allegati */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => openAttachmentModal('signature')}
                    className="bg-indigo-100 text-indigo-700 py-3 rounded-lg font-semibold text-sm relative"
                  >
                    ✍️ Firme ({attachmentCounts.signature || 0})
                  </button>
                  <button
                    onClick={() => openAttachmentModal('photo')}
                    className="bg-blue-100 text-blue-700 py-3 rounded-lg font-semibold text-sm relative"
                  >
                    📸 Foto ({attachmentCounts.photo || 0})
                  </button>
                </div>

                {/* Azioni */}
                <div className="space-y-2">
                  <button
                    onClick={() => navigateTo(currentDelivery.latitude, currentDelivery.longitude)}
                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold"
                  >
                    🗺️ NAVIGA
                  </button>
                  <button
                    onClick={() => openScaricoView(currentDelivery)}
                    className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold"
                  >
                    📦 APRI SCARICO
                  </button>
                  {currentDelivery.state !== 'done' && (
                    <button
                      onClick={openResoModal}
                      className="w-full bg-orange-600 text-white py-3 rounded-lg font-semibold"
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
              <div className="text-3xl font-bold text-right mb-6 p-4 bg-gray-100 rounded-lg">
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
                    className="h-14 bg-gray-200 hover:bg-gray-300 rounded-lg font-bold text-lg"
                  >
                    {btn}
                  </button>
                ))}
                <button
                  onClick={calcConfirm}
                  className="col-span-2 h-14 bg-green-600 text-white rounded-lg font-bold text-lg"
                >
                  ✓ OK
                </button>
              </div>

              <div className="text-sm text-gray-500 mt-3 text-center">
                Max: {calcMaxQty}
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
                <label className="block text-sm font-semibold mb-2">Note (opzionale)</label>
                <textarea
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  rows={3}
                  placeholder="Note pagamento..."
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold"
                >
                  Annulla
                </button>
                <button
                  onClick={processPayment}
                  className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold"
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
                    <div className="font-semibold mb-2">{product.product_id[1]}</div>
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
