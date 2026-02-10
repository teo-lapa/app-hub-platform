'use client';

import { useState, useCallback, useRef } from 'react';
import {
  Zap, Loader2, Sparkles, CheckCircle2, XCircle,
  RotateCcw, Play, Package, TrendingUp,
  ChevronDown, ListChecks, Eye, Target, Search
} from 'lucide-react';
import toast from 'react-hot-toast';
import PostPreviewCard from '@/components/social-ai/autopilot/PostPreviewCard';
import VideoEditor from '@/components/social-ai/video/VideoEditor';
import type { AutopilotPost } from '@/types/social-ai';

type ViewMode = 'queue' | 'review' | 'video-edit';
type AutopilotMode = 'auto' | 'single-product';

export default function AutopilotPage() {
  // Core state
  const [queue, setQueue] = useState<AutopilotPost[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('queue');
  const [autopilotMode, setAutopilotMode] = useState<AutopilotMode>('auto');

  // Loading states
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [isGeneratingQueue, setIsGeneratingQueue] = useState(false);
  const [generatingPostIds, setGeneratingPostIds] = useState<Set<string>>(new Set());
  const [publishingPostIds, setPublishingPostIds] = useState<Set<string>>(new Set());

  // Stats
  const [productsCount, setProductsCount] = useState(0);

  // Video edit state
  const [editingPost, setEditingPost] = useState<AutopilotPost | null>(null);

  // Single product mode state
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [showProductPicker, setShowProductPicker] = useState(false);

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
  // Load products (shared between modes)
  // ==========================================
  const loadProducts = async (all = false) => {
    setIsLoadingProducts(true);
    const loadingToast = toast.loading('Caricamento catalogo prodotti...');

    try {
      const url = all
        ? '/api/social-ai/autopilot/product-intelligence?all=true'
        : '/api/social-ai/autopilot/product-intelligence';
      const productsRes = await fetch(url);
      const productsData = await productsRes.json();

      if (!productsRes.ok) throw new Error(productsData.error);

      const products = productsData.data.products || [];
      setProductsCount(products.length);
      setAllProducts(products);

      if (products.length === 0) {
        toast.error('Nessun prodotto trovato nel catalogo', { id: loadingToast });
        setIsLoadingProducts(false);
        return null;
      }

      toast.dismiss(loadingToast);
      return products;
    } catch (error: any) {
      toast.error(error.message || 'Errore caricamento prodotti', { id: loadingToast });
      return null;
    } finally {
      setIsLoadingProducts(false);
    }
  };

  // ==========================================
  // STEP 1A: Auto mode - AI decides what to post
  // ==========================================
  const handleGenerateQueue = async () => {
    setQueue([]);

    const products = await loadProducts();
    if (!products) return;

    setIsGeneratingQueue(true);
    const loadingToast = toast.loading(`${products.length} prodotti trovati, AI sta decidendo...`);

    try {
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
      setIsGeneratingQueue(false);
    }
  };

  // ==========================================
  // STEP 1B: Single product mode - user picks, generates for all platforms
  // ==========================================
  const handleShowProductPicker = async () => {
    setAutopilotMode('single-product');
    // Always load ALL products for the picker (not just top 50)
    const products = await loadProducts(true);
    if (!products) return;
    setShowProductPicker(true);
  };

  const handleSelectProduct = async (product: any) => {
    setSelectedProduct(product);
    setShowProductPicker(false);
    setQueue([]);
    setIsGeneratingQueue(true);

    const loadingToast = toast.loading(`Generazione post per "${product.name}" su tutti i social...`);

    try {
      const getCategoryName = (cat: any): string => {
        if (!cat) return 'Food';
        if (typeof cat === 'string') return cat;
        if (typeof cat === 'object') return cat.name || cat[1] || 'Food';
        return String(cat);
      };

      // Create posts for all 6 platforms from the same product
      const platforms = [
        { platform: 'instagram' as const, tone: 'casual' as const, contentType: 'image' as const, time: '12:00' },
        { platform: 'facebook' as const, tone: 'casual' as const, contentType: 'image' as const, time: '12:30' },
        { platform: 'linkedin' as const, tone: 'professional' as const, contentType: 'image' as const, time: '11:00' },
        { platform: 'twitter' as const, tone: 'casual' as const, contentType: 'image' as const, time: '13:00' },
        { platform: 'youtube' as const, tone: 'professional' as const, contentType: 'video' as const, time: '17:00' },
        { platform: 'tiktok' as const, tone: 'fun' as const, contentType: 'video' as const, time: '18:00' },
      ];

      const today = new Date().toISOString().split('T')[0];

      const newQueue: AutopilotPost[] = platforms.map((p, index) => ({
        id: `autopilot-${Date.now()}-${index}`,
        productIndex: 0,
        product: {
          id: product.id,
          name: product.name,
          code: product.code || '',
          image: product.image || '',
          category: getCategoryName(product.category),
          price: product.price || 0,
        },
        platform: p.platform,
        tone: p.tone,
        contentType: p.contentType,
        videoStyle: 'cinematic' as const,
        videoDuration: 6,
        scheduledFor: `${today}T${p.time}:00`,
        reasoning: `${product.name} - post ottimizzato per ${p.platform}`,
        status: 'queued' as const,
        createdAt: new Date().toISOString(),
      }));

      setQueue(newQueue);
      toast.success(`6 post creati per "${product.name}" - uno per ogni piattaforma`, { id: loadingToast });

    } catch (error: any) {
      toast.error(error.message || 'Errore', { id: loadingToast });
    } finally {
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
  // Approve / Reject / Edit / Update
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

      toast.success(`${post.product.name}: pubblicato su ${post.platform}!`);
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

  const handleUpdatePost = (postId: string, updates: Partial<AutopilotPost>) => {
    setQueue(prev => prev.map(p =>
      p.id === postId ? { ...p, ...updates } : p
    ));
    toast.success('Post aggiornato!');
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

  // Filter products for picker (search in name and category)
  const searchLower = productSearch.toLowerCase();
  const filteredProducts = allProducts.filter(p => {
    if (!p.hasImage) return false;
    if (!searchLower) return true;
    const catName = typeof p.category === 'string' ? p.category : '';
    return p.name.toLowerCase().includes(searchLower) || catName.toLowerCase().includes(searchLower);
  });

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
          L&apos;AI analizza il tuo catalogo, sceglie i migliori prodotti e genera contenuti pronti da pubblicare.
          Tu verifichi e approvi con un click.
        </p>
      </div>

      {/* Main action buttons - TWO MODES */}
      {queue.length === 0 && !showProductPicker && (
        <div className="max-w-lg mx-auto mb-8 space-y-3">
          {/* Mode 1: AI Autopilot */}
          <button
            onClick={() => { setAutopilotMode('auto'); handleGenerateQueue(); }}
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
                <span>AI Autopilot</span>
              </>
            )}
          </button>
          <p className="text-center text-purple-400/50 text-xs">
            L&apos;AI sceglie prodotti e piattaforme automaticamente
          </p>

          <div className="flex items-center gap-3 py-2">
            <div className="flex-1 h-px bg-purple-500/20" />
            <span className="text-purple-400/40 text-xs">oppure</span>
            <div className="flex-1 h-px bg-purple-500/20" />
          </div>

          {/* Mode 2: Single Product → All Socials */}
          <button
            onClick={handleShowProductPicker}
            disabled={isLoadingProducts}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-slate-800/60 hover:bg-slate-700/60 border-2 border-purple-500/30 hover:border-purple-500/50 rounded-2xl text-white font-semibold text-lg transition-all disabled:opacity-50 transform hover:scale-[1.01] active:scale-[0.99]"
          >
            {isLoadingProducts ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin" />
                <span>Caricamento prodotti...</span>
              </>
            ) : (
              <>
                <Target className="h-6 w-6 text-purple-400" />
                <span>1 Prodotto → Tutti i Social</span>
              </>
            )}
          </button>
          <p className="text-center text-purple-400/50 text-xs">
            Scegli tu il prodotto, l&apos;AI genera copy per ogni piattaforma
          </p>
        </div>
      )}

      {/* Product Picker */}
      {showProductPicker && (
        <div className="max-w-2xl mx-auto mb-8">
          <div className="bg-slate-800/60 rounded-2xl border border-purple-500/30 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">Scegli un prodotto</h3>
              <button
                onClick={() => { setShowProductPicker(false); setAutopilotMode('auto'); }}
                className="text-slate-400 hover:text-white text-sm"
              >
                Annulla
              </button>
            </div>

            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-purple-400/50" />
              <input
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                placeholder="Cerca prodotto..."
                className="w-full bg-slate-900/70 border border-purple-500/30 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm focus:border-purple-500 focus:outline-none"
                autoFocus
              />
            </div>

            {/* Product list */}
            <div className="max-h-80 overflow-y-auto space-y-1 pr-1">
              {filteredProducts.slice(0, 30).map((product: any) => {
                const catName = typeof product.category === 'object'
                  ? product.category?.name || product.category?.[1] || 'Food'
                  : product.category || 'Food';

                return (
                  <button
                    key={product.id}
                    onClick={() => handleSelectProduct(product)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-purple-500/10 border border-transparent hover:border-purple-500/20 transition-all text-left"
                  >
                    {product.image && (
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-12 h-12 object-cover rounded-lg border border-purple-500/20"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{product.name}</p>
                      <p className="text-purple-300/60 text-xs truncate">{catName}</p>
                    </div>
                    <span className="text-emerald-400 text-xs font-medium whitespace-nowrap">
                      CHF {Number(product.price || 0).toFixed(2)}
                    </span>
                  </button>
                );
              })}

              {filteredProducts.length === 0 && (
                <p className="text-center text-purple-400/50 text-sm py-8">
                  Nessun prodotto trovato con immagine
                </p>
              )}
            </div>

            <p className="text-purple-400/40 text-xs mt-3 text-center">
              {filteredProducts.length} prodotti con immagine disponibili
            </p>
          </div>
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
            {selectedProduct && (
              <span className="text-purple-300 text-xs bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20 truncate max-w-48">
                <Target className="h-3 w-3 inline mr-1" />
                {selectedProduct.name}
              </span>
            )}
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
              onClick={() => { setQueue([]); setSelectedProduct(null); setShowProductPicker(false); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/50 hover:bg-slate-600/50 border border-purple-500/20 rounded-lg text-slate-300 text-xs transition-all"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Ricomincia
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
              onUpdatePost={handleUpdatePost}
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
            onClick={() => { setQueue([]); setSelectedProduct(null); }}
            className="mt-4 px-6 py-2 bg-slate-700/50 hover:bg-slate-600/50 border border-purple-500/20 rounded-xl text-purple-300 text-sm transition-all"
          >
            Genera nuova coda
          </button>
        </div>
      )}
    </div>
  );
}
