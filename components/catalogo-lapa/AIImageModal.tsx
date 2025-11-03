'use client';

import { useState, useRef } from 'react';
import { X, Sparkles, Image as ImageIcon, Upload, Wand2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface AIImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: number;
  productName: string;
  currentImage?: string; // Base64 immagine attuale
  onImageGenerated: (newImageBase64: string) => void;
}

export function AIImageModal({
  isOpen,
  onClose,
  productId,
  productName,
  currentImage,
  onImageGenerated
}: AIImageModalProps) {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<string>('1:1');
  const [useCurrentImage, setUseCurrentImage] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('Inserisci una descrizione per generare l\'immagine');
      return;
    }

    setIsGenerating(true);
    try {
      // Determina quale immagine usare come base (se richiesto)
      let baseImage: string | null = null;
      if (useCurrentImage && currentImage) {
        baseImage = currentImage;
      } else if (uploadedImage) {
        baseImage = uploadedImage;
      }

      const response = await fetch('/api/gemini/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          aspectRatio,
          baseImage
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore durante la generazione');
      }

      setGeneratedImage(data.image.dataUrl);
      toast.success('Immagine generata con successo!');

    } catch (error: any) {
      console.error('Errore generazione immagine:', error);
      toast.error(error.message || 'Errore durante la generazione dell\'immagine');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConfirm = () => {
    if (!generatedImage) {
      toast.error('Nessuna immagine da confermare');
      return;
    }

    // Estrai solo il base64 senza il prefisso data:image
    const base64Data = generatedImage.replace(/^data:image\/\w+;base64,/, '');
    onImageGenerated(base64Data);
    toast.success('Immagine confermata! Ora verrà caricata su Odoo...');
    handleClose();
  };

  const handleClose = () => {
    setPrompt('');
    setGeneratedImage(null);
    setUploadedImage(null);
    setUseCurrentImage(false);
    onClose();
  };

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Verifica tipo file
    if (!file.type.startsWith('image/')) {
      toast.error('Seleziona un file immagine valido');
      return;
    }

    try {
      toast.loading('Compressione immagine...');
      const compressedBase64 = await compressImage(file);
      setUploadedImage(compressedBase64);
      setUseCurrentImage(false); // Disattiva immagine corrente
      toast.dismiss();
      toast.success('Immagine caricata e ottimizzata!');
    } catch (error: any) {
      console.error('Errore compressione:', error);
      toast.dismiss();
      toast.error('Errore durante la compressione dell\'immagine');
    }
  };

  // Template prompts suggeriti
  const suggestedPrompts = [
    `Una foto professionale di ${productName} su sfondo bianco pulito, illuminazione da studio, alta qualità`,
    `${productName} in stile fotorealista con illuminazione naturale, composizione minimalista`,
    `Immagine pubblicitaria di ${productName} con packaging premium, luci soffuse, sfondo elegante`,
  ];

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div
        className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl max-w-4xl w-full shadow-2xl border border-emerald-500/20 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-r from-emerald-500 to-blue-500 p-3 rounded-xl">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">AI Image Generator</h2>
              <p className="text-slate-400 text-sm">Powered by Google Gemini</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-700 rounded-lg"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Prodotto corrente */}
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <div className="text-sm text-slate-400 mb-1">Prodotto</div>
            <div className="text-white font-semibold">{productName}</div>
            <div className="text-xs text-slate-500">ID: {productId}</div>
          </div>

          {/* Layout a 2 colonne */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Colonna sinistra: Controlli */}
            <div className="space-y-4">
              {/* Prompt principale */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Descrizione Immagine
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Descrivi l'immagine che vuoi generare..."
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-white placeholder:text-slate-500 min-h-[120px] resize-none"
                  disabled={isGenerating}
                />
                <div className="text-xs text-slate-500 mt-1">
                  Tip: Descrivi la scena in modo dettagliato, non usare solo keyword
                </div>
              </div>

              {/* Prompts suggeriti */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Suggerimenti
                </label>
                <div className="space-y-2">
                  {suggestedPrompts.map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={() => setPrompt(suggestion)}
                      disabled={isGenerating}
                      className="w-full text-left px-3 py-2 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-600/50 hover:border-emerald-500/50 rounded-lg text-sm text-slate-300 hover:text-white transition-all disabled:opacity-50"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>

              {/* Aspect Ratio */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Formato Immagine
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['1:1', '16:9', '4:3'].map((ratio) => (
                    <button
                      key={ratio}
                      onClick={() => setAspectRatio(ratio)}
                      disabled={isGenerating}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        aspectRatio === ratio
                          ? 'bg-gradient-to-r from-emerald-500 to-blue-500 text-white'
                          : 'bg-slate-800 text-slate-300 border border-slate-600 hover:border-emerald-500/50'
                      } disabled:opacity-50`}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              </div>

              {/* Opzioni immagine base */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-300">
                  Immagine di Partenza (opzionale)
                </label>

                {/* Usa immagine corrente */}
                {currentImage && (
                  <label className="flex items-center space-x-3 p-3 bg-slate-800/50 border border-slate-600/50 rounded-lg cursor-pointer hover:border-emerald-500/50 transition-colors">
                    <input
                      type="checkbox"
                      checked={useCurrentImage}
                      onChange={(e) => {
                        setUseCurrentImage(e.target.checked);
                        if (e.target.checked) setUploadedImage(null);
                      }}
                      disabled={isGenerating}
                      className="w-4 h-4 text-emerald-500 bg-slate-700 border-slate-600 rounded focus:ring-emerald-500"
                    />
                    <ImageIcon className="h-4 w-4 text-slate-400" />
                    <span className="text-sm text-slate-300">Usa immagine corrente del prodotto</span>
                  </label>
                )}

                {/* Upload immagine custom */}
                <div>
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
                    className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-emerald-500/50 rounded-lg text-slate-300 hover:text-white transition-all disabled:opacity-50"
                  >
                    <Upload className="h-4 w-4" />
                    <span className="text-sm">Carica un'altra immagine</span>
                  </button>
                  {uploadedImage && (
                    <div className="mt-2 text-xs text-emerald-400">
                      ✓ Immagine caricata
                    </div>
                  )}
                </div>
              </div>

              {/* Pulsante genera */}
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim()}
                className="w-full flex items-center justify-center space-x-2 px-6 py-4 bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-emerald-500/25"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Generazione in corso...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="h-5 w-5" />
                    <span>Genera Immagine AI</span>
                  </>
                )}
              </button>
            </div>

            {/* Colonna destra: Anteprima */}
            <div className="space-y-4">
              <label className="block text-sm font-medium text-slate-300">
                Anteprima
              </label>

              {/* Box anteprima */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 min-h-[300px] flex items-center justify-center">
                {generatedImage ? (
                  <div className="w-full space-y-3">
                    <img
                      src={generatedImage}
                      alt="Immagine generata"
                      className="w-full h-auto rounded-lg shadow-xl"
                    />
                    <div className="text-xs text-center text-emerald-400">
                      ✓ Immagine generata con successo
                    </div>
                  </div>
                ) : isGenerating ? (
                  <div className="text-center space-y-4">
                    <Loader2 className="h-12 w-12 text-emerald-500 mx-auto animate-spin" />
                    <div className="text-slate-400">
                      Gemini sta creando la tua immagine...
                    </div>
                  </div>
                ) : (
                  <div className="text-center space-y-4">
                    <Sparkles className="h-12 w-12 text-slate-600 mx-auto" />
                    <div className="text-slate-500">
                      L'immagine generata apparirà qui
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-slate-700 bg-slate-900/50">
          <button
            onClick={handleClose}
            disabled={isGenerating}
            className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            Annulla
          </button>

          <button
            onClick={handleConfirm}
            disabled={!generatedImage || isGenerating}
            className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            Conferma e Salva su Odoo
          </button>
        </div>
      </div>
    </div>
  );
}
