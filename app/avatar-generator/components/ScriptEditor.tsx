'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DocumentTextIcon, ClockIcon, SpeakerWaveIcon } from '@heroicons/react/24/outline';

interface ScriptEditorProps {
  script: string;
  onScriptChange: (script: string) => void;
  voice: string;
  onVoiceChange: (voice: string) => void;
}

const voiceOptions = [
  { id: 'male', name: 'Voce Maschile', description: 'Tono professionale e assertivo' },
  { id: 'female', name: 'Voce Femminile', description: 'Tono caldo e accogliente' },
  { id: 'neutral', name: 'Voce Neutro', description: 'Tono equilibrato e versatile' },
];

export default function ScriptEditor({
  script,
  onScriptChange,
  voice,
  onVoiceChange
}: ScriptEditorProps) {
  const [stats, setStats] = useState({
    characters: 0,
    words: 0,
    estimatedDuration: '0:00'
  });

  useEffect(() => {
    const characters = script.length;
    const words = script.trim() ? script.trim().split(/\s+/).length : 0;

    // Stima durata: circa 150 parole = 1 minuto
    const minutes = Math.floor(words / 150);
    const remainingWords = words % 150;
    const seconds = Math.round((remainingWords / 150) * 60);
    const estimatedDuration = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    setStats({ characters, words, estimatedDuration });
  }, [script]);

  return (
    <div className="w-full space-y-6">
      {/* Voice Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-3">
          Seleziona voce
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {voiceOptions.map((voiceOption) => {
            const isSelected = voice === voiceOption.id;
            return (
              <motion.button
                key={voiceOption.id}
                onClick={() => onVoiceChange(voiceOption.id)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`
                  p-4 rounded-lg border-2 transition-all duration-200 text-left
                  ${isSelected
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 bg-white hover:border-indigo-300'
                  }
                `}
              >
                <div className="flex items-start gap-3">
                  <div className={`
                    p-2 rounded-lg
                    ${isSelected ? 'bg-indigo-100' : 'bg-gray-100'}
                  `}>
                    <SpeakerWaveIcon className={`
                      h-5 w-5
                      ${isSelected ? 'text-indigo-600' : 'text-gray-600'}
                    `} />
                  </div>
                  <div className="flex-1">
                    <h4 className={`
                      font-semibold text-sm
                      ${isSelected ? 'text-indigo-900' : 'text-gray-900'}
                    `}>
                      {voiceOption.name}
                    </h4>
                    <p className={`
                      text-xs mt-1
                      ${isSelected ? 'text-indigo-600' : 'text-gray-500'}
                    `}>
                      {voiceOption.description}
                    </p>
                  </div>
                  {isSelected && (
                    <div className="w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Script Editor */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-medium text-gray-900">
            Script del video
          </label>
          <div className="flex items-center gap-4 text-xs text-gray-600">
            <span className="flex items-center gap-1">
              <DocumentTextIcon className="h-4 w-4" />
              {stats.characters} caratteri, {stats.words} parole
            </span>
            <span className="flex items-center gap-1">
              <ClockIcon className="h-4 w-4" />
              ~{stats.estimatedDuration} min
            </span>
          </div>
        </div>

        <div className="relative">
          <textarea
            value={script}
            onChange={(e) => onScriptChange(e.target.value)}
            placeholder="Scrivi qui il testo che il tuo avatar dirà nel video...&#10;&#10;Es: Ciao! Sono [Il tuo nome] e oggi voglio parlarti dei nostri prodotti eccezionali. Abbiamo una selezione curata di specialità italiane che ti faranno innamorare del vero gusto della tradizione..."
            rows={12}
            className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none font-mono text-sm leading-relaxed"
          />

          {script.length === 0 && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="text-center text-gray-400 p-8">
                <DocumentTextIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Inizia a scrivere il tuo script...</p>
              </div>
            </div>
          )}
        </div>

        {/* Stats and Tips */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-blue-50 rounded-lg border border-blue-200"
          >
            <h4 className="text-sm font-semibold text-blue-900 mb-2">
              Durata stimata
            </h4>
            <div className="flex items-center gap-2">
              <ClockIcon className="h-5 w-5 text-blue-600" />
              <span className="text-2xl font-bold text-blue-600">
                {stats.estimatedDuration}
              </span>
              <span className="text-sm text-blue-600">minuti</span>
            </div>
            <p className="text-xs text-blue-700 mt-2">
              Basato su ~150 parole/minuto
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-4 bg-indigo-50 rounded-lg border border-indigo-200"
          >
            <h4 className="text-sm font-semibold text-indigo-900 mb-2">
              Suggerimenti
            </h4>
            <ul className="text-xs text-indigo-700 space-y-1">
              <li>• Usa frasi brevi e chiare</li>
              <li>• Mantieni un tono naturale</li>
              <li>• Evita termini troppo tecnici</li>
              <li>• Fai pause con la punteggiatura</li>
            </ul>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
