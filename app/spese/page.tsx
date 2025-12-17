'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera,
  Upload,
  Receipt,
  Check,
  Loader2,
  AlertCircle,
  ChevronRight,
  CreditCard,
  Wallet,
  Store,
  Calendar,
  Tag,
  FileText,
  X,
  RefreshCw,
  ShoppingCart
} from 'lucide-react';
import toast from 'react-hot-toast';

// Funzione per comprimere l'immagine
const compressImage = (file: File, maxWidth: number = 1200, quality: number = 0.8): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        // Calcola le nuove dimensioni mantenendo l'aspect ratio
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Could not compress image'));
              return;
            }

            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });

            console.log(`📷 Immagine compressa: ${(file.size / 1024).toFixed(0)}KB → ${(compressedFile.size / 1024).toFixed(0)}KB`);
            resolve(compressedFile);
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => reject(new Error('Could not load image'));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
};

// Tipi
interface ReceiptAnalysis {
  storeName: string;
  storeAddress?: string;
  date: string;
  time?: string;
  totalAmount: number;
  currency: string;
  vatAmount?: number;
  vatRate?: string;
  subtotal?: number;
  category: 'carburante' | 'cibo' | 'trasporto' | 'alloggio' | 'materiale' | 'altro';
  categoryConfidence: number;
  items: Array<{
    description: string;
    quantity?: number;
    unitPrice?: number;
    totalPrice: number;
  }>;
  paymentMethod?: string;
  confidence: number;
  rawText?: string;
}

interface ExpenseCategory {
  id: number;
  name: string;
  code: string;
  defaultPrice: number;
}

// Stati dell'app
type AppState = 'upload' | 'analyzing' | 'review' | 'submitting' | 'success' | 'error';

// Mapping categorie AI → icone e colori
const CATEGORY_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  'carburante': { icon: '⛽', color: 'bg-amber-500/20 text-amber-400', label: 'Carburante' },
  'cibo': { icon: '🍽️', color: 'bg-green-500/20 text-green-400', label: 'Pasti' },
  'trasporto': { icon: '🚗', color: 'bg-blue-500/20 text-blue-400', label: 'Trasporto' },
  'alloggio': { icon: '🏨', color: 'bg-purple-500/20 text-purple-400', label: 'Alloggio' },
  'materiale': { icon: '🔧', color: 'bg-orange-500/20 text-orange-400', label: 'Materiale' },
  'altro': { icon: '📦', color: 'bg-gray-500/20 text-gray-400', label: 'Altro' }
};

