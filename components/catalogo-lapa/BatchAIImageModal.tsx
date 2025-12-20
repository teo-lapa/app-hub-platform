'use client';

import { useState, useEffect } from 'react';
import { X, Sparkles, Loader2, CheckCircle, XCircle, AlertTriangle, Play, Pause, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';

interface Product {
  id: number;
  name: string;
  default_code?: string;
  image_256?: string;
}

interface BatchAIImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onComplete: () => void;
}

interface GenerationStatus {
  productId: number;
  status: 'pending' | 'generating' | 'success' | 'error';
  error?: string;
}

export function BatchAIImageModal({
  isOpen,
  onClose,
  products,
  onComplete
}: BatchAIImageModalProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [statuses, setStatuses] = useState<GenerationStatus[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [promptTemplate, setPromptTemplate] = useState('professional');

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen && products.length > 0) {
      setStatuses(products.map(p => ({ productId: p.id, status: 'pending' })));
      setCurrentIndex(0);
      setIsGenerating(false);
      setIsPaused(false);
    }
  }, [isOpen, products]);

  if (!isOpen) return null;

  const promptTemplates = {
    professional: (name: string) =>
      `Una foto professionale di ${name} su sfondo bianco pulito, illuminazione da studio, alta qualità, fotografia di prodotto commerciale`,
    natural: (name: string) =>
      `${name} in stile fotorealista con illuminazione naturale, composizione minimalista, foto di prodotto elegante`,
    premium: (name: string) =>
      `Immagine pubblicitaria di ${name} con packaging premium, luci soffuse, sfondo elegante, stile luxury`,
    food: (name: string) =>
      `Foto food styling professionale di ${name}, ingredienti freschi visibili, illuminazione calda e appetitosa, sfondo rustico elegante`
  };

  const generateImageForProduct = async (product: Product): Promise<boolean> => {
    try {
      // Update status to generating
      setStatuses(prev => prev.map(s =>
        s.productId === product.id ? { ...s, status: 'generating' } : s
      ));

      // Generate prompt based on template
      const prompt = promptTemplates[promptTemplate as keyof typeof promptTemplates](product.name);

      // Call Gemini API
      const response = await fetch('/api/gemini/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          aspectRatio: '1:1',
          baseImage: product.image_256 || null
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore generazione');
      }

      // Extract base64 and upload to Odoo
      const base64Data = data.image.dataUrl.replace(/^data:image\/\w+;base64,/, '');

      const uploadResponse = await fetch('/api/catalogo-lapa/update-product-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          imageBase64: base64Data
        })
      });

      const uploadData = await uploadResponse.json();

      if (!uploadResponse.ok || !uploadData.success) {
        throw new Error(uploadData.error || 'Errore upload');
      }

      // Update status to success
      setStatuses(prev => prev.map(s =>
        s.productId === product.id ? { ...s, status: 'success' } : s
      ));

      return true;

    } catch (error: any) {
      console.error(`Errore per prodotto ${product.id}:`, error);
      setStatuses(prev => prev.map(s =>
        s.productId === product.id ? { ...s, status: 'error', error: error.message } : s
      ));
      return false;
    }
  };

  const startGeneration = async () => {
    setIsGenerating(true);
    setIsPaused(false);

    for (let i = currentIndex; i < products.length; i++) {
      // Check if paused
      if (isPaused) {
        setCurrentIndex(i);
        setIsGenerating(false);
        return;
      }

      const product = products[i];
      const status = statuses.find(s => s.productId === product.id);

      // Skip already successful
      if (status?.status === 'success') {
        continue;
      }

      await generateImageForProduct(product);
      setCurrentIndex(i + 1);

      // Small delay between requests to avoid rate limiting
      if (i < products.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    setIsGenerating(false);
    toast.success(`Generazione completata! ${statuses.filter(s => s.status === 'success').length}/${products.length} immagini create`);
  };

  const pauseGeneration = () => {
    setIsPaused(true);
  };

  const retryFailed = async () => {
    const failedProducts = products.filter(p =>
      statuses.find(s => s.productId === p.id)?.status === 'error'
    );

    if (failedProducts.length === 0) {
      toast.error('Nessun prodotto fallito da ritentare');
      return;
    }

    setIsGenerating(true);

    for (const product of failedProducts) {
      if (isPaused) break;
      await generateImageForProduct(product);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    setIsGenerating(false);
  };

  const handleClose = () => {
    if (isGenerating) {
      const confirm = window.confirm('Generazione in corso. Vuoi interrompere?');
      if (!confirm) return;
      setIsPaused(true);
    }
    onComplete();
    onClose();
  };

  const successCount = statuses.filter(s => s.status === 'success').length;
  const errorCount = statuses.filter(s => s.status === 'error').length;
  const pendingCount = statuses.filter(s => s.status === 'pending').length;
  const generatingCount = statuses.filter(s => s.status === 'generating').length;
  const progress = products.length > 0 ? ((successCount + errorCount) / products.length) * 100 : 0;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div
        className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl max-w-4xl w-full shadow-2xl border border-purple-500/20 max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-3 rounded-xl">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Generazione Batch AI</h2>
              <p className="text-slate-400 text-sm">{products.length} prodotti selezionati</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-700 rounded-lg"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Template Selection */}
        <div className="p-6 border-b border-slate-700">
          <label className="block text-sm font-medium text-slate-300 mb-3">
            Stile Immagine
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { key: 'professional', label: 'Professionale', desc: 'Sfondo bianco, studio' },
              { key: 'natural', label: 'Naturale', desc: 'Luce naturale, minimal' },
              { key: 'premium', label: 'Premium', desc: 'Lusso, packaging' },
              { key: 'food', label: 'Food Styling', desc: 'Cucina, appetitoso' }
            ].map(template => (
              <button
                key={template.key}
                onClick={() => setPromptTemplate(template.key)}
                disabled={isGenerating}
                className={`p-3 rounded-lg text-left transition-all ${
                  promptTemplate === template.key
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                    : 'bg-slate-800 text-slate-300 border border-slate-600 hover:border-purple-500/50'
                } disabled:opacity-50`}
              >
                <div className="font-medium">{template.label}</div>
                <div className="text-xs opacity-70">{template.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Progress */}
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-300 text-sm">Progresso</span>
            <span className="text-slate-300 text-sm">{Math.round(progress)}%</span>
          </div>
          <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-3 text-sm">
            <div className="flex items-center space-x-4">
              <span className="flex items-center text-green-400">
                <CheckCircle className="h-4 w-4 mr-1" />
                {successCount} completati
              </span>
              <span className="flex items-center text-red-400">
                <XCircle className="h-4 w-4 mr-1" />
                {errorCount} errori
              </span>
              <span className="flex items-center text-slate-400">
                <AlertTriangle className="h-4 w-4 mr-1" />
                {pendingCount} in attesa
              </span>
            </div>
            {generatingCount > 0 && (
              <span className="flex items-center text-purple-400">
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                In elaborazione...
              </span>
            )}
          </div>
        </div>

        {/* Product List */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {products.map((product) => {
              const status = statuses.find(s => s.productId === product.id);
              return (
                <div
                  key={product.id}
                  className={`bg-slate-800/50 rounded-lg p-2 border transition-all ${
                    status?.status === 'success' ? 'border-green-500/50 bg-green-500/10' :
                    status?.status === 'error' ? 'border-red-500/50 bg-red-500/10' :
                    status?.status === 'generating' ? 'border-purple-500/50 bg-purple-500/10' :
                    'border-slate-600/50'
                  }`}
                >
                  <div className="aspect-square bg-slate-700/30 rounded overflow-hidden mb-2 relative">
                    {product.image_256 ? (
                      <img
                        src={`data:image/jpeg;base64,${product.image_256}`}
                        alt={product.name}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">
                        No img
                      </div>
                    )}
                    {/* Status overlay */}
                    {status?.status === 'generating' && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <Loader2 className="h-8 w-8 text-purple-400 animate-spin" />
                      </div>
                    )}
                    {status?.status === 'success' && (
                      <div className="absolute top-1 right-1">
                        <CheckCircle className="h-5 w-5 text-green-400" />
                      </div>
                    )}
                    {status?.status === 'error' && (
                      <div className="absolute top-1 right-1">
                        <XCircle className="h-5 w-5 text-red-400" />
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-white line-clamp-2 font-medium">
                    {product.name}
                  </div>
                  {product.default_code && (
                    <div className="text-[10px] text-slate-400 truncate">
                      {product.default_code}
                    </div>
                  )}
                  {status?.error && (
                    <div className="text-[10px] text-red-400 mt-1 truncate" title={status.error}>
                      {status.error}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-slate-700 bg-slate-900/50">
          <button
            onClick={handleClose}
            disabled={isGenerating}
            className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            Chiudi
          </button>

          <div className="flex items-center space-x-3">
            {errorCount > 0 && !isGenerating && (
              <button
                onClick={retryFailed}
                className="flex items-center space-x-2 px-4 py-3 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors"
              >
                <RotateCcw className="h-5 w-5" />
                <span>Riprova falliti ({errorCount})</span>
              </button>
            )}

            {isGenerating ? (
              <button
                onClick={pauseGeneration}
                className="flex items-center space-x-2 px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-white font-semibold rounded-lg transition-all"
              >
                <Pause className="h-5 w-5" />
                <span>Pausa</span>
              </button>
            ) : (
              <button
                onClick={startGeneration}
                disabled={pendingCount === 0 && errorCount === 0}
                className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              >
                <Play className="h-5 w-5" />
                <span>{currentIndex > 0 ? 'Riprendi' : 'Avvia Generazione'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
