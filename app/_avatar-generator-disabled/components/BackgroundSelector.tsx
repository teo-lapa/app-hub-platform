'use client';

import { motion } from 'framer-motion';
import { BuildingOfficeIcon } from '@heroicons/react/24/outline';
import { UtensilsCrossed, ChefHat, Square, Sparkles } from 'lucide-react';

interface BackgroundSelectorProps {
  selectedBackground: string;
  onBackgroundChange: (background: string, customDescription?: string) => void;
}

const backgroundPresets = [
  {
    id: 'modern-office',
    name: 'Ufficio Moderno',
    description: 'Ambiente professionale',
    icon: BuildingOfficeIcon,
  },
  {
    id: 'restaurant',
    name: 'Ristorante',
    description: 'Sala da pranzo elegante',
    icon: UtensilsCrossed,
  },
  {
    id: 'professional-kitchen',
    name: 'Cucina Professionale',
    description: 'Cucina da chef',
    icon: ChefHat,
  },
  {
    id: 'neutral',
    name: 'Sfondo Neutro',
    description: 'Sfondo semplice uniforme',
    icon: Square,
  },
  {
    id: 'custom',
    name: 'Custom',
    description: 'Descrizione personalizzata',
    icon: Sparkles,
  },
];

export default function BackgroundSelector({
  selectedBackground,
  onBackgroundChange
}: BackgroundSelectorProps) {
  const handleBackgroundSelect = (backgroundId: string) => {
    onBackgroundChange(backgroundId);
  };

  const handleCustomDescriptionChange = (description: string) => {
    if (selectedBackground === 'custom') {
      onBackgroundChange('custom', description);
    }
  };

  return (
    <div className="w-full space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {backgroundPresets.map((background) => {
          const Icon = background.icon;
          const isSelected = selectedBackground === background.id;

          return (
            <motion.button
              key={background.id}
              onClick={() => handleBackgroundSelect(background.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`
                relative p-6 rounded-xl border-2 transition-all duration-200
                ${isSelected
                  ? 'border-blue-500 bg-blue-50 shadow-md'
                  : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm'
                }
              `}
            >
              <div className="flex flex-col items-center text-center space-y-3">
                <div className={`
                  p-3 rounded-full transition-colors
                  ${isSelected ? 'bg-blue-100' : 'bg-gray-100'}
                `}>
                  <Icon className={`
                    h-8 w-8
                    ${isSelected ? 'text-blue-600' : 'text-gray-600'}
                  `} />
                </div>

                <div>
                  <h3 className={`
                    font-semibold text-sm
                    ${isSelected ? 'text-blue-900' : 'text-gray-900'}
                  `}>
                    {background.name}
                  </h3>
                  <p className={`
                    text-xs mt-1
                    ${isSelected ? 'text-blue-600' : 'text-gray-500'}
                  `}>
                    {background.description}
                  </p>
                </div>

                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center"
                  >
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </motion.div>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>

      {selectedBackground === 'custom' && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
        >
          <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Descrivi lo sfondo desiderato
            </label>
            <textarea
              onChange={(e) => handleCustomDescriptionChange(e.target.value)}
              placeholder="Es: Libreria con libri antichi, luce naturale dalla finestra..."
              rows={4}
              className="w-full px-4 py-3 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
            <p className="text-xs text-gray-600 mt-2">
              Descrivi l'ambiente che meglio rappresenta il tuo brand
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
