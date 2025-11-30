'use client';

import { useState } from 'react';
import PDFUploader from '@/components/test-ocr/PDFUploader';
import ResultViewer from '@/components/test-ocr/ResultViewer';
import { FileText, Zap, Upload } from 'lucide-react';

export default function TestOCRPage() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = (file: File) => {
    setUploadedFile(file);
    setResults(null);
    setError(null);
  };

  const handleProcessWithGemini = async () => {
    if (!uploadedFile) return;

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', uploadedFile);

      const response = await fetch('/api/test-ocr/gemini-flash', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Errore durante l\'elaborazione');
      }

      const data = await response.json();
      setResults(data);
    } catch (err: any) {
      setError(err.message || 'Errore sconosciuto');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <FileText className="w-8 h-8 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Test OCR - Gemini Vision
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Testa la qualità di trascrizione PDF con AI Vision
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Upload */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5 text-indigo-600" />
                Upload PDF
              </h2>

              <PDFUploader
                onFileUpload={handleFileUpload}
                uploadedFile={uploadedFile}
              />

              {uploadedFile && (
                <div className="mt-6">
                  <button
                    onClick={handleProcessWithGemini}
                    disabled={loading}
                    className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold text-white transition-all ${
                      loading
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg hover:shadow-xl'
                    }`}
                  >
                    <Zap className="w-5 h-5" />
                    {loading ? 'Elaborazione in corso...' : 'Elabora con Gemini 2.5 Flash'}
                  </button>
                </div>
              )}

              {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">
                    <strong>Errore:</strong> {error}
                  </p>
                </div>
              )}
            </div>

            {/* Info Card */}
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-200">
              <h3 className="font-semibold text-gray-900 mb-3">
                📊 Cosa testa questa app?
              </h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-indigo-600 font-bold">•</span>
                  <span><strong>Testo Raw:</strong> Estrazione semplice del testo</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-indigo-600 font-bold">•</span>
                  <span><strong>Markdown:</strong> Testo strutturato con formattazione</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-indigo-600 font-bold">•</span>
                  <span><strong>JSON:</strong> Dati strutturati per automazione</span>
                </li>
              </ul>
              <div className="mt-4 pt-4 border-t border-indigo-200">
                <p className="text-xs text-gray-600">
                  💡 Carica una fattura, DDT o ordine di acquisto per vedere come Gemini Vision lo interpreta.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column - Results */}
          <div>
            {results ? (
              <ResultViewer results={results} />
            ) : (
              <div className="bg-white rounded-xl shadow-lg p-12 border border-gray-200 h-full flex items-center justify-center">
                <div className="text-center text-gray-400">
                  <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Nessun risultato ancora</p>
                  <p className="text-sm mt-2">
                    Carica un PDF e clicca su &quot;Elabora&quot; per vedere i risultati
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
