'use client';

import { useState, useCallback, useRef } from 'react';
import {
  Zap, Loader2, Sparkles, CheckCircle2, XCircle,
  RotateCcw, Play, Package, TrendingUp,
  ChevronDown, ListChecks, Eye
} from 'lucide-react';
import toast from 'react-hot-toast';
import PostPreviewCard from '@/components/social-ai/autopilot/PostPreviewCard';
import VideoEditor from '@/components/social-ai/video/VideoEditor';
import type { AutopilotPost } from '@/types/social-ai';

type ViewMode = 'queue' | 'review' | 'video-edit';

export default function AutopilotPage() {
  // Core state
  const [queue, setQueue] = useState<AutopilotPost[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('queue');

  // Loading states
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [isGeneratingQueue, setIsGeneratingQueue] = useState(false);
  const [generatingPostIds, setGeneratingPostIds] = useState<Set<string>>(new Set());
  const [publishingPostIds, setPublishingPostIds] = useState<Set<string>>(new Set());

  // Stats
  const [productsCount, setProductsCount] = useState(0);

  // Video edit state
  const [editingPost, setEditingPost] = useState<AutopilotPost | null>(null);

  // Track active video polls to prevent duplicates
  const activeVideoPolls = useRef<Set<string>>(new Set());

  // ==========================================
  // Video polling - checks Veo 3.1 video status
  // ==========================================
  const pollVideoStatus = useCallback((postId: string, operationId: string) => {
    if (activeVideoPolls.current.has(postId)) return;
    activeVideoPolls.current.add(postId);

    let attempts = 0;
    const maxAttempts = 120; // 10 minutes max

    const poll = async () => {
      try {
        const res = await fetch('/api/social-ai/check-video-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operationId }),
        });
        const data = await res.json();

        if (data.done && data.video) {
          // Video ready - update the post
          setQueue(prev => prev.map(p => {
            if (p.id !== postId || !p.result?.video) return p;
            return {
              ...p,
              result: {
                ...p.result,
                video: { ...p.result.video, status: 'completed' as const, dataUrl: data.video.dataUrl },
              },
            };
          }));
          activeVideoPolls.current.delete(postId);
          toast.success('Video pronto!');
          return;
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000);
        } else {
          activeVideoPolls.current.delete(postId);
          toast.error('Timeout generazione video');
        }
      } catch {
        activeVideoPolls.current.delete(postId);
      }
    };

    poll();
  }, []);

  // ==========================================
  // STEP 1: Generate Queue (AI decides what to post)
  // ==========================================
  const handleGenerateQueue = async () => {
    setIsLoadingProducts(true);
    setQueue([]);

    const loadingToast = toast.loading('Analisi catalogo prodotti...');

    try {
      // Fetch products with intelligence
      const productsRes = await fetch('/api/social-ai/autopilot/product-intelligence');
      const productsData = await productsRes.json();

      if (!productsRes.ok) throw new Error(productsData.error);

      const products = productsData.data.products || [];
      setProductsCount(products.length);

      if (products.length === 0) {
        toast.error('Nessun prodotto trovato nel catalogo', { id: loadingToast });
        setIsLoadingProducts(false);
        return;
      }

      toast.loading(`${products.length} prodotti trovati, AI sta decidendo...`, { id: loadingToast });
      setIsLoadingProducts(false);
      setIsGeneratingQueue(true);

      // Strip images before sending to generate-queue (saves ~2MB in request)
      const productsWithoutImages = products.map((p: any) => ({
        ...p,
        image: undefined,
      }));

      // Ask AI to generate the queue
      const queueRes = await fetch('/api/social-ai/autopilot/generate-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: productsWithoutImages, count: 6 }),
      });

      const queueData = await queueRes.json();

      if (!queueRes.ok) throw new Error(queueData.error);

      // Map product images back from the original products data
      const queueWithImages = (queueData.data.queue || []).map((post: any) => {
        const productIdx = post.productIndex ?? products.findIndex((p: any) => p.id === post.product?.id);
        const originalProduct = productIdx >= 0 ? products[productIdx] : null;
        return {
          ...post,
          product: {
            ...post.product,
            image: originalProduct?.image || post.product?.image || '',
          },
        };
      });

      setQueue(queueWithImages);
      toast.success(`${queueWithImages.length} post suggeriti dall'AI!`, { id: loadingToast });

    } catch (error: any) {
      toast.error(error.message || 'Errore durante generazione coda', { id: loadingToast });
    } finally {
      setIsLoadingProducts(false);
      setIsGeneratingQueue(false);
    }
  };

  // ==========================================
  // STEP 2: Generate content for a post
  // ==========================================
  const handleGeneratePost = async (post: AutopilotPost) => {
    if (!post.product.image) {
      toast.error(`${post.product.name}: immagine mancante`);
      return;
    }

    setGeneratingPostIds(prev => new Set(prev).add(post.id));
    setQueue(prev => prev.map(p => p.id === post.id ? { ...p, status: 'generating' } : p));

    try {
      const response = await fetch('/api/social-ai/autopilot/generate-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      const result = data.data.result;

      setQueue(prev => prev.map(p =>
        p.id === post.id ? { ...p, status: 'ready', result } : p
      ));

      // Start video polling if video is still generating
      if (result?.video?.operationId && result.video.status !== 'completed') {
        pollVideoStatus(post.id, result.video.operationId);
      }

      toast.success(`${post.product.name}: contenuto generato!`);
    } catch (error: any) {
      setQueue(prev => prev.map(p =>
        p.id === post.id ? { ...p, status: 'failed', error: error.message } : p
      ));
      toast.error(`Errore: ${error.message}`);
    } finally {
      setGeneratingPostIds(prev => {
        const next = new Set(prev);
        next.delete(post.id);
        return next;
      });
    }
  };

  // ==========================================
  // STEP 3: Generate ALL posts in sequence
  // ==========================================
  const handleGenerateAll = async () => {
    const queuedPosts = queue.filter(p => p.status === 'queued' && p.product.image);

    if (queuedPosts.length === 0) {
      toast.error('Nessun post da generare');
      return;
    }

    toast(`Generazione di ${queuedPosts.length} post in corso...`);

    for (const post of queuedPosts) {
      await handleGeneratePost(post);
      // Small delay between requests to avoid rate limiting
      await new Promise(r => setTimeout(r, 2000));
    }

    toast.success('Tutti i post generati!');
    setViewMode('review');
  };

  // ==========================================
  // Approve / Reject / Edit
  // ==========================================
  const handleApprove = async (postId: string) => {
    const post = queue.find(p => p.id === postId);
    if (!post || !post.result) return;

    setPublishingPostIds(prev => new Set(prev).add(postId));

    try {
      const response = await fetch('/api/social-ai/autopilot/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post, action: 'publish_now' }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      setQueue(prev => prev.map(p =>
        p.id === postId ? { ...p, status: 'published', publishedAt: new Date().toISOString() } : p
      ));

      toast.success(`${post.product.name}: pubblicato!`);
    } catch (error: any) {
      toast.error(`Errore pubblicazione: ${error.message}`);
    } finally {
      setPublishingPostIds(prev => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
    }
  };

  const handleReject = (postId: string) => {
    setQueue(prev => prev.map(p =>
      p.id === postId ? { ...p, status: 'rejected' } : p
    ));
    toast('Post rimosso dalla coda');
  };

  const handleEdit = (postId: string) => {
    const post = queue.find(p => p.id === postId);
    if (post) {
      setEditingPost(post);
      setViewMode('video-edit');
    }
  };

  const handleApproveAll = async () => {
    const readyPosts = queue.filter(p => p.status === 'ready');
    if (readyPosts.length === 0) {
      toast.error('Nessun post pronto da approvare');
      return;
    }

    toast(`Pubblicazione di ${readyPosts.length} post...`);

    for (const post of readyPosts) {
      await handleApprove(post.id);
      await new Promise(r => setTimeout(r, 3000));
    }
  };

  // Stats
  const stats = {
    total: queue.length,
    queued: queue.filter(p => p.status === 'queued').length,
    generating: queue.filter(p => p.status === 'generating').length,
    ready: queue.filter(p => p.status === 'ready').length,
    published: queue.filter(p => p.status === 'published').length,
    rejected: queue.filter(p => p.status === 'rejected').length,
  };

  const readyPosts = queue.filter(p => p.status === 'ready');
  const allPosts = queue.filter(p => p.status !== 'rejected');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

      {/* Hero section */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-3 mb-4">
          <div className="bg-gradient-to-r from-orange-500 via-pink-500 to-purple-500 p-3 rounded-2xl shadow-lg shadow-purple-500/25">
            <Zap className="h-8 w-8 text-white" />
          </div>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">AI Autopilot</h2>
        <p className="text-purple-300/80 text-sm max-w-lg mx-auto">
          L'AI analizza il tuo catalogo, sceglie i migliori prodotti e genera contenuti pronti da pubblicare.
          Tu verifichi e approvi con un click.
        </p>
      </div>

      {/* Main action button */}
      {queue.length === 0 && (
        <div className="max-w-md mx-auto mb-8">
          <button
            onClick={handleGenerateQueue}
            disabled={isLoadingProducts || isGeneratingQueue}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 hover:from-orange-600 hover:via-pink-600 hover:to-purple-700 rounded-2xl text-white font-bold text-lg shadow-2xl shadow-purple-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
          >
            {isLoadingProducts ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin" />
                <span>Analisi catalogo...</span>
              </>
            ) : isGeneratingQueue ? (
              <>
                <Sparkles className="h-6 w-6 animate-pulse" />
                <span>AI sta decidendo...</span>
              </>
            ) : (
              <>
                <Zap className="h-6 w-6" />
                <span>Avvia Autopilot</span>
              </>
            )}
          </button>
          <p className="text-center text-purple-400/50 text-xs mt-3">
            L'AI analizzerà prodotti, performance passate e tendenze per creare il piano editoriale perfetto
          </p>
        </div>
      )}

      {/* Stats bar */}
      {queue.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 bg-slate-800/40 rounded-xl border border-purple-500/20 p-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Package className="h-4 w-4 text-purple-400" />
              <span className="text-white text-sm font-medium">{stats.total} post</span>
            </div>
            {stats.queued > 0 && (
              <span className="text-amber-400 text-xs bg-amber-500/10 px-2 py-0.5 rounded-full">
                {stats.queued} in coda
              </span>
            )}
            {stats.generating > 0 && (
              <span className="text-purple-400 text-xs bg-purple-500/10 px-2 py-0.5 rounded-full animate-pulse">
                {stats.generating} generando
              </span>
            )}
            {stats.ready > 0 && (
              <span className="text-emerald-400 text-xs bg-emerald-500/10 px-2 py-0.5 rounded-full">
                {stats.ready} pronti
              </span>
            )}
            {stats.published > 0 && (
              <span className="text-blue-400 text-xs bg-blue-500/10 px-2 py-0.5 rounded-full">
                {stats.published} pubblicati
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            <div className="flex bg-slate-900/50 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('queue')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  viewMode === 'queue' ? 'bg-purple-500 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <ListChecks className="h-3.5 w-3.5 inline mr-1" />
                Coda
              </button>
              <button
                onClick={() => setViewMode('review')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  viewMode === 'review' ? 'bg-purple-500 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Eye className="h-3.5 w-3.5 inline mr-1" />
                Review
              </button>
            </div>

            {stats.queued > 0 && (
              <button
                onClick={handleGenerateAll}
                disabled={generatingPostIds.size > 0}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg text-white text-xs font-medium transition-all disabled:opacity-50"
              >
                <Play className="h-3.5 w-3.5" />
                Genera Tutti
              </button>
            )}

            {stats.ready > 1 && (
              <button
                onClick={handleApproveAll}
                disabled={publishingPostIds.size > 0}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-lg text-white text-xs font-medium transition-all disabled:opacity-50"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Approva Tutti ({stats.ready})
              </button>
            )}

            <button
              onClick={handleGenerateQueue}
              disabled={isGeneratingQueue}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/50 hover:bg-slate-600/50 border border-purple-500/20 rounded-lg text-slate-300 text-xs transition-all"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Rigenera
            </button>
          </div>
        </div>
      )}

      {/* Video Editor view */}
      {viewMode === 'video-edit' && editingPost && (
        <div className="mb-6">
          <button
            onClick={() => { setViewMode('review'); setEditingPost(null); }}
            className="flex items-center gap-1.5 text-purple-400 text-sm mb-4 hover:text-purple-300"
          >
            ← Torna alla review
          </button>
          <div className="max-w-3xl mx-auto">
            <h3 className="text-white font-semibold mb-3">{editingPost.product.name}</h3>
            <VideoEditor
              originalVideoUrl={editingPost.result?.video?.dataUrl}
              productImage={editingPost.product.image}
              videoStyle={editingPost.videoStyle}
              videoDuration={editingPost.videoDuration}
              onVideoRefined={(newUrl) => {
                setQueue(prev => prev.map(p =>
                  p.id === editingPost.id && p.result?.video
                    ? { ...p, result: { ...p.result, video: { ...p.result.video!, dataUrl: newUrl, status: 'completed' as const } } }
                    : p
                ));
              }}
            />
          </div>
        </div>
      )}

      {/* Queue / Review grid */}
      {(viewMode === 'queue' || viewMode === 'review') && queue.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {(viewMode === 'review' ? readyPosts : allPosts).map((post) => (
            <PostPreviewCard
              key={post.id}
              post={post}
              onApprove={handleApprove}
              onReject={handleReject}
              onEdit={handleEdit}
              isGenerating={generatingPostIds.has(post.id)}
              isPublishing={publishingPostIds.has(post.id)}
            />
          ))}
        </div>
      )}

      {/* Empty review state */}
      {viewMode === 'review' && readyPosts.length === 0 && queue.length > 0 && (
        <div className="text-center py-16">
          <Sparkles className="h-12 w-12 text-purple-500/30 mx-auto mb-4" />
          <h3 className="text-white font-semibold mb-2">Nessun post pronto per la review</h3>
          <p className="text-purple-300/60 text-sm mb-4">
            {stats.queued > 0
              ? `${stats.queued} post in coda - clicca "Genera Tutti" per creare i contenuti`
              : stats.generating > 0
              ? `${stats.generating} post in generazione...`
              : 'Tutti i post sono stati gestiti'
            }
          </p>
          {stats.queued > 0 && (
            <button
              onClick={handleGenerateAll}
              className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl text-white font-medium"
            >
              Genera Tutti i Contenuti
            </button>
          )}
        </div>
      )}

      {/* Success state */}
      {queue.length > 0 && stats.published > 0 && stats.ready === 0 && stats.queued === 0 && stats.generating === 0 && (
        <div className="text-center py-8 bg-emerald-500/5 rounded-2xl border border-emerald-500/20 mt-6">
          <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
          <h3 className="text-white font-semibold text-lg mb-1">Tutto pubblicato!</h3>
          <p className="text-emerald-300/70 text-sm">
            {stats.published} post pubblicati con successo
          </p>
          <button
            onClick={handleGenerateQueue}
            className="mt-4 px-6 py-2 bg-slate-700/50 hover:bg-slate-600/50 border border-purple-500/20 rounded-xl text-purple-300 text-sm transition-all"
          >
            Genera nuova coda
          </button>
        </div>
      )}
    </div>
  );
}
