'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search, ArrowLeft, Home, X, Filter, BookOpen, Image as ImageIcon, CheckSquare, Square } from 'lucide-react';
import Link from 'next/link';
import { useAppAccess } from '@/hooks/useAppAccess';
import toast from 'react-hot-toast';
import { BlogArticle, ArticleFilters } from '@/types/blog';
import { loadBlogArticles, filterArticles, getArticleStats } from '@/lib/utils/blogArticles';
import { BlogArticleCard } from '@/components/blog/BlogArticleCard';
import { BlogAIImageModal } from '@/components/blog/BlogAIImageModal';
import { BatchBlogImageModal } from '@/components/blog/BatchBlogImageModal';

export default function BlogPhotoManagerPage() {
  // Access control
  const { hasAccess, loading: accessLoading } = useAppAccess('blog-photo1', true);

  // State
  const [allArticles, setAllArticles] = useState<BlogArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Filters
  const [filters, setFilters] = useState<ArticleFilters>({
    publishedOnly: false,
    withoutImages: false,
    searchQuery: ''
  });

  // Selection mode
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedArticleIds, setSelectedArticleIds] = useState<Set<number>>(new Set());

  // Modals
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<BlogArticle | null>(null);

  // Generated images storage (in-memory)
  const [generatedImages, setGeneratedImages] = useState<Record<number, string>>({});

  // Header visibility tracking
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  // Mount tracking
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  // Scroll detection for header auto-hide
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY < 50) {
        // Always show header at top
        setIsHeaderVisible(true);
      } else if (currentScrollY > lastScrollY && currentScrollY > 100) {
        // Scrolling down - hide header
        setIsHeaderVisible(false);
      } else if (currentScrollY < lastScrollY) {
        // Scrolling up - show header
        setIsHeaderVisible(true);
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  // Load articles on mount
  useEffect(() => {
    async function loadArticles() {
      if (hasAccess && !accessLoading) {
        try {
          setLoading(true);
          const articles = await loadBlogArticles();
          setAllArticles(articles);
          toast.success(`✅ ${articles.length} articoli caricati da Odoo`);
        } catch (error) {
          console.error('Errore caricamento articoli:', error);
          toast.error('Errore nel caricamento degli articoli');
        } finally {
          setLoading(false);
        }
      }
    }
    loadArticles();
  }, [hasAccess, accessLoading]);

  // Update filter search query when search changes
  useEffect(() => {
    setFilters(prev => ({ ...prev, searchQuery }));
  }, [searchQuery]);

  // Filtered articles
  const filteredArticles = useMemo(() => {
    return filterArticles(allArticles, filters);
  }, [allArticles, filters]);

  // Stats
  const stats = useMemo(() => {
    return getArticleStats(allArticles);
  }, [allArticles]);

  // Show access loading
  if (accessLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-white text-xl">Caricamento...</div>
      </div>
    );
  }

  // Show no access
  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-8 text-center max-w-md">
          <h2 className="text-2xl font-bold text-red-400 mb-4">Accesso Negato</h2>
          <p className="text-slate-300 mb-6">
            Non hai i permessi per accedere al Blog Photo Manager.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-slate-700 text-white rounded-lg font-semibold hover:bg-slate-600 transition-all"
          >
            <Home className="w-5 h-5" />
            Torna alla Home
          </Link>
        </div>
      </div>
    );
  }

  // Selection handlers
  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedArticleIds(new Set());
  };

  const toggleArticleSelection = (articleId: number) => {
    const newSet = new Set(selectedArticleIds);
    if (newSet.has(articleId)) {
      newSet.delete(articleId);
    } else {
      newSet.add(articleId);
    }
    setSelectedArticleIds(newSet);
  };

  const selectAllVisible = () => {
    const newSet = new Set<number>();
    filteredArticles.forEach(article => newSet.add(article.id));
    setSelectedArticleIds(newSet);
    toast.success(`${filteredArticles.length} articoli selezionati`);
  };

  const deselectAll = () => {
    setSelectedArticleIds(new Set());
    toast('Selezione cancellata');
  };

  // Modal handlers
  const handleArticleClick = (article: BlogArticle) => {
    setSelectedArticle(article);
    setIsAIModalOpen(true);
  };

  const handleBatchGenerate = () => {
    if (selectedArticleIds.size === 0) {
      toast.error('Seleziona almeno un articolo');
      return;
    }
    setIsBatchModalOpen(true);
  };

  const handleImageGenerated = (articleId: number, imageBase64: string) => {
    setGeneratedImages(prev => ({
      ...prev,
      [articleId]: `data:image/png;base64,${imageBase64}`
    }));
  };

  const selectedArticles = Array.from(selectedArticleIds)
    .map(id => allArticles.find(a => a.id === id))
    .filter((a): a is BlogArticle => a !== undefined);

  const activeFiltersCount = [
    filters.publishedOnly,
    filters.withoutImages
  ].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 pb-32">
      {/* Header - with auto-hide on scroll */}
      <div className={`
        bg-gradient-to-r from-purple-600 to-emerald-600 p-3 md:p-4 shadow-lg sticky top-0 z-40
        transition-transform duration-300 ease-in-out
        ${isHeaderVisible ? 'translate-y-0' : '-translate-y-full'}
      `}>
        <div className="container mx-auto">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
              <Link
                href="/"
                className="p-1.5 md:p-2 hover:bg-white/20 rounded-lg transition-colors flex-shrink-0"
              >
                <ArrowLeft className="w-5 h-5 md:w-6 md:h-6 text-white" />
              </Link>
              <div className="min-w-0">
                <h1 className="text-lg md:text-2xl lg:text-3xl font-bold text-white flex items-center gap-1.5 md:gap-2 truncate">
                  <BookOpen className="w-5 h-5 md:w-7 md:h-7 flex-shrink-0" />
                  <span className="truncate">Blog Photo Manager</span>
                </h1>
                <p className="text-purple-100 text-xs md:text-sm mt-0.5 hidden sm:block">
                  Gestisci e genera immagini AI
                </p>
              </div>
            </div>

            {/* Selection Mode Toggle */}
            <button
              onClick={toggleSelectionMode}
              className={`
                px-2 md:px-4 py-1.5 md:py-2 rounded-lg font-semibold transition-all
                flex items-center gap-1 md:gap-2 text-xs md:text-sm flex-shrink-0
                ${isSelectionMode
                  ? 'bg-white text-purple-600'
                  : 'bg-white/20 text-white hover:bg-white/30'
                }
              `}
            >
              {isSelectionMode ? <CheckSquare className="w-4 h-4 md:w-5 md:h-5" /> : <Square className="w-4 h-4 md:w-5 md:h-5" />}
              <span className="hidden sm:inline">Selezione</span>
            </button>
          </div>

          {/* Stats Bar - Compact on mobile */}
          <div className="grid grid-cols-3 md:grid-cols-5 gap-1.5 md:gap-2 mt-2 md:mt-3">
            <div className="bg-white/10 rounded-lg p-1.5 md:p-2 text-center">
              <div className="text-sm md:text-lg font-bold text-white">{stats.total}</div>
              <div className="text-[10px] md:text-xs text-purple-100">Totale</div>
            </div>
            <div className="bg-white/10 rounded-lg p-1.5 md:p-2 text-center">
              <div className="text-sm md:text-lg font-bold text-white">{stats.published}</div>
              <div className="text-[10px] md:text-xs text-purple-100">Pubbl.</div>
            </div>
            <div className="bg-white/10 rounded-lg p-1.5 md:p-2 text-center">
              <div className="text-sm md:text-lg font-bold text-white">{stats.withImages}</div>
              <div className="text-[10px] md:text-xs text-purple-100 hidden md:block">Con Immagini</div>
              <div className="text-[10px] md:text-xs text-purple-100 md:hidden">Img</div>
            </div>
            <div className="bg-white/10 rounded-lg p-1.5 md:p-2 text-center hidden md:block">
              <div className="text-sm md:text-lg font-bold text-white">{filteredArticles.length}</div>
              <div className="text-[10px] md:text-xs text-purple-100">Filtrati</div>
            </div>
            <div className="bg-white/10 rounded-lg p-1.5 md:p-2 text-center hidden md:block">
              <div className="text-sm md:text-lg font-bold text-white">{Object.keys(generatedImages).length}</div>
              <div className="text-[10px] md:text-xs text-purple-100">Generati</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-white text-xl">Caricamento articoli...</div>
          </div>
        ) : (
          <>
            {/* Articles Grid */}
            {filteredArticles.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredArticles.map((article) => (
                  <BlogArticleCard
                    key={article.id}
                    article={article}
                    isSelectionMode={isSelectionMode}
                    isSelected={selectedArticleIds.has(article.id)}
                    onSelect={() => toggleArticleSelection(article.id)}
                    onClick={() => handleArticleClick(article)}
                    generatedImage={generatedImages[article.id]}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20">
                <ImageIcon className="w-20 h-20 text-slate-600 mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">
                  Nessun articolo trovato
                </h3>
                <p className="text-slate-400 text-center max-w-md">
                  Prova a modificare i filtri o la ricerca per vedere più risultati
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Fixed Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-slate-800 to-slate-900 border-t-2 border-slate-700 p-4 shadow-xl z-40">
        <div className="container mx-auto">
          <div className="flex items-center gap-3">
            {/* Search Bar */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cerca articoli per titolo, keywords..."
                className="w-full pl-10 pr-10 py-3 rounded-lg bg-slate-700 text-white border-2 border-slate-600 focus:border-purple-500 focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X className="w-5 h-5 text-slate-400 hover:text-white" />
                </button>
              )}
            </div>

            {/* Filter Button */}
            <button
              onClick={() => setIsFiltersOpen(!isFiltersOpen)}
              className={`
                px-6 py-3 rounded-lg font-semibold transition-all flex items-center gap-2
                ${isFiltersOpen || activeFiltersCount > 0
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-700 text-white hover:bg-slate-600'
                }
              `}
            >
              <Filter className="w-5 h-5" />
              Filtri {activeFiltersCount > 0 && `(${activeFiltersCount})`}
            </button>

            {/* Selection Actions */}
            {isSelectionMode && (
              <>
                {selectedArticleIds.size > 0 ? (
                  <>
                    <button
                      onClick={deselectAll}
                      className="px-6 py-3 bg-slate-700 text-white rounded-lg font-semibold hover:bg-slate-600 transition-all"
                    >
                      Deseleziona ({selectedArticleIds.size})
                    </button>
                    <button
                      onClick={handleBatchGenerate}
                      className="px-6 py-3 bg-gradient-to-r from-purple-600 to-emerald-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-emerald-700 transition-all flex items-center gap-2"
                    >
                      <ImageIcon className="w-5 h-5" />
                      Genera Batch ({selectedArticleIds.size})
                    </button>
                  </>
                ) : (
                  <button
                    onClick={selectAllVisible}
                    className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-all"
                  >
                    Seleziona Tutti
                  </button>
                )}
              </>
            )}
          </div>

          {/* Filters Panel */}
          {isFiltersOpen && (
            <div className="mt-4 bg-slate-700 rounded-lg p-4 space-y-3">
              <h3 className="text-white font-semibold mb-3">Filtri Avanzati</h3>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="filter-published"
                  checked={filters.publishedOnly}
                  onChange={(e) => setFilters(prev => ({ ...prev, publishedOnly: e.target.checked }))}
                  className="w-5 h-5 rounded bg-slate-600 border-slate-500"
                />
                <label htmlFor="filter-published" className="text-white cursor-pointer">
                  Solo articoli pubblicati
                </label>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="filter-no-images"
                  checked={filters.withoutImages}
                  onChange={(e) => setFilters(prev => ({ ...prev, withoutImages: e.target.checked }))}
                  className="w-5 h-5 rounded bg-slate-600 border-slate-500"
                />
                <label htmlFor="filter-no-images" className="text-white cursor-pointer">
                  Solo articoli senza immagini
                </label>
              </div>

              <button
                onClick={() => {
                  setFilters({ publishedOnly: false, withoutImages: false, searchQuery: '' });
                  setSearchQuery('');
                }}
                className="w-full px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-500 transition-colors text-sm"
              >
                Reset Filtri
              </button>
            </div>
          )}
        </div>
      </div>

      {/* AI Image Modal */}
      {selectedArticle && (
        <BlogAIImageModal
          isOpen={isAIModalOpen}
          onClose={() => {
            setIsAIModalOpen(false);
            setSelectedArticle(null);
          }}
          article={selectedArticle}
          onImageGenerated={(imageBase64) => handleImageGenerated(selectedArticle.id, imageBase64)}
        />
      )}

      {/* Batch Modal */}
      <BatchBlogImageModal
        isOpen={isBatchModalOpen}
        onClose={() => {
          setIsBatchModalOpen(false);
          setIsSelectionMode(false);
          setSelectedArticleIds(new Set());
        }}
        articles={selectedArticles}
        onComplete={() => {
          toast.success('Generazione batch completata!');
        }}
      />
    </div>
  );
}
