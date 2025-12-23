'use client';

import { BlogArticle } from '@/types/blog';
import { FileText, Image as ImageIcon, CheckCircle, XCircle, Calendar } from 'lucide-react';
import { getKeywordsArray } from '@/lib/utils/blogArticles';

interface BlogArticleCardProps {
  article: BlogArticle;
  isSelectionMode: boolean;
  isSelected: boolean;
  onSelect?: () => void;
  onClick: () => void;
  generatedImage?: string;
}

export function BlogArticleCard({
  article,
  isSelectionMode,
  isSelected,
  onSelect,
  onClick,
  generatedImage
}: BlogArticleCardProps) {
  const keywords = getKeywordsArray(article);

  const handleCardClick = () => {
    if (isSelectionMode && onSelect) {
      onSelect();
    } else {
      onClick();
    }
  };

  return (
    <div
      className={`
        relative group rounded-lg overflow-hidden
        bg-gradient-to-br from-slate-700 to-slate-600
        border-2 transition-all duration-200 cursor-pointer
        ${isSelected
          ? 'border-emerald-500 shadow-lg shadow-emerald-500/50'
          : 'border-slate-600 hover:border-slate-500'
        }
        ${isSelectionMode ? 'hover:border-emerald-400' : 'hover:shadow-xl hover:scale-[1.02]'}
      `}
      onClick={handleCardClick}
    >
      {/* Selection Checkbox */}
      {isSelectionMode && (
        <div className="absolute top-2 right-2 z-10">
          <div
            className={`
              w-6 h-6 rounded flex items-center justify-center
              ${isSelected
                ? 'bg-emerald-500'
                : 'bg-slate-700 border-2 border-slate-400'
              }
            `}
          >
            {isSelected && <CheckCircle className="w-4 h-4 text-white" />}
          </div>
        </div>
      )}

      {/* Image Preview Area (16:9) */}
      <div className="relative w-full aspect-video bg-slate-800">
        {generatedImage || article.coverImage ? (
          <img
            src={generatedImage || article.coverImage || ''}
            alt={article.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-16 h-16 text-slate-600" />
          </div>
        )}

        {/* Published Status Badge */}
        <div className="absolute top-2 left-2">
          {article.is_published ? (
            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/90 text-white text-xs font-medium">
              <CheckCircle className="w-3 h-3" />
              Pubblicato
            </div>
          ) : (
            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-slate-500/90 text-white text-xs font-medium">
              <XCircle className="w-3 h-3" />
              Bozza
            </div>
          )}
        </div>

        {/* Image Count Indicator */}
        {article.analysis.hasImages > 0 && (
          <div className="absolute bottom-2 right-2">
            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-purple-500/90 text-white text-xs font-medium">
              <ImageIcon className="w-3 h-3" />
              {article.analysis.hasImages}
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Title */}
        <h3 className="text-white font-semibold text-sm line-clamp-2 mb-2 min-h-[2.5rem]">
          {article.name}
        </h3>

        {/* Subtitle */}
        {article.subtitle && (
          <p className="text-slate-300 text-xs line-clamp-1 mb-3">
            {article.subtitle}
          </p>
        )}

        {/* Keywords Tags */}
        {keywords.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {keywords.slice(0, 3).map((keyword, index) => (
              <span
                key={index}
                className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-xs"
              >
                {keyword}
              </span>
            ))}
          </div>
        )}

        {/* Metadata */}
        <div className="flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1">
            <FileText className="w-3 h-3" />
            <span>{article.analysis.wordCount} parole</span>
          </div>

          {article.dates?.created && (
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>{new Date(article.dates.created).toLocaleDateString('it-IT')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Hover Overlay */}
      {!isSelectionMode && (
        <div className="absolute inset-0 bg-gradient-to-t from-purple-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      )}
    </div>
  );
}
