'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink } from 'lucide-react';
import { useEffect } from 'react';

interface Article {
  id: string;
  title: string;
  content: string;
  category: 'Curiosita Food' | 'Gestione Ristorante';
  source: string;
  imageUrl: string;
  date: string;
}

interface ArticleModalProps {
  article: Article | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ArticleModal({ article, isOpen, onClose }: ArticleModalProps) {
  // Blocca scroll quando modal è aperto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Chiudi con ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
    }
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!article) return null;

  const categoryColors = {
    'Curiosita Food': 'text-green-400 border-green-500/50 bg-green-500/10',
    'Gestione Ristorante': 'text-red-400 border-red-500/50 bg-red-500/10',
  };

  // Formatta il contenuto in paragrafi
  const paragraphs = article.content.split('\n\n').filter(p => p.trim());

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="min-h-screen px-4 flex items-center justify-center py-8">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.3 }}
                className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-3xl shadow-2xl max-w-4xl w-full border border-gray-700"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Close Button */}
                <button
                  onClick={onClose}
                  className="absolute top-6 right-6 z-50 p-3 rounded-full bg-red-600/90 hover:bg-red-500 text-white transition-all duration-200 backdrop-blur-sm border-2 border-white/20 shadow-xl hover:scale-110"
                >
                  <X className="w-6 h-6 stroke-[3]" />
                </button>

                {/* Hero Image */}
                <div className="relative h-64 md:h-80 overflow-hidden rounded-t-3xl">
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/50 to-transparent z-10" />
                  <img
                    src={article.imageUrl}
                    alt={article.title}
                    className="w-full h-full object-cover"
                  />

                  {/* Category Badge */}
                  <div className="absolute top-6 left-6 z-20">
                    <span
                      className={`px-4 py-2 rounded-full text-sm font-bold border ${categoryColors[article.category]} shadow-lg backdrop-blur-sm`}
                    >
                      {article.category}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-8 md:p-12">
                  {/* Title */}
                  <h1 className="text-3xl md:text-4xl font-bold text-white mb-6 leading-tight">
                    {article.title}
                  </h1>

                  {/* Date */}
                  <div className="flex items-center gap-2 text-gray-400 text-sm mb-8">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <span>
                      {new Date(article.date).toLocaleDateString('it-IT', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </span>
                  </div>

                  {/* Article Content */}
                  <div className="prose prose-invert prose-lg max-w-none">
                    {paragraphs.map((paragraph, index) => (
                      <p
                        key={index}
                        className="text-gray-300 mb-6 leading-relaxed text-lg"
                      >
                        {paragraph}
                      </p>
                    ))}
                  </div>

                  {/* Divider */}
                  <div className="my-8 h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent" />

                  {/* Source */}
                  <div className="bg-gradient-to-r from-gray-800/50 to-gray-900/50 rounded-xl p-6 border border-gray-700">
                    <div className="flex items-start gap-3">
                      <ExternalLink className="w-5 h-5 text-green-400 mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-gray-400 text-sm mb-1">Fonte:</p>
                        <p className="text-white font-semibold">{article.source}</p>
                        <p className="text-gray-500 text-xs mt-2">
                          Articolo generato con AI - Claude by Anthropic
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Decorative gradients */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-green-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-red-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />
              </motion.div>
            </div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
