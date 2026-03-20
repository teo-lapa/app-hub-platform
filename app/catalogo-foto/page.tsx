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
} from 'lucide-react';
import Image from 'next/image';
import toast, { Toaster } from 'react-hot-toast';
import { AppHeader, MobileHomeButton } from '@/components/layout/AppHeader';

// Types
interface JobItem {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'review' | 'error';
  product_name?: string;
  odoo_product_id?: number;
  photo_count: number;
  first_photo_url?: string;
  notes?: string;
  created_at: string;
  error_message?: string;
}

type TabType = 'scatta' | 'risultati';
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Risultati tab state
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [filter, setFilter] = useState<FilterType>('tutti');

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

  // Save product
  const handleSave = async () => {
    if (photos.length === 0) {
      toast.error('Scatta almeno una foto!');
      return;
    }

    setIsSaving(true);

    try {
      // 1. Upload photos
      const uploadedUrls: string[] = [];
      for (const photo of photos) {
        const formData = new FormData();
        formData.append('file', photo);

        const uploadRes = await fetch('/api/catalogo-foto/upload', {
          method: 'POST',
          body: formData,
        });

        if (!uploadRes.ok) throw new Error('Errore upload foto');

        const uploadData = await uploadRes.json();
        uploadedUrls.push(uploadData.url);
      }

      // 2. Create job
      const jobRes = await fetch('/api/catalogo-foto/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photo_urls: uploadedUrls,
          notes: notes || undefined,
        }),
      });

      if (!jobRes.ok) throw new Error('Errore creazione job');

      // Reset form
      setPhotos([]);
      setPreviews([]);
      setNotes('');
      setSessionCount(prev => prev + 1);
      toast.success('Prodotto salvato! Puoi scattare il prossimo.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore nel salvataggio');
    } finally {
      setIsSaving(false);
    }
  };

  // Fetch jobs
  const fetchJobs = async () => {
    setIsLoadingJobs(true);
    try {
      const res = await fetch('/api/catalogo-foto/jobs?limit=50');
      if (!res.ok) throw new Error('Errore caricamento jobs');
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch (err) {
      toast.error('Errore caricamento risultati');
    } finally {
      setIsLoadingJobs(false);
    }
  };

  // Tab switch handler
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    if (tab === 'risultati') fetchJobs();
  };

  // Filter jobs
  const filteredJobs = jobs.filter(job => {
    if (filter === 'tutti') return true;
    if (filter === 'completati') return job.status === 'completed';
    if (filter === 'review') return job.status === 'review';
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
      error: { label: 'Errore', icon: X, bg: 'bg-red-500/20', text: 'text-red-400' },
    }[status];

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
            className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-lg text-base font-semibold transition-all ${
              activeTab === 'scatta'
                ? 'bg-emerald-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ScanLine className="h-5 w-5" />
            Scatta
          </button>
          <button
            onClick={() => handleTabChange('risultati')}
            className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-lg text-base font-semibold transition-all ${
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
                  disabled={isSaving}
                  className="w-full min-h-[64px] rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98] transition-all shadow-lg shadow-blue-900/30 flex items-center justify-center gap-3 text-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-6 w-6 animate-spin" />
                      Salvataggio...
                    </>
                  ) : (
                    <>
                      <Save className="h-6 w-6" />
                      SALVA PRODOTTO ({photos.length} foto)
                    </>
                  )}
                </button>
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
                            <Image
                              src={job.first_photo_url}
                              alt="Product"
                              width={64}
                              height={64}
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
                              {job.product_name || 'In attesa...'}
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
                              href={`${process.env.NEXT_PUBLIC_ODOO_URL}/web#id=${job.odoo_product_id}&model=product.template&view_type=form`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 mt-2 text-xs text-emerald-400 hover:text-emerald-300 font-semibold"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Apri in Odoo
                            </a>
                          )}

                          {job.status === 'error' && job.error_message && (
                            <p className="mt-1 text-xs text-red-400 truncate">{job.error_message}</p>
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

      <MobileHomeButton />
    </div>
  );
}
