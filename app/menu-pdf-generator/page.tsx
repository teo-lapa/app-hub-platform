'use client';

import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Home, FileText, Upload, Image as ImageIcon, Mic, Loader2, Download, Sparkles, X, Eye } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface MenuItem {
  name: string;
  description?: string;
  price?: string;
  allergens?: string[];
}

interface MenuCategory {
  name: string;
  items: MenuItem[];
}

interface MenuData {
  restaurantName: string;
  categories: MenuCategory[];
}

export default function MenuPDFGeneratorPage() {
  const [textInput, setTextInput] = useState('');
  const [imageInput, setImageInput] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedMenu, setGeneratedMenu] = useState<MenuData | null>(null);
  const [menuStyle, setMenuStyle] = useState<string>('classico');
  const [restaurantName, setRestaurantName] = useState('Il Mio Ristorante');
  const [restaurantLogo, setRestaurantLogo] = useState<string | null>(null);
  const [menuLanguage, setMenuLanguage] = useState<string>('it');
  const [isLoadingInfo, setIsLoadingInfo] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch restaurant info from Odoo on mount
  useEffect(() => {
    const fetchRestaurantInfo = async () => {
      try {
        const response = await fetch('/api/menu-pdf/restaurant-info');
        const data = await response.json();

        if (data.success && data.data) {
          setRestaurantName(data.data.restaurantName || 'Il Mio Ristorante');
          setRestaurantLogo(data.data.logo);
          console.log('✅ Restaurant info loaded:', data.data.restaurantName);
        }
      } catch (error) {
        console.error('Error fetching restaurant info:', error);
        // Usa valori di default in caso di errore
      } finally {
        setIsLoadingInfo(false);
      }
    };

    fetchRestaurantInfo();
  }, []);

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
      setImageInput(base64);
      setImagePreview(base64);
      toast.success('Foto del menu caricata!');
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateMenu = async () => {
    if (!textInput.trim() && !imageInput) {
      toast.error('Inserisci il testo del menu o carica una foto');
      return;
    }

    setIsGenerating(true);
    const loadingToast = toast.loading('Nano Banana sta analizzando il menu...');

    try {
      const response = await fetch('/api/gemini/generate-menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          textInput,
          imageInput,
          menuStyle,
          restaurantName,
          menuLanguage
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore durante la generazione');
      }

      setGeneratedMenu(data.menu);
      toast.success('Menu strutturato con successo!', { id: loadingToast });

    } catch (error: any) {
      console.error('Errore generazione menu:', error);
      toast.error(error.message || 'Errore durante la generazione del menu', { id: loadingToast });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!generatedMenu) return;

    const loadingToast = toast.loading('Generazione PDF in corso...');

    try {
      const response = await fetch('/api/gemini/generate-menu-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menu: generatedMenu,
          style: menuStyle
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore durante la generazione del PDF');
      }

      // Scarica il PDF
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${restaurantName.replace(/[^a-z0-9]/gi, '_')}_menu.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);

      toast.success('PDF scaricato con successo!', { id: loadingToast });

    } catch (error: any) {
      console.error('Errore download PDF:', error);
      toast.error(error.message || 'Errore durante il download del PDF', { id: loadingToast });
    }
  };

  const suggestedInputs = [
    "Antipasti: Bruschetta al pomodoro CHF 8, Caprese CHF 12\nPrimi: Spaghetti carbonara CHF 18, Risotto ai funghi CHF 22\nSecondi: Tagliata di manzo CHF 32, Orata al forno CHF 28",
    "Pizze: Margherita CHF 16, Marinara CHF 14, Diavola CHF 19, Quattro Stagioni CHF 20\nContorni: Patatine fritte CHF 7, Insalata mista CHF 8",
    "Menu del giorno: Antipasto della casa, Pasta al pomodoro, Cotoletta con patate, Dolce, Acqua e caffè - CHF 28"
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
                  <div className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 p-3 rounded-xl">
                    <FileText className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-white">Menu PDF Generator</h1>
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
          {/* Colonna Sinistra: Input */}
          <div className="space-y-6">
            {/* Nome Ristorante */}
            <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl border border-slate-600/50 p-6">
              <label className="block text-sm font-medium text-slate-300 mb-3 flex items-center justify-between">
                <span>Nome Ristorante</span>
                {isLoadingInfo && (
                  <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                )}
              </label>

              {restaurantLogo && (
                <div className="mb-3 flex justify-center relative">
                  <img
                    src={restaurantLogo}
                    alt="Logo Ristorante"
                    className="h-16 w-auto object-contain rounded-lg border border-slate-600/50 bg-white/5 p-2"
                  />
                  <button
                    onClick={() => setRestaurantLogo(null)}
                    className="absolute top-0 right-1/2 translate-x-8 -translate-y-1 p-1.5 bg-red-500 hover:bg-red-600 rounded-full text-white transition-colors"
                    title="Rimuovi logo"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}

              {!restaurantLogo && (
                <div className="mb-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;

                      if (!file.type.startsWith('image/')) {
                        toast.error('Seleziona un file immagine valido');
                        return;
                      }

                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const base64 = event.target?.result as string;
                        setRestaurantLogo(base64);
                        toast.success('Logo caricato!');
                      };
                      reader.readAsDataURL(file);
                    }}
                    className="hidden"
                    id="logo-upload"
                  />
                  <label
                    htmlFor="logo-upload"
                    className="flex items-center justify-center space-x-2 px-4 py-3 bg-slate-900/50 hover:bg-slate-700/50 border border-slate-600 hover:border-orange-500/50 rounded-lg text-slate-300 hover:text-white transition-all cursor-pointer"
                  >
                    <Upload className="h-4 w-4" />
                    <span className="text-sm">Carica Logo Personalizzato</span>
                  </label>
                </div>
              )}

              <input
                type="text"
                value={restaurantName}
                onChange={(e) => setRestaurantName(e.target.value)}
                placeholder="Il Mio Ristorante"
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-white placeholder:text-slate-500"
                disabled={isGenerating || isLoadingInfo}
              />

              {restaurantLogo && (
                <div className="mt-2 text-xs text-emerald-400 text-center">
                  ✓ Logo caricato da Odoo
                </div>
              )}
            </div>

            {/* Testo Menu */}
            <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl border border-slate-600/50 p-6">
              <label className="block text-sm font-medium text-slate-300 mb-3 flex items-center space-x-2">
                <FileText className="h-4 w-4" />
                <span>Scrivi il Menu</span>
              </label>
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Scrivi qui i piatti del tuo menu con prezzi e descrizioni..."
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-white placeholder:text-slate-500 min-h-[200px] resize-none"
                disabled={isGenerating}
              />
            </div>

            {/* Esempi */}
            <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl border border-slate-600/50 p-6">
              <label className="block text-sm font-medium text-slate-300 mb-3">
                Esempi Rapidi
              </label>
              <div className="space-y-2">
                {suggestedInputs.map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => setTextInput(suggestion)}
                    disabled={isGenerating}
                    className="w-full text-left px-4 py-3 bg-slate-900/50 hover:bg-slate-700/50 border border-slate-600/50 hover:border-orange-500/50 rounded-lg text-sm text-slate-300 hover:text-white transition-all disabled:opacity-50"
                  >
                    {suggestion.substring(0, 80)}...
                  </button>
                ))}
              </div>
            </div>

            {/* Upload Foto Menu */}
            <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl border border-slate-600/50 p-6">
              <label className="block text-sm font-medium text-slate-300 mb-3 flex items-center space-x-2">
                <Upload className="h-4 w-4" />
                <span>Oppure Carica Foto del Menu</span>
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
                className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-slate-900/50 hover:bg-slate-700/50 border border-slate-600 hover:border-orange-500/50 rounded-lg text-slate-300 hover:text-white transition-all disabled:opacity-50"
              >
                <ImageIcon className="h-4 w-4" />
                <span className="text-sm">Scatta o Carica Foto</span>
              </button>

              {imagePreview && (
                <div className="mt-4 relative">
                  <img
                    src={imagePreview}
                    alt="Menu"
                    className="w-full h-auto rounded-lg border border-slate-600"
                  />
                  <button
                    onClick={() => {
                      setImageInput(null);
                      setImagePreview(null);
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-red-500 hover:bg-red-600 rounded-full text-white transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <div className="mt-2 text-xs text-emerald-400 text-center">
                    ✓ Foto caricata - Gemini la leggerà
                  </div>
                </div>
              )}
            </div>

            {/* Lingua Menu */}
            <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl border border-slate-600/50 p-6">
              <label className="block text-sm font-medium text-slate-300 mb-3">
                Lingua del Menu
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {[
                  { code: 'de', name: 'Deutsch 🇩🇪', priority: true },
                  { code: 'fr', name: 'Français 🇫🇷', priority: true },
                  { code: 'en', name: 'English 🇬🇧', priority: true },
                  { code: 'it', name: 'Italiano 🇮🇹', priority: true },
                  { code: 'es', name: 'Español 🇪🇸' },
                  { code: 'pt', name: 'Português 🇵🇹' },
                  { code: 'ru', name: 'Русский 🇷🇺' },
                  { code: 'ar', name: 'العربية 🇸🇦' },
                  { code: 'zh', name: '中文 🇨🇳' },
                  { code: 'ja', name: '日本語 🇯🇵' },
                  { code: 'ko', name: '한국어 🇰🇷' },
                  { code: 'tr', name: 'Türkçe 🇹🇷' }
                ].map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => setMenuLanguage(lang.code)}
                    disabled={isGenerating}
                    className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      menuLanguage === lang.code
                        ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg ring-2 ring-blue-400'
                        : lang.priority
                        ? 'bg-slate-900/50 text-slate-200 border-2 border-blue-500/40 hover:border-blue-500'
                        : 'bg-slate-900/50 text-slate-300 border border-slate-600 hover:border-blue-500/50'
                    } disabled:opacity-50`}
                  >
                    {lang.name}
                  </button>
                ))}
              </div>
              <div className="mt-2 text-xs text-slate-500 text-center">
                Lingue nazionali CH: DE, FR, IT, EN
              </div>
            </div>

            {/* Stile Menu */}
            <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl border border-slate-600/50 p-6">
              <label className="block text-sm font-medium text-slate-300 mb-3">
                Stile PDF
              </label>
              <div className="grid grid-cols-3 gap-3">
                {['classico', 'moderno', 'elegante'].map((style) => (
                  <button
                    key={style}
                    onClick={() => setMenuStyle(style)}
                    disabled={isGenerating}
                    className={`px-4 py-3 rounded-lg text-sm font-medium transition-all capitalize ${
                      menuStyle === style
                        ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-lg'
                        : 'bg-slate-900/50 text-slate-300 border border-slate-600 hover:border-orange-500/50'
                    } disabled:opacity-50`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

            {/* Pulsante Genera */}
            <button
              onClick={handleGenerateMenu}
              disabled={isGenerating || (!textInput.trim() && !imageInput)}
              className="w-full flex items-center justify-center space-x-3 px-6 py-4 bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 hover:from-orange-600 hover:via-red-600 hover:to-pink-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl hover:shadow-orange-500/25 text-lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span>Analisi in corso...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-6 w-6" />
                  <span>Genera Menu 🍌</span>
                </>
              )}
            </button>
          </div>

          {/* Colonna Destra: Anteprima e Download */}
          <div className="space-y-6">
            <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl border border-slate-600/50 p-6">
              <label className="block text-sm font-medium text-slate-300 mb-4 flex items-center space-x-2">
                <Eye className="h-4 w-4" />
                <span>Anteprima Menu</span>
              </label>

              <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-6 min-h-[500px] max-h-[600px] overflow-y-auto">
                {generatedMenu ? (
                  <div className="space-y-6">
                    {/* Nome Ristorante */}
                    <div className="text-center border-b border-slate-700 pb-4">
                      <h2 className="text-3xl font-bold text-white mb-2">
                        {generatedMenu.restaurantName}
                      </h2>
                      <div className="w-32 h-0.5 bg-gradient-to-r from-orange-500 to-pink-500 mx-auto" />
                    </div>

                    {/* Categorie */}
                    {generatedMenu.categories.map((category, catIdx) => (
                      <div key={catIdx} className="space-y-4">
                        <h3 className="text-xl font-bold text-orange-400 uppercase border-b border-slate-700 pb-2">
                          {category.name}
                        </h3>

                        {category.items.map((item, itemIdx) => (
                          <div key={itemIdx} className="space-y-1">
                            <div className="flex justify-between items-start">
                              <span className="text-white font-semibold">{item.name}</span>
                              {item.price && (
                                <span className="text-orange-400 font-bold">CHF {item.price}</span>
                              )}
                            </div>

                            {item.description && (
                              <p className="text-sm text-slate-400">{item.description}</p>
                            )}

                            {item.allergens && item.allergens.length > 0 && (
                              <p className="text-xs text-slate-500 italic">
                                Allergeni: {item.allergens.join(', ')}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}

                    <div className="text-xs text-center text-emerald-400 font-medium pt-4 border-t border-slate-700">
                      ✓ Menu strutturato con successo
                    </div>
                  </div>
                ) : isGenerating ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center space-y-6">
                      <Loader2 className="h-16 w-16 text-orange-500 mx-auto animate-spin" />
                      <div className="space-y-2">
                        <div className="text-white font-medium text-lg">
                          Nano Banana sta analizzando...
                        </div>
                        <div className="text-slate-400 text-sm">
                          Strutturando il menu perfetto
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center space-y-6">
                      <div className="relative">
                        <Sparkles className="h-20 w-20 text-slate-600 mx-auto" />
                        <div className="absolute inset-0 h-20 w-20 mx-auto animate-ping opacity-20">
                          <Sparkles className="h-20 w-20 text-orange-500" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-slate-400 font-medium">
                          Il menu apparirà qui
                        </div>
                        <div className="text-slate-500 text-sm">
                          Scrivi o carica una foto e clicca "Genera Menu"
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Pulsante Download PDF */}
              {generatedMenu && (
                <button
                  onClick={handleDownloadPDF}
                  className="w-full mt-4 flex items-center justify-center space-x-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg transition-colors"
                >
                  <Download className="h-5 w-5" />
                  <span>Scarica PDF Professionale</span>
                </button>
              )}
            </div>

            {/* Info Card */}
            <div className="bg-gradient-to-r from-orange-500/10 to-pink-500/10 border border-orange-500/30 rounded-xl p-6">
              <h3 className="text-white font-semibold mb-3 flex items-center space-x-2">
                <Sparkles className="h-5 w-5 text-orange-400" />
                <span>Come funziona</span>
              </h3>
              <ul className="space-y-2 text-sm text-slate-300">
                <li className="flex items-start space-x-2">
                  <span className="text-orange-400">1.</span>
                  <span>Scrivi il menu o scatta/carica una foto</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-red-400">2.</span>
                  <span>Gemini AI analizza e struttura i piatti</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-pink-400">3.</span>
                  <span>Scegli lo stile del PDF (classico, moderno, elegante)</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-emerald-400">4.</span>
                  <span>Scarica e stampa il tuo menu professionale! 📄</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
