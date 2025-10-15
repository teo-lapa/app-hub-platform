'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';

interface ArticleCardProps {
  id: string;
  title: string;
  preview: string;
  category: 'Curiosita Food' | 'Gestione Ristorante';
  imageUrl: string;
  onClick: () => void;
}

export default function ArticleCard({
  title,
  preview,
  category,
  imageUrl,
  onClick,
}: ArticleCardProps) {
  const categoryColors = {
    'Curiosita Food': 'from-green-500/20 to-green-600/20 border-green-500/50',
    'Gestione Ristorante': 'from-red-500/20 to-red-600/20 border-red-500/50',
  };

  const categoryBadgeColors = {
    'Curiosita Food': 'bg-green-500 text-white',
    'Gestione Ristorante': 'bg-red-500 text-white',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      whileHover={{ y: -8, scale: 1.02 }}
      onClick={onClick}
      className="cursor-pointer group"
    >
      <div
        className={`relative overflow-hidden rounded-2xl border-2 bg-gradient-to-br ${categoryColors[category]} backdrop-blur-sm shadow-xl hover:shadow-2xl transition-all duration-300`}
      >
        {/* Image Section */}
        <div className="relative h-48 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10" />
          <img
            src={imageUrl}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />

          {/* Category Badge */}
          <div className="absolute top-4 left-4 z-20">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold ${categoryBadgeColors[category]} shadow-lg`}
            >
              {category}
            </span>
          </div>
        </div>

        {/* Content Section */}
        <div className="p-6 bg-gray-900/90 backdrop-blur-md">
          <h3 className="text-xl font-bold text-white mb-3 line-clamp-2 group-hover:text-green-400 transition-colors duration-300">
            {title}
          </h3>

          <p className="text-gray-300 text-sm line-clamp-3 leading-relaxed">
            {preview}
          </p>

          {/* Read More Indicator */}
          <div className="mt-4 flex items-center gap-2 text-green-400 font-semibold text-sm group-hover:gap-4 transition-all duration-300">
            <span>Leggi articolo completo</span>
            <svg
              className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>
        </div>

        {/* Animated border effect on hover */}
        <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-green-500/30 via-red-500/30 to-green-500/30 animate-shimmer" />
        </div>
      </div>
    </motion.div>
  );
}
