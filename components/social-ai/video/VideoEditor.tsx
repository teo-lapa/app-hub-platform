'use client';

import { useState, useRef } from 'react';
import {
  Video, Wand2, Loader2, RotateCcw, Download,
  ChevronRight, Play, Pause, Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';

interface VideoVersion {
  id: string;
  prompt: string;
  dataUrl?: string;
  operationId?: string;
  status: 'generating' | 'completed' | 'failed';
  createdAt: string;
}

interface VideoEditorProps {
  originalVideoUrl?: string;
  originalPrompt?: string;
  productImage: string;
  videoStyle?: string;
  videoDuration?: number;
  aspectRatio?: string;
  onVideoRefined?: (newVideoUrl: string) => void;
}

const quickChips = [
  { label: 'Piu lento', prompt: 'Rendilo piu lento e fluido' },
  { label: 'Piu zoom', prompt: 'Aggiungi piu zoom verso il prodotto' },
  { label: 'Piu drammatico', prompt: 'Rendilo piu drammatico con luci e ombre' },
  { label: 'Cambia luce', prompt: 'Cambia illuminazione a golden hour calda' },
  { label: 'Piu dinamico', prompt: 'Rendilo piu veloce e energico' },
  { label: 'Rotazione 360', prompt: 'Aggiungi rotazione 360 gradi del prodotto' },
  { label: 'Stile luxury', prompt: 'Rendilo piu elegante e luxury con sfondo scuro' },
  { label: 'Effetto cinema', prompt: 'Aggiungi effetto cinematografico con dolly shot' },
];

export default function VideoEditor({
  originalVideoUrl,
  originalPrompt = '',
  productImage,
  videoStyle = 'cinematic',
  videoDuration = 6,
  aspectRatio = '16:9',
  onVideoRefined,
}: VideoEditorProps) {
  const [refinementPrompt, setRefinementPrompt] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [versions, setVersions] = useState<VideoVersion[]>([]);
  const [currentVersionIndex, setCurrentVersionIndex] = useState(-1); // -1 = original

  const currentVersion = currentVersionIndex >= 0 ? versions[currentVersionIndex] : null;
  const currentVideoUrl = currentVersion?.dataUrl || originalVideoUrl;

  const handleRefine = async (promptText?: string) => {
    const prompt = promptText || refinementPrompt;
    if (!prompt.trim()) {
      toast.error('Scrivi cosa vuoi modificare nel video');
      return;
    }

    if (!productImage) {
      toast.error('Immagine prodotto necessaria per il video');
      return;
    }

    setIsRefining(true);
    const loadingToast = toast.loading('Preparazione modifica video...');

    try {
      const response = await fetch('/api/social-ai/refine-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalPrompt,
          refinementPrompt: prompt,
          productImage,
          videoStyle,
          videoDuration,
          aspectRatio,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore durante modifica video');
      }

      const newVersion: VideoVersion = {
        id: `v-${Date.now()}`,
        prompt: prompt,
        operationId: data.data.operationId,
        status: 'generating',
        createdAt: new Date().toISOString(),
      };

      setVersions(prev => [...prev, newVersion]);
      setCurrentVersionIndex(versions.length);
      setRefinementPrompt('');

      toast.success('Video in generazione con le tue modifiche!', { id: loadingToast });

      // Start polling for the new video
      if (data.data.operationId) {
        pollVideoStatus(data.data.operationId, versions.length);
      }

    } catch (error: any) {
      toast.error(error.message || 'Errore durante modifica video', { id: loadingToast });
    } finally {
      setIsRefining(false);
    }
  };

  const pollVideoStatus = async (operationId: string, versionIndex: number) => {
    setIsPolling(true);
    let attempts = 0;
    const maxAttempts = 120;

    const poll = async () => {
      try {
        const response = await fetch('/api/social-ai/check-video-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operationId }),
        });

        const data = await response.json();

        if (!response.ok) {
          setVersions(prev => prev.map((v, i) =>
            i === versionIndex ? { ...v, status: 'failed' as const } : v
          ));
          setIsPolling(false);
          toast.error('Errore nella generazione del video modificato');
          return;
        }

        if (data.done && data.video) {
          setVersions(prev => prev.map((v, i) =>
            i === versionIndex ? { ...v, status: 'completed' as const, dataUrl: data.video.dataUrl } : v
          ));
          setIsPolling(false);
          toast.success('Video modificato pronto!');
          onVideoRefined?.(data.video.dataUrl);
          return;
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000);
        } else {
          setVersions(prev => prev.map((v, i) =>
            i === versionIndex ? { ...v, status: 'failed' as const } : v
          ));
          setIsPolling(false);
          toast.error('Timeout generazione video');
        }
      } catch {
        setIsPolling(false);
      }
    };

    poll();
  };

  const handleDownload = () => {
    const url = currentVideoUrl;
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    link.download = `video-refined-${Date.now()}.mp4`;
    link.click();
    toast.success('Download video avviato!');
  };

  return (
    <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl border border-purple-500/30 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-white" />
          <span className="text-white font-semibold text-sm">Video Editor AI</span>
        </div>
        <span className="text-white/70 text-xs">
          {versions.length > 0 ? `${versions.length} versione/i` : 'Originale'}
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Video display - side by side on desktop */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Original */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <span className={`w-2 h-2 rounded-full ${currentVersionIndex === -1 ? 'bg-emerald-400' : 'bg-slate-500'}`} />
              <span className="text-xs text-slate-300 font-medium">Originale</span>
            </div>
            {originalVideoUrl ? (
              <video
                src={originalVideoUrl}
                controls
                muted
                className="w-full rounded-lg border border-purple-500/20 bg-black"
              />
            ) : (
              <div className="w-full h-40 rounded-lg border border-purple-500/20 bg-slate-900/50 flex items-center justify-center">
                <div className="text-center">
                  <Video className="h-8 w-8 text-purple-500/50 mx-auto mb-2" />
                  <span className="text-slate-500 text-xs">Nessun video originale</span>
                </div>
              </div>
            )}
          </div>

          {/* Refined version */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <span className={`w-2 h-2 rounded-full ${currentVersion?.status === 'completed' ? 'bg-emerald-400' : currentVersion?.status === 'generating' ? 'bg-amber-400 animate-pulse' : 'bg-slate-500'}`} />
              <span className="text-xs text-slate-300 font-medium">
                {currentVersion ? `Versione ${currentVersionIndex + 1}` : 'Modificato'}
              </span>
            </div>
            {currentVersion?.status === 'generating' || isPolling ? (
              <div className="w-full h-40 rounded-lg border border-purple-500/20 bg-slate-900/50 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <span className="text-purple-300 text-xs">Generazione in corso...</span>
                  <p className="text-slate-500 text-[10px] mt-1">Veo 3.1 - circa 2 minuti</p>
                </div>
              </div>
            ) : currentVersion?.dataUrl ? (
              <video
                src={currentVersion.dataUrl}
                controls
                muted
                className="w-full rounded-lg border border-purple-500/20 bg-black"
              />
            ) : (
              <div className="w-full h-40 rounded-lg border border-dashed border-purple-500/30 bg-slate-900/30 flex items-center justify-center">
                <div className="text-center">
                  <Sparkles className="h-8 w-8 text-purple-500/30 mx-auto mb-2" />
                  <span className="text-slate-500 text-xs">Scrivi un prompt per modificare</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Version history */}
        {versions.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setCurrentVersionIndex(-1)}
              className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${
                currentVersionIndex === -1
                  ? 'bg-purple-500 text-white'
                  : 'bg-slate-700/50 text-slate-400 hover:text-white'
              }`}
            >
              Originale
            </button>
            {versions.map((v, i) => (
              <button
                key={v.id}
                onClick={() => setCurrentVersionIndex(i)}
                className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-medium transition-all truncate max-w-[150px] ${
                  currentVersionIndex === i
                    ? 'bg-purple-500 text-white'
                    : v.status === 'failed'
                    ? 'bg-red-500/20 text-red-400'
                    : v.status === 'generating'
                    ? 'bg-amber-500/20 text-amber-400 animate-pulse'
                    : 'bg-slate-700/50 text-slate-400 hover:text-white'
                }`}
                title={v.prompt}
              >
                V{i + 1}: {v.prompt}
              </button>
            ))}
          </div>
        )}

        {/* Quick chips */}
        <div>
          <span className="text-[10px] text-purple-300/50 uppercase tracking-wider font-medium mb-1.5 block">
            Modifiche rapide
          </span>
          <div className="flex flex-wrap gap-1.5">
            {quickChips.map((chip) => (
              <button
                key={chip.label}
                onClick={() => handleRefine(chip.prompt)}
                disabled={isRefining || isPolling}
                className="px-2.5 py-1 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-full text-purple-300 text-[11px] font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom prompt input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={refinementPrompt}
            onChange={(e) => setRefinementPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRefine()}
            placeholder="Descrivi come vuoi modificare il video..."
            disabled={isRefining || isPolling}
            className="flex-1 px-3 py-2.5 bg-slate-900/50 border border-purple-500/50 rounded-xl text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
          />
          <button
            onClick={() => handleRefine()}
            disabled={isRefining || isPolling || !refinementPrompt.trim()}
            className="px-4 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-xl text-white text-sm font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {isRefining ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Wand2 className="h-4 w-4" />
                <span className="hidden sm:inline">Modifica</span>
              </>
            )}
          </button>
        </div>

        {/* Download button */}
        {currentVideoUrl && (
          <button
            onClick={handleDownload}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-700/50 hover:bg-slate-600/50 border border-purple-500/20 rounded-xl text-slate-300 text-sm transition-all"
          >
            <Download className="h-4 w-4" />
            <span>Scarica Video</span>
          </button>
        )}
      </div>
    </div>
  );
}
