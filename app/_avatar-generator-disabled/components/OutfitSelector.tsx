'use client';

import { motion } from 'framer-motion';
import { BriefcaseIcon, UserIcon } from '@heroicons/react/24/outline';
import { ChefHat, Shirt, Sparkles } from 'lucide-react';

interface OutfitSelectorProps {
  selectedOutfit: string;
  onOutfitChange: (outfit: string, customDescription?: string) => void;
}

const outfitPresets = [
  {
    id: 'business',
    name: 'Business',
    description: 'Abito formale da ufficio',
    icon: BriefcaseIcon,
  },
  {
    id: 'casual',
    name: 'Casual',
    description: 'Abbigliamento informale',
    icon: Shirt,
  },
  {
    id: 'chef',
    name: 'Chef',
    description: 'Divisa da chef professionale',
    icon: ChefHat,
  },
  {
    id: 'elegant',
    name: 'Elegante',
    description: 'Look sofisticato',
    icon: Sparkles,
  },
  {
    id: 'custom',
    name: 'Custom',
    description: 'Descrizione personalizzata',
    icon: UserIcon,
  },
];

export default function OutfitSelector({ selectedOutfit, onOutfitChange }: OutfitSelectorProps) {
  const handleOutfitSelect = (outfitId: string) => {
    onOutfitChange(outfitId);
  };

  const handleCustomDescriptionChange = (description: string) => {
    if (selectedOutfit === 'custom') {
      onOutfitChange('custom', description);
    }
  };

  return (
    <div className="w-full space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {outfitPresets.map((outfit) => {
          const Icon = outfit.icon;
          const isSelected = selectedOutfit === outfit.id;

          return (
            <motion.button
              key={outfit.id}
              onClick={() => handleOutfitSelect(outfit.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`
                relative p-6 rounded-xl border-2 transition-all duration-200
                ${isSelected
                  ? 'border-indigo-500 bg-indigo-50 shadow-md'
                  : 'border-gray-200 bg-white hover:border-indigo-300 hover:shadow-sm'
                }
              `}
            >
              <div className="flex flex-col items-center text-center space-y-3">
                <div className={`
                  p-3 rounded-full transition-colors
                  ${isSelected ? 'bg-indigo-100' : 'bg-gray-100'}
                `}>
                  <Icon className={`
                    h-8 w-8
                    ${isSelected ? 'text-indigo-600' : 'text-gray-600'}
                  `} />
                </div>

                <div>
                  <h3 className={`
                    font-semibold text-sm
                    ${isSelected ? 'text-indigo-900' : 'text-gray-900'}
                  `}>
                    {outfit.name}
                  </h3>
                  <p className={`
                    text-xs mt-1
                    ${isSelected ? 'text-indigo-600' : 'text-gray-500'}
                  `}>
                    {outfit.description}
                  </p>
                </div>

                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-2 right-2 w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center"
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

      {selectedOutfit === 'custom' && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
        >
          <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-200">
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Descrivi l'outfit desiderato
            </label>
            <textarea
              onChange={(e) => handleCustomDescriptionChange(e.target.value)}
              placeholder="Es: Camicia bianca, cravatta blu, giacca grigia..."
              rows={4}
              className="w-full px-4 py-3 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
            <p className="text-xs text-gray-600 mt-2">
              Più dettagli fornisci, migliore sarà il risultato
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
