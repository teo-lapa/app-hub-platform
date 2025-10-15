'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Newspaper, Sparkles, RefreshCw, ArrowLeft, Loader2 } from 'lucide-react';
import ArticleCard from '@/app/components/ArticleCard';
import ArticleModal from '@/app/components/ArticleModal';
import { useRouter } from 'next/navigation';

interface Article {
  id: string;
  title: string;
  content: string;
  category: 'Curiosita Food' | 'Gestione Ristorante';
  source: string;
  imageUrl: string;
  date: string;
  preview: string;
}

export default function FoodNewsPage() {
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carica articoli all'avvio
  useEffect(() => {
    loadArticles();
  }, []);

  const loadArticles = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch('/api/food-news');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore nel caricamento degli articoli');
      }

      setArticles(data.articles);
    } catch (err) {
      console.error('Error loading articles:', err);
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setIsLoading(false);
    }
  };

  const generateNewArticles = async () => {
    try {
      setIsGenerating(true);
      setError(null);

      const response = await fetch('/api/food-news/generate', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore nella generazione degli articoli');
      }

      setArticles(data.articles);
    } catch (err) {
      console.error('Error generating articles:', err);
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setIsGenerating(false);
    }
  };

  // Filtra articoli per categoria
  const curiositaArticles = articles.filter((a) => a.category === 'Curiosita Food');
  const gestioneArticles = articles.filter((a) => a.category === 'Gestione Ristorante');

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black">
      {/* Header */}
      <div className="relative overflow-hidden border-b border-gray-800">
        <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 via-red-500/10 to-green-500/10 animate-shimmer" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between mb-6">
            {/* Back Button */}
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800/80 hover:bg-gray-700 text-white rounded-xl transition-all duration-200 border border-gray-700"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Indietro</span>
            </button>

            {/* Generate Button */}
            <button
              onClick={generateNewArticles}
              disabled={isGenerating}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-red-600 hover:from-green-700 hover:to-red-700 text-white rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Generazione...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-5 h-5" />
                  <span>Nuovi Articoli</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-gradient-to-br from-green-500 to-red-500 rounded-2xl">
              <Newspaper className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-white">
                Food News Daily
              </h1>
              <p className="text-gray-400 mt-1">
                Articoli giornalieri generati con AI
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-yellow-400">
            <Sparkles className="w-5 h-5" />
            <p className="text-sm">
              Contenuti originali creati da Claude AI - Aggiornati quotidianamente
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-12 h-12 text-green-500 animate-spin mb-4" />
            <p className="text-gray-400 text-lg">Caricamento articoli...</p>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-6 text-center">
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={loadArticles}
              className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all duration-200"
            >
              Riprova
            </button>
          </div>
        )}

        {/* Articles Grid */}
        {!isLoading && !error && articles.length > 0 && (
          <>
            {/* Curiosita Food Section */}
            {curiositaArticles.length > 0 && (
              <section className="mb-16">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-8"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-1 h-8 bg-gradient-to-b from-green-500 to-green-600 rounded-full" />
                    <h2 className="text-3xl font-bold text-white">
                      Curiosita del Food
                    </h2>
                  </div>
                  <p className="text-gray-400 ml-6">
                    Scopri i segreti della cucina mediterranea
                  </p>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {curiositaArticles.map((article, index) => (
                    <ArticleCard
                      key={article.id}
                      {...article}
                      onClick={() => setSelectedArticle(article)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Gestione Ristorante Section */}
            {gestioneArticles.length > 0 && (
              <section>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="mb-8"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-1 h-8 bg-gradient-to-b from-red-500 to-red-600 rounded-full" />
                    <h2 className="text-3xl font-bold text-white">
                      Gestione Ristorante
                    </h2>
                  </div>
                  <p className="text-gray-400 ml-6">
                    Strategie e best practices per il successo del tuo business
                  </p>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {gestioneArticles.map((article, index) => (
                    <ArticleCard
                      key={article.id}
                      {...article}
                      onClick={() => setSelectedArticle(article)}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* Empty State */}
        {!isLoading && !error && articles.length === 0 && (
          <div className="text-center py-20">
            <Newspaper className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-400 mb-2">
              Nessun articolo disponibile
            </h3>
            <p className="text-gray-500 mb-6">
              Genera i primi articoli della giornata
            </p>
            <button
              onClick={generateNewArticles}
              disabled={isGenerating}
              className="px-6 py-3 bg-gradient-to-r from-green-600 to-red-600 hover:from-green-700 hover:to-red-700 text-white rounded-xl transition-all duration-200 font-semibold"
            >
              Genera Articoli
            </button>
          </div>
        )}
      </div>

      {/* Article Modal */}
      <ArticleModal
        article={selectedArticle}
        isOpen={!!selectedArticle}
        onClose={() => setSelectedArticle(null)}
      />

      {/* Background decorations */}
      <div className="fixed top-20 right-0 w-96 h-96 bg-green-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-20 left-0 w-96 h-96 bg-red-500/5 rounded-full blur-3xl pointer-events-none" />
    </div>
  );
}
