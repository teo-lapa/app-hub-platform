'use client';

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera,
  Package,
  Check,
  AlertTriangle,
  Clock,
  Loader2,
  X,
  ExternalLink,
  ImagePlus,
  Save,
  List,
  ScanLine,
  RefreshCw,
  Filter,
  MapPin,
  Send,
  Trash2,
  Snowflake,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react';
import Image from 'next/image';
import toast, { Toaster } from 'react-hot-toast';
import { AppHeader, MobileHomeButton } from '@/components/layout/AppHeader';
import { QRScanner } from '@/components/inventario/QRScanner';

// Types
interface JobItem {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'review' | 'error' | 'failed';
  product_name?: string;
  odoo_product_id?: number;
  photo_count: number;
  first_photo_url?: string;
  notes?: string;
  created_at: string;
  error_message?: string;
  result_json?: any;
}

interface LocationProduct {
  id: number;
  name: string;
  code: string;
  barcode: string;
  image: string | null;
  quantity: number;
  catalogato: boolean;
}

interface MapBin {
  id: number;
  name: string;
  barcode: string;
  count: number;
}

interface MapZone {
  id: number;
  name: string;
  label: string;
  count: number;
  bins: MapBin[];
}

type TabType = 'scatta' | 'ubicazione' | 'risultati';
type FilterType = 'tutti' | 'completati' | 'review' | 'pending';

