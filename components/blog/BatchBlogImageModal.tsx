'use client';

import { useState, useEffect } from 'react';
import { X, Sparkles, Loader2, CheckCircle, XCircle, Play, Pause, Download, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { BlogArticle } from '@/types/blog';
import { generateDefaultPrompt } from '@/lib/utils/blogArticles';

interface BatchBlogImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  articles: BlogArticle[];
  onComplete?: () => void;
}

interface GenerationStatus {
  articleId: number;
  status: 'pending' | 'generating' | 'success' | 'error';
  error?: string;
  imageDataUrl?: string;
}

export function BatchBlogImageModal({
  isOpen,
  onClose,
  articles,
  onComplete
}: BatchBlogImageModalProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [statuses, setStatuses] = useState<GenerationStatus[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [styleTemplate, setStyleTemplate] = useState('editorial');

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen && articles.length > 0) {
      setStatuses(articles.map(a => ({ articleId: a.id, status: 'pending' })));
      setCurrentIndex(0);
      setIsGenerating(false);
      setIsPaused(false);
    }
  }, [isOpen, articles]);

  if (!isOpen) return null;

  const styleTemplates = {
    editorial: (article: BlogArticle) =>
      `Create a professional editorial blog header image for an article titled "${article.name}". Modern, clean design with typography elements, sophisticated color palette, high quality for web publishing.`,
    food: (article: BlogArticle) =>
      `Create a food photography blog header for "${article.name}". Appetizing Italian cuisine imagery, fresh ingredients, warm lighting, rustic elegance, professional food styling.`,
    business: (article: BlogArticle) =>
      `Create a business-focused blog header for "${article.name}". Corporate, modern aesthetic, professional photography, clean design, suitable for restaurant industry content.`,
    vibrant: (article: BlogArticle) =>
      `Create a vibrant, engaging blog header for "${article.name}". Colorful, dynamic composition, eye-catching imagery, modern design, suitable for marketing content.`
  };

  const generateImageForArticle = async (article: BlogArticle): Promise<boolean> => {
    try {
      // Update status to generating
      setStatuses(prev => prev.map(s =>
        s.articleId === article.id ? { ...s, status: 'generating' } : s
      ));

      // Generate prompt based on template
      const prompt = styleTemplates[styleTemplate as keyof typeof styleTemplates](article);

      // Call Gemini API
      const response = await fetch('/api/gemini/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          aspectRatio: '16:9',
          tone: styleTemplate
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore generazione');
      }

      // Update status to success with image
      setStatuses(prev => prev.map(s =>
        s.articleId === article.id
          ? { ...s, status: 'success', imageDataUrl: data.image.dataUrl }
          : s
      ));

      return true;

    } catch (error: any) {
      console.error(`Errore per articolo ${article.id}:`, error);
      setStatuses(prev => prev.map(s =>
        s.articleId === article.id
          ? { ...s, status: 'error', error: error.message }
          : s
      ));
      return false;
    }
  };

  const startGeneration = async () => {
    setIsGenerating(true);
    setIsPaused(false);

    for (let i = currentIndex; i < articles.length; i++) {
      // Check if paused
      if (isPaused) {
        setCurrentIndex(i);
        setIsGenerating(false);
        return;
      }

      const article = articles[i];
      const status = statuses.find(s => s.articleId === article.id);

      // Skip already successful
      if (status?.status === 'success') {
        continue;
      }

      await generateImageForArticle(article);
      setCurrentIndex(i + 1);

      // Small delay between requests to avoid rate limiting
      if (i < articles.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    setIsGenerating(false);
    toast.success(`Generazione completata! ${statuses.filter(s => s.status === 'success').length}/${articles.length} immagini create`);

    if (onComplete) {
      onComplete();
    }
  };

  const pauseGeneration = () => {
    setIsPaused(true);
    toast('Generazione in pausa');
  };

  const resumeGeneration = () => {
    setIsPaused(false);
    startGeneration();
  };

  const retryFailed = () => {
    // Reset failed items to pending
    setStatuses(prev => prev.map(s =>
      s.status === 'error' ? { ...s, status: 'pending', error: undefined } : s
    ));
    setCurrentIndex(0);
    toast('Riprovo gli articoli con errore...');
    startGeneration();
  };

  const downloadAll = () => {
    const successfulImages = statuses.filter(s => s.status === 'success' && s.imageDataUrl);

    if (successfulImages.length === 0) {
      toast.error('Nessuna immagine da scaricare');
      return;
    }

    successfulImages.forEach((status, index) => {
      const article = articles.find(a => a.id === status.articleId);
      if (!article || !status.imageDataUrl) return;

      setTimeout(() => {
        const link = document.createElement('a');
        link.href = status.imageDataUrl!;
        link.download = `blog-${article.id}-${article.name.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '-')}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }, index * 300); // Stagger downloads
    });

    toast.success(`Download avviato per ${successfulImages.length} immagini`);
  };

  const handleClose = () => {
    if (isGenerating && !isPaused) {
      toast.error('Ferma prima la generazione');
      return;
    }
    onClose();
  };

  const stats = {
    pending: statuses.filter(s => s.status === 'pending').length,
    generating: statuses.filter(s => s.status === 'generating').length,
    success: statuses.filter(s => s.status === 'success').length,
    error: statuses.filter(s => s.status === 'error').length
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto border-2 border-slate-700">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-emerald-600 p-6 flex items-center justify-between border-b-2 border-purple-500/50 z-10">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Sparkles className="w-6 h-6" />
              Generazione Batch Immagini Blog
            </h2>
            <p className="text-purple-100 text-sm mt-1">
              {articles.length} articoli selezionati
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-slate-700/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-slate-300">{stats.pending}</div>
              <div className="text-xs text-slate-400">In attesa</div>
            </div>
            <div className="bg-blue-500/20 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-300">{stats.generating}</div>
              <div className="text-xs text-blue-400">In corso</div>
            </div>
            <div className="bg-emerald-500/20 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-emerald-300">{stats.success}</div>
              <div className="text-xs text-emerald-400">Completati</div>
            </div>
            <div className="bg-red-500/20 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-red-300">{stats.error}</div>
              <div className="text-xs text-red-400">Errori</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="bg-slate-700 rounded-full h-4 overflow-hidden">
            <div
              className="bg-gradient-to-r from-purple-600 to-emerald-600 h-full transition-all duration-300"
              style={{ width: `${((stats.success + stats.error) / articles.length) * 100}%` }}
            />
          </div>

          {/* Style Template Selection */}
          {!isGenerating && (
            <div>
              <label className="block text-white font-medium mb-2">
                Stile Template
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  { value: 'editorial', label: 'Editoriale', emoji: '📰' },
                  { value: 'food', label: 'Food Photography', emoji: '🍝' },
                  { value: 'business', label: 'Business', emoji: '💼' },
                  { value: 'vibrant', label: 'Vibrante', emoji: '🎨' }
                ].map((style) => (
                  <button
                    key={style.value}
                    onClick={() => setStyleTemplate(style.value)}
                    className={`
                      px-4 py-2 rounded-lg font-medium transition-all
                      ${styleTemplate === style.value
                        ? 'bg-purple-600 text-white shadow-lg'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }
                    `}
                  >
                    {style.emoji} {style.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Articles Status List */}
          <div className="max-h-96 overflow-y-auto space-y-2">
            {articles.map((article, index) => {
              const status = statuses.find(s => s.articleId === article.id);
              return (
                <div
                  key={article.id}
                  className={`
                    flex items-center gap-3 p-3 rounded-lg
                    ${status?.status === 'success' ? 'bg-emerald-500/10 border border-emerald-500/30' :
                      status?.status === 'error' ? 'bg-red-500/10 border border-red-500/30' :
                      status?.status === 'generating' ? 'bg-blue-500/10 border border-blue-500/30' :
                      'bg-slate-700/30 border border-slate-600'}
                  `}
                >
                  <div className="flex-shrink-0 w-6 h-6">
                    {status?.status === 'success' && <CheckCircle className="w-6 h-6 text-emerald-400" />}
                    {status?.status === 'error' && <XCircle className="w-6 h-6 text-red-400" />}
                    {status?.status === 'generating' && <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />}
                    {status?.status === 'pending' && <div className="w-6 h-6 rounded-full bg-slate-600" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-white font-medium truncate">{article.name}</div>
                    {status?.error && (
                      <div className="text-red-400 text-xs">{status.error}</div>
                    )}
                  </div>

                  {status?.imageDataUrl && (
                    <div className="flex-shrink-0 w-24 h-14 rounded overflow-hidden bg-slate-800">
                      <img
                        src={status.imageDataUrl}
                        alt={article.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-slate-700">
            {!isGenerating && stats.pending > 0 && (
              <button
                onClick={startGeneration}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-emerald-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-emerald-700 transition-all flex items-center justify-center gap-2"
              >
                <Play className="w-5 h-5" />
                Avvia Generazione
              </button>
            )}

            {isGenerating && !isPaused && (
              <button
                onClick={pauseGeneration}
                className="flex-1 px-6 py-3 bg-yellow-600 text-white rounded-lg font-semibold hover:bg-yellow-700 transition-all flex items-center justify-center gap-2"
              >
                <Pause className="w-5 h-5" />
                Pausa
              </button>
            )}

            {isPaused && (
              <button
                onClick={resumeGeneration}
                className="flex-1 px-6 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
              >
                <Play className="w-5 h-5" />
                Riprendi
              </button>
            )}

            {stats.error > 0 && !isGenerating && (
              <button
                onClick={retryFailed}
                className="px-6 py-3 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-all flex items-center gap-2"
              >
                <RotateCcw className="w-5 h-5" />
                Riprova Errori
              </button>
            )}

            {stats.success > 0 && (
              <button
                onClick={downloadAll}
                className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-all flex items-center gap-2"
              >
                <Download className="w-5 h-5" />
                Scarica Tutti ({stats.success})
              </button>
            )}

            <button
              onClick={handleClose}
              disabled={isGenerating && !isPaused}
              className="px-6 py-3 bg-slate-700 text-white rounded-lg font-semibold hover:bg-slate-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Chiudi
            </button>
          </div>

          {/* Info Note */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <p className="text-blue-200 text-sm">
              Ogni immagine richiede circa 5-10 secondi. Le generazioni avvengono in sequenza con una pausa di 1 secondo tra ognuna per evitare rate limiting.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
