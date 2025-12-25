'use client';

import { useState, useCallback, DragEvent, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PhotoIcon, XMarkIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline';

interface PhotoUploaderProps {
  onPhotoSelect: (file: File, preview: string) => void;
  currentPhoto?: string;
}

export default function PhotoUploader({ onPhotoSelect, currentPhoto }: PhotoUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateFile = (file: File): boolean => {
    // Check if it's an image
    if (!file.type.startsWith('image/')) {
      setError('Il file deve essere un\'immagine (JPG, PNG, ecc.)');
      return false;
    }

    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > maxSize) {
      setError('Il file non deve superare i 10MB');
      return false;
    }

    setError(null);
    return true;
  };

  const handleFile = (file: File) => {
    if (validateFile(file)) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const preview = reader.result as string;
        onPhotoSelect(file, preview);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, []);

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleRemovePhoto = () => {
    setError(null);
    onPhotoSelect(null as any, '');
  };

  return (
    <div className="w-full">
      <AnimatePresence mode="wait">
        {currentPhoto ? (
          <motion.div
            key="preview"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="relative"
          >
            <div className="relative rounded-xl overflow-hidden border-2 border-indigo-200 bg-white">
              <img
                src={currentPhoto}
                alt="Preview"
                className="w-full h-64 object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />

              <button
                onClick={handleRemovePhoto}
                className="absolute top-4 right-4 p-2 bg-white/90 backdrop-blur-sm rounded-full hover:bg-white transition-colors shadow-lg"
              >
                <XMarkIcon className="h-5 w-5 text-gray-700" />
              </button>

              <div className="absolute bottom-4 left-4 right-4">
                <button
                  onClick={() => document.getElementById('photo-input')?.click()}
                  className="w-full px-4 py-2 bg-white/90 backdrop-blur-sm rounded-lg hover:bg-white transition-colors shadow-lg text-sm font-medium text-gray-700 flex items-center justify-center gap-2"
                >
                  <ArrowUpTrayIcon className="h-4 w-4" />
                  Cambia foto
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="dropzone"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              relative rounded-xl border-2 border-dashed transition-all duration-200
              ${isDragging
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-gray-300 bg-gray-50 hover:border-indigo-400 hover:bg-indigo-50/50'
              }
            `}
          >
            <div className="p-12 flex flex-col items-center justify-center text-center">
              <motion.div
                animate={isDragging ? { scale: 1.1 } : { scale: 1 }}
                className="mb-4"
              >
                <PhotoIcon className={`h-16 w-16 mx-auto ${isDragging ? 'text-indigo-500' : 'text-gray-400'}`} />
              </motion.div>

              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Carica la tua foto
              </h3>

              <p className="text-sm text-gray-600 mb-6">
                Trascina qui la tua foto oppure clicca per selezionarla
              </p>

              <button
                onClick={() => document.getElementById('photo-input')?.click()}
                className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-sm hover:shadow-md"
              >
                Seleziona file
              </button>

              <p className="text-xs text-gray-500 mt-4">
                Formati supportati: JPG, PNG, GIF (max 10MB)
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <input
        id="photo-input"
        type="file"
        accept="image/*"
        onChange={handleFileInput}
        className="hidden"
      />

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg"
          >
            <p className="text-sm text-red-600 font-medium">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