export default function CatalogoFotoPage() {
  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('scatta');

  // Scatta tab state
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);
  const [bgUploads, setBgUploads] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Ubicazione tab state
  const [showLocationScanner, setShowLocationScanner] = useState(false);
  const [locationName, setLocationName] = useState('');
  const [locationProducts, setLocationProducts] = useState<LocationProduct[]>([]);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [locationFilter, setLocationFilter] = useState<'tutti' | 'da_fare' | 'fatti'>('tutti');

  // Mappa zone/bin (navigazione "dove devo andare")
  const [mapZones, setMapZones] = useState<MapZone[]>([]);
  const [isLoadingMap, setIsLoadingMap] = useState(false);
  const [selectedZone, setSelectedZone] = useState<MapZone | null>(null);
  const [pendingBin, setPendingBin] = useState<MapBin | null>(null);

  // Risultati tab state
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [filter, setFilter] = useState<FilterType>('tutti');
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [reprocessingJobs, setReprocessingJobs] = useState<Set<string>>(new Set());
  const [dismissingJobs, setDismissingJobs] = useState<Set<string>>(new Set());

  // Photo capture
  const handlePhotos = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles = Array.from(files);
    setPhotos(prev => [...prev, ...newFiles]);

    newFiles.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });

    // Reset input so same file can be selected again
    e.target.value = '';
  }, []);

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  // Compress photo client-side before upload (max 3MB)
  const compressPhoto = async (file: File): Promise<Blob> => {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1920;
        let w = img.width, h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
          else { w = Math.round(w * maxDim / h); h = maxDim; }
        }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
        canvas.toBlob((blob) => resolve(blob || file), 'image/jpeg', 0.75);
      };
      img.src = URL.createObjectURL(file);
    });
  };

  // Save product - reset form immediately, upload in background
  const handleSave = () => {
    if (photos.length === 0) {
      toast.error('Scatta almeno una foto!');
      return;
    }

    // Capture current photos and notes before resetting
    const savedPhotos = [...photos];
    const savedNotes = notes;

    // Reset form IMMEDIATELY
    setPhotos([]);
    setPreviews([]);
    setNotes('');
    setSessionCount(prev => prev + 1);
    setBgUploads(prev => prev + 1);
    toast.success(`${savedPhotos.length} foto in upload...`);

    // Upload in background
    (async () => {
      try {
        const uploadedUrls: string[] = [];
        for (const photo of savedPhotos) {
          const compressed = await compressPhoto(photo);
          const formData = new FormData();
          formData.append('file', new File([compressed], photo.name, { type: 'image/jpeg' }));
          const uploadRes = await fetch('/api/catalogo-foto/upload', { method: 'POST', body: formData });
          if (!uploadRes.ok) {
            const errData = await uploadRes.json().catch(() => ({}));
            throw new Error(errData.error || 'Errore upload');
          }
          const uploadData = await uploadRes.json();
          uploadedUrls.push(uploadData.url);
        }

        const jobRes = await fetch('/api/catalogo-foto/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operator_name: 'Paul', photo_urls: uploadedUrls, notes: savedNotes || undefined }),
        });
        if (!jobRes.ok) throw new Error('Errore creazione job');
        toast.success('Upload completato!', { icon: '✅' });
      } catch (err: any) {
        toast.error(`Errore upload: ${err.message || 'riprova'}`);
      } finally {
        setBgUploads(prev => prev - 1);
      }
    })();
  };

  // Fetch jobs
  const fetchJobs = async () => {
    setIsLoadingJobs(true);
    try {
      const res = await fetch('/api/catalogo-foto/jobs?limit=50');
      if (!res.ok) throw new Error('Errore caricamento jobs');
      const data = await res.json();
      const mapped = (data.data || []).map((j: any) => {
        let productName = j.odoo_product_name;
        let odooId = j.odoo_product_id;
        if (!productName && j.result_json) {
          const raw = j.result_json.raw_result || '';
          const m = raw.match(/Prodotto trovato:\s*(.+?)(?:\s*\(ID:\s*(\d+)\))?$/m);
          if (m) { productName = m[1].trim(); odooId = odooId || (m[2] ? parseInt(m[2]) : null); }
          if (!productName) { productName = j.result_json.odoo_product_name; }
          if (!odooId) { odooId = j.result_json.odoo_product_id; }
        }
        return { ...j, product_name: productName, odoo_product_id: odooId, first_photo_url: j.photo_urls?.[0] };
      });
      setJobs(mapped);
    } catch (err) {
      toast.error('Errore caricamento risultati');
    } finally {
      setIsLoadingJobs(false);
    }
  };

  // Reprocess a review job with new instructions
  const handleReprocess = async (jobId: string) => {
    const instruction = reviewNotes[jobId]?.trim();
    if (!instruction) {
      toast.error('Scrivi le istruzioni prima di riprocessare');
      return;
    }
    setReprocessingJobs(prev => new Set(prev).add(jobId));
    try {
      const res = await fetch(`/api/catalogo-foto/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'pending', notes: instruction }),
      });
      if (!res.ok) throw new Error('Errore');
      toast.success('Job rimesso in coda con le nuove istruzioni');
      setReviewNotes(prev => { const n = { ...prev }; delete n[jobId]; return n; });
      fetchJobs();
    } catch {
      toast.error('Errore nel riprocessamento');
    } finally {
      setReprocessingJobs(prev => { const n = new Set(prev); n.delete(jobId); return n; });
    }
  };

  // Dismiss (gia' fatto / ignora) un job failed/review
  const handleDismiss = async (jobId: string) => {
    if (!confirm('Confermi di rimuovere questo job dalla lista? (il prodotto in Odoo non viene toccato)')) return;
    setDismissingJobs(prev => new Set(prev).add(jobId));
    try {
      const res = await fetch(`/api/catalogo-foto/jobs/${jobId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Errore');
      setJobs(prev => prev.filter(j => j.id !== jobId));
      toast.success('Rimosso');
    } catch {
      toast.error('Errore rimozione');
    } finally {
      setDismissingJobs(prev => { const n = new Set(prev); n.delete(jobId); return n; });
    }
  };

  // Location scanning
  const handleLocationScan = async (code: string) => {
    setShowLocationScanner(false);
    setIsLoadingLocation(true);
    setLocationProducts([]);
    setLocationName('');

    try {
      const res = await fetch('/api/catalogo-foto/location-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ locationCode: code }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setLocationName(data.location?.complete_name || data.location?.name || code);
      setLocationProducts(data.products || []);

      const done = (data.products || []).filter((p: LocationProduct) => p.catalogato).length;
      const total = (data.products || []).length;
      toast.success(`${total} prodotti trovati (${done} fatti, ${total - done} da fare)`);
    } catch (err: any) {
      toast.error(err.message || 'Errore caricamento ubicazione');
    } finally {
      setIsLoadingLocation(false);
    }
  };

  // Carica la mappa zone -> bin con i conteggi "da fare"
  const fetchLocationMap = async () => {
    setIsLoadingMap(true);
    try {
      const res = await fetch('/api/catalogo-foto/location-map', { credentials: 'include' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setMapZones(data.zones || []);
    } catch (err: any) {
      toast.error(err.message || 'Errore caricamento mappa');
    } finally {
      setIsLoadingMap(false);
    }
  };

  // Tap su un bin: per aprire i prodotti DEVE scansionare il QR di QUEL bin
  const handleSelectBin = (bin: MapBin) => {
    if (!bin.barcode) {
      toast.error('Questa ubicazione non ha un QR collegato');
      return;
    }
    setPendingBin(bin);
    setShowLocationScanner(true);
  };

  // Risultato scansione: se arrivo da un bin, il QR deve combaciare
  const handleScanResult = (code: string) => {
    if (pendingBin) {
      const norm = (s: string) => (s || '').trim().toUpperCase();
      if (norm(code) !== norm(pendingBin.barcode)) {
        toast.error(`QR sbagliato: hai scansionato "${code}" ma devi essere su ${pendingBin.name}`);
        setPendingBin(null);
        return;
      }
      setLocationFilter('da_fare');
    }
    handleLocationScan(code);
  };

  // Torna alla mappa dalla vista prodotti (e aggiorna i conteggi)
  const backToMap = () => {
    setLocationName('');
    setLocationProducts([]);
    setPendingBin(null);
    setLocationFilter('tutti');
    fetchLocationMap();
  };

  const handleSelectProductFromLocation = (product: LocationProduct) => {
    setNotes(`Sistema prodotto: ${product.name} (ID: ${product.id})`);
    setActiveTab('scatta');
    toast.success(`Prodotto selezionato: ${product.name}`);
    setTimeout(() => fileInputRef.current?.click(), 300);
  };

  const filteredLocationProducts = locationProducts.filter(p => {
    if (locationFilter === 'tutti') return true;
    if (locationFilter === 'da_fare') return !p.catalogato;
    if (locationFilter === 'fatti') return p.catalogato;
    return true;
  });

  // Tab switch handler
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    if (tab === 'risultati') fetchJobs();
    if (tab === 'ubicazione' && !locationName) fetchLocationMap();
  };

  // Icona per zona in base al nome
  const zoneIcon = (label: string) => {
    const l = label.toLowerCase();
    if (l.includes('frigo') || l.includes('congelatore') || l.includes('pingu')) return Snowflake;
    if (l.includes('secco')) return Package;
    return MapPin;
  };

  // Filter jobs
  const filteredJobs = jobs.filter(job => {
    if (filter === 'tutti') return true;
    if (filter === 'completati') return job.status === 'completed';
    if (filter === 'review') return job.status === 'review' || job.status === 'failed' || job.status === 'error';
    if (filter === 'pending') return job.status === 'pending' || job.status === 'processing';
    return true;
  });

  // Status badge
  const StatusBadge = ({ status }: { status: JobItem['status'] }) => {
    const config = {
      pending: { label: 'In attesa', icon: Clock, bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
      processing: { label: 'Elaborazione', icon: Loader2, bg: 'bg-blue-500/20', text: 'text-blue-400' },
      completed: { label: 'Completato', icon: Check, bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
      review: { label: 'Da rivedere', icon: AlertTriangle, bg: 'bg-orange-500/20', text: 'text-orange-400' },
      error: { label: 'Da rifare', icon: AlertTriangle, bg: 'bg-orange-500/20', text: 'text-orange-400' },
      failed: { label: 'Da rifare', icon: AlertTriangle, bg: 'bg-orange-500/20', text: 'text-orange-400' },
    }[status];

    if (!config) return null;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.text}`}>
        <Icon className={`h-3.5 w-3.5 ${status === 'processing' ? 'animate-spin' : ''}`} />
        {config.label}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <Toaster position="top-center" />

      <AppHeader
        title="Catalogo Foto"
        subtitle="Scansiona foto prodotti per catalogo"
        icon={<Camera className="h-6 w-6 text-white" />}
      />

      {/* Tab Selector */}
      <div className="max-w-3xl mx-auto px-4 pt-6">
        <div className="flex rounded-xl bg-slate-800 p-1 border border-slate-700">
          <button
            onClick={() => handleTabChange('scatta')}
            className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'scatta'
                ? 'bg-emerald-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ScanLine className="h-5 w-5" />
            Scatta
          </button>
          <button
            onClick={() => handleTabChange('ubicazione')}
            className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'ubicazione'
                ? 'bg-emerald-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <MapPin className="h-5 w-5" />
            Ubicazione
          </button>
          <button
            onClick={() => handleTabChange('risultati')}
            className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'risultati'
                ? 'bg-emerald-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <List className="h-5 w-5" />
            Risultati
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          {/* TAB: SCATTA */}
          {activeTab === 'scatta' && (
            <motion.div
              key="scatta"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-5"
            >
              {/* Session counter */}
              {sessionCount > 0 && (
                <div className="text-center text-sm text-slate-400">
                  Prodotti salvati in questa sessione: <span className="text-emerald-400 font-bold text-lg">{sessionCount}</span>
                  {bgUploads > 0 && <span className="ml-3 text-blue-400">({bgUploads} in upload...)</span>}
                </div>
              )}

              {/* New product button */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                onChange={handlePhotos}
                className="hidden"
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full min-h-[72px] rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98] transition-all shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-3 text-xl font-bold"
              >
                <ImagePlus className="h-7 w-7" />
                {photos.length === 0 ? 'NUOVO PRODOTTO' : 'AGGIUNGI FOTO'}
              </button>

              {/* Photo grid */}
              {previews.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                    Foto ({previews.length})
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    {previews.map((preview, idx) => (
                      <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border-2 border-slate-700">
                        <Image
                          src={preview}
                          alt={`Foto ${idx + 1}`}
                          fill
                          className="object-cover"
                        />
                        <button
                          onClick={() => removePhoto(idx)}
                          className="absolute top-1.5 right-1.5 p-1.5 rounded-full bg-red-500/90 hover:bg-red-600 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {photos.length > 0 && (
                <div>
                  <label className="block text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Note (opzionale)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Es: foto da angolazione diversa, prodotto nuovo, etichetta rovinata..."
                    rows={3}
                    className="w-full rounded-xl bg-slate-800 border border-slate-700 px-4 py-3 text-base text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
                  />
                </div>
              )}

              {/* Save button */}
              {photos.length > 0 && (
                <button
                  onClick={handleSave}
                  className="w-full min-h-[64px] rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98] transition-all shadow-lg shadow-blue-900/30 flex items-center justify-center gap-3 text-lg font-bold"
                >
                  <Save className="h-6 w-6" />
                  SALVA PRODOTTO ({photos.length} foto)
                </button>
              )}
            </motion.div>
          )}

          {/* TAB: UBICAZIONE */}
          {activeTab === 'ubicazione' && (
            <motion.div
              key="ubicazione"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-5"
            >
              {(locationName || isLoadingLocation) ? (
                /* ===== LIVELLO 2: prodotti dell'ubicazione (dopo scan QR valido) ===== */
                <>
                  <button
                    onClick={backToMap}
                    className="inline-flex items-center gap-2 text-slate-300 hover:text-white text-sm font-semibold"
                  >
                    <ArrowLeft className="h-4 w-4" /> Mappa
                  </button>

                  {/* Location info */}
                  {locationName && (
                    <div className="rounded-xl bg-slate-800 border border-blue-500/30 p-4 flex items-center gap-3">
                      <MapPin className="h-5 w-5 text-blue-400 shrink-0" />
                      <div>
                        <p className="text-sm text-slate-400">Ubicazione</p>
                        <p className="font-bold text-white">{locationName}</p>
                      </div>
                      <div className="ml-auto text-right">
                        <p className="text-sm text-slate-400">{locationProducts.length} prodotti</p>
                        <p className="text-xs text-emerald-400">
                          {locationProducts.filter(p => p.catalogato).length} fatti
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Loading */}
                  {isLoadingLocation && (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                      <Loader2 className="h-10 w-10 animate-spin mb-3" />
                      <p>Caricamento prodotti...</p>
                    </div>
                  )}

                  {/* Product filters */}
                  {locationProducts.length > 0 && (
                    <div className="flex items-center gap-2">
                      {([
                        { key: 'tutti' as const, label: `Tutti (${locationProducts.length})` },
                        { key: 'da_fare' as const, label: `Da fare (${locationProducts.filter(p => !p.catalogato).length})` },
                        { key: 'fatti' as const, label: `Fatti (${locationProducts.filter(p => p.catalogato).length})` },
                      ]).map(f => (
                        <button
                          key={f.key}
                          onClick={() => setLocationFilter(f.key)}
                          className={`px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
                            locationFilter === f.key
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Product list */}
                  {locationProducts.length > 0 && !isLoadingLocation && (
                    <div className="space-y-3">
                      {filteredLocationProducts.map((product) => (
                        <motion.div
                          key={product.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          onClick={() => handleSelectProductFromLocation(product)}
                          className="rounded-xl bg-slate-800 border border-slate-700 p-4 hover:border-slate-500 active:scale-[0.98] transition-all cursor-pointer"
                        >
                          <div className="flex gap-3 items-center">
                            {/* Thumbnail */}
                            <div className="h-14 w-14 rounded-lg bg-slate-700 overflow-hidden shrink-0">
                              {product.image ? (
                                <img src={product.image} alt={product.name} className="object-cover h-full w-full" />
                              ) : (
                                <div className="flex items-center justify-center h-full">
                                  <Package className="h-5 w-5 text-slate-500" />
                                </div>
                              )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-white text-sm truncate">{product.name}</p>
                              {product.code && (
                                <p className="text-xs text-slate-400">{product.code}</p>
                              )}
                            </div>

                            {/* Status badge */}
                            <span className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
                              product.catalogato
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}>
                              {product.catalogato ? (
                                <><Check className="h-3.5 w-3.5" /> Fatto</>
                              ) : (
                                <><Camera className="h-3.5 w-3.5" /> Da fare</>
                              )}
                            </span>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </>
              ) : selectedZone ? (
                /* ===== LIVELLO 1: le ubicazioni (bin) della zona, solo quelle da fare ===== */
                <>
                  <button
                    onClick={() => setSelectedZone(null)}
                    className="inline-flex items-center gap-2 text-slate-300 hover:text-white text-sm font-semibold"
                  >
                    <ArrowLeft className="h-4 w-4" /> Zone
                  </button>

                  <div className="rounded-xl bg-slate-800 border border-blue-500/30 p-4 flex items-center gap-3">
                    {(() => { const Icon = zoneIcon(selectedZone.label); return <Icon className="h-6 w-6 text-blue-400 shrink-0" />; })()}
                    <div>
                      <p className="text-sm text-slate-400">Zona</p>
                      <p className="font-bold text-white">{selectedZone.label}</p>
                    </div>
                    <p className="ml-auto text-right text-sm font-bold text-red-400">{selectedZone.count} da fare</p>
                  </div>

                  <p className="text-xs text-slate-500">Vai su queste ubicazioni e flasha il QR per vedere i prodotti</p>

                  <div className="space-y-3">
                    {selectedZone.bins.map((bin) => (
                      <button
                        key={bin.id}
                        onClick={() => handleSelectBin(bin)}
                        className="w-full rounded-xl bg-slate-800 border border-slate-700 p-4 flex items-center gap-3 hover:border-slate-500 active:scale-[0.98] transition-all"
                      >
                        <MapPin className="h-5 w-5 text-blue-400 shrink-0" />
                        <span className="flex-1 text-left font-semibold text-white text-sm truncate">{bin.name}</span>
                        <span className="shrink-0 px-3 py-1.5 rounded-full text-xs font-bold bg-red-500/20 text-red-400">
                          {bin.count} da fare
                        </span>
                        <ChevronRight className="h-5 w-5 text-slate-500 shrink-0" />
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                /* ===== LIVELLO 0: la mappa delle zone ===== */
                <>
                  {/* Scorciatoia: scansiona direttamente un'ubicazione */}
                  <button
                    onClick={() => { setPendingBin(null); setShowLocationScanner(true); }}
                    className="w-full min-h-[64px] rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98] transition-all shadow-lg shadow-blue-900/30 flex items-center justify-center gap-3 text-lg font-bold"
                  >
                    <MapPin className="h-6 w-6" />
                    SCANSIONA UBICAZIONE
                  </button>

                  {isLoadingMap ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                      <Loader2 className="h-10 w-10 animate-spin mb-3" />
                      <p>Calcolo prodotti da fare...</p>
                    </div>
                  ) : mapZones.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                      <Check className="h-12 w-12 mb-3 text-emerald-500" />
                      <p className="text-lg font-semibold">Tutto fotografato!</p>
                      <p className="text-sm">Nessun prodotto con giacenza da fare</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-slate-400">Dove andare a fotografare</p>
                        <button
                          onClick={fetchLocationMap}
                          className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-colors"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {mapZones.map((zone) => {
                          const Icon = zoneIcon(zone.label);
                          return (
                            <button
                              key={zone.id}
                              onClick={() => setSelectedZone(zone)}
                              className="rounded-2xl bg-slate-800 border border-slate-700 p-5 flex flex-col items-start gap-2 hover:border-blue-500/50 active:scale-[0.98] transition-all text-left"
                            >
                              <Icon className="h-7 w-7 text-blue-400" />
                              <p className="font-bold text-white">{zone.label}</p>
                              <p className="text-sm">
                                <span className="text-2xl font-extrabold text-red-400">{zone.count}</span>{' '}
                                <span className="text-slate-400">da fare</span>
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </>
              )}
            </motion.div>
          )}

          {/* TAB: RISULTATI */}
          {activeTab === 'risultati' && (
            <motion.div
              key="risultati"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-5"
            >
              {/* Filters */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {([
                  { key: 'tutti', label: 'Tutti' },
                  { key: 'completati', label: 'Completati' },
                  { key: 'review', label: 'Da rivedere' },
                  { key: 'pending', label: 'In attesa' },
                ] as { key: FilterType; label: string }[]).map(f => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={`px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
                      filter === f.key
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}

                <button
                  onClick={fetchJobs}
                  disabled={isLoadingJobs}
                  className="ml-auto p-2.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-colors"
                >
                  <RefreshCw className={`h-5 w-5 ${isLoadingJobs ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* Jobs list */}
              {isLoadingJobs ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                  <Loader2 className="h-10 w-10 animate-spin mb-3" />
                  <p>Caricamento...</p>
                </div>
              ) : filteredJobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                  <Package className="h-12 w-12 mb-3" />
                  <p className="text-lg font-semibold">Nessun risultato</p>
                  <p className="text-sm">I prodotti scansionati appariranno qui</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredJobs.map((job) => (
                    <motion.div
                      key={job.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-xl bg-slate-800 border border-slate-700 p-4 hover:border-slate-600 transition-colors"
                    >
                      <div className="flex gap-3">
                        {/* Thumbnail */}
                        <div className="h-16 w-16 rounded-lg bg-slate-700 overflow-hidden shrink-0">
                          {job.first_photo_url ? (
                            <img
                              src={job.first_photo_url}
                              alt="Product"
                              className="object-cover h-full w-full"
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full">
                              <Package className="h-6 w-6 text-slate-500" />
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <p className="font-semibold text-white truncate">
                              {job.product_name || (job.status === 'completed' ? 'Confermato — generazione foto completata con successo.' : job.status === 'failed' || job.status === 'error' ? 'Elaborazione fallita' : 'In attesa...')}
                            </p>
                            <StatusBadge status={job.status} />
                          </div>

                          <div className="flex items-center gap-3 text-xs text-slate-400">
                            <span className="flex items-center gap-1">
                              <Camera className="h-3.5 w-3.5" />
                              {job.photo_count} foto
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              {new Date(job.created_at).toLocaleString('it-CH', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>

                          {/* Odoo link for completed */}
                          {job.status === 'completed' && job.odoo_product_id && (
                            <a
                              href={`https://lapadevadmin-lapa-v2.odoo.com/web#id=${job.odoo_product_id}&model=product.template&view_type=form`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 mt-2 text-xs text-emerald-400 hover:text-emerald-300 font-semibold"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Apri in Odoo
                            </a>
                          )}

                          {/* Result summary */}
                          {job.status === 'completed' && job.result_json?.raw_result && (
                            <p className="mt-1.5 text-xs text-slate-400 line-clamp-2">
                              {job.result_json.raw_result.split('\n').filter((l: string) => l.trim() && !l.startsWith('|') && !l.startsWith('#') && !l.startsWith('---')).slice(0, 2).join(' — ')}
                            </p>
                          )}


                          {/* Review/Failed: instruction input + reprocess button */}
                          {(job.status === 'review' || job.status === 'failed' || job.status === 'error') && (
                            <div className="mt-3 space-y-2">
                              <textarea
                                value={reviewNotes[job.id] || ''}
                                onChange={(e) => setReviewNotes(prev => ({ ...prev, [job.id]: e.target.value }))}
                                placeholder="Scrivi istruzioni: es. cerca PISTACCHIO in Odoo, fornitore Innovaction..."
                                rows={2}
                                className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-orange-500 focus:outline-none resize-none"
                              />
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleReprocess(job.id)}
                                  disabled={reprocessingJobs.has(job.id)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                                >
                                  {reprocessingJobs.has(job.id) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                                  Riprocessa
                                </button>
                                <button
                                  onClick={() => handleDismiss(job.id)}
                                  disabled={dismissingJobs.has(job.id)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold transition-colors disabled:opacity-50"
                                  title="Il prodotto e' gia' a posto in Odoo, rimuovi dalla lista"
                                >
                                  {dismissingJobs.has(job.id) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                  Gia' fatto
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* QR Scanner for location */}
      <QRScanner
        isOpen={showLocationScanner}
        onClose={() => setShowLocationScanner(false)}
        onScan={handleScanResult}
        title={pendingBin ? `Flasha ${pendingBin.name}` : 'Scanner Ubicazione'}
      />

      <MobileHomeButton />
    </div>
  );
}
