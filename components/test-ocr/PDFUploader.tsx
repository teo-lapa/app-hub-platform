'use client';

import { useCallback, useState } from 'react';
import { Upload, File, X, CheckCircle } from 'lucide-react';

interface PDFUploaderProps {
  onFileUpload: (file: File) => void;
  uploadedFile: File | null;
}

export default function PDFUploader({ onFileUpload, uploadedFile }: PDFUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      const pdfFile = files.find((file) => file.type === 'application/pdf');

      if (pdfFile) {
        onFileUpload(pdfFile);
      } else {
        alert('Per favore carica solo file PDF');
      }
    },
    [onFileUpload]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && file.type === 'application/pdf') {
        onFileUpload(file);
      } else {
        alert('Per favore carica solo file PDF');
      }
    },
    [onFileUpload]
  );

  const handleRemove = useCallback(() => {
    onFileUpload(null as any);
  }, [onFileUpload]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div>
      {!uploadedFile ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer ${
            isDragging
              ? 'border-indigo-500 bg-indigo-50 scale-105'
              : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'
          }`}
        >
          <input
            type="file"
            id="pdf-upload"
            accept=".pdf,application/pdf"
            onChange={handleFileInput}
            className="hidden"
          />
          <label htmlFor="pdf-upload" className="cursor-pointer">
            <Upload
              className={`w-12 h-12 mx-auto mb-4 transition-colors ${
                isDragging ? 'text-indigo-600' : 'text-gray-400'
              }`}
            />
            <p className="text-lg font-semibold text-gray-700 mb-2">
              {isDragging ? 'Rilascia il file qui' : 'Trascina un PDF qui'}
            </p>
            <p className="text-sm text-gray-500">
              oppure{' '}
              <span className="text-indigo-600 font-semibold hover:underline">
                clicca per selezionare
              </span>
            </p>
            <p className="text-xs text-gray-400 mt-3">
              Dimensione massima: 10 MB
            </p>
          </label>
        </div>
      ) : (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="p-2 bg-green-100 rounded-lg shrink-0">
                <File className="w-6 h-6 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                  <span className="text-sm font-semibold text-green-900">
                    File caricato
                  </span>
                </div>
                <p className="text-sm font-medium text-gray-900 truncate">
                  {uploadedFile.name}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  {formatFileSize(uploadedFile.size)}
                </p>
              </div>
            </div>
            <button
              onClick={handleRemove}
              className="p-2 hover:bg-red-100 rounded-lg transition-colors shrink-0"
              title="Rimuovi file"
            >
              <X className="w-5 h-5 text-red-600" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
