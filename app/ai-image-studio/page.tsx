'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Home, Sparkles, Wand2, Upload, Image as ImageIcon,
  Loader2, Download, Copy, X, Share2, Mic, MicOff, Type,
  Palette, Building2, ChevronDown, Lightbulb
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

type Tone = 'professional' | 'casual' | 'fun' | 'luxury';
type InputMode = 'text' | 'audio';
type ActiveDropdown = 'format' | 'image' | 'style' | 'brand' | 'examples' | null;

export default function AIImageStudioPage() {
  // Main states
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<string>('1:1');
  const [baseImage, setBaseImage] = useState<string | null>(null);
  const [baseImagePreview, setBaseImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Input mode (text or audio)
  const [inputMode, setInputMode] = useState<InputMode>('text');
  const [isRecording, setIsRecording] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);

  // Tone of Voice
  const [tone, setTone] = useState<Tone>('professional');

  // Branding states
  const [includeLogo, setIncludeLogo] = useState(false);
  const [logoImage, setLogoImage] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [companyMotto, setCompanyMotto] = useState('');

  // Active dropdown
  const [activeDropdown, setActiveDropdown] = useState<ActiveDropdown>(null);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognitionInstance = new SpeechRecognition();
        recognitionInstance.continuous = true;
        recognitionInstance.interimResults = true;
        recognitionInstance.lang = 'it-IT';

        recognitionInstance.onresult = (event: any) => {
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
            }
          }

          if (finalTranscript) {
            setPrompt(prev => prev + ' ' + finalTranscript.trim());
          }
        };

        recognitionInstance.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setIsRecording(false);
          toast.error('Errore nel riconoscimento vocale');
        };

        recognitionInstance.onend = () => {
          setIsRecording(false);
        };

        setRecognition(recognitionInstance);
      }
    }
  }, []);

  const toggleRecording = () => {
    if (!recognition) {
      toast.error('Il riconoscimento vocale non è supportato dal tuo browser');
      return;
    }

    if (isRecording) {
      recognition.stop();
      setIsRecording(false);
    } else {
      setPrompt('');
      recognition.start();
      setIsRecording(true);
      toast.success('Parla ora...');
    }
  };

  const toggleDropdown = (dropdown: ActiveDropdown) => {
    setActiveDropdown(activeDropdown === dropdown ? null : dropdown);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('Inserisci una descrizione per generare l\'immagine');
      return;
    }

    setIsGenerating(true);
    setActiveDropdown(null);
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
      setIncludeLogo(true);
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

  const handleShare = async () => {
    if (!generatedImage) return;

    const hashtags = '#AIImage #NanoBanana #GeneratedArt #AIArt';
    const shareText = `${prompt}\n\n${hashtags}`;

    try {
      await navigator.clipboard.writeText(shareText);

      const link = document.createElement('a');
      link.href = generatedImage;
      link.download = `ai-image-${Date.now()}.png`;
      link.click();

      toast.success('Descrizione copiata e immagine scaricata!');
    } catch (error) {
      toast.error('Errore durante la preparazione per la condivisione');
    }
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
    "Una foto professionale di un piatto di pasta italiana su sfondo bianco pulito",
    "Un prodotto alimentare premium in stile fotorealista con illuminazione naturale",
    "Immagine pubblicitaria di una bottiglia di vino italiano con packaging premium",
    "Una confezione di caffè artigianale fotografata in stile lifestyle",
  ];

  const toneLabels: Record<Tone, { label: string; emoji: string }> = {
    professional: { label: 'Pro', emoji: '💼' },
    casual: { label: 'Casual', emoji: '😊' },
    fun: { label: 'Fun', emoji: '🎉' },
    luxury: { label: 'Luxury', emoji: '✨' }
  };

  const formatLabels: Record<string, string> = {
    '1:1': '1:1',
    '16:9': '16:9',
    '4:3': '4:3',
    '9:16': '9:16'
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header compatto */}
      <div className="bg-slate-900/80 backdrop-blur-sm border-b border-slate-700 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-3">
          <div className="py-2 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Link
                href="/dashboard"
                className="p-1.5 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg border border-slate-600 transition-colors"
              >
                <Home className="h-4 w-4 text-slate-300" />
              </Link>
              <div className="flex items-center space-x-2">
                <div className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 p-1.5 rounded-lg">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <span className="text-sm font-bold text-white">AI Image Studio</span>
                <span className="text-xs">🍌</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-3 py-3 space-y-3">

        {/* IMMAGINE GENERATA */}
        <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl border border-slate-600/50 p-3">
          <div className="aspect-square max-h-[45vh] bg-slate-900/50 border border-slate-700 rounded-xl flex items-center justify-center overflow-hidden">
            {generatedImage ? (
              <img
                src={generatedImage}
                alt="Immagine generata"
                className="w-full h-full object-contain"
              />
            ) : isGenerating ? (
              <div className="text-center space-y-3">
                <Loader2 className="h-10 w-10 text-purple-500 mx-auto animate-spin" />
                <div className="text-slate-400 text-xs">Generazione...</div>
              </div>
            ) : (
              <div className="text-center space-y-2 p-4">
                <Sparkles className="h-10 w-10 text-slate-600 mx-auto" />
                <div className="text-slate-500 text-xs">L'immagine apparirà qui</div>
              </div>
            )}
          </div>

          {/* Pulsanti azione immagine */}
          {generatedImage && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              <button
                onClick={handleShare}
                className="flex items-center justify-center space-x-1.5 px-2 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium rounded-lg transition-colors text-sm"
              >
                <Share2 className="h-4 w-4" />
                <span>Share</span>
              </button>
              <button
                onClick={handleDownload}
                className="flex items-center justify-center space-x-1.5 px-2 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition-colors text-sm"
              >
                <Download className="h-4 w-4" />
                <span>Save</span>
              </button>
              <button
                onClick={handleCopyToClipboard}
                className="flex items-center justify-center space-x-1.5 px-2 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors text-sm"
              >
                <Copy className="h-4 w-4" />
                <span>Copia</span>
              </button>
            </div>
          )}
        </div>

        {/* BUTTON BAR - Opzioni compatte */}
        <div className="relative">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {/* Format Button */}
            <button
              onClick={() => toggleDropdown('format')}
              className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeDropdown === 'format'
                  ? 'bg-purple-500 text-white'
                  : 'bg-slate-800/60 text-slate-300 border border-slate-600'
              }`}
            >
              <span>{aspectRatio}</span>
              <ChevronDown className="h-3 w-3" />
            </button>

            {/* Image Button */}
            <button
              onClick={() => toggleDropdown('image')}
              className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeDropdown === 'image'
                  ? 'bg-purple-500 text-white'
                  : baseImagePreview
                    ? 'bg-emerald-600 text-white border border-emerald-500'
                    : 'bg-slate-800/60 text-slate-300 border border-slate-600'
              }`}
            >
              <ImageIcon className="h-4 w-4" />
              <span>Img</span>
            </button>

            {/* Style Button */}
            <button
              onClick={() => toggleDropdown('style')}
              className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeDropdown === 'style'
                  ? 'bg-purple-500 text-white'
                  : 'bg-slate-800/60 text-slate-300 border border-slate-600'
              }`}
            >
              <Palette className="h-4 w-4" />
              <span>{toneLabels[tone].emoji}</span>
            </button>

            {/* Brand Button */}
            <button
              onClick={() => toggleDropdown('brand')}
              className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeDropdown === 'brand'
                  ? 'bg-purple-500 text-white'
                  : includeLogo
                    ? 'bg-emerald-600 text-white border border-emerald-500'
                    : 'bg-slate-800/60 text-slate-300 border border-slate-600'
              }`}
            >
              <Building2 className="h-4 w-4" />
              <span>Brand</span>
            </button>

            {/* Examples Button */}
            <button
              onClick={() => toggleDropdown('examples')}
              className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeDropdown === 'examples'
                  ? 'bg-purple-500 text-white'
                  : 'bg-slate-800/60 text-slate-300 border border-slate-600'
              }`}
            >
              <Lightbulb className="h-4 w-4" />
            </button>
          </div>

          {/* Dropdown Panels */}
          {activeDropdown && (
            <div className="mt-2 bg-slate-800/90 backdrop-blur-sm rounded-xl border border-slate-600/50 p-3 animate-in fade-in slide-in-from-top-2 duration-200">
              {/* Format Dropdown */}
              {activeDropdown === 'format' && (
                <div className="space-y-2">
                  <div className="text-xs text-slate-400 font-medium mb-2">Formato Immagine</div>
                  <div className="flex flex-wrap gap-2">
                    {['1:1', '16:9', '4:3', '9:16'].map((ratio) => (
                      <button
                        key={ratio}
                        onClick={() => { setAspectRatio(ratio); setActiveDropdown(null); }}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          aspectRatio === ratio
                            ? 'bg-purple-500 text-white'
                            : 'bg-slate-900/50 text-slate-300 border border-slate-600 hover:border-purple-500/50'
                        }`}
                      >
                        {ratio}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Image Dropdown */}
              {activeDropdown === 'image' && (
                <div className="space-y-3">
                  <div className="text-xs text-slate-400 font-medium">Immagine Base (opzionale)</div>
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
                    className="flex items-center space-x-2 px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-sm text-slate-300 hover:border-purple-500/50 w-full"
                  >
                    <Upload className="h-4 w-4" />
                    <span>{baseImagePreview ? 'Cambia Immagine' : 'Carica Immagine'}</span>
                  </button>
                  {baseImagePreview && (
                    <div className="flex items-center space-x-3">
                      <img src={baseImagePreview} alt="Base" className="h-16 w-auto object-contain rounded border border-slate-600" />
                      <button
                        onClick={() => { setBaseImage(null); setBaseImagePreview(null); }}
                        className="p-1.5 bg-red-500 hover:bg-red-600 rounded-lg text-white"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Style Dropdown */}
              {activeDropdown === 'style' && (
                <div className="space-y-2">
                  <div className="text-xs text-slate-400 font-medium mb-2">Stile Immagine</div>
                  <div className="grid grid-cols-2 gap-2">
                    {(['professional', 'casual', 'fun', 'luxury'] as Tone[]).map((t) => (
                      <button
                        key={t}
                        onClick={() => { setTone(t); setActiveDropdown(null); }}
                        className={`flex items-center justify-center space-x-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                          tone === t
                            ? 'bg-purple-500 text-white'
                            : 'bg-slate-900/50 text-slate-300 border border-slate-600 hover:border-purple-500/50'
                        }`}
                      >
                        <span>{toneLabels[t].emoji}</span>
                        <span>{toneLabels[t].label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Brand Dropdown */}
              {activeDropdown === 'brand' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-400 font-medium">Branding Aziendale</div>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeLogo}
                        onChange={(e) => setIncludeLogo(e.target.checked)}
                        disabled={isGenerating}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-900/50 text-purple-500"
                      />
                      <span className="text-xs text-slate-300">Attivo</span>
                    </label>
                  </div>

                  {includeLogo && (
                    <div className="space-y-3">
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
                        className="flex items-center space-x-2 px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg cursor-pointer text-sm text-slate-300 hover:border-purple-500/50 w-full"
                      >
                        <Upload className="h-4 w-4" />
                        <span>{logoPreview ? 'Cambia Logo' : 'Carica Logo'}</span>
                      </label>
                      {logoPreview && (
                        <div className="flex items-center space-x-3">
                          <img src={logoPreview} alt="Logo" className="h-10 w-auto object-contain rounded" />
                          <button
                            onClick={() => { setLogoImage(null); setLogoPreview(null); }}
                            className="p-1.5 bg-red-500 hover:bg-red-600 rounded-lg text-white"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                      <input
                        type="text"
                        value={companyMotto}
                        onChange={(e) => setCompanyMotto(e.target.value)}
                        placeholder="Motto/Slogan aziendale"
                        maxLength={100}
                        className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 text-sm"
                        disabled={isGenerating}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Examples Dropdown */}
              {activeDropdown === 'examples' && (
                <div className="space-y-2">
                  <div className="text-xs text-slate-400 font-medium mb-2">Esempi di Prompt</div>
                  <div className="space-y-1.5">
                    {suggestedPrompts.map((suggestion, idx) => (
                      <button
                        key={idx}
                        onClick={() => { setPrompt(suggestion); setActiveDropdown(null); }}
                        disabled={isGenerating}
                        className="w-full text-left px-3 py-2 bg-slate-900/50 hover:bg-slate-700/50 border border-slate-600/50 rounded-lg text-xs text-slate-300 hover:text-white transition-all"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* INPUT PROMPT - Con toggle Audio/Testo */}
        <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl border border-slate-600/50 p-3">
          {/* Toggle Audio/Testo - Piccolo */}
          <div className="flex items-center space-x-1 mb-2">
            <button
              onClick={() => setInputMode('text')}
              className={`flex items-center justify-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                inputMode === 'text'
                  ? 'bg-purple-500 text-white'
                  : 'bg-slate-900/50 text-slate-400 border border-slate-600'
              }`}
            >
              <Type className="h-3 w-3" />
              <span>Testo</span>
            </button>
            <button
              onClick={() => setInputMode('audio')}
              className={`flex items-center justify-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                inputMode === 'audio'
                  ? 'bg-purple-500 text-white'
                  : 'bg-slate-900/50 text-slate-400 border border-slate-600'
              }`}
            >
              <Mic className="h-3 w-3" />
              <span>Audio</span>
            </button>
          </div>

          {/* Input Area */}
          {inputMode === 'text' ? (
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Descrivi l'immagine che vuoi generare..."
              className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder:text-slate-500 min-h-[80px] resize-none text-sm"
              disabled={isGenerating}
            />
          ) : (
            <div className="space-y-2">
              <button
                onClick={toggleRecording}
                disabled={isGenerating}
                className={`w-full flex items-center justify-center space-x-2 px-3 py-5 rounded-lg font-medium transition-all ${
                  isRecording
                    ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                    : 'bg-slate-900/50 border border-slate-600 text-slate-300 hover:border-purple-500/50'
                }`}
              >
                {isRecording ? (
                  <>
                    <MicOff className="h-5 w-5" />
                    <span className="text-sm">Tocca per fermare</span>
                  </>
                ) : (
                  <>
                    <Mic className="h-5 w-5" />
                    <span className="text-sm">Tocca e parla</span>
                  </>
                )}
              </button>
              {prompt && (
                <div className="p-2.5 bg-slate-900/50 border border-slate-600 rounded-lg">
                  <div className="text-xs text-slate-400 mb-1">Trascrizione:</div>
                  <div className="text-white text-sm">{prompt}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* PULSANTE GENERA */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim()}
          className="w-full flex items-center justify-center space-x-2 px-4 py-3.5 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 hover:from-purple-600 hover:via-pink-600 hover:to-orange-600 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Generazione...</span>
            </>
          ) : (
            <>
              <Sparkles className="h-5 w-5" />
              <span>Genera Immagine 🍌</span>
            </>
          )}
        </button>

      </div>
    </div>
  );
}
