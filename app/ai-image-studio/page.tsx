'use client';

import { useState, useRef } from 'react';
import { ArrowLeft, Home, Sparkles, Wand2, Upload, Image as ImageIcon, Loader2, Download, Copy, X } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

type Tone = 'professional' | 'casual' | 'fun' | 'luxury';

export default function AIImageStudioPage() {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<string>('1:1');
  const [baseImage, setBaseImage] = useState<string | null>(null);
  const [baseImagePreview, setBaseImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tone of Voice
  const [tone, setTone] = useState<Tone>('professional');

  // Branding states
  const [includeLogo, setIncludeLogo] = useState(false);
  const [logoImage, setLogoImage] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [companyMotto, setCompanyMotto] = useState('');

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('Inserisci una descrizione per generare l\'immagine');
      return;
    }

    setIsGenerating(true);
    const loadingToast = toast.loading('Nano Banana sta creando la tua immagine...');

    try {
      const response = await fetch('/api/gemini/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          aspectRatio,
          baseImage,
          tone,
          includeLogo,
          logoImage: logoImage || undefined,
          companyMotto: companyMotto || undefined
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore durante la generazione');
      }

      setGeneratedImage(data.image.dataUrl);
      toast.success('Immagine generata con successo!', { id: loadingToast });

    } catch (error: any) {
      console.error('Errore generazione immagine:', error);
      toast.error(error.message || 'Errore durante la generazione dell\'immagine', { id: loadingToast });
    } finally {
      setIsGenerating(false);
    }
  };

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
      setBaseImage(base64);
      setBaseImagePreview(base64);
      toast.success('Immagine caricata!');
    };
    reader.readAsDataURL(file);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Seleziona un file immagine valido per il logo');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setLogoImage(base64);
      setLogoPreview(base64);
      toast.success('Logo aziendale caricato!');
    };
    reader.readAsDataURL(file);
  };

  const handleDownload = () => {
    if (!generatedImage) return;

    const link = document.createElement('a');
    link.href = generatedImage;
    link.download = `ai-image-${Date.now()}.png`;
    link.click();
    toast.success('Download avviato!');
  };

  const handleCopyToClipboard = async () => {
    if (!generatedImage) return;

    try {
      const response = await fetch(generatedImage);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob })
      ]);
      toast.success('Immagine copiata negli appunti!');
    } catch (error) {
      toast.error('Errore durante la copia');
    }
  };

  const suggestedPrompts = [
    "Una foto professionale di un piatto di pasta italiana su sfondo bianco pulito, illuminazione da studio, alta qualità",
    "Un prodotto alimentare premium in stile fotorealista con illuminazione naturale, composizione minimalista",
    "Immagine pubblicitaria di una bottiglia di vino italiano con packaging premium, luci soffuse, sfondo elegante nero",
    "Una confezione di caffè artigianale fotografata in stile lifestyle, luce naturale dalla finestra, atmosfera calda",
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="bg-slate-900/80 backdrop-blur-sm border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Link
                  href="/dashboard"
                  className="flex items-center space-x-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg border border-slate-600 transition-colors group"
                >
                  <ArrowLeft className="h-5 w-5 text-slate-300 group-hover:text-white" />
                  <Home className="h-5 w-5 text-slate-300 group-hover:text-white" />
                  <span className="text-slate-300 group-hover:text-white font-medium">Home</span>
                </Link>

                <div className="flex items-center space-x-3">
                  <div className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 p-3 rounded-xl">
                    <Sparkles className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-white">AI Image Studio</h1>
                    <p className="text-slate-300">Powered by Google Gemini (Nano Banana) 🍌</p>
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
          {/* Colonna Sinistra: Controlli */}
          <div className="space-y-6">
            {/* Card Prompt */}
            <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl border border-slate-600/50 p-6">
              <label className="block text-sm font-medium text-slate-300 mb-3 flex items-center space-x-2">
                <Wand2 className="h-4 w-4" />
                <span>Descrizione Immagine</span>
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Descrivi l'immagine che vuoi generare in modo dettagliato..."
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-white placeholder:text-slate-500 min-h-[150px] resize-none"
                disabled={isGenerating}
              />
              <div className="mt-2 text-xs text-slate-500">
                💡 Tip: Descrivi la scena in modo narrativo e dettagliato, non usare solo parole chiave
              </div>
            </div>

            {/* Prompts Suggeriti */}
            <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl border border-slate-600/50 p-6">
              <label className="block text-sm font-medium text-slate-300 mb-3">
                Esempi di Prompt
              </label>
              <div className="space-y-2">
                {suggestedPrompts.map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => setPrompt(suggestion)}
                    disabled={isGenerating}
                    className="w-full text-left px-4 py-3 bg-slate-900/50 hover:bg-slate-700/50 border border-slate-600/50 hover:border-purple-500/50 rounded-lg text-sm text-slate-300 hover:text-white transition-all disabled:opacity-50"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>

            {/* Aspect Ratio */}
            <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl border border-slate-600/50 p-6">
              <label className="block text-sm font-medium text-slate-300 mb-3">
                Formato Immagine
              </label>
              <div className="grid grid-cols-3 gap-3">
                {['1:1', '16:9', '4:3', '3:2', '2:3', '9:16'].map((ratio) => (
                  <button
                    key={ratio}
                    onClick={() => setAspectRatio(ratio)}
                    disabled={isGenerating}
                    className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                      aspectRatio === ratio
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                        : 'bg-slate-900/50 text-slate-300 border border-slate-600 hover:border-purple-500/50'
                    } disabled:opacity-50`}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </div>

            {/* Branding Aziendale */}
            <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl border border-slate-600/50 p-6">
              <div className="flex items-center justify-between mb-4">
                <label className="text-sm font-medium text-slate-300">
                  Branding Aziendale
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeLogo}
                    onChange={(e) => setIncludeLogo(e.target.checked)}
                    disabled={isGenerating}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-900/50 text-purple-500 focus:ring-2 focus:ring-purple-500"
                  />
                  <span className="text-xs text-slate-300">Includi logo/motto</span>
                </label>
              </div>

              {includeLogo && (
                <>
                  {/* Upload Logo */}
                  <div className="mb-4">
                    <label className="block text-xs text-slate-300 mb-2">
                      Logo Aziendale (opzionale)
                    </label>
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
                      className="flex items-center justify-center space-x-2 px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg hover:border-purple-500/50 transition-colors cursor-pointer text-sm text-slate-300"
                    >
                      <Upload className="h-4 w-4" />
                      <span>Carica Logo</span>
                    </label>

                    {logoPreview && (
                      <div className="mt-2 relative inline-block">
                        <img
                          src={logoPreview}
                          alt="Logo"
                          className="h-16 w-auto object-contain rounded border border-slate-600 bg-white/5 p-2"
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
                    <label className="block text-xs text-slate-300 mb-2">
                      Motto/Slogan (opzionale)
                    </label>
                    <input
                      type="text"
                      value={companyMotto}
                      onChange={(e) => setCompanyMotto(e.target.value)}
                      placeholder="Es: Qualità Italiana dal 1950"
                      maxLength={100}
                      className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder:text-slate-500 text-sm"
                      disabled={isGenerating}
                    />
                    <div className="text-xs text-slate-500 mt-1 text-right">
                      {companyMotto.length}/100
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Tone of Voice */}
            <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl border border-slate-600/50 p-6">
              <label className="block text-sm font-medium text-slate-300 mb-3">
                Tone of Voice
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['professional', 'casual', 'fun', 'luxury'] as Tone[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTone(t)}
                    disabled={isGenerating}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      tone === t
                        ? 'bg-purple-500 text-white'
                        : 'bg-slate-900/50 text-slate-300 border border-slate-600 hover:border-purple-500/50'
                    } disabled:opacity-50 capitalize`}
                  >
                    {t === 'professional' ? 'Professional' : t === 'casual' ? 'Casual' : t === 'fun' ? 'Fun' : 'Luxury'}
                  </button>
                ))}
              </div>
            </div>

            {/* Upload Immagine Base */}
            <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl border border-slate-600/50 p-6">
              <label className="block text-sm font-medium text-slate-300 mb-3 flex items-center space-x-2">
                <Upload className="h-4 w-4" />
                <span>Immagine di Partenza (Opzionale)</span>
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
                className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-slate-900/50 hover:bg-slate-700/50 border border-slate-600 hover:border-purple-500/50 rounded-lg text-slate-300 hover:text-white transition-all disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                <span className="text-sm">Carica Immagine</span>
              </button>

              {baseImagePreview && (
                <div className="mt-4 relative">
                  <img
                    src={baseImagePreview}
                    alt="Base"
                    className="w-full h-auto rounded-lg border border-slate-600"
                  />
                  <button
                    onClick={() => {
                      setBaseImage(null);
                      setBaseImagePreview(null);
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-red-500 hover:bg-red-600 rounded-full text-white transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <div className="mt-2 text-xs text-emerald-400 text-center">
                    ✓ Immagine caricata - verrà usata come base
                  </div>
                </div>
              )}
            </div>

            {/* Pulsante Genera */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              className="w-full flex items-center justify-center space-x-3 px-6 py-4 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 hover:from-purple-600 hover:via-pink-600 hover:to-orange-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl hover:shadow-purple-500/25 text-lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span>Generazione in corso...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-6 w-6" />
                  <span>Genera Immagine AI 🍌</span>
                </>
              )}
            </button>
          </div>

          {/* Colonna Destra: Anteprima */}
          <div className="space-y-6">
            <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl border border-slate-600/50 p-6">
              <label className="block text-sm font-medium text-slate-300 mb-4 flex items-center space-x-2">
                <ImageIcon className="h-4 w-4" />
                <span>Anteprima Risultato</span>
              </label>

              <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-6 min-h-[500px] flex items-center justify-center">
                {generatedImage ? (
                  <div className="w-full space-y-4">
                    <img
                      src={generatedImage}
                      alt="Immagine generata"
                      className="w-full h-auto rounded-lg shadow-2xl border border-slate-600"
                    />
                    <div className="text-xs text-center text-emerald-400 font-medium">
                      ✓ Immagine generata con successo
                    </div>
                  </div>
                ) : isGenerating ? (
                  <div className="text-center space-y-6">
                    <Loader2 className="h-16 w-16 text-purple-500 mx-auto animate-spin" />
                    <div className="space-y-2">
                      <div className="text-white font-medium text-lg">
                        Nano Banana sta lavorando...
                      </div>
                      <div className="text-slate-400 text-sm">
                        Generazione dell'immagine in corso
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center space-y-6">
                    <div className="relative">
                      <Sparkles className="h-20 w-20 text-slate-600 mx-auto" />
                      <div className="absolute inset-0 h-20 w-20 mx-auto animate-ping opacity-20">
                        <Sparkles className="h-20 w-20 text-purple-500" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-slate-400 font-medium">
                        L'immagine generata apparirà qui
                      </div>
                      <div className="text-slate-500 text-sm">
                        Scrivi un prompt e clicca "Genera Immagine AI"
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Azioni sull'immagine generata */}
              {generatedImage && (
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button
                    onClick={handleDownload}
                    className="flex items-center justify-center space-x-2 px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    <span>Download</span>
                  </button>
                  <button
                    onClick={handleCopyToClipboard}
                    className="flex items-center justify-center space-x-2 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
                  >
                    <Copy className="h-4 w-4" />
                    <span>Copia</span>
                  </button>
                </div>
              )}
            </div>

            {/* Info Card */}
            <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl p-6">
              <h3 className="text-white font-semibold mb-3 flex items-center space-x-2">
                <Sparkles className="h-5 w-5 text-purple-400" />
                <span>Come funziona</span>
              </h3>
              <ul className="space-y-2 text-sm text-slate-300">
                <li className="flex items-start space-x-2">
                  <span className="text-purple-400">1.</span>
                  <span>Descrivi l'immagine che vuoi creare in modo dettagliato</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-pink-400">2.</span>
                  <span>Scegli il formato (1:1, 16:9, ecc.)</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-orange-400">3.</span>
                  <span>Opzionale: Carica un'immagine da modificare</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-emerald-400">4.</span>
                  <span>Clicca "Genera" e attendi la magia! 🪄</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
