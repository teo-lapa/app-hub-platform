'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DollarSign, ArrowLeft, TrendingUp, TrendingDown, Lock, CheckCircle, SkipForward, X, Search, AlertCircle, ThumbsUp, ThumbsDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { AppHeader } from '@/components/layout/AppHeader';
import { PriceCheckProductCard } from '@/components/controllo-prezzi/PriceCheckProductCard';
import { PriceCategoryFilterBar } from '@/components/controllo-prezzi/PriceCategoryFilterBar';
import { PriceCheckProduct } from '@/lib/types/price-check';
import toast from 'react-hot-toast';

// Block Request interface (matches API response)
interface BlockRequest {
  activityId: number;
  state: 'overdue' | 'today' | 'planned';
  dueDate: string;
  assignedTo: string;
  proposedPrice: number;
  sellerNotes: string;
  productId: number;
  productName: string;
  productCode: string;
  orderId: number;
  orderName: string;
  customerId: number;
  customerName: string;
  costPrice: number;
  avgSellingPrice: number;
  criticalPrice: number;
  marginPercent: number;
}

export default function ControlloPrezziPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  // Controllo accesso: SOLO Admin
  useEffect(() => {
    if (user) {
      // Accetta solo utenti con ruolo admin
      if (user.role !== 'admin') {
        toast.error('Accesso negato: questa app è disponibile solo per amministratori');
        router.push('/');
      }
    }
  }, [user, router]);

  // Stati principali
  const [currentView, setCurrentView] = useState<'filter' | 'products'>('filter');
  const [selectedCategory, setSelectedCategory] = useState<'below_critical' | 'critical_to_avg' | 'above_avg' | 'blocked' | 'all' | null>(null);
  const [products, setProducts] = useState<PriceCheckProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<PriceCheckProduct | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedPrice, setEditedPrice] = useState<number>(0);
  const [editedDiscount, setEditedDiscount] = useState<number>(0);
  const [isSavingPrice, setIsSavingPrice] = useState(false);

  // Block requests state
  const [blockRequests, setBlockRequests] = useState<BlockRequest[]>([]);
  const [loadingBlockRequests, setLoadingBlockRequests] = useState(false);
  const [selectedBlockRequest, setSelectedBlockRequest] = useState<BlockRequest | null>(null);

  // Conteggi
  const [categoryCounts, setCategoryCounts] = useState({
    below_critical: 0,
    critical_to_avg: 0,
    above_avg: 0,
    blocked: 0,
    all: 0,
  });

  // Stati UI
  const [loading, setLoading] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showBlockRequestModal, setShowBlockRequestModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Carica conteggi per categoria
  const loadCounts = async () => {
    try {
      const response = await fetch('/api/controllo-prezzi/counts', {
        credentials: 'include',
      });

      const data = await response.json();
      if (data.success) {
        setCategoryCounts(data.counts.byCategory);
      }
    } catch (error) {
      console.error('Errore caricamento conteggi:', error);
      toast.error('Errore caricamento conteggi');
    }
  };

  // Carica conteggi all'avvio
  useEffect(() => {
    loadCounts();
  }, []);

  // Fetch block requests
  const loadBlockRequests = async () => {
    setLoadingBlockRequests(true);
    try {
      const response = await fetch('/api/controllo-prezzi/block-requests', {
        credentials: 'include',
      });

      const data = await response.json();
      if (data.success) {
        setBlockRequests(data.requests || []);
        toast.success(`RICHIESTE BLOCCO: ${data.requests?.length || 0} richieste`);
      } else {
        toast.error(data.error || 'Errore caricamento richieste blocco');
      }
    } catch (error: any) {
      toast.error('Errore: ' + error.message);
    } finally {
      setLoadingBlockRequests(false);
    }
  };

  // Seleziona categoria e mostra prodotti/richieste
  const handleSelectCategory = async (category: 'below_critical' | 'critical_to_avg' | 'above_avg' | 'blocked' | 'all') => {
    setSelectedCategory(category);
    setCurrentView('products');

    // If category is 'blocked', load block requests instead of products
    if (category === 'blocked') {
      await loadBlockRequests();
    } else {
      setLoading(true);
      try {
        const response = await fetch(`/api/controllo-prezzi/products?category=${category}&days=28`, {
          credentials: 'include',
        });

        const data = await response.json();
        if (data.success) {
          setProducts(data.products || []);
          const categoryLabels = {
            all: 'TUTTI I PREZZI',
            below_critical: 'SOTTO PUNTO CRITICO',
            critical_to_avg: 'TRA PC E MEDIO',
            above_avg: 'SOPRA MEDIO',
            blocked: 'RICHIESTE BLOCCO',
          };
          toast.success(`${categoryLabels[category]}: ${data.products?.length || 0} prodotti`);
        } else {
          toast.error(data.error || 'Errore caricamento prodotti');
        }
      } catch (error: any) {
        toast.error('Errore: ' + error.message);
      } finally {
        setLoading(false);
      }
    }
  };

  // Prodotti filtrati per ricerca
  const filteredProducts = products.filter(p => {
    if (!searchQuery || searchQuery.length < 3) return true;
    const query = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(query) ||
      p.code?.toLowerCase().includes(query) ||
      p.customerName?.toLowerCase().includes(query) ||
      p.orderName?.toLowerCase().includes(query)
    );
  });

  // Raggruppa prodotti per settimana e giorno
  const groupProductsByWeekAndDay = (products: PriceCheckProduct[]) => {
    const today = new Date();
    const weeks: {
      weekNumber: number;
      weekLabel: string;
      days: {
        date: string;
        dayLabel: string;
        products: PriceCheckProduct[];
      }[];
    }[] = [];

    // Raggruppa per data
    const productsByDate = new Map<string, PriceCheckProduct[]>();

    products.forEach(p => {
      const date = p.orderDate || today.toISOString().split('T')[0];
      if (!productsByDate.has(date)) {
        productsByDate.set(date, []);
      }
      productsByDate.get(date)!.push(p);
    });

    // Crea settimane (ultime 4)
    for (let weekOffset = 0; weekOffset < 4; weekOffset++) {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - (today.getDay() || 7) + 1 - (weekOffset * 7)); // Lunedì

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6); // Domenica

      const weekNumber = getWeekNumber(weekStart);
      const weekLabel = `Settimana ${weekNumber} (${formatDate(weekStart, 'short')} - ${formatDate(weekEnd, 'short')})`;

      const days: {
        date: string;
        dayLabel: string;
        products: PriceCheckProduct[];
      }[] = [];

      // Crea giorni della settimana
      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const currentDay = new Date(weekStart);
        currentDay.setDate(weekStart.getDate() + dayOffset);

        const dateStr = currentDay.toISOString().split('T')[0];
        const dayProducts = productsByDate.get(dateStr) || [];

        if (dayProducts.length > 0) {
          days.push({
            date: dateStr,
            dayLabel: formatDate(currentDay, 'full'),
            products: dayProducts
          });
        }
      }

      if (days.length > 0) {
        weeks.push({
          weekNumber,
          weekLabel,
          days
        });
      }
    }

    return weeks;
  };

  // Ottieni numero settimana
  const getWeekNumber = (date: Date): number => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  };

  // Formatta data
  const formatDate = (date: Date, format: 'short' | 'full'): string => {
    const days = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
    const months = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

    if (format === 'short') {
      return `${date.getDate()} ${months[date.getMonth()]}`;
    } else {
      return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
    }
  };

  const groupedProducts = groupProductsByWeekAndDay(filteredProducts);

  // Estrae solo il nome breve del prodotto (prima della descrizione)
  const extractShortName = (fullName: string): string => {
    const lines = fullName.split('\n');
    const firstLine = lines[0];
    const beforeMarkdown = firstLine.split('**')[0].trim();
    return beforeMarkdown || firstLine.trim();
  };

  // Block requests filtrati per ricerca
  const filteredBlockRequests = blockRequests.filter(br => {
    if (!searchQuery || searchQuery.length < 3) return true;
    const query = searchQuery.toLowerCase();
    return (
      br.productName.toLowerCase().includes(query) ||
      br.productCode?.toLowerCase().includes(query) ||
      br.customerName?.toLowerCase().includes(query) ||
      br.orderName?.toLowerCase().includes(query) ||
      br.sellerNotes?.toLowerCase().includes(query)
    );
  });

  // Click su card prodotto
  const handleProductClick = (product: PriceCheckProduct) => {
    setSelectedProduct(product);
    setEditedPrice(product.soldPrice);
    setEditedDiscount(product.discount);
    setIsEditMode(false);
    setShowProductModal(true);
  };

  // Abilita modifica prezzo
  const handleEnableEdit = () => {
    if (selectedProduct) {
      setEditedPrice(selectedProduct.soldPrice);
      setEditedDiscount(selectedProduct.discount);
      setIsEditMode(true);
    }
  };

  // Annulla modifica
  const handleCancelEdit = () => {
    setIsEditMode(false);
    if (selectedProduct) {
      setEditedPrice(selectedProduct.soldPrice);
      setEditedDiscount(selectedProduct.discount);
    }
  };

  // Salva modifiche prezzo
  const handleSavePrice = async () => {
    if (!selectedProduct) return;

    setIsSavingPrice(true);
    try {
      // Trova il lineId dal prodotto
      // Assumiamo che il prodotto abbia un lineId dalla API
      const lineId = (selectedProduct as any).lineId;

      if (!lineId) {
        toast.error('Errore: ID riga ordine non trovato');
        return;
      }

      const response = await fetch('/api/controllo-prezzi/update-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          orderLineId: lineId,
          newPrice: editedPrice,
          newDiscount: editedDiscount
        })
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Prezzo aggiornato con successo!');
        setIsEditMode(false);

        // Aggiorna il prodotto nella lista locale
        setProducts(prev =>
          prev.map(p => {
            if (p.id === selectedProduct.id && p.orderId === selectedProduct.orderId) {
              return {
                ...p,
                soldPrice: editedPrice,
                discount: editedDiscount
              };
            }
            return p;
          })
        );

        // Aggiorna anche il prodotto selezionato
        setSelectedProduct({
          ...selectedProduct,
          soldPrice: editedPrice,
          discount: editedDiscount
        });
      } else {
        toast.error(data.error || 'Errore aggiornamento prezzo');
      }
    } catch (error: any) {
      toast.error('Errore: ' + error.message);
    } finally {
      setIsSavingPrice(false);
    }
  };

  // Click su card richiesta blocco
  const handleBlockRequestClick = (blockRequest: BlockRequest) => {
    setSelectedBlockRequest(blockRequest);
    setShowBlockRequestModal(true);
  };

  // Approve block request
  const handleApproveBlock = async () => {
    if (!selectedBlockRequest) return;

    try {
      const response = await fetch('/api/controllo-prezzi/approve-block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          activityId: selectedBlockRequest.activityId,
          feedback: 'Prezzo bloccato approvato dal supervisore',
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Richiesta blocco prezzo approvata');
        setShowBlockRequestModal(false);
        // Rimuovi dalla lista
        setBlockRequests(prev => prev.filter(br => br.activityId !== selectedBlockRequest.activityId));
        // Reload counts
        loadCounts();
      } else {
        toast.error(data.error || 'Errore durante approvazione');
      }
    } catch (error: any) {
      toast.error('Errore: ' + error.message);
    }
  };

  // Reject block request
  const handleRejectBlock = async () => {
    if (!selectedBlockRequest) return;

    const reason = prompt('Inserisci il motivo del rifiuto:');
    if (!reason || reason.trim() === '') {
      toast.error('Motivo del rifiuto obbligatorio');
      return;
    }

    try {
      const response = await fetch('/api/controllo-prezzi/reject-block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          activityId: selectedBlockRequest.activityId,
          reason: reason.trim(),
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Richiesta blocco prezzo rifiutata');
        setShowBlockRequestModal(false);
        // Rimuovi dalla lista
        setBlockRequests(prev => prev.filter(br => br.activityId !== selectedBlockRequest.activityId));
        // Reload counts
        loadCounts();
      } else {
        toast.error(data.error || 'Errore durante rifiuto');
      }
    } catch (error: any) {
      toast.error('Errore: ' + error.message);
    }
  };

  // Marca come controllato
  const handleMarkAsReviewed = async () => {
    if (!selectedProduct) return;

    try {
      const response = await fetch('/api/controllo-prezzi/mark-reviewed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          productId: selectedProduct.id,
          orderId: selectedProduct.orderId,
          reviewedBy: user?.email || 'unknown',
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Prezzo marcato come controllato');
        setShowProductModal(false);
        // Rimuovi da lista
        setProducts(prev => prev.filter(p => p.id !== selectedProduct.id || p.orderId !== selectedProduct.orderId));
      } else {
        toast.error(data.error || 'Errore durante verifica');
      }
    } catch (error: any) {
      toast.error('Errore: ' + error.message);
    }
  };

  // Blocca prezzo
  const handleBlockPrice = async () => {
    if (!selectedProduct) return;

    try {
      const response = await fetch('/api/controllo-prezzi/block-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          productId: selectedProduct.id,
          orderId: selectedProduct.orderId,
          blockedBy: user?.email || 'unknown',
          note: 'Prezzo bloccato da supervisore',
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Prezzo bloccato - non apparira piu nella lista');
        setShowProductModal(false);
        // Rimuovi da lista
        setProducts(prev => prev.filter(p => p.id !== selectedProduct.id || p.orderId !== selectedProduct.orderId));
      } else {
        toast.error(data.error || 'Errore durante blocco');
      }
    } catch (error: any) {
      toast.error('Errore: ' + error.message);
    }
  };

  // Riporta a "Da Controllare"
  const handleMarkAsPending = async () => {
    if (!selectedProduct) return;

    try {
      const response = await fetch('/api/controllo-prezzi/mark-pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          productId: selectedProduct.id,
          orderId: selectedProduct.orderId,
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Prezzo riportato a "Da Controllare"');
        setShowProductModal(false);
        // Aggiorna stato in lista
        setProducts(prev =>
          prev.map(p =>
            p.id === selectedProduct.id && p.orderId === selectedProduct.orderId
              ? { ...p, status: 'pending' as const }
              : p
          )
        );
      } else {
        toast.error(data.error || 'Errore durante operazione');
      }
    } catch (error: any) {
      toast.error('Errore: ' + error.message);
    }
  };

  // Torna indietro
  const handleBack = () => {
    if (currentView === 'products') {
      setCurrentView('filter');
      setSelectedCategory(null);
      setProducts([]);
      setBlockRequests([]);
      loadCounts(); // Ricarica conteggi aggiornati
    } else {
      router.back();
    }
  };

  const getCategoryLabel = () => {
    if (!selectedCategory) return '';
    const labels = {
      all: 'TUTTI I PREZZI',
      below_critical: 'SOTTO PUNTO CRITICO',
      critical_to_avg: 'TRA PC E MEDIO',
      above_avg: 'SOPRA MEDIO',
      blocked: 'RICHIESTE BLOCCO',
    };
    return labels[selectedCategory];
  };

  // Calcola posizione marker su slider
  const getPriceSliderPosition = (product: PriceCheckProduct | { soldPrice?: number; costPrice: number; criticalPrice: number; avgSellingPrice: number; proposedPrice?: number }): { value: number; critical: number; avg: number; min: number; max: number } => {
    const costPrice = product.costPrice;
    const criticalPrice = product.criticalPrice;
    const avgSellingPrice = product.avgSellingPrice;
    const value = 'soldPrice' in product ? (product.soldPrice || 0) : (product.proposedPrice || 0);

    const min = costPrice * 1.05; // +5% margine minimo
    const max = avgSellingPrice > 0 ? avgSellingPrice * 2.5 : costPrice * 4.2;

    return {
      value,
      critical: criticalPrice,
      avg: avgSellingPrice,
      min,
      max
    };
  };

  // Get state badge class for block requests
  const getBlockRequestStateBadgeClass = (state: 'overdue' | 'today' | 'planned'): string => {
    switch (state) {
      case 'overdue':
        return 'bg-red-500/20 text-red-400 border border-red-500';
      case 'today':
        return 'bg-orange-500/20 text-orange-400 border border-orange-500';
      case 'planned':
        return 'bg-blue-500/20 text-blue-400 border border-blue-500';
      default:
        return 'bg-slate-500/20 text-slate-400 border border-slate-500';
    }
  };

  // Format state badge for block requests
  const formatBlockRequestStateBadge = (state: 'overdue' | 'today' | 'planned'): string => {
    switch (state) {
      case 'overdue':
        return 'SCADUTO';
      case 'today':
        return 'OGGI';
      case 'planned':
        return 'PIANIFICATO';
      default:
        return 'SCONOSCIUTO';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <AppHeader
        title="Controllo Prezzi"
        onBack={handleBack}
        showBackButton={currentView !== 'filter'}
      />

      <main className="container mx-auto p-4 max-w-7xl">
        {/* Vista: Selezione Categoria */}
        {currentView === 'filter' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            <div className="text-center mb-8">
              <h1 className="text-3xl sm:text-4xl font-bold mb-2">
                Controllo Prezzi
              </h1>
              <p className="text-slate-400">
                Monitora i prezzi di vendita rispetto al Punto Critico e alla Media
              </p>
            </div>

            <PriceCategoryFilterBar
              counts={categoryCounts}
              onSelect={handleSelectCategory}
            />
          </motion.div>
        )}

        {/* Vista: Lista Prodotti o Richieste Blocco */}
        {currentView === 'products' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            {/* Header con filtri */}
            <div className="glass p-4 rounded-xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold">{getCategoryLabel()}</h2>
                  <p className="text-sm text-slate-400">
                    {selectedCategory === 'blocked'
                      ? `${filteredBlockRequests.length} richieste`
                      : `${filteredProducts.length} prodotti`}
                    {searchQuery.length >= 3 && ` • Ricerca: "${searchQuery}"`}
                  </p>
                </div>

                {/* Badge totale */}
                <div className="px-4 py-2 bg-blue-500/20 rounded-full border border-blue-500">
                  <span className="font-bold text-blue-400">
                    {selectedCategory === 'blocked' ? filteredBlockRequests.length : filteredProducts.length}
                  </span>
                </div>
              </div>

              {/* Barra di ricerca veloce */}
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cerca prodotto o cliente (min 3 caratteri)..."
                    className="w-full pl-10 pr-10 py-3 glass rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 min-w-[48px] min-h-[48px] p-3 rounded-full glass-strong flex items-center justify-center hover:bg-red-500/20"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {searchQuery.length > 0 && searchQuery.length < 3 && (
                  <p className="text-xs text-orange-400 mt-1 ml-1">
                    Inserisci almeno 3 caratteri per cercare
                  </p>
                )}
              </div>
            </div>

            {/* Griglia prodotti o richieste blocco */}
            {selectedCategory === 'blocked' ? (
              // Block Requests Grid
              loadingBlockRequests ? (
                <div className="flex items-center justify-center py-20">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
                </div>
              ) : filteredBlockRequests.length === 0 ? (
                <div className="glass p-12 rounded-xl text-center">
                  <div className="text-6xl mb-4">🔓</div>
                  <h3 className="text-xl font-bold mb-2">Nessuna richiesta di blocco</h3>
                  <p className="text-slate-400">
                    Ottimo! Nessuna richiesta in attesa
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-3">
                  {filteredBlockRequests.map((blockRequest) => (
                    <BlockRequestCard
                      key={blockRequest.activityId}
                      blockRequest={blockRequest}
                      onClick={() => handleBlockRequestClick(blockRequest)}
                    />
                  ))}
                </div>
              )
            ) : (
              // Products Grid
              loading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="glass p-12 rounded-xl text-center">
                  <div className="text-6xl mb-4">📦</div>
                  <h3 className="text-xl font-bold mb-2">Nessun prodotto trovato</h3>
                  <p className="text-slate-400">
                    Ottimo! Nessun prodotto in questa categoria
                  </p>
                </div>
              ) : selectedCategory === 'below_critical' ? (
                // Vista raggruppata per settimana/giorno (solo per below_critical)
                <div className="space-y-6">
                  {groupedProducts.map((week, weekIndex) => (
                    <motion.div
                      key={`week-${week.weekNumber}`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: weekIndex * 0.1 }}
                      className="glass p-6 rounded-xl"
                    >
                      {/* Header Settimana */}
                      <h3 className="text-2xl font-bold mb-4 flex items-center gap-3">
                        <span className="text-blue-400">📅</span>
                        {week.weekLabel}
                        <span className="ml-auto text-sm font-normal text-slate-400">
                          {week.days.reduce((sum, day) => sum + day.products.length, 0)} prodotti
                        </span>
                      </h3>

                      {/* Giorni */}
                      <div className="space-y-4">
                        {week.days.map((day, dayIndex) => (
                          <div key={`day-${day.date}`} className="glass-strong p-4 rounded-lg">
                            {/* Header Giorno */}
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-lg font-semibold text-slate-200">
                                {day.dayLabel}
                              </h4>
                              <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm font-bold">
                                {day.products.length} {day.products.length === 1 ? 'prodotto' : 'prodotti'}
                              </span>
                            </div>

                            {/* Griglia prodotti del giorno */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-3">
                              {day.products.map((product) => (
                                <PriceCheckProductCard
                                  key={`${product.id}-${product.orderId}`}
                                  product={product}
                                  onClick={() => handleProductClick(product)}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  ))}

                  {groupedProducts.length === 0 && (
                    <div className="glass p-12 rounded-xl text-center">
                      <div className="text-6xl mb-4">✅</div>
                      <h3 className="text-xl font-bold mb-2">Nessun prodotto sotto punto critico</h3>
                      <p className="text-slate-400">
                        Ottimo! Nessun prodotto nelle ultime 4 settimane
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                // Vista normale griglia (altre categorie)
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-3">
                  {filteredProducts.map((product) => (
                    <PriceCheckProductCard
                      key={`${product.id}-${product.orderId}`}
                      product={product}
                      onClick={() => handleProductClick(product)}
                    />
                  ))}
                </div>
              )
            )}
          </motion.div>
        )}
      </main>

      {/* Modal Dettaglio Prodotto */}
      <AnimatePresence>
        {showProductModal && selectedProduct && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowProductModal(false)}
          >
            <motion.div
              className="glass-strong rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={() => setShowProductModal(false)}
                className="absolute top-4 right-4 min-w-[48px] min-h-[48px] rounded-full glass-strong flex items-center justify-center hover:bg-red-500/20"
              >
                ✕
              </button>

              {/* Nome prodotto */}
              <h2 className="text-2xl font-bold text-center mb-6">{extractShortName(selectedProduct.name)}</h2>

              {/* Info card */}
              <div className="glass p-4 rounded-lg space-y-3 mb-6">
                {/* Prezzo venduto */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Prezzo Venduto:</span>
                  {isEditMode ? (
                    <input
                      type="number"
                      step="0.01"
                      value={editedPrice}
                      onChange={(e) => setEditedPrice(parseFloat(e.target.value) || 0)}
                      className="px-3 py-2 bg-slate-700 rounded-lg text-blue-400 font-bold text-xl w-32 text-right"
                    />
                  ) : (
                    <span className="font-bold text-2xl text-blue-400">
                      CHF {selectedProduct.soldPrice.toFixed(2)}
                    </span>
                  )}
                </div>

                {/* Sconto */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Sconto:</span>
                  {isEditMode ? (
                    <input
                      type="number"
                      step="0.1"
                      value={editedDiscount}
                      onChange={(e) => setEditedDiscount(parseFloat(e.target.value) || 0)}
                      className="px-3 py-2 bg-slate-700 rounded-lg text-orange-400 font-bold w-24 text-right"
                    />
                  ) : (
                    <span className="font-bold text-orange-400">
                      {selectedProduct.discount > 0 ? `-${selectedProduct.discount.toFixed(1)}%` : '0%'}
                    </span>
                  )}
                </div>

                {/* Cliente e Ordine */}
                <div className="pt-2 border-t border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-400">Cliente:</span>
                    <span className="font-semibold">{selectedProduct.customerName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Ordine:</span>
                    <span className="font-semibold">{selectedProduct.orderName}</span>
                  </div>
                </div>

                {/* Nota venditore */}
                {selectedProduct.note && (
                  <div className="pt-2 border-t border-slate-700">
                    <span className="text-slate-400 text-sm">Nota Venditore:</span>
                    <p className="text-yellow-400 mt-1">{selectedProduct.note}</p>
                  </div>
                )}
              </div>

              {/* Slider Prezzi */}
              <div className="glass p-4 rounded-lg mb-6">
                <h3 className="font-bold mb-3">Analisi Prezzi</h3>

                {/* Prezzi di riferimento */}
                <div className="grid grid-cols-3 gap-3 mb-4 text-xs">
                  <div className="text-center">
                    <div className="text-slate-400">Punto Critico</div>
                    <div className="font-bold text-yellow-400">
                      CHF {selectedProduct.criticalPrice.toFixed(2)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-slate-400">Medio</div>
                    <div className="font-bold text-blue-400">
                      CHF {selectedProduct.avgSellingPrice.toFixed(2)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-slate-400">Costo</div>
                    <div className="font-bold text-red-400">
                      CHF {selectedProduct.costPrice.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Slider visuale */}
                <div className="relative h-12 bg-slate-700/50 rounded-lg overflow-hidden">
                  {(() => {
                    const { value, critical, avg, min, max } = getPriceSliderPosition(selectedProduct);
                    const criticalPos = ((critical - min) / (max - min)) * 100;
                    const avgPos = ((avg - min) / (max - min)) * 100;
                    const valuePos = ((value - min) / (max - min)) * 100;

                    return (
                      <>
                        {/* Gradiente di sfondo */}
                        <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 to-blue-500 opacity-30" />

                        {/* Marker Punto Critico */}
                        <div
                          className="absolute top-0 bottom-0 w-1 bg-yellow-500"
                          style={{ left: `${criticalPos}%` }}
                        >
                          <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs text-yellow-400 font-bold whitespace-nowrap">
                            PC
                          </div>
                        </div>

                        {/* Marker Medio */}
                        {avg > 0 && (
                          <div
                            className="absolute top-0 bottom-0 w-1 bg-blue-500"
                            style={{ left: `${avgPos}%` }}
                          >
                            <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs text-blue-400 font-bold whitespace-nowrap">
                              Medio
                            </div>
                          </div>
                        )}

                        {/* Marker Prezzo Venduto */}
                        <div
                          className="absolute top-0 bottom-0 w-2 bg-white shadow-lg"
                          style={{ left: `${valuePos}%` }}
                        >
                          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full border-2 border-blue-500" />
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Azioni */}
              <div className="space-y-3">
                <h3 className="font-bold text-lg mb-3">Azioni Disponibili</h3>

                {/* Pulsanti Edit/Save/Cancel */}
                {!isEditMode ? (
                  <button
                    onClick={handleEnableEdit}
                    className="w-full glass-strong p-4 rounded-lg hover:bg-blue-500/20 transition-all
                             flex items-center justify-between group border-2 border-blue-500/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                        ✏️
                      </div>
                      <div className="text-left">
                        <div className="font-semibold">Modifica Prezzo</div>
                        <div className="text-xs text-slate-400">Cambia prezzo e sconto</div>
                      </div>
                    </div>
                    <ArrowLeft className="w-5 h-5 rotate-180 text-slate-400 group-hover:translate-x-1 transition-transform" />
                  </button>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={handleSavePrice}
                      disabled={isSavingPrice}
                      className="glass-strong p-4 rounded-lg bg-green-500/20 hover:bg-green-500/30 transition-all
                               flex items-center justify-center gap-2 border-2 border-green-500/50 disabled:opacity-50"
                    >
                      {isSavingPrice ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-5 h-5" />
                          Salva
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      disabled={isSavingPrice}
                      className="glass-strong p-4 rounded-lg hover:bg-red-500/20 transition-all
                               flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <span className="text-xl">✕</span>
                      Annulla
                    </button>
                  </div>
                )}

                {/* Marca come controllato */}
                <button
                  onClick={handleMarkAsReviewed}
                  className="w-full glass-strong p-4 rounded-lg hover:bg-green-500/20 transition-all
                           flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold">Marca come Controllato</div>
                      <div className="text-xs text-slate-400">Prezzo verificato e approvato</div>
                    </div>
                  </div>
                  <ArrowLeft className="w-5 h-5 rotate-180 text-slate-400 group-hover:translate-x-1 transition-transform" />
                </button>

                {/* Blocca prezzo */}
                <button
                  onClick={handleBlockPrice}
                  className="w-full glass-strong p-4 rounded-lg hover:bg-red-500/20 transition-all
                           flex items-center justify-between group border-2 border-red-500/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                      <Lock className="w-5 h-5 text-red-400" />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-red-400">Blocca Prezzo</div>
                      <div className="text-xs text-slate-400">Blocca e rimuovi dalla lista</div>
                    </div>
                  </div>
                  <ArrowLeft className="w-5 h-5 rotate-180 text-red-400 group-hover:translate-x-1 transition-transform" />
                </button>

                {/* Riporta a "Da Controllare" */}
                <button
                  onClick={handleMarkAsPending}
                  className="w-full glass-strong p-4 rounded-lg hover:bg-yellow-500/20 transition-all
                           flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                      <SkipForward className="w-5 h-5 text-yellow-400" />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-yellow-400">Da Controllare</div>
                      <div className="text-xs text-slate-400">Riporta in stato pending</div>
                    </div>
                  </div>
                  <ArrowLeft className="w-5 h-5 rotate-180 text-yellow-400 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Dettaglio Richiesta Blocco */}
      <AnimatePresence>
        {showBlockRequestModal && selectedBlockRequest && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowBlockRequestModal(false)}
          >
            <motion.div
              className="glass-strong rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={() => setShowBlockRequestModal(false)}
                className="absolute top-4 right-4 min-w-[48px] min-h-[48px] rounded-full glass-strong flex items-center justify-center hover:bg-red-500/20"
              >
                ✕
              </button>

              {/* Header con badge stato */}
              <div className="text-center mb-6">
                <div className={`inline-block text-xs font-bold px-4 py-2 rounded-full mb-3 ${getBlockRequestStateBadgeClass(selectedBlockRequest.state)}`}>
                  {formatBlockRequestStateBadge(selectedBlockRequest.state)}
                </div>
                <h2 className="text-2xl font-bold mb-1">{extractShortName(selectedBlockRequest.productName)}</h2>
                <p className="text-slate-400">COD: {selectedBlockRequest.productCode}</p>
              </div>

              {/* Info card */}
              <div className="glass p-4 rounded-lg space-y-3 mb-6">
                {/* Prezzo proposto */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Prezzo Proposto:</span>
                  <span className="font-bold text-2xl text-blue-400">
                    CHF {selectedBlockRequest.proposedPrice.toFixed(2)}
                  </span>
                </div>

                {/* Margine */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Margine:</span>
                  <span className={`font-bold ${selectedBlockRequest.marginPercent < 40 ? 'text-red-400' : 'text-green-400'}`}>
                    {selectedBlockRequest.marginPercent.toFixed(1)}%
                  </span>
                </div>

                {/* Cliente e Ordine */}
                <div className="pt-2 border-t border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-400">Cliente:</span>
                    <span className="font-semibold">{selectedBlockRequest.customerName}</span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-400">Ordine:</span>
                    <span className="font-semibold">{selectedBlockRequest.orderName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Scadenza:</span>
                    <span className="font-semibold">{new Date(selectedBlockRequest.dueDate).toLocaleDateString('it-IT')}</span>
                  </div>
                </div>

                {/* Note venditore */}
                {selectedBlockRequest.sellerNotes && (
                  <div className="pt-2 border-t border-slate-700">
                    <span className="text-slate-400 text-sm">Note Venditore:</span>
                    <p className="text-yellow-400 mt-1">{selectedBlockRequest.sellerNotes}</p>
                  </div>
                )}
              </div>

              {/* Slider Prezzi */}
              <div className="glass p-4 rounded-lg mb-6">
                <h3 className="font-bold mb-3">Analisi Prezzi</h3>

                {/* Prezzi di riferimento */}
                <div className="grid grid-cols-3 gap-3 mb-4 text-xs">
                  <div className="text-center">
                    <div className="text-slate-400">Punto Critico</div>
                    <div className="font-bold text-yellow-400">
                      CHF {selectedBlockRequest.criticalPrice.toFixed(2)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-slate-400">Medio</div>
                    <div className="font-bold text-blue-400">
                      CHF {selectedBlockRequest.avgSellingPrice.toFixed(2)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-slate-400">Costo</div>
                    <div className="font-bold text-red-400">
                      CHF {selectedBlockRequest.costPrice.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Slider visuale */}
                <div className="relative h-12 bg-slate-700/50 rounded-lg overflow-hidden">
                  {(() => {
                    const { value, critical, avg, min, max } = getPriceSliderPosition(selectedBlockRequest);
                    const criticalPos = ((critical - min) / (max - min)) * 100;
                    const avgPos = ((avg - min) / (max - min)) * 100;
                    const valuePos = ((value - min) / (max - min)) * 100;

                    return (
                      <>
                        {/* Gradiente di sfondo */}
                        <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 to-blue-500 opacity-30" />

                        {/* Marker Punto Critico */}
                        <div
                          className="absolute top-0 bottom-0 w-1 bg-yellow-500"
                          style={{ left: `${criticalPos}%` }}
                        >
                          <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs text-yellow-400 font-bold whitespace-nowrap">
                            PC
                          </div>
                        </div>

                        {/* Marker Medio */}
                        {avg > 0 && (
                          <div
                            className="absolute top-0 bottom-0 w-1 bg-blue-500"
                            style={{ left: `${avgPos}%` }}
                          >
                            <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs text-blue-400 font-bold whitespace-nowrap">
                              Medio
                            </div>
                          </div>
                        )}

                        {/* Marker Prezzo Proposto */}
                        <div
                          className="absolute top-0 bottom-0 w-2 bg-white shadow-lg"
                          style={{ left: `${valuePos}%` }}
                        >
                          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full border-2 border-blue-500" />
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Azioni */}
              <div className="space-y-3">
                <h3 className="font-bold text-lg mb-3">Azioni Disponibili</h3>

                {/* Approva */}
                <button
                  onClick={handleApproveBlock}
                  className="w-full glass-strong p-4 rounded-lg hover:bg-green-500/20 transition-all
                           flex items-center justify-between group border-2 border-green-500/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                      <ThumbsUp className="w-5 h-5 text-green-400" />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-green-400">Approva</div>
                      <div className="text-xs text-slate-400">Approva la richiesta di blocco prezzo</div>
                    </div>
                  </div>
                  <ArrowLeft className="w-5 h-5 rotate-180 text-green-400 group-hover:translate-x-1 transition-transform" />
                </button>

                {/* Rifiuta */}
                <button
                  onClick={handleRejectBlock}
                  className="w-full glass-strong p-4 rounded-lg hover:bg-red-500/20 transition-all
                           flex items-center justify-between group border-2 border-red-500/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                      <ThumbsDown className="w-5 h-5 text-red-400" />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-red-400">Rifiuta</div>
                      <div className="text-xs text-slate-400">Rifiuta la richiesta con motivazione</div>
                    </div>
                  </div>
                  <ArrowLeft className="w-5 h-5 rotate-180 text-red-400 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Block Request Card Component
function BlockRequestCard({ blockRequest, onClick }: { blockRequest: BlockRequest; onClick: () => void }) {
  const extractShortName = (fullName: string): string => {
    const lines = fullName.split('\n');
    const firstLine = lines[0];
    const beforeMarkdown = firstLine.split('**')[0].trim();
    return beforeMarkdown || firstLine.trim();
  };

  const getStateBadgeClass = (state: 'overdue' | 'today' | 'planned'): string => {
    switch (state) {
      case 'overdue':
        return 'bg-red-500/20 text-red-400 border border-red-500';
      case 'today':
        return 'bg-orange-500/20 text-orange-400 border border-orange-500';
      case 'planned':
        return 'bg-blue-500/20 text-blue-400 border border-blue-500';
      default:
        return 'bg-slate-500/20 text-slate-400 border border-slate-500';
    }
  };

  const formatStateBadge = (state: 'overdue' | 'today' | 'planned'): string => {
    switch (state) {
      case 'overdue':
        return 'SCADUTO';
      case 'today':
        return 'OGGI';
      case 'planned':
        return 'PIANIFICATO';
      default:
        return 'SCONOSCIUTO';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="glass p-3 rounded-xl cursor-pointer transition-all"
      onClick={onClick}
    >
      {/* Icona prodotto (senza immagine) */}
      <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 mx-auto mb-2 rounded-lg overflow-hidden bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-3xl">
        🔒
      </div>

      {/* Nome prodotto (solo nome breve) */}
      <h3 className="text-xs sm:text-sm font-semibold mt-2 line-clamp-2 text-center min-h-[2.5rem]">
        {extractShortName(blockRequest.productName)}
      </h3>

      {/* Badge stato */}
      <div className={`text-xs font-bold mt-2 text-center px-2 py-1 rounded-full ${getStateBadgeClass(blockRequest.state)}`}>
        {formatStateBadge(blockRequest.state)}
      </div>

      {/* Prezzo proposto */}
      <div className="mt-2 text-center">
        <div className="text-sm font-bold text-blue-400">
          CHF {blockRequest.proposedPrice.toFixed(2)}
        </div>
        <div className={`text-xs ${blockRequest.marginPercent < 40 ? 'text-red-400' : 'text-green-400'}`}>
          {blockRequest.marginPercent.toFixed(1)}% margine
        </div>
      </div>

      {/* Cliente */}
      <div className="text-xs text-slate-400 mt-2 text-center truncate">
        {blockRequest.customerName}
      </div>

      {/* Note venditore se presenti */}
      {blockRequest.sellerNotes && (
        <div className="text-xs text-yellow-400 mt-1 text-center truncate">
          {blockRequest.sellerNotes}
        </div>
      )}
    </motion.div>
  );
}
