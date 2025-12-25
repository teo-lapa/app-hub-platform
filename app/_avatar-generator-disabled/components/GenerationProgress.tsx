'use client';

import { motion } from 'framer-motion';
import { PhotoIcon, SpeakerWaveIcon, VideoCameraIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { Loader2 } from 'lucide-react';

interface GenerationProgressProps {
  currentStep: number;
  progress: number;
}

const steps = [
  {
    id: 1,
    name: 'Elaborazione foto',
    description: 'Analisi e preparazione immagine',
    icon: PhotoIcon,
  },
  {
    id: 2,
    name: 'Generazione audio',
    description: 'Sintesi vocale dello script',
    icon: SpeakerWaveIcon,
  },
  {
    id: 3,
    name: 'Creazione video',
    description: 'Animazione avatar e sincronizzazione',
    icon: VideoCameraIcon,
  },
  {
    id: 4,
    name: 'Finalizzazione',
    description: 'Rendering e ottimizzazione',
    icon: CheckCircleIcon,
  },
];

export default function GenerationProgress({ currentStep, progress }: GenerationProgressProps) {
  return (
    <div className="w-full space-y-8">
      {/* Progress Bar */}
      <div className="relative">
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-indigo-500 via-blue-500 to-purple-500 rounded-full relative overflow-hidden"
          >
            <motion.div
              animate={{ x: ['0%', '100%'] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
            />
          </motion.div>
        </div>
        <div className="mt-2 text-center">
          <span className="text-2xl font-bold text-indigo-600">{progress}%</span>
          <span className="text-sm text-gray-600 ml-2">completato</span>
        </div>
      </div>

      {/* Steps */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isCompleted = currentStep > step.id;
          const isActive = currentStep === step.id;
          const isPending = currentStep < step.id;

          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`
                relative p-6 rounded-xl border-2 transition-all duration-300
                ${isCompleted
                  ? 'border-green-500 bg-green-50'
                  : isActive
                  ? 'border-indigo-500 bg-indigo-50 shadow-lg'
                  : 'border-gray-200 bg-white'
                }
              `}
            >
              <div className="flex flex-col items-center text-center space-y-3">
                {/* Icon */}
                <div className={`
                  relative p-4 rounded-full transition-all duration-300
                  ${isCompleted
                    ? 'bg-green-100'
                    : isActive
                    ? 'bg-indigo-100'
                    : 'bg-gray-100'
                  }
                `}>
                  {isCompleted ? (
                    <CheckCircleIcon className="h-8 w-8 text-green-600" />
                  ) : isActive ? (
                    <>
                      <Icon className="h-8 w-8 text-indigo-600" />
                      <motion.div
                        className="absolute inset-0 rounded-full border-2 border-indigo-600"
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                    </>
                  ) : (
                    <Icon className="h-8 w-8 text-gray-400" />
                  )}

                  {isActive && (
                    <motion.div
                      className="absolute -top-1 -right-1"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    >
                      <Loader2 className="h-5 w-5 text-indigo-600" />
                    </motion.div>
                  )}
                </div>

                {/* Step Number */}
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                  ${isCompleted
                    ? 'bg-green-500 text-white'
                    : isActive
                    ? 'bg-indigo-500 text-white'
                    : 'bg-gray-200 text-gray-500'
                  }
                `}>
                  {isCompleted ? '✓' : step.id}
                </div>

                {/* Step Info */}
                <div>
                  <h4 className={`
                    font-semibold text-sm
                    ${isCompleted
                      ? 'text-green-900'
                      : isActive
                      ? 'text-indigo-900'
                      : 'text-gray-500'
                    }
                  `}>
                    {step.name}
                  </h4>
                  <p className={`
                    text-xs mt-1
                    ${isCompleted
                      ? 'text-green-600'
                      : isActive
                      ? 'text-indigo-600'
                      : 'text-gray-400'
                    }
                  `}>
                    {step.description}
                  </p>
                </div>

                {/* Status Badge */}
                {isActive && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="px-3 py-1 bg-indigo-500 text-white text-xs font-semibold rounded-full"
                  >
                    In corso...
                  </motion.div>
                )}

                {isCompleted && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="px-3 py-1 bg-green-500 text-white text-xs font-semibold rounded-full"
                  >
                    Completato
                  </motion.div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Current Step Details */}
      {currentStep > 0 && currentStep <= steps.length && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl border border-indigo-200"
        >
          <div className="flex items-center gap-4">
            <Loader2 className="h-6 w-6 text-indigo-600 animate-spin flex-shrink-0" />
            <div className="flex-1">
              <h4 className="font-semibold text-indigo-900 mb-1">
                {steps[currentStep - 1].name}
              </h4>
              <p className="text-sm text-indigo-700">
                {steps[currentStep - 1].description}
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-indigo-600">{progress}%</div>
              <div className="text-xs text-indigo-600">completato</div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Completion Message */}
      {currentStep > steps.length && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border-2 border-green-200"
        >
          <div className="flex items-center gap-4">
            <div className="bg-green-100 p-3 rounded-full">
              <CheckCircleIcon className="h-8 w-8 text-green-600" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-green-900 text-lg mb-1">
                Video completato!
              </h4>
              <p className="text-sm text-green-700">
                Il tuo avatar video è stato generato con successo e pronto per il download.
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