export default function SpesePage() {
  // Stati
  const [appState, setAppState] = useState<AppState>('upload');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string>('image/jpeg');
  const [analysis, setAnalysis] = useState<ReceiptAnalysis | null>(null);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [paymentMode, setPaymentMode] = useState<'company_account' | 'own_account'>('company_account');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Carica categorie all'avvio
  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const response = await fetch('/api/spese/submit?action=categories', {
        credentials: 'include'
      });
      const data = await response.json();

      if (data.success && data.categories) {
        setCategories(data.categories);
      }
    } catch (error) {
      console.error('Errore caricamento categorie:', error);
    }
  };

  // Gestione upload immagine
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Verifica tipo file
    if (!file.type.startsWith('image/')) {
      toast.error('Seleziona un\'immagine valida');
      return;
    }

    // Verifica dimensione (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Immagine troppo grande (max 10MB)');
      return;
    }

    // Comprimi l'immagine se è grande (tipico delle foto da fotocamera)
    let processedFile = file;
    if (file.size > 500 * 1024) { // Se > 500KB, comprimi
      try {
        toast.loading('Compressione immagine...', { id: 'compress' });
        processedFile = await compressImage(file, 1200, 0.75);
        toast.dismiss('compress');
      } catch (error) {
        console.warn('Compressione fallita, uso immagine originale:', error);
        processedFile = file;
        toast.dismiss('compress');
      }
    }

    // Crea preview dall'immagine compressa
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Full = event.target?.result as string;
      setImagePreview(base64Full);

      // Estrai solo la parte base64 (senza il prefisso data:image/...;base64,)
      const base64Data = base64Full.split(',')[1];
      setImageBase64(base64Data);
      setImageMimeType(processedFile.type);
    };
    reader.readAsDataURL(processedFile);

    // Inizia analisi con l'immagine compressa
    await analyzeReceipt(processedFile);
  };

  // Analizza scontrino con Gemini
  const analyzeReceipt = async (file: File) => {
    setAppState('analyzing');
    setErrorMessage('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/spese/analyze', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      const data = await response.json();

      if (data.success && data.analysis) {
        setAnalysis(data.analysis);
        setImageBase64(data.imageBase64);
        setImageMimeType(data.imageMimeType);

        // Auto-seleziona categoria se disponibile
        const aiCategory = data.analysis.category;
        const matchingCategory = categories.find(c =>
          c.name.toLowerCase().includes(aiCategory) ||
          aiCategory.includes(c.name.toLowerCase())
        );
        if (matchingCategory) {
          setSelectedCategoryId(matchingCategory.id);
        }

        setAppState('review');
        toast.success('Scontrino analizzato!');
      } else {
        throw new Error(data.error || 'Errore analisi scontrino');
      }
    } catch (error: any) {
      console.error('Errore analisi:', error);
      setErrorMessage(error.message);
      setAppState('error');
      toast.error('Errore analisi scontrino');
    }
  };

  // Invia spesa a Odoo
  const submitExpense = async () => {
    if (!analysis) return;

    setAppState('submitting');

    try {
      const response = await fetch('/api/spese/submit', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          totalAmount: analysis.totalAmount,
          date: analysis.date,
          categoryId: selectedCategoryId,
          categoryName: analysis.category,
          description: analysis.rawText,
          storeName: analysis.storeName,
          vatAmount: analysis.vatAmount,
          items: analysis.items,
          imageBase64: imageBase64,
          imageMimeType: imageMimeType,
          paymentMode: paymentMode,
          note: note
        })
      });

      const data = await response.json();

      if (data.success) {
        setAppState('success');
        toast.success('Spesa registrata con successo!');
      } else {
        throw new Error(data.error || 'Errore invio spesa');
      }
    } catch (error: any) {
      console.error('Errore invio:', error);
      setErrorMessage(error.message);
      setAppState('error');
      toast.error('Errore invio spesa');
    }
  };

  // Reset per nuova spesa
  const resetForm = () => {
    setAppState('upload');
    setImagePreview(null);
    setImageBase64(null);
    setAnalysis(null);
    setSelectedCategoryId(null);
    setNote('');
    setPaymentMode('company_account');
    setErrorMessage('');

    // Reset input file
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  // Render stato: Upload
  const renderUploadState = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center min-h-[60vh] p-6"
    >
      <div className="w-24 h-24 bg-blue-500/20 rounded-full flex items-center justify-center mb-6">
        <Receipt className="w-12 h-12 text-blue-400" />
      </div>

      <h1 className="text-2xl font-bold mb-2">Registra Spesa</h1>
      <p className="text-muted-foreground text-center mb-8">
        Scatta una foto dello scontrino o caricala dalla galleria
      </p>

      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
        {/* Pulsante Fotocamera */}
        <button
          onClick={() => cameraInputRef.current?.click()}
          className="flex-1 glass-strong hover:bg-white/20 transition-all p-6 rounded-2xl flex flex-col items-center gap-3"
        >
          <div className="w-14 h-14 bg-green-500/20 rounded-full flex items-center justify-center">
            <Camera className="w-7 h-7 text-green-400" />
          </div>
          <span className="font-semibold">Scatta Foto</span>
        </button>

        {/* Pulsante Upload */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex-1 glass-strong hover:bg-white/20 transition-all p-6 rounded-2xl flex flex-col items-center gap-3"
        >
          <div className="w-14 h-14 bg-blue-500/20 rounded-full flex items-center justify-center">
            <Upload className="w-7 h-7 text-blue-400" />
          </div>
          <span className="font-semibold">Carica Immagine</span>
        </button>
      </div>

      {/* Input nascosti */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleImageSelect}
        className="hidden"
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageSelect}
        className="hidden"
      />
    </motion.div>
  );

  // Render stato: Analyzing
  const renderAnalyzingState = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center min-h-[60vh] p-6"
    >
      {imagePreview && (
        <div className="w-48 h-48 rounded-2xl overflow-hidden mb-6 shadow-lg">
          <img src={imagePreview} alt="Scontrino" className="w-full h-full object-cover" />
        </div>
      )}

      <Loader2 className="w-12 h-12 text-blue-400 animate-spin mb-4" />
      <h2 className="text-xl font-semibold mb-2">Analisi in corso...</h2>
      <p className="text-muted-foreground text-center">
        Gemini sta leggendo lo scontrino
      </p>
    </motion.div>
  );

  // Render stato: Review
  const renderReviewState = () => {
    if (!analysis) return null;

    const categoryConfig = CATEGORY_CONFIG[analysis.category] || CATEGORY_CONFIG['altro'];

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 pb-32"
      >
        {/* Header con immagine */}
        <div className="flex items-start gap-4 mb-6">
          {imagePreview && (
            <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 shadow-lg">
              <img src={imagePreview} alt="Scontrino" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="flex-1">
            <h1 className="text-xl font-bold mb-1">Conferma Spesa</h1>
            <p className="text-muted-foreground text-sm">
              Verifica i dati estratti dallo scontrino
            </p>
          </div>
        </div>

        {/* Card principale */}
        <div className="glass-strong rounded-2xl p-5 mb-4">
          {/* Negozio e categoria */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center">
                <Store className="w-5 h-5 text-gray-400" />
              </div>
              <div>
                <h3 className="font-semibold">{analysis.storeName}</h3>
                {analysis.storeAddress && (
                  <p className="text-sm text-muted-foreground">{analysis.storeAddress}</p>
                )}
              </div>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${categoryConfig.color}`}>
              {categoryConfig.icon} {categoryConfig.label}
            </span>
          </div>

          {/* Totale grande */}
          <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-xl p-4 mb-4">
            <div className="text-sm text-muted-foreground mb-1">Totale</div>
            <div className="text-4xl font-bold">
              {analysis.currency} {analysis.totalAmount.toFixed(2)}
            </div>
            {analysis.vatAmount && (
              <div className="text-sm text-muted-foreground mt-1">
                di cui IVA {analysis.vatRate || ''}: {analysis.currency} {analysis.vatAmount.toFixed(2)}
              </div>
            )}
          </div>

          {/* Data */}
          <div className="flex items-center gap-3 mb-4 p-3 glass rounded-xl">
            <Calendar className="w-5 h-5 text-blue-400" />
            <div>
              <div className="text-sm text-muted-foreground">Data</div>
              <div className="font-semibold">
                {new Date(analysis.date).toLocaleDateString('it-CH', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
                {analysis.time && ` alle ${analysis.time}`}
              </div>
            </div>
          </div>

          {/* Dettaglio prodotti */}
          {analysis.items && analysis.items.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-3">
                <ShoppingCart className="w-4 h-4 text-blue-400" />
                <span className="font-semibold text-sm">Dettaglio Prodotti</span>
              </div>
              <div className="space-y-2">
                {analysis.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 glass rounded-lg">
                    <div className="flex-1">
                      <span className="text-sm">{item.description}</span>
                      {item.quantity && (
                        <span className="text-xs text-muted-foreground ml-2">
                          x{item.quantity}
                        </span>
                      )}
                    </div>
                    <span className="font-semibold text-sm">
                      {analysis.currency} {item.totalPrice.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modalità pagamento */}
        <div className="glass-strong rounded-2xl p-5 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-5 h-5 text-blue-400" />
            <span className="font-semibold">Pagato con</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setPaymentMode('company_account')}
              className={`p-4 rounded-xl transition-all flex flex-col items-center gap-2 ${
                paymentMode === 'company_account'
                  ? 'bg-blue-600 text-white'
                  : 'glass hover:bg-white/10'
              }`}
            >
              <CreditCard className="w-6 h-6" />
              <span className="text-sm font-medium">Carta Aziendale</span>
            </button>

            <button
              onClick={() => setPaymentMode('own_account')}
              className={`p-4 rounded-xl transition-all flex flex-col items-center gap-2 ${
                paymentMode === 'own_account'
                  ? 'bg-blue-600 text-white'
                  : 'glass hover:bg-white/10'
              }`}
            >
              <Wallet className="w-6 h-6" />
              <span className="text-sm font-medium">Soldi Miei</span>
            </button>
          </div>
        </div>

        {/* Nota opzionale */}
        <div className="glass-strong rounded-2xl p-5 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-5 h-5 text-blue-400" />
            <span className="font-semibold">Nota (opzionale)</span>
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Aggiungi una nota..."
            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={2}
          />
        </div>

        {/* Pulsanti azione */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-gray-900 via-gray-900/95 to-transparent">
          <div className="flex gap-3 max-w-lg mx-auto">
            <button
              onClick={resetForm}
              className="flex-1 glass hover:bg-white/20 transition-all p-4 rounded-xl flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-5 h-5" />
              Annulla
            </button>
            <button
              onClick={submitExpense}
              className="flex-[2] bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 transition-all p-4 rounded-xl flex items-center justify-center gap-2 font-semibold"
            >
              <Check className="w-5 h-5" />
              Conferma Spesa
            </button>
          </div>
        </div>
      </motion.div>
    );
  };

  // Render stato: Submitting
  const renderSubmittingState = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center min-h-[60vh] p-6"
    >
      <Loader2 className="w-12 h-12 text-green-400 animate-spin mb-4" />
      <h2 className="text-xl font-semibold mb-2">Invio in corso...</h2>
      <p className="text-muted-foreground text-center">
        Creazione spesa in Odoo
      </p>
    </motion.div>
  );

  // Render stato: Success
  const renderSuccessState = () => (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center min-h-[60vh] p-6"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', delay: 0.2 }}
        className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mb-6"
      >
        <Check className="w-12 h-12 text-green-400" />
      </motion.div>

      <h2 className="text-2xl font-bold mb-2">Spesa Registrata!</h2>
      <p className="text-muted-foreground text-center mb-8">
        La spesa è stata creata e inviata per approvazione
      </p>

      {analysis && (
        <div className="glass-strong rounded-2xl p-6 w-full max-w-sm mb-8">
          <div className="flex items-center justify-between mb-3">
            <span className="text-muted-foreground">Negozio</span>
            <span className="font-semibold">{analysis.storeName}</span>
          </div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-muted-foreground">Importo</span>
            <span className="font-bold text-xl text-green-400">
              {analysis.currency} {analysis.totalAmount.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Data</span>
            <span className="font-semibold">{analysis.date}</span>
          </div>
        </div>
      )}

      <button
        onClick={resetForm}
        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all px-8 py-4 rounded-xl flex items-center gap-2 font-semibold"
      >
        <Receipt className="w-5 h-5" />
        Registra Altra Spesa
      </button>
    </motion.div>
  );

  // Render stato: Error
  const renderErrorState = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center min-h-[60vh] p-6"
    >
      <div className="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center mb-6">
        <AlertCircle className="w-12 h-12 text-red-400" />
      </div>

      <h2 className="text-2xl font-bold mb-2">Errore</h2>
      <p className="text-muted-foreground text-center mb-4">
        {errorMessage || 'Si è verificato un errore'}
      </p>

      <div className="flex gap-3">
        <button
          onClick={resetForm}
          className="glass hover:bg-white/20 transition-all px-6 py-3 rounded-xl flex items-center gap-2"
        >
          <RefreshCw className="w-5 h-5" />
          Riprova
        </button>
      </div>
    </motion.div>
  );

  // Render principale
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <div className="sticky top-0 z-50 glass-strong border-b border-white/10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
              <Receipt className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold">Spese</h1>
              <p className="text-xs text-muted-foreground">LAPA App</p>
            </div>
          </div>

          {appState !== 'upload' && appState !== 'success' && (
            <button
              onClick={resetForm}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Contenuto */}
      <div className="max-w-lg mx-auto">
        <AnimatePresence mode="wait">
          {appState === 'upload' && renderUploadState()}
          {appState === 'analyzing' && renderAnalyzingState()}
          {appState === 'review' && renderReviewState()}
          {appState === 'submitting' && renderSubmittingState()}
          {appState === 'success' && renderSuccessState()}
          {appState === 'error' && renderErrorState()}
        </AnimatePresence>
      </div>
    </div>
  );
}
