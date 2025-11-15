'use client';

import { useState, useEffect } from 'react';

type Tab = 'chat' | 'extract' | 'qa' | 'ocr';

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

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default function JetsonAIHub() {
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [jetsonStatus, setJetsonStatus] = useState<any>(null);

  // Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // Extract Data State
  const [extractFile, setExtractFile] = useState<File | null>(null);
  const [extractLoading, setExtractLoading] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);

  // Q&A State
  const [qaFile, setQaFile] = useState<File | null>(null);
  const [qaQuestion, setQaQuestion] = useState('');
  const [qaAnswer, setQaAnswer] = useState<string | null>(null);
  const [qaLoading, setQaLoading] = useState(false);

  // OCR State
  const [ocrFiles, setOcrFiles] = useState<File[]>([]);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResults, setOcrResults] = useState<OCRResult[]>([]);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [currentProcessing, setCurrentProcessing] = useState<number>(0);

  useEffect(() => {
    checkJetsonStatus();
  }, []);

  const checkJetsonStatus = async () => {
    try {
      const res = await fetch('/api/jetson/ocr');
      const data = await res.json();
      setJetsonStatus(data);
    } catch (err) {
      console.error('Failed to check Jetson status:', err);
    }
  };

  // Chat Functions
  const handleChatSend = async () => {
    if (!chatInput.trim()) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setChatLoading(true);

    try {
      const response = await fetch(`${jetsonStatus?.tunnel?.url || ''}/api/v1/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          conversation: chatMessages
        })
      });

      const data = await response.json();

      if (data.success) {
        setChatMessages(data.conversation);
      } else {
        throw new Error(data.error || 'Chat failed');
      }
    } catch (error: any) {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: `Errore: ${error.message}`
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  // Extract Data Functions
  const handleExtractData = async () => {
    if (!extractFile) return;

    setExtractLoading(true);
    setExtractedData(null);

    try {
      const formData = new FormData();
      formData.append('file', extractFile);

      const response = await fetch(`${jetsonStatus?.tunnel?.url || ''}/api/v1/extract-data`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        setExtractedData(data.extractedData);
      } else {
        throw new Error(data.error || 'Extraction failed');
      }
    } catch (error: any) {
      alert(`Errore: ${error.message}`);
    } finally {
      setExtractLoading(false);
    }
  };

  const downloadCSV = () => {
    if (!extractedData) return;

    // Convert to CSV
    const headers = Object.keys(extractedData.details || {});
    const values = Object.values(extractedData.details || {});
    let csv = headers.join(',') + '\n' + values.join(',') + '\n\n';

    // Add items if available
    if (extractedData.details?.items && extractedData.details.items.length > 0) {
      csv += '\nProdotti:\n';
      csv += 'Descrizione,Quantità,Prezzo Unitario,Totale\n';
      extractedData.details.items.forEach((item: any) => {
        csv += `"${item.description}",${item.quantity || ''},${item.unitPrice || ''},${item.total || ''}\n`;
      });
    }

    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `estratto-${new Date().getTime()}.csv`;
    a.click();
  };

  // Q&A Functions
  const handleAskQuestion = async () => {
    if (!qaFile || !qaQuestion.trim()) return;

    setQaLoading(true);
    setQaAnswer(null);

    try {
      const formData = new FormData();
      formData.append('file', qaFile);
      formData.append('question', qaQuestion);

      const response = await fetch(`${jetsonStatus?.tunnel?.url || ''}/api/v1/ask-document`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        setQaAnswer(data.answer);
      } else {
        throw new Error(data.error || 'Q&A failed');
      }
    } catch (error: any) {
      setQaAnswer(`Errore: ${error.message}`);
    } finally {
      setQaLoading(false);
    }
  };

  // OCR Functions
  const handleOcrUpload = async () => {
    if (ocrFiles.length === 0) {
      setOcrError('Seleziona almeno un PDF');
      return;
    }

    setOcrLoading(true);
    setOcrError(null);
    setOcrResults([]);
    setCurrentProcessing(0);

    const processedResults: OCRResult[] = [];

    try {
      for (let i = 0; i < ocrFiles.length; i++) {
        const file = ocrFiles[i];
        setCurrentProcessing(i + 1);

        const formData = new FormData();
        formData.append('file', file);

        const fileSizeMB = file.size / (1024 * 1024);
        const useDirectUpload = fileSizeMB > 4 && jetsonStatus?.tunnel?.url;

        const response = await fetch(
          useDirectUpload
            ? `${jetsonStatus.tunnel.url}/api/v1/ocr/analyze`
            : '/api/jetson/ocr',
          {
            method: 'POST',
            body: formData
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(`${file.name}: ${data.error || 'Errore'}`);
        }

        processedResults.push(data);
        setOcrResults([...processedResults]);
      }
    } catch (err: any) {
      setOcrError(err.message);
    } finally {
      setOcrLoading(false);
      setCurrentProcessing(0);
    }
  };

  const tabs = [
    {
      id: 'chat' as Tab,
      name: 'Chat AI',
      icon: '💬',
      desc: 'Chatta con Llama'
    },
    {
      id: 'extract' as Tab,
      name: 'Estrai',
      icon: '📊',
      desc: 'PDF → CSV'
    },
    {
      id: 'qa' as Tab,
      name: 'Domande',
      icon: '❓',
      desc: 'Q&A Documenti'
    },
    {
      id: 'ocr' as Tab,
      name: 'OCR',
      icon: '📄',
      desc: 'Leggi PDF'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-pink-50 p-2 sm:p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header - Ottimizzato mobile */}
        <div className="mb-4 sm:mb-6 md:mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-1 sm:mb-2 bg-gradient-to-r from-indigo-600 to-pink-600 bg-clip-text text-transparent">
            🚀 Jetson AI Hub
          </h1>
          <p className="text-xs sm:text-sm md:text-base text-gray-600">
            AI locale con NVIDIA Jetson Nano + Ollama Llama 3.2 3B
          </p>
        </div>

        {/* Status - Compatto su mobile */}
        {jetsonStatus && (
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm sm:text-base font-semibold text-gray-900 truncate">Jetson Status</h3>
                <p className="text-xs text-gray-600 truncate">{jetsonStatus.tunnel?.url}</p>
              </div>
              <div className="flex items-center gap-2 ml-2">
                <div className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full ${jetsonStatus.tunnel?.status === 'online' ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
                <span className={`text-xs sm:text-sm font-medium ${jetsonStatus.tunnel?.status === 'online' ? 'text-green-600' : 'text-red-600'}`}>
                  {jetsonStatus.tunnel?.status || 'offline'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Tab Navigation - Ottimizzato per touch mobile */}
        <div className="grid grid-cols-4 gap-1 sm:gap-2 mb-4 sm:mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                p-2 sm:p-3 md:p-4 rounded-lg transition-all touch-manipulation
                ${activeTab === tab.id
                  ? 'bg-gradient-to-r from-indigo-600 to-pink-600 text-white shadow-lg scale-105'
                  : 'bg-white text-gray-700 hover:bg-gray-50 shadow'
                }
              `}
            >
              <div className="text-xl sm:text-2xl md:text-3xl mb-1">{tab.icon}</div>
              <div className="text-xs sm:text-sm font-semibold truncate">{tab.name}</div>
              <div className="text-[10px] sm:text-xs opacity-80 truncate hidden sm:block">{tab.desc}</div>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 md:p-8">
          {/* Chat Tab */}
          {activeTab === 'chat' && (
            <div className="space-y-4">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">💬 Chat con Llama AI</h2>
              <p className="text-sm sm:text-base text-gray-600">Chiacchiera con l'intelligenza artificiale locale</p>

              {/* Chat Messages - Ottimizzato mobile */}
              <div className="border border-gray-200 rounded-lg p-3 sm:p-4 h-[50vh] sm:h-96 overflow-y-auto bg-gray-50 space-y-3">
                {chatMessages.length === 0 && (
                  <p className="text-center text-gray-400 text-sm sm:text-base mt-8">Inizia una conversazione...</p>
                )}
                {chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`
                        max-w-[85%] sm:max-w-[80%] p-3 rounded-lg text-sm sm:text-base
                        ${msg.role === 'user'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white border border-gray-200 text-gray-900'
                        }
                      `}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-gray-200 p-3 rounded-lg">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Input - Touch friendly */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleChatSend()}
                  placeholder="Scrivi un messaggio..."
                  className="flex-1 p-3 sm:p-4 border border-gray-300 rounded-lg text-sm sm:text-base focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  disabled={chatLoading}
                />
                <button
                  onClick={handleChatSend}
                  disabled={chatLoading || !chatInput.trim()}
                  className="px-4 sm:px-6 py-3 sm:py-4 bg-indigo-600 text-white rounded-lg font-semibold disabled:opacity-50 hover:bg-indigo-700 transition-colors touch-manipulation text-sm sm:text-base"
                >
                  Invia
                </button>
              </div>
            </div>
          )}

          {/* Extract Data Tab */}
          {activeTab === 'extract' && (
            <div className="space-y-4">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">📊 Estrai Dati da PDF</h2>
              <p className="text-sm sm:text-base text-gray-600">Converti PDF in Excel/CSV con AI</p>

              {/* File Upload - Touch friendly */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 sm:p-8 md:p-12 text-center hover:border-indigo-500 transition-colors">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setExtractFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="extract-upload"
                />
                <label htmlFor="extract-upload" className="cursor-pointer">
                  <div className="text-4xl sm:text-5xl md:text-6xl mb-3 sm:mb-4">📄</div>
                  <p className="text-base sm:text-lg font-semibold text-gray-700 mb-2">
                    {extractFile ? extractFile.name : 'Seleziona PDF'}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500">
                    {extractFile ? `${(extractFile.size / 1024).toFixed(2)} KB` : 'Clicca per caricare'}
                  </p>
                </label>
              </div>

              <button
                onClick={handleExtractData}
                disabled={!extractFile || extractLoading}
                className="w-full bg-gradient-to-r from-indigo-600 to-pink-600 text-white py-3 sm:py-4 px-6 sm:px-8 rounded-lg font-semibold text-base sm:text-lg hover:from-indigo-700 hover:to-pink-700 disabled:opacity-50 transition-all shadow-md hover:shadow-lg touch-manipulation"
              >
                {extractLoading ? '⏳ Elaborazione...' : '🚀 Estrai Dati'}
              </button>

              {/* Extracted Data Display */}
              {extractedData && (
                <div className="mt-4 sm:mt-6 p-4 sm:p-6 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <h3 className="text-base sm:text-lg font-bold text-green-900">✅ Dati Estratti</h3>
                    <button
                      onClick={downloadCSV}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm sm:text-base touch-manipulation"
                    >
                      📥 Scarica CSV
                    </button>
                  </div>
                  <pre className="text-xs sm:text-sm bg-white p-3 sm:p-4 rounded border border-green-200 overflow-x-auto">
                    {JSON.stringify(extractedData, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Q&A Tab */}
          {activeTab === 'qa' && (
            <div className="space-y-4">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">❓ Fai Domande ai PDF</h2>
              <p className="text-sm sm:text-base text-gray-600">Carica un documento e chiedi qualsiasi cosa</p>

              {/* File Upload */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 sm:p-8 md:p-12 text-center hover:border-indigo-500 transition-colors">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setQaFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="qa-upload"
                />
                <label htmlFor="qa-upload" className="cursor-pointer">
                  <div className="text-4xl sm:text-5xl md:text-6xl mb-3 sm:mb-4">📄</div>
                  <p className="text-base sm:text-lg font-semibold text-gray-700 mb-2">
                    {qaFile ? qaFile.name : 'Seleziona PDF'}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500">
                    {qaFile ? `${(qaFile.size / 1024).toFixed(2)} KB` : 'Clicca per caricare'}
                  </p>
                </label>
              </div>

              {/* Question Input */}
              <input
                type="text"
                value={qaQuestion}
                onChange={(e) => setQaQuestion(e.target.value)}
                placeholder="Es: Qual è l'importo totale della fattura?"
                className="w-full p-3 sm:p-4 border border-gray-300 rounded-lg text-sm sm:text-base focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />

              <button
                onClick={handleAskQuestion}
                disabled={!qaFile || !qaQuestion.trim() || qaLoading}
                className="w-full bg-gradient-to-r from-indigo-600 to-pink-600 text-white py-3 sm:py-4 px-6 sm:px-8 rounded-lg font-semibold text-base sm:text-lg hover:from-indigo-700 hover:to-pink-700 disabled:opacity-50 transition-all shadow-md hover:shadow-lg touch-manipulation"
              >
                {qaLoading ? '⏳ Elaborazione...' : '❓ Chiedi'}
              </button>

              {/* Answer Display */}
              {qaAnswer && (
                <div className="mt-4 sm:mt-6 p-4 sm:p-6 bg-blue-50 border border-blue-200 rounded-lg">
                  <h3 className="text-base sm:text-lg font-bold text-blue-900 mb-3">💡 Risposta</h3>
                  <p className="text-sm sm:text-base text-blue-900">{qaAnswer}</p>
                </div>
              )}
            </div>
          )}

          {/* OCR Tab */}
          {activeTab === 'ocr' && (
            <div className="space-y-4">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">📄 OCR Scanner</h2>
              <p className="text-sm sm:text-base text-gray-600">Leggi e classifica documenti con Tesseract + AI</p>

              {/* File Upload */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 sm:p-8 md:p-12 text-center hover:border-indigo-500 transition-colors">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setOcrFiles(e.target.files ? Array.from(e.target.files) : [])}
                  className="hidden"
                  id="ocr-upload"
                  multiple
                />
                <label htmlFor="ocr-upload" className="cursor-pointer">
                  <div className="text-4xl sm:text-5xl md:text-6xl mb-3 sm:mb-4">📄</div>
                  <p className="text-base sm:text-lg font-semibold text-gray-700 mb-2">
                    {ocrFiles.length > 0 ? `${ocrFiles.length} PDF selezionati` : 'Seleziona PDF (multipli)'}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500">
                    {ocrFiles.length > 0
                      ? `${(ocrFiles.reduce((sum, f) => sum + f.size, 0) / 1024).toFixed(2)} KB totali`
                      : 'Clicca per caricare'}
                  </p>
                </label>
              </div>

              {/* File List - Scrollable su mobile */}
              {ocrFiles.length > 0 && (
                <div className="max-h-32 sm:max-h-40 overflow-y-auto bg-gray-50 rounded-lg p-3 border border-gray-200">
                  {ocrFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-200 last:border-b-0">
                      <span className="text-xs sm:text-sm text-gray-700 truncate flex-1">{file.name}</span>
                      <span className="text-[10px] sm:text-xs text-gray-500 ml-2">{(file.size / 1024).toFixed(2)} KB</span>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={handleOcrUpload}
                disabled={ocrFiles.length === 0 || ocrLoading}
                className="w-full bg-gradient-to-r from-indigo-600 to-pink-600 text-white py-3 sm:py-4 px-6 sm:px-8 rounded-lg font-semibold text-base sm:text-lg hover:from-indigo-700 hover:to-pink-700 disabled:opacity-50 transition-all shadow-md hover:shadow-lg touch-manipulation"
              >
                {ocrLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Elaborazione {currentProcessing}/{ocrFiles.length}...
                  </span>
                ) : (
                  `🚀 Analizza ${ocrFiles.length > 1 ? `${ocrFiles.length} Documenti` : 'Documento'}`
                )}
              </button>

              {/* Error */}
              {ocrError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4">
                  <p className="text-red-800 text-sm sm:text-base font-medium">❌ {ocrError}</p>
                </div>
              )}

              {/* Results - Ottimizzato mobile */}
              {ocrResults.length > 0 && ocrResults.map((result, idx) => (
                <div key={idx} className="bg-gradient-to-br from-gray-50 to-white rounded-lg border border-gray-200 p-4 sm:p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 mb-1 truncate">
                        Doc {idx + 1}/{ocrResults.length}: {result.filename}
                      </p>
                      <div className="inline-block px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-indigo-600 to-pink-600 text-white rounded-lg text-lg sm:text-2xl font-bold">
                        {result.result.typeName}
                      </div>
                      <p className="mt-2 text-xs sm:text-sm text-gray-600">
                        Confidence: <span className="font-bold">{result.result.confidence}%</span>
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-xs sm:text-sm text-gray-500">Tempo</p>
                      <p className="text-xl sm:text-2xl font-bold text-indigo-600">
                        {(result.processing.totalDuration / 1000).toFixed(1)}s
                      </p>
                    </div>
                  </div>

                  {/* Details - Grid responsive */}
                  {result.result.details && Object.keys(result.result.details).length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      {result.result.details.supplier && (
                        <div className="border border-gray-200 rounded-lg p-3">
                          <p className="text-xs text-gray-500 mb-1">Fornitore</p>
                          <p className="text-sm font-semibold text-gray-900 truncate">{result.result.details.supplier}</p>
                        </div>
                      )}
                      {result.result.details.number && (
                        <div className="border border-gray-200 rounded-lg p-3">
                          <p className="text-xs text-gray-500 mb-1">Numero</p>
                          <p className="text-sm font-semibold text-gray-900">{result.result.details.number}</p>
                        </div>
                      )}
                      {result.result.details.date && (
                        <div className="border border-gray-200 rounded-lg p-3">
                          <p className="text-xs text-gray-500 mb-1">Data</p>
                          <p className="text-sm font-semibold text-gray-900">{result.result.details.date}</p>
                        </div>
                      )}
                      {result.result.details.amount !== undefined && (
                        <div className="border border-gray-200 rounded-lg p-3 sm:col-span-2">
                          <p className="text-xs text-gray-500 mb-1">Importo</p>
                          <p className="text-2xl font-bold text-green-600">
                            {result.result.details.amount} {result.result.details.currency || 'EUR'}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Extracted Text - Compatto */}
                  <div>
                    <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-2">📝 Testo Estratto</h3>
                    <div className="bg-gray-50 rounded-lg p-3 max-h-48 sm:max-h-64 overflow-y-auto">
                      <pre className="text-xs sm:text-sm text-gray-700 whitespace-pre-wrap font-mono">
                        {result.result.extractedText}
                      </pre>
                    </div>
                    <p className="text-[10px] sm:text-xs text-gray-500 mt-2">
                      {result.result.fullTextLength} caratteri
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
// Force rebuild
