'use client';

import { useState } from 'react';
import { X, Sparkles, Download, Loader2, Wand2, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { BlogArticle } from '@/types/blog';
import { generateDefaultPrompt, getKeywordsArray } from '@/lib/utils/blogArticles';

interface BlogAIImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  article: BlogArticle;
  onImageGenerated?: (imageBase64: string) => void;
}

export function BlogAIImageModal({
  isOpen,
  onClose,
  article,
  onImageGenerated
}: BlogAIImageModalProps) {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [tone, setTone] = useState<string>('professional');
  const [isUploading, setIsUploading] = useState(false);
  const [isUploaded, setIsUploaded] = useState(false);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    const finalPrompt = prompt.trim() || generateDefaultPrompt(article);

    if (!finalPrompt) {
      toast.error('Inserisci una descrizione per generare l\'immagine');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('/api/gemini/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: finalPrompt,
          aspectRatio: '16:9',
          tone
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore durante la generazione');
      }

      setGeneratedImage(data.image.dataUrl);
      toast.success('Immagine generata con successo!');

      if (onImageGenerated) {
        const base64Data = data.image.dataUrl.replace(/^data:image\/\w+;base64,/, '');
        onImageGenerated(base64Data);
      }

    } catch (error: any) {
      console.error('Errore generazione immagine:', error);
      toast.error(error.message || 'Errore durante la generazione dell\'immagine');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!generatedImage) {
      toast.error('Nessuna immagine da scaricare');
      return;
    }

    const link = document.createElement('a');
    link.href = generatedImage;
    link.download = `blog-${article.id}-${article.name.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '-')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Immagine scaricata!');
  };

  const handleUploadToOdoo = async () => {
    if (!generatedImage) {
      toast.error('Nessuna immagine da caricare');
      return;
    }

    setIsUploading(true);
    try {
      const response = await fetch('/api/blog/upload-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blogPostId: article.id,
          imageBase64: generatedImage,
          filename: `blog_${article.id}_${Date.now()}.png`
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore durante il caricamento');
      }

      setIsUploaded(true);
      toast.success('✅ Immagine caricata su Odoo!');
    } catch (error: any) {
      console.error('Errore caricamento su Odoo:', error);
      toast.error(error.message || 'Errore durante il caricamento su Odoo');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setPrompt('');
    setGeneratedImage(null);
    setTone('professional');
    setIsUploading(false);
    setIsUploaded(false);
    onClose();
  };

  const suggestedPrompts = [
    `Professional header for "${article.name.slice(0, 50)}"`,
    `Modern food blog image about ${getKeywordsArray(article)[0] || 'Italian cuisine'}`,
    `Editorial style image for restaurant industry article`,
    `Vibrant, engaging imagery for ${article.subtitle?.slice(0, 40)}`
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border-2 border-slate-700">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-emerald-600 p-6 flex items-center justify-between border-b-2 border-purple-500/50">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Sparkles className="w-6 h-6" />
              Genera Immagine AI per Blog
            </h2>
            <p className="text-purple-100 text-sm mt-1 line-clamp-1">
              {article.name}
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
          {/* Article Info */}
          <div className="bg-slate-700/50 rounded-lg p-4">
            <h3 className="text-white font-semibold mb-2">{article.name}</h3>
            {article.subtitle && (
              <p className="text-slate-300 text-sm mb-2">{article.subtitle}</p>
            )}
            <div className="flex flex-wrap gap-2">
              {getKeywordsArray(article).slice(0, 5).map((keyword, index) => (
                <span
                  key={index}
                  className="px-2 py-1 rounded-full bg-slate-600 text-slate-200 text-xs"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>

          {/* Tone Selection */}
          <div>
            <label className="block text-white font-medium mb-2">
              Stile Immagine
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { value: 'professional', label: 'Professionale', emoji: '💼' },
                { value: 'editorial', label: 'Editoriale', emoji: '📰' },
                { value: 'modern', label: 'Moderno', emoji: '✨' },
                { value: 'vibrant', label: 'Vibrante', emoji: '🎨' }
              ].map((style) => (
                <button
                  key={style.value}
                  onClick={() => setTone(style.value)}
                  className={`
                    px-4 py-2 rounded-lg font-medium transition-all
                    ${tone === style.value
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

          {/* Prompt Input */}
          <div>
            <label className="block text-white font-medium mb-2">
              Descrizione Immagine (opzionale)
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={generateDefaultPrompt(article)}
              className="w-full px-4 py-3 rounded-lg bg-slate-700 text-white border-2 border-slate-600 focus:border-purple-500 focus:outline-none resize-none"
              rows={4}
            />
            <p className="text-slate-400 text-xs mt-1">
              Lascia vuoto per usare una descrizione automatica basata sul titolo e parole chiave
            </p>
          </div>

          {/* Suggested Prompts */}
          <div>
            <label className="block text-white font-medium mb-2">
              Suggerimenti Veloci
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {suggestedPrompts.map((suggested, index) => (
                <button
                  key={index}
                  onClick={() => setPrompt(suggested)}
                  className="px-3 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 text-left text-sm transition-colors"
                >
                  <Wand2 className="w-3 h-3 inline mr-1" />
                  {suggested}
                </button>
              ))}
            </div>
          </div>

          {/* Generated Image Preview */}
          {generatedImage && (
            <div>
              <label className="block text-white font-medium mb-2">
                Anteprima Immagine Generata (16:9)
              </label>
              <div className="relative aspect-video rounded-lg overflow-hidden bg-slate-800">
                <img
                  src={generatedImage}
                  alt="Generated"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-emerald-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generazione in corso...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Genera Immagine
                </>
              )}
            </button>

            {generatedImage && (
              <>
                <button
                  onClick={handleUploadToOdoo}
                  disabled={isUploading || isUploaded}
                  className={`px-6 py-3 rounded-lg font-semibold transition-all flex items-center gap-2 ${
                    isUploaded
                      ? 'bg-green-600 text-white cursor-default'
                      : 'bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50'
                  }`}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Caricamento...
                    </>
                  ) : isUploaded ? (
                    <>
                      <Upload className="w-5 h-5" />
                      Caricato su Odoo ✓
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      Carica su Odoo
                    </>
                  )}
                </button>

                <button
                  onClick={handleDownload}
                  className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-all flex items-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  Scarica
                </button>
              </>
            )}

            <button
              onClick={handleClose}
              className="px-6 py-3 bg-slate-700 text-white rounded-lg font-semibold hover:bg-slate-600 transition-all"
            >
              Chiudi
            </button>
          </div>

          {/* Info Note */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <p className="text-blue-200 text-sm">
              Le immagini generate sono in formato 16:9, perfette per header di articoli blog.
              Ogni generazione richiede 5-10 secondi.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
