'use client';

import { useState } from 'react';

interface OCRResult {
  success: boolean;
  filename: string;
  result: {
    type: string;
    typeName: string;
    confidence: number;
    details: {
      supplier?: string;
      customer?: string;
      number?: string;
      date?: string;
      amount?: number;
      currency?: string;
      items?: Array<{
        description: string;
        quantity?: number;
        unitPrice?: number;
        total?: number;
      }>;
    };
    extractedText: string;
    fullTextLength: number;
  };
  processing: {
    ocrDuration: number;
    classificationDuration: number;
    totalDuration: number;
  };
}

export default function JetsonOCRPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<OCRResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [jetsonStatus, setJetsonStatus] = useState<any>(null);
  const [currentProcessing, setCurrentProcessing] = useState<number>(0);

  const checkJetsonStatus = async () => {
    try {
      const res = await fetch('/api/jetson/ocr');
      const data = await res.json();
      setJetsonStatus(data);
    } catch (err) {
      console.error('Failed to check Jetson status:', err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles(Array.from(e.target.files));
      setError(null);
      setResults([]);
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setError('Seleziona almeno un PDF prima di continuare');
      return;
    }

    setLoading(true);
    setError(null);
    setResults([]);
    setCurrentProcessing(0);

    const processedResults: OCRResult[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setCurrentProcessing(i + 1);

        console.log(`📄 Elaborazione ${i + 1}/${files.length}: ${file.name}`);

        const formData = new FormData();
        formData.append('file', file);

        // Vercel ha limite 4.5 MB - se file è > 4 MB, upload diretto al Jetson
        const fileSizeMB = file.size / (1024 * 1024);
        const useDirectUpload = fileSizeMB > 4 && jetsonStatus?.tunnel?.url;

        let response;

        if (useDirectUpload) {
          console.log(`📦 File grande (${fileSizeMB.toFixed(2)} MB) - upload diretto al Jetson`);
          // Upload diretto al Jetson via Cloudflare Tunnel (supporta fino a 50 MB)
          response = await fetch(`${jetsonStatus.tunnel.url}/api/v1/ocr/analyze`, {
            method: 'POST',
            body: formData,
          });
        } else {
          // Upload tramite API Vercel (per file piccoli)
          response = await fetch('/api/jetson/ocr', {
            method: 'POST',
            body: formData,
          });
        }

        const data = await response.json();

        if (!response.ok) {
          throw new Error(`${file.name}: ${data.error || 'Errore durante l\'elaborazione'}`);
        }

        processedResults.push(data);
        setResults([...processedResults]); // Aggiorna progressivamente i risultati
      }

      console.log(`✅ Elaborazione completata: ${processedResults.length}/${files.length} file`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setCurrentProcessing(0);
    }
  };

  // Check status on mount
  useState(() => {
    checkJetsonStatus();
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-pink-50 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-indigo-600 to-pink-600 bg-clip-text text-transparent">
            🚀 Jetson OCR Server
          </h1>
          <p className="text-gray-600">
            GPU-accelerated document OCR powered by NVIDIA Jetson Nano
          </p>
        </div>

        {/* Jetson Status */}
        {jetsonStatus && (
          <div className="mb-6 p-4 bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Jetson Status</h3>
                <p className="text-sm text-gray-600">{jetsonStatus.tunnel?.url}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${jetsonStatus.tunnel?.status === 'online' ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
                <span className={`font-medium ${jetsonStatus.tunnel?.status === 'online' ? 'text-green-600' : 'text-red-600'}`}>
                  {jetsonStatus.tunnel?.status || 'offline'}
                </span>
              </div>
            </div>
            {jetsonStatus.jetson && (
              <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">Tesseract:</span>{' '}
                  <span className="font-medium">{jetsonStatus.jetson.services?.tesseract || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-gray-500">Redis:</span>{' '}
                  <span className="font-medium">{jetsonStatus.jetson.services?.redis || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-gray-500">Ollama AI:</span>{' '}
                  <span className="font-medium">{jetsonStatus.jetson.services?.ollama || 'N/A'}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Upload Area */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-indigo-500 transition-colors">
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="hidden"
              id="pdf-upload"
              multiple
            />
            <label htmlFor="pdf-upload" className="cursor-pointer">
              <div className="text-6xl mb-4">📄</div>
              <p className="text-lg font-semibold text-gray-700 mb-2">
                {files.length > 0 ? `${files.length} PDF selezionati` : 'Clicca per selezionare PDF (anche multipli)'}
              </p>
              <p className="text-sm text-gray-500">
                {files.length > 0
                  ? `${(files.reduce((sum, f) => sum + f.size, 0) / 1024).toFixed(2)} KB totali`
                  : 'Supporto per fatture, ordini, ricevute, DDT, ecc.'}
              </p>
            </label>
          </div>

          {/* Lista file selezionati */}
          {files.length > 0 && (
            <div className="mt-4 max-h-40 overflow-y-auto bg-gray-50 rounded-lg p-3">
              {files.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-200 last:border-b-0">
                  <span className="text-sm text-gray-700 truncate flex-1">{file.name}</span>
                  <span className="text-xs text-gray-500 ml-2">{(file.size / 1024).toFixed(2)} KB</span>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={files.length === 0 || loading}
            className="w-full mt-6 bg-gradient-to-r from-indigo-600 to-pink-600 text-white py-4 px-8 rounded-lg font-semibold text-lg hover:from-indigo-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Elaborazione {currentProcessing}/{files.length}...
              </span>
            ) : (
              `🚀 Analizza ${files.length > 1 ? `${files.length} Documenti` : 'Documento'}`
            )}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800 font-medium">❌ Errore: {error}</p>
          </div>
        )}

        {/* Results */}
        {results.length > 0 && results.map((result, resultIdx) => (
          <div key={resultIdx} className="bg-white rounded-xl shadow-lg p-8 space-y-6 mb-6">
            {/* Document Type Badge */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-500 mb-1">
                  Documento {resultIdx + 1}/{results.length}: {result.filename}
                </div>
                <div className="inline-block px-6 py-3 bg-gradient-to-r from-indigo-600 to-pink-600 text-white rounded-lg text-2xl font-bold">
                  {result.result.typeName}
                </div>
                <p className="mt-2 text-sm text-gray-600">
                  Confidence: <span className="font-bold">{result.result.confidence}%</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Tempo elaborazione</p>
                <p className="text-2xl font-bold text-indigo-600">
                  {(result.processing.totalDuration / 1000).toFixed(1)}s
                </p>
              </div>
            </div>

            {/* Details Grid */}
            {result.result.details && Object.keys(result.result.details).length > 0 && (
              <div className="grid grid-cols-2 gap-4">
                {result.result.details.supplier && (
                  <div className="border border-gray-200 rounded-lg p-4">
                    <p className="text-sm text-gray-500 mb-1">Fornitore</p>
                    <p className="font-semibold text-gray-900">{result.result.details.supplier}</p>
                  </div>
                )}
                {result.result.details.customer && (
                  <div className="border border-gray-200 rounded-lg p-4">
                    <p className="text-sm text-gray-500 mb-1">Cliente</p>
                    <p className="font-semibold text-gray-900">{result.result.details.customer}</p>
                  </div>
                )}
                {result.result.details.number && (
                  <div className="border border-gray-200 rounded-lg p-4">
                    <p className="text-sm text-gray-500 mb-1">Numero Documento</p>
                    <p className="font-semibold text-gray-900">{result.result.details.number}</p>
                  </div>
                )}
                {result.result.details.date && (
                  <div className="border border-gray-200 rounded-lg p-4">
                    <p className="text-sm text-gray-500 mb-1">Data</p>
                    <p className="font-semibold text-gray-900">{result.result.details.date}</p>
                  </div>
                )}
                {result.result.details.amount !== undefined && (
                  <div className="border border-gray-200 rounded-lg p-4 col-span-2">
                    <p className="text-sm text-gray-500 mb-1">Importo Totale</p>
                    <p className="text-3xl font-bold text-green-600">
                      {result.result.details.amount} {result.result.details.currency || 'EUR'}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Line Items */}
            {result.result.details.items && result.result.details.items.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">📋 Righe Prodotto</h3>
                <div className="space-y-2">
                  {result.result.details.items.map((item, idx) => (
                    <div key={idx} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{item.description}</p>
                          <p className="text-sm text-gray-600">
                            {item.quantity && `Qty: ${item.quantity}`}
                            {item.unitPrice && ` × ${item.unitPrice.toFixed(2)}`}
                          </p>
                        </div>
                        {item.total && (
                          <p className="font-bold text-gray-900">{item.total.toFixed(2)}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Extracted Text */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">📝 Testo Estratto</h3>
              <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                  {result.result.extractedText}
                </pre>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {result.result.fullTextLength} caratteri totali
              </p>
            </div>

            {/* Performance Stats */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200">
              <div className="text-center">
                <p className="text-sm text-gray-500">OCR</p>
                <p className="text-lg font-bold text-indigo-600">
                  {(result.processing.ocrDuration / 1000).toFixed(1)}s
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500">AI Classification</p>
                <p className="text-lg font-bold text-pink-600">
                  {(result.processing.classificationDuration / 1000).toFixed(1)}s
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500">Totale</p>
                <p className="text-lg font-bold text-green-600">
                  {(result.processing.totalDuration / 1000).toFixed(1)}s
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
