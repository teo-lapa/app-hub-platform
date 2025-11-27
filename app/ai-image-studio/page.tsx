'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Home, Sparkles, Wand2, Upload, Image as ImageIcon,
  Loader2, Download, Copy, X, Share2, Mic, MicOff, Type,
  Palette, Building2, ChevronDown, Lightbulb, Zap, Star
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

type Tone = 'professional' | 'casual' | 'fun' | 'luxury';
type InputMode = 'text' | 'audio';
type ActiveDropdown = 'format' | 'image' | 'style' | 'brand' | 'examples' | null;

// Floating particle component
const FloatingParticle = ({ delay, duration, size, color, left }: { delay: number; duration: number; size: number; color: string; left: number }) => (
  <div
    className={`absolute rounded-full opacity-60 animate-float pointer-events-none ${color}`}
    style={{
      width: size,
      height: size,
      left: `${left}%`,
      bottom: '-20px',
      animationDelay: `${delay}s`,
      animationDuration: `${duration}s`,
    }}
  />
);

// Sparkle burst animation
const SparkleEffect = ({ active }: { active: boolean }) => {
  if (!active) return null;
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {[...Array(12)].map((_, i) => (
        <div
          key={i}
          className="absolute w-2 h-2 bg-yellow-400 rounded-full animate-sparkle-burst"
          style={{
            left: '50%',
            top: '50%',
            animationDelay: `${i * 0.1}s`,
            transform: `rotate(${i * 30}deg)`,
          }}
        />
      ))}
    </div>
  );
};

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

  // Animation states
  const [showSparkles, setShowSparkles] = useState(false);
  const [imageJustGenerated, setImageJustGenerated] = useState(false);
  const [buttonHover, setButtonHover] = useState(false);

  // Share modal state
  const [showShareModal, setShowShareModal] = useState(false);
  const [socialCaption, setSocialCaption] = useState('');
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false);
  const [captionLanguage, setCaptionLanguage] = useState<'it' | 'en' | 'de' | 'fr' | 'es'>('it');

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
    setShowSparkles(true);
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
      setImageJustGenerated(true);
      setTimeout(() => setImageJustGenerated(false), 1500);
      toast.success('Immagine generata con successo!', { id: loadingToast });

    } catch (error: any) {
      console.error('Errore generazione immagine:', error);
      toast.error(error.message || 'Errore durante la generazione dell\'immagine', { id: loadingToast });
    } finally {
      setIsGenerating(false);
      setShowSparkles(false);
    }
  };

  // Compress and resize image to reduce payload size for Vercel limits (4.5MB max)
  const compressImage = (base64: string, maxWidth: number, quality: number): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Resize if larger than maxWidth
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        if (height > maxWidth) {
          width = (width * maxWidth) / height;
          height = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        // Compress to JPEG with quality
        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed);
      };
      img.src = base64;
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Seleziona un file immagine valido');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;

      // Always compress base images to stay under Vercel limits
      toast.loading('Ottimizzazione immagine...');
      const finalImage = await compressImage(base64, 800, 0.6);
      toast.dismiss();

      setBaseImage(finalImage);
      setBaseImagePreview(finalImage);
      toast.success('Immagine caricata!');
    };
    reader.readAsDataURL(file);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Seleziona un file immagine valido per il logo');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;

      // Always compress logo to very small size for Vercel
      toast.loading('Ottimizzazione logo...');
      const finalLogo = await compressImage(base64, 200, 0.6);
      toast.dismiss();

      setLogoImage(finalLogo);
      setLogoPreview(finalLogo);
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

  // Language configurations
  const languageConfig = {
    it: { name: 'Italiano', flag: '🇮🇹', instruction: 'Scrivi in italiano' },
    en: { name: 'English', flag: '🇬🇧', instruction: 'Write in English' },
    de: { name: 'Deutsch', flag: '🇩🇪', instruction: 'Schreibe auf Deutsch' },
    fr: { name: 'Français', flag: '🇫🇷', instruction: 'Écris en français' },
    es: { name: 'Español', flag: '🇪🇸', instruction: 'Escribe en español' }
  };

  // Generate social caption using AI copywriter
  const generateSocialCaption = async (language: 'it' | 'en' | 'de' | 'fr' | 'es' = 'it'): Promise<string> => {
    try {
      const toneDescriptions: Record<Tone, Record<string, string>> = {
        professional: { it: 'professionale e autorevole', en: 'professional and authoritative', de: 'professionell und seriös', fr: 'professionnel et autoritaire', es: 'profesional y autoritario' },
        casual: { it: 'casual e amichevole', en: 'casual and friendly', de: 'lässig und freundlich', fr: 'décontracté et amical', es: 'casual y amigable' },
        fun: { it: 'divertente e coinvolgente', en: 'fun and engaging', de: 'lustig und fesselnd', fr: 'amusant et engageant', es: 'divertido y atractivo' },
        luxury: { it: 'elegante e sofisticato', en: 'elegant and sophisticated', de: 'elegant und raffiniert', fr: 'élégant et sophistiqué', es: 'elegante y sofisticado' }
      };

      const langConfig = languageConfig[language];
      const toneText = toneDescriptions[tone][language];

      const copywriterPrompt = `You are an expert social media copywriter. Write an engaging description for this post:

IMAGE CONTENT: ${prompt}
TONE: ${toneText}
${companyMotto ? `COMPANY MOTTO: "${companyMotto}"` : ''}

RULES:
- ${langConfig.instruction}
- Use 2-4 relevant emojis (not too many)
- Maximum 2-3 catchy sentences
- Add 5-8 relevant hashtags at the end
- DO NOT use generic hashtags like #AIGenerated
- Be creative and engaging
- If there's a company motto, include it elegantly

Reply ONLY with the post text, nothing else.`;

      const response = await fetch('/api/gemini/generate-caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: copywriterPrompt })
      });

      if (!response.ok) {
        throw new Error('Errore generazione caption');
      }

      const data = await response.json();
      return data.caption || data.text || 'Scopri questa immagine! ✨';
    } catch (error) {
      console.error('Error generating caption:', error);
      // Fallback semplice
      return `✨ ${prompt}\n\n#Food #Italia #Delicious #Foodie #Yummy`;
    }
  };

  const handleShare = async () => {
    if (!generatedImage) return;

    // Open modal immediately with loading state
    setShowShareModal(true);
    setIsGeneratingCaption(true);
    setSocialCaption('');
    setCaptionLanguage('it');

    // Generate caption with AI in Italian by default
    const caption = await generateSocialCaption('it');
    setSocialCaption(caption);
    setIsGeneratingCaption(false);
  };

  // Regenerate caption in a different language
  const handleChangeLanguage = async (language: 'it' | 'en' | 'de' | 'fr' | 'es') => {
    if (language === captionLanguage && socialCaption) return; // Already in this language

    setCaptionLanguage(language);
    setIsGeneratingCaption(true);

    const caption = await generateSocialCaption(language);
    setSocialCaption(caption);
    setIsGeneratingCaption(false);
  };

  const handleCopyAndDownload = async () => {
    if (!generatedImage) return;

    try {
      // Copy text to clipboard
      await navigator.clipboard.writeText(socialCaption);

      // Download image
      const link = document.createElement('a');
      link.href = generatedImage;
      link.download = `ai-image-${Date.now()}.png`;
      link.click();

      toast.success('Testo copiato + Immagine scaricata! Ora incolla sui social 📱');
      setShowShareModal(false);
    } catch (error) {
      toast.error('Errore durante la preparazione');
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

  return (
    <div className="min-h-screen min-h-[100dvh] bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 relative overflow-hidden">
      {/* Custom CSS for animations */}
      <style jsx global>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0; }
          10% { opacity: 0.6; }
          90% { opacity: 0.6; }
          100% { transform: translateY(-100vh) rotate(360deg); opacity: 0; }
        }
        @keyframes sparkle-burst {
          0% { transform: translate(-50%, -50%) scale(0); opacity: 1; }
          100% { transform: translate(-50%, -50%) translateX(100px) scale(1); opacity: 0; }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(168, 85, 247, 0.4); }
          50% { box-shadow: 0 0 40px rgba(168, 85, 247, 0.8), 0 0 60px rgba(236, 72, 153, 0.4); }
        }
        @keyframes wiggle {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-3deg); }
          75% { transform: rotate(3deg); }
        }
        @keyframes bounce-in {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.05); }
          70% { transform: scale(0.9); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes gradient-shift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-float { animation: float linear infinite; }
        .animate-sparkle-burst { animation: sparkle-burst 0.6s ease-out forwards; }
        .animate-pulse-glow { animation: pulse-glow 2s ease-in-out infinite; }
        .animate-wiggle { animation: wiggle 0.5s ease-in-out; }
        .animate-bounce-in { animation: bounce-in 0.6s ease-out; }
        .animate-shimmer {
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
          background-size: 200% 100%;
          animation: shimmer 2s infinite;
        }
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient-shift 3s ease infinite;
        }
        .hover-lift {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .hover-lift:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(0,0,0,0.3);
        }
      `}</style>

      {/* Floating particles background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(15)].map((_, i) => (
          <FloatingParticle
            key={i}
            delay={i * 1.5}
            duration={15 + Math.random() * 10}
            size={4 + Math.random() * 8}
            color={['bg-purple-500', 'bg-pink-500', 'bg-orange-400', 'bg-yellow-400'][i % 4]}
            left={Math.random() * 100}
          />
        ))}
      </div>

      {/* Animated gradient orbs */}
      <div className="absolute top-20 left-10 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-20 right-10 w-80 h-80 bg-pink-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />

      {/* Header compatto */}
      <div className="bg-slate-900/80 backdrop-blur-sm border-b border-slate-700/50 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-3">
          <div className="py-2 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Link
                href="/dashboard"
                className="p-1.5 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg border border-slate-600 transition-all hover:scale-105 hover:border-purple-500/50"
              >
                <Home className="h-4 w-4 text-slate-300" />
              </Link>
              <div className="flex items-center space-x-2">
                <div className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 p-1.5 rounded-lg animate-gradient relative overflow-hidden">
                  <Sparkles className="h-4 w-4 text-white relative z-10" />
                  <div className="absolute inset-0 animate-shimmer" />
                </div>
                <span className="text-sm font-bold text-white">AI Image Studio</span>
                <span className="text-lg animate-bounce">🍌</span>
              </div>
            </div>
            {/* Magic wand indicator */}
            {isGenerating && (
              <div className="flex items-center space-x-2 text-purple-400">
                <Wand2 className="h-4 w-4 animate-wiggle" />
                <span className="text-xs">Magia in corso...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-3 py-3 space-y-3 relative z-10">

        {/* IMMAGINE GENERATA */}
        <div className={`bg-slate-800/40 backdrop-blur-sm rounded-xl border border-slate-600/50 p-3 transition-all duration-300 ${isGenerating ? 'animate-pulse-glow' : ''}`}>
          <div className={`aspect-square max-h-[45vh] bg-slate-900/50 border border-slate-700 rounded-xl flex items-center justify-center overflow-hidden relative ${imageJustGenerated ? 'animate-bounce-in' : ''}`}>
            <SparkleEffect active={showSparkles} />

            {generatedImage ? (
              <img
                src={generatedImage}
                alt="Immagine generata"
                className={`w-full h-full object-contain transition-all duration-500 ${imageJustGenerated ? 'scale-105' : 'scale-100'}`}
              />
            ) : isGenerating ? (
              <div className="text-center space-y-4">
                {/* Animated loading */}
                <div className="relative">
                  <div className="w-20 h-20 rounded-full border-4 border-purple-500/30 border-t-purple-500 animate-spin mx-auto" />
                  <Sparkles className="h-8 w-8 text-purple-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <div className="text-purple-400 text-sm font-medium">Creazione in corso...</div>
                  <div className="flex justify-center space-x-1">
                    {[...Array(3)].map((_, i) => (
                      <div
                        key={i}
                        className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.2}s` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-3 p-4 group cursor-pointer" onClick={() => document.querySelector('textarea')?.focus()}>
                <div className="relative">
                  <Sparkles className="h-12 w-12 text-slate-600 mx-auto group-hover:text-purple-500 transition-colors group-hover:animate-wiggle" />
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-purple-500 rounded-full animate-ping opacity-75" />
                </div>
                <div className="text-slate-500 text-sm group-hover:text-slate-400 transition-colors">
                  Scrivi un prompt e clicca Genera!
                </div>
                <div className="text-slate-600 text-xs">
                  La magia inizia da qui ✨
                </div>
              </div>
            )}
          </div>

          {/* Pulsanti azione immagine */}
          {generatedImage && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              <button
                onClick={handleShare}
                className="flex items-center justify-center space-x-1.5 px-2 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium rounded-lg transition-all text-sm hover-lift group"
              >
                <Share2 className="h-4 w-4 group-hover:animate-wiggle" />
                <span>Share</span>
              </button>
              <button
                onClick={handleDownload}
                className="flex items-center justify-center space-x-1.5 px-2 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition-all text-sm hover-lift group"
              >
                <Download className="h-4 w-4 group-hover:animate-bounce" />
                <span>Save</span>
              </button>
              <button
                onClick={handleCopyToClipboard}
                className="flex items-center justify-center space-x-1.5 px-2 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-all text-sm hover-lift group"
              >
                <Copy className="h-4 w-4 group-hover:scale-110 transition-transform" />
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
              className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap hover-lift ${
                activeDropdown === 'format'
                  ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                  : 'bg-slate-800/60 text-slate-300 border border-slate-600 hover:border-purple-500/50'
              }`}
            >
              <span>{aspectRatio}</span>
              <ChevronDown className={`h-3 w-3 transition-transform ${activeDropdown === 'format' ? 'rotate-180' : ''}`} />
            </button>

            {/* Image Button */}
            <button
              onClick={() => toggleDropdown('image')}
              className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap hover-lift ${
                activeDropdown === 'image'
                  ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                  : baseImagePreview
                    ? 'bg-emerald-600 text-white border border-emerald-500 shadow-lg shadow-emerald-500/30'
                    : 'bg-slate-800/60 text-slate-300 border border-slate-600 hover:border-purple-500/50'
              }`}
            >
              <ImageIcon className="h-4 w-4" />
              <span>Img</span>
              {baseImagePreview && <Star className="h-3 w-3 fill-current" />}
            </button>

            {/* Style Button */}
            <button
              onClick={() => toggleDropdown('style')}
              className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap hover-lift ${
                activeDropdown === 'style'
                  ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                  : 'bg-slate-800/60 text-slate-300 border border-slate-600 hover:border-purple-500/50'
              }`}
            >
              <Palette className="h-4 w-4" />
              <span className="text-base">{toneLabels[tone].emoji}</span>
            </button>

            {/* Brand Button */}
            <button
              onClick={() => toggleDropdown('brand')}
              className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap hover-lift ${
                activeDropdown === 'brand'
                  ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                  : includeLogo
                    ? 'bg-emerald-600 text-white border border-emerald-500 shadow-lg shadow-emerald-500/30'
                    : 'bg-slate-800/60 text-slate-300 border border-slate-600 hover:border-purple-500/50'
              }`}
            >
              <Building2 className="h-4 w-4" />
              <span>Brand</span>
              {includeLogo && <Zap className="h-3 w-3 fill-current" />}
            </button>

            {/* Examples Button */}
            <button
              onClick={() => toggleDropdown('examples')}
              className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap hover-lift ${
                activeDropdown === 'examples'
                  ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                  : 'bg-slate-800/60 text-slate-300 border border-slate-600 hover:border-purple-500/50'
              }`}
            >
              <Lightbulb className={`h-4 w-4 ${activeDropdown === 'examples' ? 'fill-yellow-400 text-yellow-400' : ''}`} />
            </button>
          </div>

          {/* Dropdown Panels */}
          {activeDropdown && (
            <div className="mt-2 bg-slate-800/90 backdrop-blur-sm rounded-xl border border-slate-600/50 p-3 animate-bounce-in shadow-xl">
              {/* Format Dropdown */}
              {activeDropdown === 'format' && (
                <div className="space-y-2">
                  <div className="text-xs text-slate-400 font-medium mb-2 flex items-center space-x-2">
                    <span>Formato Immagine</span>
                    <div className="flex-1 h-px bg-gradient-to-r from-slate-600 to-transparent" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {['1:1', '16:9', '4:3', '9:16'].map((ratio) => (
                      <button
                        key={ratio}
                        onClick={() => { setAspectRatio(ratio); setActiveDropdown(null); }}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all hover-lift ${
                          aspectRatio === ratio
                            ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                            : 'bg-slate-900/50 text-slate-300 border border-slate-600 hover:border-purple-500/50 hover:bg-slate-800/50'
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
                  <div className="text-xs text-slate-400 font-medium flex items-center space-x-2">
                    <span>Immagine Base (opzionale)</span>
                    <div className="flex-1 h-px bg-gradient-to-r from-slate-600 to-transparent" />
                  </div>
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
                    className="flex items-center space-x-2 px-4 py-2.5 bg-slate-900/50 border border-slate-600 border-dashed rounded-lg text-sm text-slate-300 hover:border-purple-500/50 w-full hover:bg-slate-800/50 transition-all group"
                  >
                    <Upload className="h-4 w-4 group-hover:animate-bounce" />
                    <span>{baseImagePreview ? 'Cambia Immagine' : 'Carica Immagine'}</span>
                  </button>
                  {baseImagePreview && (
                    <div className="flex items-center space-x-3 p-2 bg-slate-900/30 rounded-lg">
                      <img src={baseImagePreview} alt="Base" className="h-16 w-auto object-contain rounded border border-slate-600" />
                      <button
                        onClick={() => { setBaseImage(null); setBaseImagePreview(null); }}
                        className="p-1.5 bg-red-500 hover:bg-red-600 rounded-lg text-white hover:scale-110 transition-transform"
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
                  <div className="text-xs text-slate-400 font-medium mb-2 flex items-center space-x-2">
                    <span>Stile Immagine</span>
                    <div className="flex-1 h-px bg-gradient-to-r from-slate-600 to-transparent" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(['professional', 'casual', 'fun', 'luxury'] as Tone[]).map((t) => (
                      <button
                        key={t}
                        onClick={() => { setTone(t); setActiveDropdown(null); }}
                        className={`flex items-center justify-center space-x-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all hover-lift ${
                          tone === t
                            ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                            : 'bg-slate-900/50 text-slate-300 border border-slate-600 hover:border-purple-500/50 hover:bg-slate-800/50'
                        }`}
                      >
                        <span className="text-lg">{toneLabels[t].emoji}</span>
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
                    <div className="text-xs text-slate-400 font-medium flex items-center space-x-2">
                      <span>Branding Aziendale</span>
                    </div>
                    <label className="flex items-center space-x-2 cursor-pointer group">
                      <div className={`w-10 h-5 rounded-full transition-all ${includeLogo ? 'bg-purple-500' : 'bg-slate-600'} relative`}>
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all shadow ${includeLogo ? 'left-5' : 'left-0.5'}`} />
                      </div>
                      <span className="text-xs text-slate-300">{includeLogo ? 'ON' : 'OFF'}</span>
                      <input
                        type="checkbox"
                        checked={includeLogo}
                        onChange={(e) => setIncludeLogo(e.target.checked)}
                        disabled={isGenerating}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {includeLogo && (
                    <div className="space-y-3 animate-bounce-in">
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
                        className="flex items-center space-x-2 px-4 py-2.5 bg-slate-900/50 border border-slate-600 border-dashed rounded-lg cursor-pointer text-sm text-slate-300 hover:border-purple-500/50 w-full transition-all group"
                      >
                        <Upload className="h-4 w-4 group-hover:animate-bounce" />
                        <span>{logoPreview ? 'Cambia Logo' : 'Carica Logo'}</span>
                      </label>
                      {logoPreview && (
                        <div className="flex items-center space-x-3 p-2 bg-slate-900/30 rounded-lg">
                          <img src={logoPreview} alt="Logo" className="h-10 w-auto object-contain rounded" />
                          <button
                            onClick={() => { setLogoImage(null); setLogoPreview(null); }}
                            className="p-1.5 bg-red-500 hover:bg-red-600 rounded-lg text-white hover:scale-110 transition-transform"
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
                        className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                        disabled={isGenerating}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Examples Dropdown */}
              {activeDropdown === 'examples' && (
                <div className="space-y-2">
                  <div className="text-xs text-slate-400 font-medium mb-2 flex items-center space-x-2">
                    <Lightbulb className="h-3 w-3 text-yellow-400" />
                    <span>Esempi di Prompt</span>
                    <div className="flex-1 h-px bg-gradient-to-r from-slate-600 to-transparent" />
                  </div>
                  <div className="space-y-1.5">
                    {suggestedPrompts.map((suggestion, idx) => (
                      <button
                        key={idx}
                        onClick={() => { setPrompt(suggestion); setActiveDropdown(null); toast.success('Prompt selezionato!'); }}
                        disabled={isGenerating}
                        className="w-full text-left px-3 py-2 bg-slate-900/50 hover:bg-slate-700/50 border border-slate-600/50 rounded-lg text-xs text-slate-300 hover:text-white transition-all hover:border-purple-500/30 group"
                      >
                        <span className="group-hover:text-purple-400 transition-colors">💡</span> {suggestion}
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
                  ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20'
                  : 'bg-slate-900/50 text-slate-400 border border-slate-600 hover:border-purple-500/50'
              }`}
            >
              <Type className="h-3 w-3" />
              <span>Testo</span>
            </button>
            <button
              onClick={() => setInputMode('audio')}
              className={`flex items-center justify-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                inputMode === 'audio'
                  ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20'
                  : 'bg-slate-900/50 text-slate-400 border border-slate-600 hover:border-purple-500/50'
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
              placeholder="✨ Descrivi l'immagine dei tuoi sogni..."
              className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white placeholder:text-slate-500 min-h-[80px] resize-none text-sm transition-all"
              disabled={isGenerating}
            />
          ) : (
            <div className="space-y-2">
              <button
                onClick={toggleRecording}
                disabled={isGenerating}
                className={`w-full flex items-center justify-center space-x-2 px-3 py-5 rounded-lg font-medium transition-all ${
                  isRecording
                    ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30'
                    : 'bg-slate-900/50 border border-slate-600 border-dashed text-slate-300 hover:border-purple-500/50 hover:bg-slate-800/50'
                }`}
              >
                {isRecording ? (
                  <>
                    <div className="relative">
                      <MicOff className="h-5 w-5" />
                      <div className="absolute -top-1 -right-1 w-2 h-2 bg-white rounded-full animate-ping" />
                    </div>
                    <span className="text-sm">Tocca per fermare</span>
                  </>
                ) : (
                  <>
                    <Mic className="h-5 w-5" />
                    <span className="text-sm">🎤 Tocca e parla</span>
                  </>
                )}
              </button>
              {prompt && (
                <div className="p-2.5 bg-slate-900/50 border border-slate-600 rounded-lg animate-bounce-in">
                  <div className="text-xs text-slate-400 mb-1">📝 Trascrizione:</div>
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
          onMouseEnter={() => setButtonHover(true)}
          onMouseLeave={() => setButtonHover(false)}
          className={`w-full flex items-center justify-center space-x-2 px-4 py-4 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 hover:from-purple-600 hover:via-pink-600 hover:to-orange-600 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl hover:shadow-2xl hover:shadow-purple-500/25 animate-gradient relative overflow-hidden group ${!isGenerating && prompt.trim() ? 'hover:scale-[1.02]' : ''}`}
        >
          {/* Shimmer effect */}
          <div className="absolute inset-0 animate-shimmer opacity-30" />

          {isGenerating ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Creazione magica...</span>
              <Sparkles className="h-4 w-4 animate-pulse" />
            </>
          ) : (
            <>
              <Sparkles className={`h-5 w-5 ${buttonHover ? 'animate-wiggle' : ''}`} />
              <span>Genera Immagine</span>
              <span className="text-lg">🍌</span>
            </>
          )}
        </button>

      </div>

      {/* SHARE MODAL */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setShowShareModal(false)}>
          <div
            className="bg-slate-800 rounded-2xl border border-slate-600 max-w-md w-full p-4 animate-bounce-in shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-2 rounded-lg">
                  <Share2 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-bold">Condividi Social</h3>
                  <p className="text-slate-400 text-xs">Pronto per Instagram, Facebook, LinkedIn...</p>
                </div>
              </div>
              <button
                onClick={() => setShowShareModal(false)}
                className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            {/* Image Preview */}
            {generatedImage && (
              <div className="mb-4 rounded-xl overflow-hidden border border-slate-600">
                <img src={generatedImage} alt="Preview" className="w-full h-40 object-cover" />
              </div>
            )}

            {/* Language Selector */}
            <div className="mb-3">
              <label className="text-xs text-slate-400 font-medium mb-2 block">
                🌍 Lingua della descrizione
              </label>
              <div className="flex flex-wrap gap-2">
                {(['it', 'en', 'de', 'fr', 'es'] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => handleChangeLanguage(lang)}
                    disabled={isGeneratingCaption}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      captionLanguage === lang
                        ? 'bg-purple-500 text-white shadow-lg'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <span>{languageConfig[lang].flag}</span>
                    <span>{languageConfig[lang].name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Caption Preview */}
            <div className="mb-4">
              <label className="text-xs text-slate-400 font-medium mb-2 block flex items-center space-x-2">
                <span>✍️ Descrizione AI Copywriter</span>
                {isGeneratingCaption && (
                  <span className="text-purple-400 animate-pulse">(generazione in corso...)</span>
                )}
              </label>
              {isGeneratingCaption ? (
                <div className="w-full px-3 py-8 bg-slate-900/50 border border-slate-600 rounded-lg flex flex-col items-center justify-center space-y-3">
                  <Loader2 className="h-8 w-8 text-purple-500 animate-spin" />
                  <span className="text-slate-400 text-sm">Il copywriter AI sta scrivendo in {languageConfig[captionLanguage].name}...</span>
                </div>
              ) : (
                <textarea
                  value={socialCaption}
                  onChange={(e) => setSocialCaption(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm min-h-[150px] resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="La descrizione apparirà qui..."
                />
              )}
            </div>

            {/* Action Button - One button does both */}
            <button
              onClick={handleCopyAndDownload}
              disabled={isGeneratingCaption || !socialCaption}
              className="w-full flex items-center justify-center space-x-3 px-4 py-4 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 hover:from-purple-600 hover:via-pink-600 hover:to-orange-600 text-white font-bold rounded-xl transition-all shadow-xl hover:shadow-2xl hover:scale-[1.02] group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              <Copy className="h-5 w-5 group-hover:scale-110 transition-transform" />
              <span>Copia Testo + Scarica Immagine</span>
              <Download className="h-5 w-5 group-hover:animate-bounce" />
            </button>

            {/* Instructions */}
            <div className="mt-3 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
              <div className="text-xs text-slate-400 space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-purple-400">1.</span>
                  <span>Clicca il pulsante sopra</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-purple-400">2.</span>
                  <span>Apri il social (Instagram, Facebook...)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-purple-400">3.</span>
                  <span>Incolla il testo (Ctrl+V) e allega l'immagine scaricata</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
