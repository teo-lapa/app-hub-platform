'use client';

import { useState } from 'react';
import { ArrowLeft, Upload, FileText, Loader2, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';

export default function JetsonUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff', 'image/webp'];
      if (!validTypes.includes(selectedFile.type)) {
        setError('Formato non supportato. Usa PDF, JPG, PNG, TIFF o WebP');
        return;
      }

      if (selectedFile.size > 10 * 1024 * 1024) {
        setError('File troppo grande. Max 10MB');
        return;
      }

      setFile(selectedFile);
      setError(null);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/jetson/ocr', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        setResult(data);
      } else {
        throw new Error(data.error || 'Analisi fallita');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const extractedText = result?.result?.extractedText || '';
  const duration = result?.processing?.totalDuration || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/jetson-monitor">
            <button className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors">
              <ArrowLeft className="w-6 h-6 text-white" />
            </button>
          </Link>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white flex items-center gap-3">
              <FileText className="w-8 h-8" />
              Analisi Documenti
            </h1>
            <p className="text-gray-300 mt-1">Upload PDF o foto per estrazione testo con OCR</p>
          </div>
        </div>

        {/* Upload Area */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 border border-white/20 mb-6">
          <div className="border-2 border-dashed border-white/30 rounded-lg p-12 text-center">
            <Upload className="w-16 h-16 text-white/60 mx-auto mb-4" />

            {!file ? (
              <>
                <h3 className="text-xl font-semibold text-white mb-2">
                  Carica un documento
                </h3>
                <p className="text-gray-300 mb-6">
                  Supporta PDF, JPG, PNG, TIFF, WebP (max 10MB)
                </p>
                <label className="inline-block">
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold cursor-pointer transition-colors">
                    Seleziona File
                  </div>
                </label>
              </>
            ) : (
              <>
                <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">
                  {file.name}
                </h3>
                <p className="text-gray-300 mb-4">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>

                <div className="flex justify-center gap-3">
                  <button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Analisi in corso...
                      </>
                    ) : (
                      <>
                        <FileText className="w-5 h-5" />
                        Analizza Documento
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setFile(null);
                      setResult(null);
                      setError(null);
                    }}
                    disabled={uploading}
                    className="px-6 py-3 bg-red-500/20 hover:bg-red-500/30 disabled:bg-gray-600/20 text-white rounded-lg font-semibold transition-colors"
                  >
                    Annulla
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-3">
              <XCircle className="w-6 h-6 text-red-400" />
              <div>
                <h3 className="text-red-400 font-semibold">Errore</h3>
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {result && extractedText && (
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">Risultati Analisi</h2>
              <div className="flex items-center gap-4 text-sm text-gray-300">
                <span>Tipo: {result.result.typeName}</span>
                <span>Durata: {duration}ms</span>
              </div>
            </div>

            <div className="bg-white/5 rounded-lg p-4 max-h-96 overflow-y-auto">
              <pre className="text-gray-200 whitespace-pre-wrap font-mono text-sm">
                {extractedText}
              </pre>
            </div>

            <div className="mt-4 flex gap-3">
              <button
                onClick={() => navigator.clipboard.writeText(extractedText)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Copia Testo
              </button>

              <button
                onClick={() => {
                  const blob = new Blob([extractedText], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${file?.name.replace(/\.[^.]+$/, '')}-text.txt`;
                  a.click();
                }}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
              >
                Scarica TXT
              </button>
            </div>
          </div>
        )}

        {/* Info */}
        <div className="mt-8 bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
          <h3 className="text-blue-300 font-semibold mb-2">ℹ️ Come funziona</h3>
          <ul className="text-blue-200 text-sm space-y-1">
            <li>• Supporta PDF multi-pagina e immagini singole</li>
            <li>• Tesseract OCR con AI per massima accuratezza</li>
            <li>• Classifica automaticamente tipo di documento</li>
            <li>• Processa localmente sul tuo Jetson per privacy totale</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
