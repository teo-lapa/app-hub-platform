'use client';

import { useState } from 'react';
import {
  Share2, Instagram, Facebook, Linkedin, MessageCircle,
  Music, Copy, Download, X, CheckCircle2, Loader2, Send, Building2
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ShareMenuProps {
  isOpen: boolean;
  onClose: () => void;
  caption: string;
  hashtags: string[];
  cta: string;
  imageUrl?: string;
  videoUrl?: string;
  platform: 'instagram' | 'facebook' | 'tiktok' | 'linkedin';
}

// Clipboard utility
const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    // Fallback
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none;';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    // iOS fix
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
      textarea.setSelectionRange(0, text.length);
    }

    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch {
    return false;
  }
};

export default function ShareMenu({
  isOpen,
  onClose,
  caption,
  hashtags,
  cta,
  imageUrl,
  videoUrl,
  platform
}: ShareMenuProps) {
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  const [isPublishingToOdoo, setIsPublishingToOdoo] = useState(false);

  if (!isOpen) return null;

  // Prepara il testo completo
  const fullText = `${caption}\n\n${hashtags.join(' ')}\n\n${cta}`;
  const shareUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const handleCopy = async (text: string, label: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedItem(label);
      toast.success(`✓ ${label} copiato!`);
      setTimeout(() => setCopiedItem(null), 2000);
    } else {
      toast.error('Errore durante la copia');
    }
  };

  const handleDownloadMedia = (url: string, type: 'image' | 'video') => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `marketing-${platform}-${Date.now()}.${type === 'image' ? 'png' : 'mp4'}`;
    link.click();
    toast.success(`Download ${type === 'image' ? 'immagine' : 'video'} avviato!`);
  };

  // Copia immagine negli appunti (Clipboard API)
  const handleCopyImage = async () => {
    if (!imageUrl) return;

    try {
      // Verifica supporto Clipboard API per immagini
      if (!navigator.clipboard || !navigator.clipboard.write) {
        toast.error('Copia immagine non supportata su questo browser');
        return;
      }

      const response = await fetch(imageUrl);
      const blob = await response.blob();

      const clipboardItem = new ClipboardItem({
        [blob.type]: blob
      });

      await navigator.clipboard.write([clipboardItem]);
      toast.success('Immagine copiata negli appunti! Puoi incollarla direttamente nell\'app.', { duration: 5000 });

      // Copia anche il testo
      setTimeout(async () => {
        await copyToClipboard(fullText);
        toast.success('Testo copiato! Ora hai immagine + testo negli appunti.', { duration: 4000 });
      }, 500);

    } catch (error) {
      console.error('Errore copia immagine:', error);
      toast.error('Impossibile copiare l\'immagine. Usa il download.', { duration: 4000 });
    }
  };

  const handleInstagram = async () => {
    // Instagram: copy text + download image + istruzioni
    await handleCopy(fullText, 'Testo');

    if (imageUrl) {
      setTimeout(() => handleDownloadMedia(imageUrl, 'image'), 500);
    }

    toast.success(
      'Testo copiato e immagine scaricata! Apri Instagram, crea un post e incolla il testo.',
      { duration: 6000 }
    );

    setTimeout(onClose, 2000);
  };

  const handleFacebook = () => {
    // Facebook Share Dialog
    const fbShareUrl = `https://www.facebook.com/share_channel/?link=${encodeURIComponent(shareUrl)}`;
    window.open(fbShareUrl, '_blank', 'width=600,height=400,noopener,noreferrer');

    // Copy caption per incollarlo manualmente
    handleCopy(fullText, 'Testo per Facebook');

    toast.success('Finestra Facebook aperta! Incolla il testo copiato nel post.');
    setTimeout(onClose, 1500);
  };

  const handleTikTok = async () => {
    // TikTok: simile a Instagram
    await handleCopy(fullText, 'Testo');

    if (videoUrl) {
      setTimeout(() => handleDownloadMedia(videoUrl, 'video'), 500);
    } else if (imageUrl) {
      setTimeout(() => handleDownloadMedia(imageUrl, 'image'), 500);
    }

    toast.success(
      'Testo copiato e media scaricato! Apri TikTok, crea un video e incolla il testo.',
      { duration: 6000 }
    );

    setTimeout(onClose, 2000);
  };

  const handleLinkedIn = () => {
    // LinkedIn Share Dialog
    const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
    window.open(linkedInUrl, '_blank', 'width=600,height=600,noopener,noreferrer');

    // Copy caption
    handleCopy(fullText, 'Testo per LinkedIn');

    toast.success('Finestra LinkedIn aperta! Incolla il testo copiato nel post.');
    setTimeout(onClose, 1500);
  };

  const handleWhatsApp = () => {
    const waText = encodeURIComponent(fullText);
    const waUrl = `https://wa.me/?text=${waText}&app_absent=1`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
    setTimeout(onClose, 1000);
  };

  // Pubblica direttamente su Odoo Social Marketing
  const handlePublishToOdoo = async () => {
    setIsPublishingToOdoo(true);

    try {
      const response = await fetch('/api/social-ai/publish-to-odoo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caption,
          hashtags,
          cta,
          imageUrl,
          videoUrl,
          platform
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success(
          `Post pubblicato su Odoo! ${data.post?.accounts?.length || 0} account collegati.`,
          { duration: 5000 }
        );
        setTimeout(onClose, 2000);
      } else {
        toast.error(data.error || 'Errore durante la pubblicazione su Odoo', { duration: 6000 });
      }
    } catch (error) {
      console.error('Errore pubblicazione Odoo:', error);
      toast.error('Errore di connessione con Odoo. Riprova.', { duration: 5000 });
    } finally {
      setIsPublishingToOdoo(false);
    }
  };

  const handleWebShare = async () => {
    if (!navigator.share) {
      toast.error('Web Share non supportato su questo browser');
      return;
    }

    try {
      // Strategia intelligente: prova a condividere immagine + clipboard per testo
      if (imageUrl) {
        // 1. Prima copia il testo negli appunti
        try {
          await copyToClipboard(fullText);
          toast.success('Testo copiato negli appunti!', { duration: 2000 });
        } catch (e) {
          console.warn('Impossibile copiare testo', e);
        }

        // 2. Poi converti immagine in file e condividi
        try {
          const response = await fetch(imageUrl);
          const blob = await response.blob();
          const file = new File([blob], `marketing-${platform}.png`, { type: 'image/png' });

          // Verifica se può condividere file
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: 'Contenuto Marketing'
            });

            toast.success('Immagine condivisa! Incolla il testo copiato nell\'app.', { duration: 5000 });
            setTimeout(onClose, 1500);
            return;
          }
        } catch (e) {
          console.warn('Impossibile condividere file, fallback a testo', e);
        }
      }

      // 3. Fallback: condividi solo testo
      await navigator.share({
        title: 'Contenuto Marketing',
        text: fullText
      });

      setTimeout(onClose, 1000);
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        toast.error('Errore durante la condivisione');
      }
    }
  };

  const platformButtons = [
    {
      id: 'instagram',
      icon: Instagram,
      label: 'Instagram',
      color: 'from-purple-500 to-pink-500',
      onClick: handleInstagram,
      description: 'Copia testo + scarica immagine'
    },
    {
      id: 'facebook',
      icon: Facebook,
      label: 'Facebook',
      color: 'from-blue-500 to-blue-600',
      onClick: handleFacebook,
      description: 'Apri Share Dialog'
    },
    {
      id: 'tiktok',
      icon: Music,
      label: 'TikTok',
      color: 'from-black to-gray-800',
      onClick: handleTikTok,
      description: 'Copia testo + scarica video'
    },
    {
      id: 'linkedin',
      icon: Linkedin,
      label: 'LinkedIn',
      color: 'from-blue-600 to-blue-700',
      onClick: handleLinkedIn,
      description: 'Apri Share Dialog'
    },
    {
      id: 'whatsapp',
      icon: MessageCircle,
      label: 'WhatsApp',
      color: 'from-green-500 to-green-600',
      onClick: handleWhatsApp,
      description: 'Condividi su WhatsApp'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full sm:max-w-lg bg-slate-800 border border-purple-500/30 rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-slate-800 border-b border-purple-500/30 p-4 sm:p-6 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg">
                <Share2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-semibold text-white">
                  Condividi Contenuto
                </h2>
                <p className="text-xs sm:text-sm text-purple-300">
                  Scegli dove condividere il tuo post
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-purple-300" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-6">
          {/* Preview */}
          <div className="bg-slate-900/50 border border-purple-500/30 rounded-xl p-4">
            <div className="text-xs text-purple-400 mb-2 font-medium">
              Anteprima Contenuto
            </div>
            <div className="text-white text-sm line-clamp-3">
              {caption}
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {hashtags.slice(0, 3).map((tag, idx) => (
                <span
                  key={idx}
                  className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded"
                >
                  {tag}
                </span>
              ))}
              {hashtags.length > 3 && (
                <span className="text-xs text-purple-400">
                  +{hashtags.length - 3}
                </span>
              )}
            </div>
          </div>

          {/* Pubblica su Odoo - Azione Principale */}
          <div className="space-y-2">
            <div className="text-xs text-purple-400 font-medium mb-3">
              Pubblica Automaticamente
            </div>
            <button
              onClick={handlePublishToOdoo}
              disabled={isPublishingToOdoo}
              className="w-full flex items-center space-x-3 p-4 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 disabled:from-gray-500 disabled:to-gray-600 border border-teal-400/30 rounded-xl transition-all group shadow-lg shadow-teal-500/20"
            >
              <div className="p-2 bg-white/20 rounded-lg">
                {isPublishingToOdoo ? (
                  <Loader2 className="h-5 w-5 text-white animate-spin" />
                ) : (
                  <Building2 className="h-5 w-5 text-white" />
                )}
              </div>
              <div className="flex-1 text-left">
                <div className="text-white font-semibold">
                  {isPublishingToOdoo ? 'Pubblicazione in corso...' : 'Pubblica su Odoo'}
                </div>
                <div className="text-xs text-teal-100">
                  Pubblica automaticamente su tutti i social collegati
                </div>
              </div>
              <Send className="h-5 w-5 text-white opacity-70 group-hover:opacity-100 transition-opacity" />
            </button>
          </div>

          {/* Platform Buttons */}
          <div className="space-y-2">
            <div className="text-xs text-purple-400 font-medium mb-3">
              Condivisione Manuale
            </div>
            {platformButtons.map((btn) => {
              const Icon = btn.icon;
              return (
                <button
                  key={btn.id}
                  onClick={btn.onClick}
                  className="w-full flex items-center space-x-3 p-4 bg-slate-900/30 hover:bg-slate-700/50 border border-purple-500/20 hover:border-purple-500/50 rounded-xl transition-all group"
                >
                  <div className={`p-2 bg-gradient-to-r ${btn.color} rounded-lg`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="text-white font-medium group-hover:text-purple-300 transition-colors">
                      {btn.label}
                    </div>
                    <div className="text-xs text-purple-500/70">
                      {btn.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Web Share API (mobile) */}
          {typeof navigator !== 'undefined' && typeof navigator.share !== 'undefined' && (
            <button
              onClick={handleWebShare}
              className="w-full flex items-center justify-center space-x-2 p-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-xl text-white font-medium transition-all"
            >
              <Share2 className="h-4 w-4" />
              <span>Condividi tramite...</span>
            </button>
          )}

          {/* Quick Actions */}
          <div className="space-y-2">
            <div className="text-xs text-purple-400 font-medium mb-3">
              Azioni Rapide
            </div>

            <button
              onClick={() => handleCopy(fullText, 'Testo completo')}
              className="w-full flex items-center space-x-3 p-3 bg-slate-900/30 hover:bg-slate-700/50 border border-purple-500/20 hover:border-purple-500/50 rounded-lg transition-all group"
            >
              {copiedItem === 'Testo completo' ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              ) : (
                <Copy className="h-5 w-5 text-purple-400 group-hover:text-purple-300" />
              )}
              <span className="flex-1 text-left text-white text-sm group-hover:text-purple-300">
                Copia tutto il testo
              </span>
            </button>

            {imageUrl && (
              <>
                <button
                  onClick={handleCopyImage}
                  className="w-full flex items-center space-x-3 p-3 bg-gradient-to-r from-emerald-500/20 to-green-500/20 hover:from-emerald-500/30 hover:to-green-500/30 border border-emerald-500/30 hover:border-emerald-500/50 rounded-lg transition-all group"
                >
                  <Copy className="h-5 w-5 text-emerald-400 group-hover:text-emerald-300" />
                  <div className="flex-1 text-left">
                    <div className="text-white text-sm font-medium group-hover:text-emerald-300">
                      Copia immagine + testo
                    </div>
                    <div className="text-xs text-emerald-500/70">
                      Incolla direttamente nell'app (mobile)
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => handleDownloadMedia(imageUrl, 'image')}
                  className="w-full flex items-center space-x-3 p-3 bg-slate-900/30 hover:bg-slate-700/50 border border-purple-500/20 hover:border-purple-500/50 rounded-lg transition-all group"
                >
                  <Download className="h-5 w-5 text-purple-400 group-hover:text-purple-300" />
                  <span className="flex-1 text-left text-white text-sm group-hover:text-purple-300">
                    Scarica immagine
                  </span>
                </button>
              </>
            )}

            {videoUrl && (
              <button
                onClick={() => handleDownloadMedia(videoUrl, 'video')}
                className="w-full flex items-center space-x-3 p-3 bg-slate-900/30 hover:bg-slate-700/50 border border-purple-500/20 hover:border-purple-500/50 rounded-lg transition-all group"
              >
                <Download className="h-5 w-5 text-purple-400 group-hover:text-purple-300" />
                <span className="flex-1 text-left text-white text-sm group-hover:text-purple-300">
                  Scarica video
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
