'use client';

import { useState, useRef } from 'react';
import {
  ArrowLeft, Home, Sparkles, Upload, Image as ImageIcon,
  Video, Loader2, Download, Instagram, Facebook, Linkedin,
  CheckCircle2, Wand2, MessageSquare, Hash, Target,
  Play, X, Package, Share2
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import ProductSelector from '@/components/social-ai/ProductSelector';
import ShareMenu from '@/components/social-ai/ShareMenu';

type SocialPlatform = 'instagram' | 'facebook' | 'tiktok' | 'linkedin';
type ContentType = 'image' | 'video' | 'both';
type Tone = 'professional' | 'casual' | 'fun' | 'luxury';

interface MarketingResult {
  copywriting: {
    caption: string;
    hashtags: string[];
    cta: string;
  };
  image?: {
    dataUrl: string;
  };
  video?: {
    operationId: string;
    status: 'generating' | 'completed';
    dataUrl?: string;
  };
  metadata: {
    platform: string;
    aspectRatio: string;
  };
}

export default function SocialAIStudioPage() {
  // Form states
  const [productImage, setProductImage] = useState<string | null>(null);
  const [productImagePreview, setProductImagePreview] = useState<string | null>(null);
  const [productName, setProductName] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [socialPlatform, setSocialPlatform] = useState<SocialPlatform>('instagram');
  const [contentType, setContentType] = useState<ContentType>('both');
  const [tone, setTone] = useState<Tone>('professional');
  const [targetAudience, setTargetAudience] = useState('');

  // Generation states
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<string[]>([]);
  const [result, setResult] = useState<MarketingResult | null>(null);

  // Video polling
  const [isPollingVideo, setIsPollingVideo] = useState(false);

  // Product Selector
  const [isProductSelectorOpen, setIsProductSelectorOpen] = useState(false);

  // Share Menu
  const [isShareMenuOpen, setIsShareMenuOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ==========================================
  // Compressione Immagine (per evitare errori con foto troppo grandi)
  // ==========================================
  const compressImage = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Calcola le dimensioni target (max 1024px sul lato più lungo)
          const MAX_SIZE = 1024;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_SIZE) {
              height = (height * MAX_SIZE) / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width = (width * MAX_SIZE) / height;
              height = MAX_SIZE;
            }
          }

          // Crea canvas per ridimensionare
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Impossibile creare il canvas'));
            return;
          }

          // Disegna l'immagine ridimensionata
          ctx.drawImage(img, 0, 0, width, height);

          // Converti in base64 con qualità ridotta (0.8 = 80%)
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);

          // Calcola la riduzione di dimensione
          const originalSize = (file.size / 1024).toFixed(0);
          const compressedSize = ((compressedBase64.length * 3) / 4 / 1024).toFixed(0);

          console.log(`Compressione: ${originalSize}KB → ${compressedSize}KB (${width}x${height}px)`);

          resolve(compressedBase64);
        };

        img.onerror = () => reject(new Error('Errore nel caricamento dell\'immagine'));
        img.src = e.target?.result as string;
      };

      reader.onerror = () => reject(new Error('Errore nella lettura del file'));
      reader.readAsDataURL(file);
    });
  };

  // ==========================================
  // Product Selector Handler
  // ==========================================
  const handleProductSelect = async (product: any) => {
    // Set product info
    setProductName(product.name);
    setProductDescription(product.description || '');

    // Se c'è un'immagine, usala
    if (product.image) {
      try {
        // Se l'immagine è già base64, usala direttamente
        if (product.image.startsWith('data:image')) {
          setProductImage(product.image);
          setProductImagePreview(product.image);
          toast.success('Prodotto caricato! Foto e info precompilate.');
        } else {
          // Altrimenti converti in base64
          const response = await fetch(product.image);
          const blob = await response.blob();
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = reader.result as string;
            setProductImage(base64);
            setProductImagePreview(base64);
            toast.success('Prodotto caricato! Foto e info precompilate.');
          };
          reader.readAsDataURL(blob);
        }
      } catch (error) {
        console.error('Errore caricamento immagine prodotto:', error);
        toast.error('Prodotto caricato, ma impossibile caricare l\'immagine');
      }
    } else {
      toast.success('Prodotto caricato! Carica manualmente una foto.');
    }
  };

  // ==========================================
  // Upload Foto Prodotto
  // ==========================================
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Seleziona un file immagine valido');
      return;
    }

    try {
      toast.loading('Compressione immagine...');
      const compressedBase64 = await compressImage(file);
      setProductImage(compressedBase64);
      setProductImagePreview(compressedBase64);
      toast.dismiss();
      toast.success('Foto prodotto caricata e ottimizzata!');
    } catch (error: any) {
      console.error('Errore compressione:', error);
      toast.dismiss();
      toast.error('Errore durante la compressione dell\'immagine');
    }
  };

  // ==========================================
  // Genera Contenuti Marketing
  // ==========================================
  const handleGenerate = async () => {
    if (!productImage) {
      toast.error('Carica una foto del prodotto prima!');
      return;
    }

    setIsGenerating(true);
    setGenerationProgress([]);
    setResult(null);

    const loadingToast = toast.loading('Avvio agenti AI...');

    try {
      // Progress updates
      setGenerationProgress(['🚀 Inizializzazione agenti in parallelo...']);

      const response = await fetch('/api/social-ai/generate-marketing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productImage,
          productName: productName || undefined,
          productDescription: productDescription || undefined,
          socialPlatform,
          contentType,
          tone,
          targetAudience: targetAudience || undefined
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore durante la generazione');
      }

      setGenerationProgress(prev => [
        ...prev,
        '✅ Copywriting completato',
        contentType !== 'video' ? '✅ Immagine generata con Nano Banana 🍌' : '',
        contentType !== 'image' ? '⏳ Video in generazione con Veo 3.1...' : ''
      ].filter(Boolean));

      setResult(data.data);

      // Se c'è un video in generazione, avvia il polling
      const hasValidVideoOperation = data.data.video?.operationId &&
                                      data.data.video.operationId.length > 0 &&
                                      data.data.video.status === 'generating';

      if (hasValidVideoOperation) {
        console.log('✅ Video operation ID valido, avvio polling:', data.data.video.operationId);
        toast.success('Copy e immagine pronti! Video in generazione...', { id: loadingToast });
        startVideoPolling(data.data.video.operationId);
      } else if (contentType === 'video' || contentType === 'both') {
        // Se era richiesto un video ma non è stato generato
        console.log('⚠️ Video richiesto ma non generato:', data.data.video);
        toast.success('Copy e immagine pronti! (Video non disponibile)', { id: loadingToast });
        setGenerationProgress(prev => [...prev, '⚠️ Video generation non disponibile al momento']);
      } else {
        toast.success('Contenuti marketing generati con successo!', { id: loadingToast });
      }

    } catch (error: any) {
      console.error('Errore:', error);
      toast.error(error.message || 'Errore durante la generazione', { id: loadingToast });
      setGenerationProgress(prev => [...prev, '❌ Errore: ' + error.message]);
    } finally {
      setIsGenerating(false);
    }
  };

  // ==========================================
  // Polling Video
  // ==========================================
  const startVideoPolling = async (operationId: string) => {
    // Validazione operationId
    if (!operationId || operationId.trim().length === 0) {
      console.error('❌ operationId non valido, skip polling');
      setIsPollingVideo(false);
      return;
    }

    setIsPollingVideo(true);
    const maxAttempts = 60; // 5 minuti max (ogni 5 secondi)
    let attempts = 0;

    const poll = async () => {
      try {
        const response = await fetch('/api/social-ai/check-video-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operationId })
        });

        const data = await response.json();

        // Se c'è un errore 500, ferma il polling
        if (!response.ok) {
          console.error('❌ Errore video polling:', data.error);
          setGenerationProgress(prev => [...prev, `❌ Video polling fallito: ${data.error || 'Errore sconosciuto'}`]);
          setIsPollingVideo(false);
          return;
        }

        if (data.done && data.video) {
          // Video completato!
          setResult(prev => prev ? {
            ...prev,
            video: {
              ...prev.video!,
              status: 'completed',
              dataUrl: data.video.dataUrl
            }
          } : null);

          setGenerationProgress(prev => [...prev, '✅ Video completato!']);
          toast.success('Video marketing generato con successo!');
          setIsPollingVideo(false);
          return;
        }

        // Continua polling
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000); // Riprova dopo 5 secondi
        } else {
          toast.error('Timeout: il video sta impiegando troppo tempo');
          setIsPollingVideo(false);
        }

      } catch (error) {
        console.error('Errore polling video:', error);
        setIsPollingVideo(false);
      }
    };

    poll();
  };

  // ==========================================
  // Download
  // ==========================================
  const handleDownloadImage = () => {
    if (!result?.image?.dataUrl) return;

    const link = document.createElement('a');
    link.href = result.image.dataUrl;
    link.download = `marketing-${socialPlatform}-${Date.now()}.png`;
    link.click();
    toast.success('Download immagine avviato!');
  };

  const handleDownloadVideo = () => {
    if (!result?.video?.dataUrl) return;

    const link = document.createElement('a');
    link.href = result.video.dataUrl;
    link.download = `marketing-${socialPlatform}-${Date.now()}.mp4`;
    link.click();
    toast.success('Download video avviato!');
  };

  // ==========================================
  // Platform Icons
  // ==========================================
  const platformIcons: Record<SocialPlatform, any> = {
    instagram: Instagram,
    facebook: Facebook,
    tiktok: Video,
    linkedin: Linkedin
  };

  const PlatformIcon = platformIcons[socialPlatform];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <div className="bg-slate-900/80 backdrop-blur-sm border-b border-purple-500/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Link
                  href="/dashboard"
                  className="flex items-center space-x-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg border border-purple-500/30 transition-colors group"
                >
                  <ArrowLeft className="h-5 w-5 text-purple-300 group-hover:text-white" />
                  <Home className="h-5 w-5 text-purple-300 group-hover:text-white" />
                  <span className="text-purple-300 group-hover:text-white font-medium">Home</span>
                </Link>

                <div className="flex items-center space-x-3">
                  <div className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 p-3 rounded-xl">
                    <Sparkles className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white">Social Marketing AI Studio</h1>
                    <p className="text-xs sm:text-sm text-purple-300">
                      Powered by Gemini 2.5 Flash (Nano Banana 🍌) & Veo 3.1
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        <div className="grid lg:grid-cols-2 gap-4 md:gap-6 lg:gap-8">

          {/* ========================================== */}
          {/* COLONNA SINISTRA: Configurazione */}
          {/* ========================================== */}
          <div className="space-y-4 sm:space-y-6">

            {/* Upload Foto Prodotto */}
            <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl border border-purple-500/30 p-4 sm:p-6">
              <label className="block text-sm font-medium text-purple-300 mb-3 flex items-center space-x-2">
                <Upload className="h-4 w-4" />
                <span>Foto Prodotto/Processo</span>
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={isGenerating}
                className="hidden"
              />

              {/* Pulsante Scegli dal Catalogo */}
              <button
                onClick={() => setIsProductSelectorOpen(true)}
                disabled={isGenerating}
                className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 border border-emerald-400/50 rounded-lg text-white font-medium transition-all disabled:opacity-50 mb-3"
              >
                <Package className="h-4 w-4" />
                <span className="text-sm">Scegli Prodotto dal Catalogo</span>
              </button>

              {/* Oppure carica foto */}
              <div className="relative my-3">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-purple-500/30"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 bg-slate-800/40 text-purple-400">oppure</span>
                </div>
              </div>

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isGenerating}
                className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-slate-900/50 hover:bg-slate-700/50 border border-purple-500/50 hover:border-purple-400 rounded-lg text-purple-300 hover:text-white transition-all disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                <span className="text-sm">Carica Foto Manualmente</span>
              </button>

              {productImagePreview && (
                <div className="mt-4 relative">
                  <img
                    src={productImagePreview}
                    alt="Prodotto"
                    className="w-full h-auto max-h-[200px] sm:max-h-[300px] object-contain rounded-lg border border-purple-500/50"
                  />
                  <button
                    onClick={() => {
                      setProductImage(null);
                      setProductImagePreview(null);
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-red-500 hover:bg-red-600 rounded-full text-white transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <div className="mt-2 text-xs text-emerald-400 text-center">
                    ✓ Foto caricata
                  </div>
                </div>
              )}
            </div>

            {/* Info Prodotto */}
            <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl border border-purple-500/30 p-4 sm:p-6">
              <label className="block text-sm font-medium text-purple-300 mb-2">
                Nome Prodotto (opzionale)
              </label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Es: Caffè Premium Arabica"
                className="w-full px-4 py-2 bg-slate-900/50 border border-purple-500/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder:text-slate-500"
                disabled={isGenerating}
              />

              <label className="block text-sm font-medium text-purple-300 mb-2 mt-4">
                Descrizione (opzionale)
              </label>
              <textarea
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
                placeholder="Breve descrizione del prodotto..."
                className="w-full px-4 py-2 bg-slate-900/50 border border-purple-500/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder:text-slate-500 min-h-[80px] resize-none"
                disabled={isGenerating}
              />
            </div>

            {/* Social Platform */}
            <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl border border-purple-500/30 p-4 sm:p-6">
              <label className="block text-sm font-medium text-purple-300 mb-3">
                Piattaforma Social
              </label>
              <div className="grid grid-cols-2 gap-3">
                {(['instagram', 'facebook', 'tiktok', 'linkedin'] as SocialPlatform[]).map((platform) => {
                  const Icon = platformIcons[platform];
                  return (
                    <button
                      key={platform}
                      onClick={() => setSocialPlatform(platform)}
                      disabled={isGenerating}
                      className={`flex items-center justify-center space-x-2 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                        socialPlatform === platform
                          ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                          : 'bg-slate-900/50 text-purple-300 border border-purple-500/50 hover:border-purple-400'
                      } disabled:opacity-50 capitalize`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{platform}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Content Type */}
            <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl border border-purple-500/30 p-4 sm:p-6">
              <label className="block text-sm font-medium text-purple-300 mb-3">
                Tipo Contenuto
              </label>
              <div className="grid grid-cols-3 gap-3">
                {(['image', 'video', 'both'] as ContentType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => setContentType(type)}
                    disabled={isGenerating}
                    className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                      contentType === type
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                        : 'bg-slate-900/50 text-purple-300 border border-purple-500/50 hover:border-purple-400'
                    } disabled:opacity-50 capitalize`}
                  >
                    {type === 'image' && <ImageIcon className="h-4 w-4 mx-auto mb-1" />}
                    {type === 'video' && <Video className="h-4 w-4 mx-auto mb-1" />}
                    {type === 'both' && <Sparkles className="h-4 w-4 mx-auto mb-1" />}
                    {type === 'both' ? 'Entrambi' : type === 'image' ? 'Foto' : 'Video'}
                  </button>
                ))}
              </div>
            </div>

            {/* Tone & Target */}
            <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl border border-purple-500/30 p-4 sm:p-6">
              <label className="block text-sm font-medium text-purple-300 mb-2">
                Tone of Voice
              </label>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {(['professional', 'casual', 'fun', 'luxury'] as Tone[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTone(t)}
                    disabled={isGenerating}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      tone === t
                        ? 'bg-purple-500 text-white'
                        : 'bg-slate-900/50 text-purple-300 border border-purple-500/50'
                    } disabled:opacity-50 capitalize`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <label className="block text-sm font-medium text-purple-300 mb-2">
                Target Audience (opzionale)
              </label>
              <input
                type="text"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="Es: Giovani professionisti 25-35 anni"
                className="w-full px-4 py-2 bg-slate-900/50 border border-purple-500/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder:text-slate-500 text-sm"
                disabled={isGenerating}
              />
            </div>

            {/* Pulsante Genera */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !productImage}
              className="w-full flex items-center justify-center space-x-2 sm:space-x-3 px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 hover:from-purple-600 hover:via-pink-600 hover:to-orange-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl hover:shadow-purple-500/25 text-sm sm:text-base md:text-lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 animate-spin" />
                  <span>Generazione in corso...</span>
                </>
              ) : (
                <>
                  <Wand2 className="h-5 w-5 sm:h-6 sm:w-6" />
                  <span className="text-center">Genera Contenuti Marketing AI 🚀</span>
                </>
              )}
            </button>

            {/* Progress */}
            {generationProgress.length > 0 && (
              <div className="bg-slate-900/50 border border-purple-500/30 rounded-xl p-4">
                <div className="text-xs text-purple-300 space-y-1">
                  {generationProgress.map((msg, idx) => (
                    <div key={idx}>{msg}</div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ========================================== */}
          {/* COLONNA DESTRA: Risultati */}
          {/* ========================================== */}
          <div className="space-y-6">

            {/* Info Card */}
            <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl p-6">
              <h3 className="text-white font-semibold mb-3 flex items-center space-x-2">
                <Sparkles className="h-5 w-5 text-purple-400" />
                <span>Come funziona</span>
              </h3>
              <ul className="space-y-2 text-sm text-purple-200">
                <li className="flex items-start space-x-2">
                  <span className="text-purple-400">1.</span>
                  <span>Carica una foto del tuo prodotto o processo</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-pink-400">2.</span>
                  <span>Scegli piattaforma social e tipo contenuto (foto/video)</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-orange-400">3.</span>
                  <span>3 Agenti AI lavorano in PARALLELO per te!</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-emerald-400">4.</span>
                  <span>Ricevi: Caption + Hashtags + Immagine/Video pronti!</span>
                </li>
              </ul>
            </div>

            {/* Risultati */}
            {result && (
              <>
                {/* Pulsante Condividi (grande, sopra i risultati) */}
                <button
                  onClick={() => setIsShareMenuOpen(true)}
                  className="w-full flex items-center justify-center space-x-2 px-6 py-4 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-emerald-500/25"
                >
                  <Share2 className="h-5 w-5" />
                  <span>Condividi sui Social 🚀</span>
                </button>

                {/* Copywriting */}
                <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl border border-purple-500/30 p-4 sm:p-6">
                  <div className="flex items-center space-x-2 mb-4">
                    <MessageSquare className="h-5 w-5 text-purple-400" />
                    <h3 className="text-white font-semibold">Copywriting</h3>
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 ml-auto" />
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="text-xs text-purple-300 mb-1">Caption</div>
                      <div className="text-white bg-slate-900/50 p-3 rounded-lg">
                        {result.copywriting.caption}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-purple-300 mb-1 flex items-center space-x-1">
                        <Hash className="h-3 w-3" />
                        <span>Hashtags</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {result.copywriting.hashtags.map((tag, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-xs"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-purple-300 mb-1 flex items-center space-x-1">
                        <Target className="h-3 w-3" />
                        <span>Call-to-Action</span>
                      </div>
                      <div className="text-white bg-slate-900/50 p-3 rounded-lg">
                        {result.copywriting.cta}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Immagine */}
                {result.image && (
                  <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl border border-purple-500/30 p-6">
                    <div className="flex items-center space-x-2 mb-4">
                      <ImageIcon className="h-5 w-5 text-purple-400" />
                      <h3 className="text-white font-semibold">Immagine Marketing</h3>
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 ml-auto" />
                    </div>

                    <img
                      src={result.image.dataUrl}
                      alt="Marketing"
                      className="w-full h-auto rounded-lg border border-purple-500/50 mb-3"
                    />

                    <button
                      onClick={handleDownloadImage}
                      className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition-colors"
                    >
                      <Download className="h-4 w-4" />
                      <span>Download Immagine</span>
                    </button>

                    <div className="mt-2 text-xs text-purple-300 text-center">
                      Generato con Nano Banana 🍌 (Gemini 2.5 Flash Image)
                    </div>
                  </div>
                )}

                {/* Video */}
                {result.video && (
                  <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl border border-purple-500/30 p-6">
                    <div className="flex items-center space-x-2 mb-4">
                      <Video className="h-5 w-5 text-purple-400" />
                      <h3 className="text-white font-semibold">Video Marketing</h3>
                      {result.video.status === 'completed' && (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 ml-auto" />
                      )}
                      {result.video.status === 'generating' && (
                        <Loader2 className="h-4 w-4 text-yellow-400 ml-auto animate-spin" />
                      )}
                    </div>

                    {result.video.status === 'generating' && (
                      <div className="text-center py-8 space-y-4">
                        <Loader2 className="h-12 w-12 text-purple-500 mx-auto animate-spin" />
                        <div className="text-purple-300">
                          Veo 3.1 sta generando il video...
                        </div>
                        <div className="text-xs text-purple-400">
                          Questo può richiedere 1-3 minuti
                        </div>
                      </div>
                    )}

                    {result.video.status === 'completed' && result.video.dataUrl && (
                      <>
                        <video
                          src={result.video.dataUrl}
                          controls
                          className="w-full h-auto rounded-lg border border-purple-500/50 mb-3"
                        />

                        <button
                          onClick={handleDownloadVideo}
                          className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition-colors"
                        >
                          <Download className="h-4 w-4" />
                          <span>Download Video</span>
                        </button>

                        <div className="mt-2 text-xs text-purple-300 text-center">
                          Generato con Veo 3.1 (Google AI)
                        </div>
                      </>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Placeholder quando non ci sono risultati */}
            {!result && !isGenerating && (
              <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl border border-purple-500/30 p-12 text-center">
                <Sparkles className="h-16 w-16 text-purple-500/30 mx-auto mb-4" />
                <div className="text-purple-400 font-medium">
                  I contenuti marketing appariranno qui
                </div>
                <div className="text-purple-500/50 text-sm mt-2">
                  Carica una foto e clicca "Genera"
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <ProductSelector
        isOpen={isProductSelectorOpen}
        onClose={() => setIsProductSelectorOpen(false)}
        onSelect={handleProductSelect}
      />

      {result && (
        <ShareMenu
          isOpen={isShareMenuOpen}
          onClose={() => setIsShareMenuOpen(false)}
          caption={result.copywriting.caption}
          hashtags={result.copywriting.hashtags}
          cta={result.copywriting.cta}
          imageUrl={result.image?.dataUrl}
          videoUrl={result.video?.dataUrl}
          platform={socialPlatform}
        />
      )}
    </div>
  );
}
