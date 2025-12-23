'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ArrowDownTrayIcon, ArrowPathIcon, PlayIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Loader2 } from 'lucide-react';

interface VideoPreviewProps {
  videoUrl?: string;
  isLoading: boolean;
  error?: string | null;
  onRegenerate: () => void;
  onDownload: () => void;
}

export default function VideoPreview({
  videoUrl,
  isLoading,
  error,
  onRegenerate,
  onDownload
}: VideoPreviewProps) {
  return (
    <div className="w-full">
      <AnimatePresence mode="wait">
        {/* Loading State */}
        {isLoading && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="aspect-video rounded-xl bg-gradient-to-br from-indigo-100 via-blue-100 to-purple-100 flex flex-col items-center justify-center p-8"
          >
            <Loader2 className="h-16 w-16 text-indigo-600 animate-spin mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Generazione in corso...
            </h3>
            <p className="text-sm text-gray-600 text-center">
              Stiamo creando il tuo video avatar. Ci vorrà qualche minuto.
            </p>
          </motion.div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <motion.div
            key="error"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="aspect-video rounded-xl bg-red-50 border-2 border-red-200 flex flex-col items-center justify-center p-8"
          >
            <div className="bg-red-100 p-4 rounded-full mb-4">
              <ExclamationTriangleIcon className="h-12 w-12 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-red-900 mb-2">
              Errore nella generazione
            </h3>
            <p className="text-sm text-red-700 text-center mb-6 max-w-md">
              {error}
            </p>
            <button
              onClick={onRegenerate}
              className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors shadow-sm hover:shadow-md flex items-center gap-2"
            >
              <ArrowPathIcon className="h-5 w-5" />
              Riprova
            </button>
          </motion.div>
        )}

        {/* Video Ready State */}
        {videoUrl && !isLoading && !error && (
          <motion.div
            key="video"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-4"
          >
            <div className="relative rounded-xl overflow-hidden bg-black shadow-2xl">
              <video
                src={videoUrl}
                controls
                className="w-full aspect-video"
                controlsList="nodownload"
              >
                Il tuo browser non supporta il tag video.
              </video>
            </div>

            <div className="flex gap-4">
              <motion.button
                onClick={onDownload}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex-1 px-6 py-4 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors shadow-md hover:shadow-lg flex items-center justify-center gap-3"
              >
                <ArrowDownTrayIcon className="h-5 w-5" />
                Scarica Video
              </motion.button>

              <motion.button
                onClick={onRegenerate}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-6 py-4 bg-white text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors shadow-md hover:shadow-lg flex items-center justify-center gap-3 border-2 border-gray-200"
              >
                <ArrowPathIcon className="h-5 w-5" />
                Rigenera
              </motion.button>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-green-50 rounded-lg border border-green-200"
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 bg-green-100 p-2 rounded-full">
                  <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-green-900">
                    Video generato con successo!
                  </h4>
                  <p className="text-sm text-green-700 mt-1">
                    Il tuo avatar video è pronto. Puoi scaricarlo o rigenerarlo con impostazioni diverse.
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Empty State */}
        {!videoUrl && !isLoading && !error && (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="aspect-video rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 flex flex-col items-center justify-center p-8"
          >
            <div className="bg-gray-200 p-6 rounded-full mb-4">
              <PlayIcon className="h-12 w-12 text-gray-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Nessun video generato
            </h3>
            <p className="text-sm text-gray-600 text-center max-w-md">
              Completa tutti i campi e clicca su "Genera Video" per creare il tuo avatar video personalizzato
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
