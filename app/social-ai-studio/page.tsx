'use client';

import { useState, useRef } from 'react';
import {
  ArrowLeft, Home, Sparkles, Upload, Image as ImageIcon,
  Video, Loader2, Download, Instagram, Facebook, Linkedin,
  CheckCircle2, Wand2, MessageSquare, Hash, Target,
  Play, X, Package, Share2, BarChart3, TrendingUp, Award,
  AlertCircle, Zap, Youtube
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import ProductSelector from '@/components/social-ai/ProductSelector';
import ShareMenu from '@/components/social-ai/ShareMenu';
import {
  getSentimentEmoji,
  getRecommendationColor,
  getEngagementLevel
} from '@/lib/social-ai/sentiment-helpers';

type SocialPlatform = 'instagram' | 'facebook' | 'tiktok' | 'linkedin';
type ContentType = 'image' | 'video' | 'both';
type Tone = 'professional' | 'casual' | 'fun' | 'luxury';
type VideoStyle = 'default' | 'zoom' | 'rotate' | 'dynamic' | 'cinematic' | 'explosion' | 'orbital' | 'reassembly';
type VideoDuration = 4 | 6 | 8; // Veo 3.1 supporta solo 4, 6, 8 secondi (massimo 8s)

interface SentimentAnalysis {
  sentiment: 'positive' | 'neutral' | 'negative';
  sentimentScore: number;
  predictedEngagement: number;
  qualityScore: number;
  strengths: string[];
  improvements: string[];
  recommendation: 'ready_to_post' | 'needs_improvement' | 'regenerate';
}

interface MarketingResult {
  copywriting: {
    caption: string;
    hashtags: string[];
    cta: string;
  };
  sentiment?: SentimentAnalysis;
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
  const [videoStyle, setVideoStyle] = useState<VideoStyle>('default');
  const [videoDuration, setVideoDuration] = useState<VideoDuration>(6);

  // Branding states
  const [includeLogo, setIncludeLogo] = useState(false);
  const [logoImage, setLogoImage] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [companyMotto, setCompanyMotto] = useState('');

  // Geo-Targeting states
  const [targetCanton, setTargetCanton] = useState('');
  const [targetCity, setTargetCity] = useState('');
  const [productCategory, setProductCategory] = useState('');

  // Recipe states
  const [includeRecipe, setIncludeRecipe] = useState(false);
  const [recipeData, setRecipeData] = useState<any | null>(null);
  const [isGeneratingRecipe, setIsGeneratingRecipe] = useState(false);
  const [isPublishingRecipe, setIsPublishingRecipe] = useState(false);
  const [publishProgress, setPublishProgress] = useState<string[]>([]);

  // YouTube publishing states
  const [isPublishingYouTube, setIsPublishingYouTube] = useState(false);
  const [youtubePublishResult, setYoutubePublishResult] = useState<any | null>(null);

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
  // Upload Logo
  // ==========================================
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Seleziona un file immagine valido per il logo');
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setLogoImage(base64);
        setLogoPreview(base64);
        toast.success('Logo aziendale caricato!');
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      console.error('Errore upload logo:', error);
      toast.error('Errore durante il caricamento del logo');
    }
  };

  // ==========================================
  // Load Default Logo
  // ==========================================
  const loadDefaultLogo = async () => {
    try {
      toast.loading('Caricamento logo LAPA...');

      const response = await fetch('/logo-lapa.png');

      if (!response.ok) {
        throw new Error(`Errore nel caricamento: ${response.statusText}`);
      }

      const blob = await response.blob();
      const reader = new FileReader();

      reader.onload = () => {
        const base64 = reader.result as string;
        setLogoImage(base64);
        setLogoPreview(base64);
        toast.dismiss();
        toast.success('Logo LAPA caricato!');
      };

      reader.onerror = () => {
        toast.dismiss();
        toast.error('Errore nella conversione del logo');
      };

      reader.readAsDataURL(blob);
    } catch (error: any) {
      console.error('Errore caricamento logo predefinito:', error);
      toast.dismiss();
      toast.error(error.message || 'Errore durante il caricamento del logo LAPA');
    }
  };

  // ==========================================
  // Genera Ricetta Tradizionale
  // ==========================================
  const handleGenerateRecipe = async () => {
    if (!productName) {
      toast.error('Inserisci il nome del prodotto prima!');
      return;
    }

    setIsGeneratingRecipe(true);
    setRecipeData(null);

    const loadingToast = toast.loading('Ricerca ricetta tradizionale...');

    try {
      setGenerationProgress(prev => [...prev, '🔍 Ricerca ricetta tradizionale in corso...']);

      const response = await fetch('/api/social-ai/product-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName,
          productDescription: productDescription || undefined,
          productImage: productImage || undefined
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore durante generazione ricetta');
      }

      setRecipeData(data.data);
      setGenerationProgress(prev => [
        ...prev,
        '✅ Ricetta tradizionale trovata!',
        `📍 Regione: ${data.data.recipe.region}`
      ]);

      toast.success('Ricetta generata con successo!', { id: loadingToast });

    } catch (error: any) {
      console.error('Errore generazione ricetta:', error);
      toast.error(error.message || 'Errore durante generazione ricetta', { id: loadingToast });
      setGenerationProgress(prev => [...prev, '❌ Errore: ' + error.message]);
    } finally {
      setIsGeneratingRecipe(false);
    }
  };

  // ==========================================
  // Pubblica Ricetta su Blog + Social
  // ==========================================
  const handlePublishRecipe = async () => {
    if (!recipeData || !productName || !productImage || !recipeData.imageUrl) {
      toast.error('Genera prima la ricetta completa!');
      return;
    }

    setIsPublishingRecipe(true);
    setPublishProgress([]);

    const loadingToast = toast.loading('Pubblicazione in corso...');

    try {
      setPublishProgress(['🚀 Inizio pubblicazione...']);

      const response = await fetch('/api/social-ai/publish-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipeData: recipeData.recipe,
          productName,
          productImage,
          recipeImage: recipeData.imageUrl,
          sources: recipeData.sources || []
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore durante pubblicazione');
      }

      setPublishProgress(prev => [
        ...prev,
        '✅ Ricetta tradotta in 4 lingue!',
        '✅ Immagini caricate su Odoo!',
        '✅ 4 Blog post creati!',
        '✅ Post social generati!',
        '🎉 Pubblicazione completata!'
      ]);

      toast.success('Ricetta pubblicata con successo su Blog e Social!', { id: loadingToast });

      // Mostra risultati
      console.log('Blog posts creati:', data.data.blogPosts);
      console.log('Post social:', data.data.socialPosts);

    } catch (error: any) {
      console.error('Errore pubblicazione:', error);
      toast.error(error.message || 'Errore durante pubblicazione', { id: loadingToast });
      setPublishProgress(prev => [...prev, '❌ Errore: ' + error.message]);
    } finally {
      setIsPublishingRecipe(false);
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

    // Se abilitata, genera anche la ricetta
    if (includeRecipe && productName) {
      await handleGenerateRecipe();
    }

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
          targetAudience: targetAudience || undefined,
          videoStyle: videoStyle || 'default',
          videoDuration: videoDuration || 6,
          // Branding
          includeLogo,
          logoImage: logoImage || undefined,
          companyMotto: companyMotto || undefined,
          // Geo-Targeting & RAG
          productCategory: productCategory || undefined,
          targetCanton: targetCanton || undefined,
          targetCity: targetCity || undefined
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
    const maxAttempts = 120; // 10 minuti max (ogni 5 secondi) - per video lunghi fino a 30s
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
  // Pubblica Video su YouTube
  // ==========================================
  const handlePublishYouTube = async () => {
    if (!result?.video?.dataUrl || !result?.copywriting) {
      toast.error('Video o copywriting non disponibili');
      return;
    }

    if (!productName) {
      toast.error('Nome prodotto richiesto');
      return;
    }

    setIsPublishingYouTube(true);
    const loadingToast = toast.loading('Pubblicazione su YouTube in corso...');

    try {
      console.log('[YouTube] Starting publication...');

      const response = await fetch('/api/social-ai/publish-youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoDataUrl: result.video.dataUrl,
          productName,
          productDescription: productDescription || undefined,
          caption: result.copywriting.caption,
          hashtags: result.copywriting.hashtags
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore durante pubblicazione YouTube');
      }

      setYoutubePublishResult(data.data);

      toast.success(
        <div>
          <div className="font-bold">Video pubblicato su YouTube! 🎉</div>
          <div className="text-sm mt-1">{data.data.youtubeTitle}</div>
        </div>,
        { id: loadingToast, duration: 6000 }
      );

      console.log('[YouTube] Published successfully:', data.data);

    } catch (error: any) {
      console.error('[YouTube] Publish error:', error);
      toast.error(error.message || 'Errore durante pubblicazione YouTube', {
        id: loadingToast
      });
    } finally {
      setIsPublishingYouTube(false);
    }
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
    <div className="min-h-screen min-h-[100dvh] bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
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
                    <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-white">Social Marketing AI Studio</h1>
                    <p className="text-xs sm:text-sm text-purple-300">
                      Powered by Gemini 2.5 Flash (Nano Banana 🍌) & Veo 3.1
                    </p>
                  </div>
                </div>
              </div>

              {/* Analytics Button */}
              <Link
                href="/social-ai-studio/analytics"
                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 rounded-lg transition-all group shadow-lg"
              >
                <BarChart3 className="h-5 w-5 text-white" />
                <span className="text-white font-medium hidden sm:inline">Analytics</span>
              </Link>
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
                className="w-full flex items-center justify-center space-x-2 px-4 py-3 sm:py-4 min-h-[48px] bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 border border-emerald-400/50 rounded-lg text-white font-medium transition-all disabled:opacity-50 mb-3"
              >
                <Package className="h-5 w-5" />
                <span className="text-sm sm:text-base">Scegli Prodotto dal Catalogo</span>
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
                className="w-full flex items-center justify-center space-x-2 px-4 py-3 sm:py-4 min-h-[48px] bg-slate-900/50 hover:bg-slate-700/50 border border-purple-500/50 hover:border-purple-400 rounded-lg text-purple-300 hover:text-white transition-all disabled:opacity-50"
              >
                <Upload className="h-5 w-5" />
                <span className="text-sm sm:text-base">Carica Foto Manualmente</span>
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

            {/* Branding Aziendale */}
            <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl border border-purple-500/30 p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <label className="text-sm font-medium text-purple-300">
                  Branding Aziendale
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeLogo}
                    onChange={(e) => setIncludeLogo(e.target.checked)}
                    disabled={isGenerating}
                    className="w-4 h-4 rounded border-purple-500/50 bg-slate-900/50 text-purple-500 focus:ring-2 focus:ring-purple-500"
                  />
                  <span className="text-xs text-purple-300">Includi logo/motto</span>
                </label>
              </div>

              {includeLogo && (
                <>
                  {/* Upload Logo */}
                  <div className="mb-4">
                    <label className="block text-xs text-purple-300 mb-2">
                      Logo Aziendale (opzionale)
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml"
                        onChange={handleLogoUpload}
                        disabled={isGenerating}
                        className="hidden"
                        id="logo-upload"
                      />
                      <label
                        htmlFor="logo-upload"
                        className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-slate-900/50 border border-purple-500/50 rounded-lg hover:border-purple-400 transition-colors cursor-pointer text-sm text-purple-300"
                      >
                        <Upload className="h-4 w-4" />
                        <span>Carica Logo</span>
                      </label>

                      {/* Usa Logo LAPA Button */}
                      <button
                        onClick={loadDefaultLogo}
                        disabled={isGenerating}
                        className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 border border-purple-400/50 rounded-lg transition-all cursor-pointer text-sm text-white font-medium disabled:opacity-50"
                      >
                        <Sparkles className="h-4 w-4" />
                        <span>Usa logo LAPA</span>
                      </button>
                    </div>

                    {logoPreview && (
                      <div className="mt-2 relative inline-block">
                        <img
                          src={logoPreview}
                          alt="Logo"
                          className="h-16 w-auto object-contain rounded border border-purple-500/50 bg-white/5 p-2"
                        />
                        <button
                          onClick={() => {
                            setLogoImage(null);
                            setLogoPreview(null);
                          }}
                          className="absolute -top-2 -right-2 p-1 bg-red-500 hover:bg-red-600 rounded-full text-white"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Motto Aziendale */}
                  <div>
                    <label className="block text-xs text-purple-300 mb-2">
                      Motto/Slogan (opzionale)
                    </label>
                    <input
                      type="text"
                      value={companyMotto}
                      onChange={(e) => setCompanyMotto(e.target.value)}
                      placeholder="Es: Qualità Italiana dal 1950"
                      maxLength={100}
                      className="w-full px-4 py-2 bg-slate-900/50 border border-purple-500/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder:text-slate-500 text-sm"
                      disabled={isGenerating}
                    />
                    <div className="text-xs text-slate-500 mt-1 text-right">
                      {companyMotto.length}/100
                    </div>
                  </div>
                </>
              )}
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
                      className={`flex items-center justify-center space-x-2 px-4 py-3 min-h-[48px] rounded-lg text-sm font-medium transition-all ${
                        socialPlatform === platform
                          ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                          : 'bg-slate-900/50 text-purple-300 border border-purple-500/50 hover:border-purple-400'
                      } disabled:opacity-50 capitalize`}
                    >
                      <Icon className="h-5 w-5" />
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
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {(['image', 'video', 'both'] as ContentType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => setContentType(type)}
                    disabled={isGenerating}
                    className={`px-4 py-3 min-h-[48px] rounded-lg text-sm font-medium transition-all ${
                      contentType === type
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                        : 'bg-slate-900/50 text-purple-300 border border-purple-500/50 hover:border-purple-400'
                    } disabled:opacity-50 capitalize`}
                  >
                    {type === 'image' && <ImageIcon className="h-5 w-5 mx-auto mb-1" />}
                    {type === 'video' && <Video className="h-5 w-5 mx-auto mb-1" />}
                    {type === 'both' && <Sparkles className="h-5 w-5 mx-auto mb-1" />}
                    {type === 'both' ? 'Entrambi' : type === 'image' ? 'Foto' : 'Video'}
                  </button>
                ))}
              </div>
            </div>

            {/* Video Style - mostra solo se video o both */}
            {(contentType === 'video' || contentType === 'both') && (
              <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl border border-purple-500/30 p-4 sm:p-6">
                <label className="block text-sm font-medium text-purple-300 mb-3">
                  Stile Video
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setVideoStyle('default')}
                    disabled={isGenerating}
                    className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                      videoStyle === 'default'
                        ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg'
                        : 'bg-slate-900/50 text-purple-300 border border-purple-500/50 hover:border-purple-400'
                    } disabled:opacity-50`}
                  >
                    <div className="font-semibold">Standard</div>
                    <div className="text-xs opacity-75">Movimento naturale</div>
                  </button>

                  <button
                    onClick={() => setVideoStyle('zoom')}
                    disabled={isGenerating}
                    className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                      videoStyle === 'zoom'
                        ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg'
                        : 'bg-slate-900/50 text-purple-300 border border-purple-500/50 hover:border-purple-400'
                    } disabled:opacity-50`}
                  >
                    <div className="font-semibold">Zoom In</div>
                    <div className="text-xs opacity-75">Avvicinamento lento</div>
                  </button>

                  <button
                    onClick={() => setVideoStyle('rotate')}
                    disabled={isGenerating}
                    className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                      videoStyle === 'rotate'
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                        : 'bg-slate-900/50 text-purple-300 border border-purple-500/50 hover:border-purple-400'
                    } disabled:opacity-50`}
                  >
                    <div className="font-semibold">Rotazione 360°</div>
                    <div className="text-xs opacity-75">Gira intorno prodotto</div>
                  </button>

                  <button
                    onClick={() => setVideoStyle('dynamic')}
                    disabled={isGenerating}
                    className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                      videoStyle === 'dynamic'
                        ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg'
                        : 'bg-slate-900/50 text-purple-300 border border-purple-500/50 hover:border-purple-400'
                    } disabled:opacity-50`}
                  >
                    <div className="font-semibold">Dinamico</div>
                    <div className="text-xs opacity-75">Movimento veloce</div>
                  </button>

                  <button
                    onClick={() => setVideoStyle('cinematic')}
                    disabled={isGenerating}
                    className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                      videoStyle === 'cinematic'
                        ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-lg'
                        : 'bg-slate-900/50 text-purple-300 border border-purple-500/50 hover:border-purple-400'
                    } disabled:opacity-50`}
                  >
                    <div className="font-semibold">Cinematico</div>
                    <div className="text-xs opacity-75">Stile film professionale</div>
                  </button>

                  <button
                    onClick={() => setVideoStyle('explosion')}
                    disabled={isGenerating}
                    className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                      videoStyle === 'explosion'
                        ? 'bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-lg'
                        : 'bg-slate-900/50 text-purple-300 border border-purple-500/50 hover:border-purple-400'
                    } disabled:opacity-50`}
                  >
                    <div className="font-semibold">Esplosione</div>
                    <div className="text-xs opacity-75">Assemblaggio pezzi</div>
                  </button>

                  <button
                    onClick={() => setVideoStyle('orbital')}
                    disabled={isGenerating}
                    className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                      videoStyle === 'orbital'
                        ? 'bg-gradient-to-r from-indigo-500 to-blue-500 text-white shadow-lg'
                        : 'bg-slate-900/50 text-purple-300 border border-purple-500/50 hover:border-purple-400'
                    } disabled:opacity-50`}
                  >
                    <div className="font-semibold">Orbitale 360°</div>
                    <div className="text-xs opacity-75">Camera vola intorno</div>
                  </button>

                  <button
                    onClick={() => setVideoStyle('reassembly')}
                    disabled={isGenerating}
                    className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                      videoStyle === 'reassembly'
                        ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-lg'
                        : 'bg-slate-900/50 text-purple-300 border border-purple-500/50 hover:border-purple-400'
                    } disabled:opacity-50`}
                  >
                    <div className="font-semibold">Ricostruzione</div>
                    <div className="text-xs opacity-75">Da frammenti a prodotto</div>
                  </button>
                </div>

                {/* Durata Video - Slider */}
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-purple-300">
                      Durata Video
                    </label>
                    <span className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                      {videoDuration}s
                    </span>
                  </div>

                  <div className="relative pt-1">
                    <input
                      type="range"
                      min="4"
                      max="8"
                      step="2"
                      value={videoDuration}
                      onChange={(e) => setVideoDuration(parseInt(e.target.value) as VideoDuration)}
                      disabled={isGenerating}
                      className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed
                        [&::-webkit-slider-thumb]:appearance-none
                        [&::-webkit-slider-thumb]:w-6
                        [&::-webkit-slider-thumb]:h-6
                        [&::-webkit-slider-thumb]:rounded-full
                        [&::-webkit-slider-thumb]:bg-gradient-to-r
                        [&::-webkit-slider-thumb]:from-purple-500
                        [&::-webkit-slider-thumb]:to-pink-500
                        [&::-webkit-slider-thumb]:shadow-lg
                        [&::-webkit-slider-thumb]:cursor-pointer
                        [&::-webkit-slider-thumb]:transition-transform
                        [&::-webkit-slider-thumb]:hover:scale-110
                        [&::-moz-range-thumb]:w-6
                        [&::-moz-range-thumb]:h-6
                        [&::-moz-range-thumb]:rounded-full
                        [&::-moz-range-thumb]:bg-gradient-to-r
                        [&::-moz-range-thumb]:from-purple-500
                        [&::-moz-range-thumb]:to-pink-500
                        [&::-moz-range-thumb]:border-0
                        [&::-moz-range-thumb]:shadow-lg
                        [&::-moz-range-thumb]:cursor-pointer"
                    />
                    <div className="flex justify-between mt-2 text-xs text-purple-300/70">
                      <span>⚡ 4s</span>
                      <span>⏱️ 6s</span>
                      <span>🎬 8s (max)</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

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

            {/* Ricetta Tradizionale */}
            <div className="bg-gradient-to-br from-amber-900/20 to-orange-900/20 backdrop-blur-sm rounded-xl border border-amber-500/30 p-4 sm:p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">👨‍🍳</span>
                  <h3 className="text-lg font-semibold text-amber-300">Ricetta Tradizionale</h3>
                </div>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeRecipe}
                    onChange={(e) => setIncludeRecipe(e.target.checked)}
                    disabled={isGenerating}
                    className="w-4 h-4 rounded border-amber-500/50 bg-slate-900/50 text-amber-500 focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="text-xs text-amber-300">Crea ricetta</span>
                </label>
              </div>
              <p className="text-xs text-amber-300/70">
                💡 L'AI cercherà automaticamente ricette tradizionali autentiche del prodotto e genererà un'immagine food photography
              </p>
            </div>

            {/* Geo-Targeting & RAG */}
            <div className="bg-gradient-to-br from-blue-900/20 to-cyan-900/20 backdrop-blur-sm rounded-xl border border-cyan-500/30 p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">🇨🇭</span>
                <h3 className="text-lg font-semibold text-cyan-300">Geo-Targeting & Smart RAG</h3>
              </div>
              <p className="text-xs text-cyan-300/70 mb-4">
                💡 L'AI imparerà dai post simili performanti nel Canton selezionato
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-cyan-300 mb-2">
                    Canton Svizzero
                  </label>
                  <select
                    value={targetCanton}
                    onChange={(e) => setTargetCanton(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-900/50 border border-cyan-500/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white text-sm"
                    disabled={isGenerating}
                  >
                    <option value="">Nessuno</option>
                    <option value="Zürich">🏙️ Zürich</option>
                    <option value="Bern">🏛️ Bern</option>
                    <option value="Ticino">🏔️ Ticino</option>
                    <option value="Vaud">🍷 Vaud</option>
                    <option value="Genève">🌍 Genève</option>
                    <option value="Basel-Stadt">🎨 Basel</option>
                    <option value="Luzern">🌊 Luzern</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-cyan-300 mb-2">
                    Città (opzionale)
                  </label>
                  <input
                    type="text"
                    value={targetCity}
                    onChange={(e) => setTargetCity(e.target.value)}
                    placeholder={targetCanton === 'Zürich' ? 'Es: Zürich' : targetCanton === 'Ticino' ? 'Es: Lugano' : 'Es: Bern'}
                    className="w-full px-4 py-2 bg-slate-900/50 border border-cyan-500/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white placeholder:text-slate-500 text-sm"
                    disabled={isGenerating}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-cyan-300 mb-2">
                  Categoria Prodotto (per RAG)
                </label>
                <select
                  value={productCategory}
                  onChange={(e) => setProductCategory(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-900/50 border border-cyan-500/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white text-sm"
                  disabled={isGenerating}
                >
                  <option value="">Auto-detect</option>
                  <option value="Food">🍽️ Food & Alimenti</option>
                  <option value="Gastro">🍴 Gastro & Ristorazione</option>
                  <option value="Beverage">🍷 Beverage & Vini</option>
                  <option value="Dairy">🧀 Latticini & Formaggi</option>
                  <option value="Fresh">🥬 Prodotti Freschi</option>
                  <option value="Frozen">❄️ Surgelati</option>
                </select>
              </div>

              {(targetCanton || productCategory) && (
                <div className="mt-3 p-3 bg-cyan-900/20 border border-cyan-500/30 rounded-lg">
                  <p className="text-xs text-cyan-300/90">
                    ✨ <strong>RAG Attivo:</strong> L'AI cercherà post simili performanti
                    {targetCanton && ` nel Canton ${targetCanton}`}
                    {productCategory && ` nella categoria ${productCategory}`}
                    {' '}per ottimizzare hashtags e CTA.
                  </p>
                </div>
              )}
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
          <div className="space-y-4 sm:space-y-6">

            {/* Info Card */}
            <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl p-4 sm:p-6">
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

                {/* Sentiment Analysis */}
                {result.sentiment && (
                  <div className="bg-gradient-to-br from-blue-900/20 to-purple-900/20 backdrop-blur-sm rounded-xl border border-blue-500/30 p-4 sm:p-6">
                    <div className="flex items-center space-x-2 mb-4">
                      <TrendingUp className="h-5 w-5 text-blue-400" />
                      <h3 className="text-white font-semibold">AI Sentiment Analysis</h3>
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 ml-auto" />
                    </div>

                    {/* Sentiment & Engagement */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      {/* Sentiment Badge */}
                      <div className="bg-slate-900/50 rounded-lg p-3 border border-blue-500/30">
                        <div className="text-xs text-blue-300 mb-1">Sentiment</div>
                        <div className="flex items-center space-x-2">
                          <span className="text-2xl">{getSentimentEmoji(result.sentiment.sentiment)}</span>
                          <div>
                            <div className="text-white font-semibold capitalize">{result.sentiment.sentiment}</div>
                            <div className="text-xs text-blue-400">Score: {result.sentiment.sentimentScore.toFixed(2)}</div>
                          </div>
                        </div>
                      </div>

                      {/* Predicted Engagement */}
                      <div className="bg-slate-900/50 rounded-lg p-3 border border-blue-500/30">
                        <div className="text-xs text-blue-300 mb-1">Predicted Engagement</div>
                        <div className="flex items-center space-x-2">
                          <span className="text-2xl">{getEngagementLevel(result.sentiment.predictedEngagement).emoji}</span>
                          <div>
                            <div className={`font-bold text-lg ${getEngagementLevel(result.sentiment.predictedEngagement).color}`}>
                              {result.sentiment.predictedEngagement.toFixed(1)}%
                            </div>
                            <div className="text-xs text-blue-400">
                              {getEngagementLevel(result.sentiment.predictedEngagement).label}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Quality Score */}
                    <div className="bg-slate-900/50 rounded-lg p-3 border border-blue-500/30 mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs text-blue-300 flex items-center space-x-1">
                          <Award className="h-3 w-3" />
                          <span>Quality Score</span>
                        </div>
                        <div className="text-white font-bold text-lg">{result.sentiment.qualityScore}/100</div>
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            result.sentiment.qualityScore >= 80 ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                            result.sentiment.qualityScore >= 60 ? 'bg-gradient-to-r from-blue-500 to-cyan-500' :
                            result.sentiment.qualityScore >= 40 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
                            'bg-gradient-to-r from-red-500 to-pink-500'
                          }`}
                          style={{ width: `${result.sentiment.qualityScore}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Recommendation Badge */}
                    <div className={`rounded-lg p-3 mb-4 border ${
                      result.sentiment.recommendation === 'ready_to_post' ? 'bg-green-900/20 border-green-500/30' :
                      result.sentiment.recommendation === 'needs_improvement' ? 'bg-yellow-900/20 border-yellow-500/30' :
                      'bg-red-900/20 border-red-500/30'
                    }`}>
                      <div className="flex items-center space-x-2">
                        {result.sentiment.recommendation === 'ready_to_post' ? (
                          <CheckCircle2 className="h-5 w-5 text-green-400" />
                        ) : result.sentiment.recommendation === 'needs_improvement' ? (
                          <AlertCircle className="h-5 w-5 text-yellow-400" />
                        ) : (
                          <X className="h-5 w-5 text-red-400" />
                        )}
                        <div>
                          <div className={`font-semibold ${getRecommendationColor(result.sentiment.recommendation)}`}>
                            {result.sentiment.recommendation === 'ready_to_post' ? '✅ Ready to Post!' :
                             result.sentiment.recommendation === 'needs_improvement' ? '⚠️ Needs Improvement' :
                             '❌ Regenerate Content'}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {result.sentiment.recommendation === 'ready_to_post' ? 'Excellent quality - share immediately' :
                             result.sentiment.recommendation === 'needs_improvement' ? 'Good but can be optimized' :
                             'Consider regenerating with different parameters'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Strengths */}
                    {result.sentiment.strengths.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs text-green-300 mb-2 flex items-center space-x-1 font-medium">
                          <Zap className="h-3 w-3" />
                          <span>Strengths</span>
                        </div>
                        <div className="space-y-1.5">
                          {result.sentiment.strengths.map((strength, idx) => (
                            <div key={idx} className="flex items-start space-x-2 text-sm">
                              <span className="text-green-400 mt-0.5">✓</span>
                              <span className="text-green-200">{strength}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Improvements */}
                    {result.sentiment.improvements.length > 0 && (
                      <div>
                        <div className="text-xs text-yellow-300 mb-2 flex items-center space-x-1 font-medium">
                          <AlertCircle className="h-3 w-3" />
                          <span>Suggested Improvements</span>
                        </div>
                        <div className="space-y-1.5">
                          {result.sentiment.improvements.map((improvement, idx) => (
                            <div key={idx} className="flex items-start space-x-2 text-sm">
                              <span className="text-yellow-400 mt-0.5">→</span>
                              <span className="text-yellow-200">{improvement}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Ricetta Tradizionale */}
                {recipeData && (
                  <div className="bg-gradient-to-br from-amber-900/20 to-orange-900/20 backdrop-blur-sm rounded-xl border border-amber-500/30 p-4 sm:p-6">
                    <div className="flex items-center space-x-2 mb-4">
                      <div className="text-2xl">👨‍🍳</div>
                      <h3 className="text-white font-semibold">Ricetta Tradizionale</h3>
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 ml-auto" />
                    </div>

                    {/* Immagine ricetta */}
                    {recipeData.imageUrl && (
                      <img
                        src={recipeData.imageUrl}
                        alt="Ricetta"
                        className="w-full h-auto rounded-lg border border-amber-500/50 mb-4"
                      />
                    )}

                    {/* Titolo e Descrizione */}
                    <div className="mb-4">
                      <h4 className="text-xl font-bold text-amber-200 mb-2">
                        {recipeData.recipe.title}
                      </h4>
                      <p className="text-sm text-amber-300/90 mb-3">
                        {recipeData.recipe.description}
                      </p>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="px-2 py-1 bg-amber-900/40 border border-amber-500/30 rounded-full text-amber-300">
                          📍 {recipeData.recipe.region}
                        </span>
                        <span className="px-2 py-1 bg-amber-900/40 border border-amber-500/30 rounded-full text-amber-300">
                          ⏱️ Prep: {recipeData.recipe.prepTime}
                        </span>
                        <span className="px-2 py-1 bg-amber-900/40 border border-amber-500/30 rounded-full text-amber-300">
                          🔥 Cook: {recipeData.recipe.cookTime}
                        </span>
                        <span className="px-2 py-1 bg-amber-900/40 border border-amber-500/30 rounded-full text-amber-300">
                          🍽️ {recipeData.recipe.servings}
                        </span>
                        <span className="px-2 py-1 bg-amber-900/40 border border-amber-500/30 rounded-full text-amber-300">
                          📊 {recipeData.recipe.difficulty}
                        </span>
                      </div>
                    </div>

                    {/* Tradizione */}
                    <div className="mb-4 p-3 bg-amber-900/20 border border-amber-500/30 rounded-lg">
                      <p className="text-xs text-amber-300/90">
                        <strong>Tradizione:</strong> {recipeData.recipe.tradition}
                      </p>
                    </div>

                    {/* Ingredienti */}
                    <div className="mb-4">
                      <div className="text-sm font-semibold text-amber-200 mb-2">Ingredienti</div>
                      <div className="space-y-1.5">
                        {recipeData.recipe.ingredients.map((ing: any, idx: number) => (
                          <div key={idx} className="flex items-start space-x-2 text-sm">
                            <span className="text-amber-400">•</span>
                            <span className="text-amber-200">
                              <strong>{ing.quantity}</strong> {ing.item}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Procedimento */}
                    <div className="mb-4">
                      <div className="text-sm font-semibold text-amber-200 mb-2">Procedimento</div>
                      <div className="space-y-2">
                        {recipeData.recipe.steps.map((step: string, idx: number) => (
                          <div key={idx} className="flex items-start space-x-2 text-sm">
                            <span className="text-amber-400 font-bold min-w-[20px]">{idx + 1}.</span>
                            <span className="text-amber-200">{step}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Tips */}
                    {recipeData.recipe.tips && recipeData.recipe.tips.length > 0 && (
                      <div className="mb-4">
                        <div className="text-sm font-semibold text-amber-200 mb-2">💡 Consigli</div>
                        <div className="space-y-1.5">
                          {recipeData.recipe.tips.map((tip: string, idx: number) => (
                            <div key={idx} className="flex items-start space-x-2 text-sm">
                              <span className="text-amber-400">→</span>
                              <span className="text-amber-200">{tip}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Fonti */}
                    {recipeData.sources && recipeData.sources.length > 0 && (
                      <details className="mb-4">
                        <summary className="text-xs text-amber-400 cursor-pointer hover:text-amber-300">
                          Fonti utilizzate
                        </summary>
                        <div className="mt-2 space-y-1">
                          {recipeData.sources.map((source: any, idx: number) => (
                            <a
                              key={idx}
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-xs text-amber-500 hover:text-amber-400 truncate"
                            >
                              → {source.title}
                            </a>
                          ))}
                        </div>
                      </details>
                    )}

                    {/* Pulsanti Download e Pubblica */}
                    <div className="space-y-3">
                      {recipeData.imageUrl && (
                        <button
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = recipeData.imageUrl;
                            link.download = `ricetta-${productName.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.png`;
                            link.click();
                          }}
                          className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors"
                        >
                          <Download className="h-4 w-4" />
                          <span>Download Immagine Ricetta</span>
                        </button>
                      )}

                      {/* Pulsante Pubblica su Blog + Social */}
                      <button
                        onClick={handlePublishRecipe}
                        disabled={isPublishingRecipe || !recipeData.imageUrl}
                        className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                      >
                        {isPublishingRecipe ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span>Pubblicazione in corso...</span>
                          </>
                        ) : (
                          <>
                            <Share2 className="h-5 w-5" />
                            <span>Pubblica su Blog + Social (IT/DE/FR/EN)</span>
                          </>
                        )}
                      </button>

                      {/* Progress Pubblicazione */}
                      {publishProgress.length > 0 && (
                        <div className="bg-slate-900/50 rounded-lg p-3 border border-amber-500/30">
                          <div className="space-y-1">
                            {publishProgress.map((msg, idx) => (
                              <div key={idx} className="text-xs text-amber-200">
                                {msg}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

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

                        <div className="space-y-2">
                          <button
                            onClick={handleDownloadVideo}
                            className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition-colors"
                          >
                            <Download className="h-4 w-4" />
                            <span>Download Video</span>
                          </button>

                          <button
                            onClick={handlePublishYouTube}
                            disabled={isPublishingYouTube}
                            className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                          >
                            {isPublishingYouTube ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Pubblicazione in corso...</span>
                              </>
                            ) : (
                              <>
                                <Youtube className="h-4 w-4" />
                                <span>Pubblica su YouTube</span>
                              </>
                            )}
                          </button>

                          {youtubePublishResult && (
                            <div className="mt-3 p-3 bg-emerald-900/30 border border-emerald-500/50 rounded-lg">
                              <div className="flex items-start space-x-2 text-sm">
                                <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                                <div className="flex-1">
                                  <div className="text-emerald-300 font-medium">
                                    Pubblicato su YouTube!
                                  </div>
                                  <div className="text-purple-300 text-xs mt-1">
                                    {youtubePublishResult.youtubeTitle}
                                  </div>
                                  {youtubePublishResult.videoUrl && (
                                    <a
                                      href={youtubePublishResult.videoUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-blue-400 hover:text-blue-300 underline mt-1 inline-block"
                                    >
                                      Vedi su YouTube →
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

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
