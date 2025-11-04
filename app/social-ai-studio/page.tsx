'use client';

import { useState, useRef } from 'react';
import {
  ArrowLeft, Home, Sparkles, Upload, Image as ImageIcon,
  Video, Loader2, Download, Instagram, Facebook, Linkedin,
  CheckCircle2, Wand2, MessageSquare, Hash, Target,
  Play, X
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

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

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ==========================================
  // Upload Foto Prodotto
  // ==========================================
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Seleziona un file immagine valido');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setProductImage(base64);
      setProductImagePreview(base64);
      toast.success('Foto prodotto caricata!');
    };
    reader.readAsDataURL(file);
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
      if (data.data.video?.operationId) {
        toast.success('Copy e immagine pronti! Video in generazione...', { id: loadingToast });
        startVideoPolling(data.data.video.operationId);
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
                    <h1 className="text-3xl font-bold text-white">Social Marketing AI Studio</h1>
                    <p className="text-purple-300">
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-2 gap-8">

          {/* ========================================== */}
          {/* COLONNA SINISTRA: Configurazione */}
          {/* ========================================== */}
          <div className="space-y-6">

            {/* Upload Foto Prodotto */}
            <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl border border-purple-500/30 p-6">
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

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isGenerating}
                className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-slate-900/50 hover:bg-slate-700/50 border border-purple-500/50 hover:border-purple-400 rounded-lg text-purple-300 hover:text-white transition-all disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                <span className="text-sm">Carica Foto</span>
              </button>

              {productImagePreview && (
                <div className="mt-4 relative">
                  <img
                    src={productImagePreview}
                    alt="Prodotto"
                    className="w-full h-auto rounded-lg border border-purple-500/50"
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
            <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl border border-purple-500/30 p-6">
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
            <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl border border-purple-500/30 p-6">
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
            <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl border border-purple-500/30 p-6">
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
            <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl border border-purple-500/30 p-6">
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
              className="w-full flex items-center justify-center space-x-3 px-6 py-4 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 hover:from-purple-600 hover:via-pink-600 hover:to-orange-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl hover:shadow-purple-500/25 text-lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span>Generazione in corso...</span>
                </>
              ) : (
                <>
                  <Wand2 className="h-6 w-6" />
                  <span>Genera Contenuti Marketing AI 🚀</span>
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
                {/* Copywriting */}
                <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl border border-purple-500/30 p-6">
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
    </div>
  );
}
