'use client';

import { useState } from 'react';
import { MessageCircle, FileSpreadsheet, HelpCircle, FileText } from 'lucide-react';

// Tab types
type Tab = 'chat' | 'extract' | 'qa' | 'ocr';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function JetsonAIHub() {
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [jetsonStatus, setJetsonStatus] = useState<any>(null);

  // Chat state
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // Extract data state
  const [extractFile, setExtractFile] = useState<File | null>(null);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [extractLoading, setExtractLoading] = useState(false);

  // Q&A state
  const [qaFile, setQaFile] = useState<File | null>(null);
  const [qaQuestion, setQaQuestion] = useState('');
  const [qaAnswer, setQaAnswer] = useState<any>(null);
  const [qaLoading, setQaLoading] = useState(false);

  // OCR state
  const [ocrFiles, setOcrFiles] = useState<File[]>([]);
  const [ocrResults, setOcrResults] = useState<any[]>([]);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);

  // Check Jetson status on mount
  useState(() => {
    fetch('/api/jetson/ocr')
      .then(res => res.json())
      .then(data => setJetsonStatus(data))
      .catch(err => console.error('Failed to check Jetson status:', err));
  });

  const tabs = [
    { id: 'chat' as Tab, name: 'Chat AI', icon: MessageCircle, description: 'Chatta con Llama 3.2' },
    { id: 'extract' as Tab, name: 'Estrai Dati', icon: FileSpreadsheet, description: 'PDF → Excel' },
    { id: 'qa' as Tab, name: 'Domande PDF', icon: HelpCircle, description: 'Fai domande ai documenti' },
    { id: 'ocr' as Tab, name: 'OCR Scanner', icon: FileText, description: 'Leggi PDF/Foto' }
  ];

  // =======================
  // CHAT FUNCTIONS
  // =======================

  const sendChatMessage = async () => {
    if (!chatInput.trim()) return;

    const userMessage: Message = { role: 'user', content: chatInput };
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setChatLoading(true);

    try {
      const res = await fetch(`${jetsonStatus?.tunnel?.url || ''}/api/v1/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: chatInput,
          conversation: chatMessages
        })
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      const aiMessage: Message = { role: 'assistant', content: data.message };
      setChatMessages(prev => [...prev, aiMessage]);

    } catch (err: any) {
      const errorMessage: Message = { role: 'assistant', content: `Errore: ${err.message}` };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setChatLoading(false);
    }
  };

  // =======================
  // EXTRACT DATA FUNCTIONS
  // =======================

  const handleExtractData = async () => {
    if (!extractFile) return;

    setExtractLoading(true);
    setExtractedData(null);

    try {
      const formData = new FormData();
      formData.append('file', extractFile);

      const res = await fetch(`${jetsonStatus?.tunnel?.url || ''}/api/v1/extract-data`, {
        method: 'POST',
        body: formData
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      setExtractedData(data.data);

    } catch (err: any) {
      alert(`Errore: ${err.message}`);
    } finally {
      setExtractLoading(false);
    }
  };

  const downloadExcel = () => {
    if (!extractedData) return;

    // Simple CSV export (you can use a library like xlsx for real Excel)
    let csv = 'Descrizione,Quantità,Prezzo Unitario,Totale\n';

    if (extractedData.items) {
      extractedData.items.forEach((item: any) => {
        csv += `${item.description || ''},${item.quantity || ''},${item.unitPrice || ''},${item.total || ''}\n`;
      });
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${extractedData.supplier || 'document'}_export.csv`;
    a.click();
  };

  // =======================
  // Q&A FUNCTIONS
  // =======================

  const handleAskQuestion = async () => {
    if (!qaFile || !qaQuestion.trim()) return;

    setQaLoading(true);
    setQaAnswer(null);

    try {
      const formData = new FormData();
      formData.append('file', qaFile);
      formData.append('question', qaQuestion);

      const res = await fetch(`${jetsonStatus?.tunnel?.url || ''}/api/v1/ask-document`, {
        method: 'POST',
        body: formData
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      setQaAnswer(data);

    } catch (err: any) {
      setQaAnswer({ answer: `Errore: ${err.message}`, confidence: 0 });
    } finally {
      setQaLoading(false);
    }
  };

  // =======================
  // OCR FUNCTIONS
  // =======================

  const handleOCR = async () => {
    if (ocrFiles.length === 0) return;

    setOcrLoading(true);
    setOcrResults([]);
    setOcrProgress(0);

    const processedResults: any[] = [];

    try {
      for (let i = 0; i < ocrFiles.length; i++) {
        const file = ocrFiles[i];
        setOcrProgress(i + 1);

        const formData = new FormData();
        formData.append('file', file);

        const fileSizeMB = file.size / (1024 * 1024);
        const useDirectUpload = fileSizeMB > 4 && jetsonStatus?.tunnel?.url;

        let response;

        if (useDirectUpload) {
          response = await fetch(`${jetsonStatus.tunnel.url}/api/v1/ocr/analyze`, {
            method: 'POST',
            body: formData,
          });
        } else {
          response = await fetch('/api/jetson/ocr', {
            method: 'POST',
            body: formData,
          });
        }

        const data = await response.json();

        if (!response.ok) {
          throw new Error(`${file.name}: ${data.error || 'Errore elaborazione'}`);
        }

        processedResults.push(data);
        setOcrResults([...processedResults]);
      }

    } catch (err: any) {
      alert(err.message);
    } finally {
      setOcrLoading(false);
      setOcrProgress(0);
    }
  };

  // =======================
  // RENDER
  // =======================

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-pink-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-indigo-600 to-pink-600 bg-clip-text text-transparent">
            🤖 Jetson AI Hub
          </h1>
          <p className="text-gray-600">
            Il tuo centro AI locale - OCR, Chat, Estrazione Dati, Q&A
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
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-4">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-2 pb-4 px-1 border-b-2 font-medium text-sm transition-colors
                    ${activeTab === tab.id
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                  `}
                >
                  <Icon className="w-5 h-5" />
                  <div className="text-left">
                    <div>{tab.name}</div>
                    <div className="text-xs text-gray-400">{tab.description}</div>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          {/* CHAT TAB */}
          {activeTab === 'chat' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-900">Chat con Llama 3.2</h2>
              <p className="text-gray-600">Chatta con l'AI locale sul tuo Jetson</p>

              {/* Chat Messages */}
              <div className="border border-gray-200 rounded-lg p-4 h-96 overflow-y-auto bg-gray-50">
                {chatMessages.length === 0 ? (
                  <div className="text-center text-gray-400 mt-20">
                    Inizia la conversazione...
                  </div>
                ) : (
                  <div className="space-y-4">
                    {chatMessages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg ${
                          msg.role === 'user'
                            ? 'bg-indigo-100 ml-12'
                            : 'bg-white border border-gray-200 mr-12'
                        }`}
                      >
                        <div className="text-xs text-gray-500 mb-1">
                          {msg.role === 'user' ? 'Tu' : 'Llama 3.2'}
                        </div>
                        <div className="text-gray-900">{msg.content}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                  placeholder="Scrivi un messaggio..."
                  className="flex-1 border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  disabled={chatLoading}
                />
                <button
                  onClick={sendChatMessage}
                  disabled={chatLoading || !chatInput.trim()}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                >
                  {chatLoading ? 'Pensando...' : 'Invia'}
                </button>
              </div>
            </div>
          )}

          {/* EXTRACT DATA TAB */}
          {activeTab === 'extract' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-900">Estrazione Dati → Excel</h2>
              <p className="text-gray-600">Carica un PDF e ottieni i dati in formato strutturato</p>

              {/* File Upload */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => e.target.files && setExtractFile(e.target.files[0])}
                  className="hidden"
                  id="extract-upload"
                />
                <label htmlFor="extract-upload" className="cursor-pointer">
                  <div className="text-5xl mb-2">📊</div>
                  <p className="text-lg font-semibold text-gray-700">
                    {extractFile ? extractFile.name : 'Clicca per selezionare PDF'}
                  </p>
                </label>
              </div>

              <button
                onClick={handleExtractData}
                disabled={!extractFile || extractLoading}
                className="w-full bg-green-600 text-white py-4 px-8 rounded-lg font-semibold text-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {extractLoading ? 'Estrazione in corso...' : '📊 Estrai Dati'}
              </button>

              {/* Extracted Data */}
              {extractedData && (
                <div className="space-y-4 border-t pt-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold">Dati Estratti</h3>
                    <button
                      onClick={downloadExcel}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      📥 Scarica CSV
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {extractedData.supplier && (
                      <div className="border border-gray-200 rounded-lg p-4">
                        <p className="text-sm text-gray-500">Fornitore</p>
                        <p className="font-semibold">{extractedData.supplier}</p>
                      </div>
                    )}
                    {extractedData.customer && (
                      <div className="border border-gray-200 rounded-lg p-4">
                        <p className="text-sm text-gray-500">Cliente</p>
                        <p className="font-semibold">{extractedData.customer}</p>
                      </div>
                    )}
                    {extractedData.number && (
                      <div className="border border-gray-200 rounded-lg p-4">
                        <p className="text-sm text-gray-500">Numero</p>
                        <p className="font-semibold">{extractedData.number}</p>
                      </div>
                    )}
                    {extractedData.amount && (
                      <div className="border border-gray-200 rounded-lg p-4">
                        <p className="text-sm text-gray-500">Totale</p>
                        <p className="text-2xl font-bold text-green-600">
                          {extractedData.amount} {extractedData.currency || 'EUR'}
                        </p>
                      </div>
                    )}
                  </div>

                  {extractedData.items && extractedData.items.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2">Prodotti ({extractedData.items.length})</h4>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {extractedData.items.map((item: any, idx: number) => (
                          <div key={idx} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                            <div className="flex justify-between">
                              <div className="flex-1">
                                <p className="font-medium">{item.description}</p>
                                <p className="text-sm text-gray-600">
                                  Qty: {item.quantity} × {item.unitPrice?.toFixed(2)}
                                </p>
                              </div>
                              <p className="font-bold">{item.total?.toFixed(2)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Q&A TAB */}
          {activeTab === 'qa' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-900">Fai Domande ai Documenti</h2>
              <p className="text-gray-600">Carica un PDF e fai domande sul contenuto</p>

              {/* File Upload */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => e.target.files && setQaFile(e.target.files[0])}
                  className="hidden"
                  id="qa-upload"
                />
                <label htmlFor="qa-upload" className="cursor-pointer">
                  <div className="text-5xl mb-2">❓</div>
                  <p className="text-lg font-semibold text-gray-700">
                    {qaFile ? qaFile.name : 'Clicca per selezionare PDF'}
                  </p>
                </label>
              </div>

              {/* Question Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  La tua domanda
                </label>
                <textarea
                  value={qaQuestion}
                  onChange={(e) => setQaQuestion(e.target.value)}
                  placeholder="Es: Qual è il totale della fattura? Quali prodotti sono stati ordinati?"
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 h-24 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  disabled={qaLoading}
                />
              </div>

              <button
                onClick={handleAskQuestion}
                disabled={!qaFile || !qaQuestion.trim() || qaLoading}
                className="w-full bg-purple-600 text-white py-4 px-8 rounded-lg font-semibold text-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {qaLoading ? 'Analizzando...' : '❓ Chiedi all\'AI'}
              </button>

              {/* Answer */}
              {qaAnswer && (
                <div className="border-t pt-4">
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                    <div className="flex items-start gap-3">
                      <div className="text-3xl">💡</div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-purple-900 mb-2">Risposta</h3>
                        <p className="text-gray-900 leading-relaxed">{qaAnswer.answer}</p>
                        {qaAnswer.confidence > 0 && (
                          <p className="text-sm text-gray-600 mt-2">
                            Confidence: {qaAnswer.confidence}%
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* OCR TAB */}
          {activeTab === 'ocr' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-900">OCR Scanner</h2>
              <p className="text-gray-600">Scansiona e classifica PDF, immagini e documenti</p>

              {/* File Upload */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <input
                  type="file"
                  accept=".pdf,image/*"
                  onChange={(e) => e.target.files && setOcrFiles(Array.from(e.target.files))}
                  className="hidden"
                  id="ocr-upload"
                  multiple
                />
                <label htmlFor="ocr-upload" className="cursor-pointer">
                  <div className="text-5xl mb-2">📄</div>
                  <p className="text-lg font-semibold text-gray-700">
                    {ocrFiles.length > 0 ? `${ocrFiles.length} file selezionati` : 'Clicca per selezionare PDF o immagini'}
                  </p>
                  {ocrFiles.length > 0 && (
                    <p className="text-sm text-gray-500 mt-2">
                      {(ocrFiles.reduce((sum, f) => sum + f.size, 0) / 1024).toFixed(2)} KB totali
                    </p>
                  )}
                </label>
              </div>

              {/* File List */}
              {ocrFiles.length > 0 && (
                <div className="max-h-32 overflow-y-auto bg-gray-50 rounded-lg p-3">
                  {ocrFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-200 last:border-b-0">
                      <span className="text-sm text-gray-700 truncate flex-1">{file.name}</span>
                      <span className="text-xs text-gray-500 ml-2">{(file.size / 1024).toFixed(2)} KB</span>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={handleOCR}
                disabled={ocrFiles.length === 0 || ocrLoading}
                className="w-full bg-gradient-to-r from-indigo-600 to-pink-600 text-white py-4 px-8 rounded-lg font-semibold text-lg hover:from-indigo-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {ocrLoading ? `Elaborazione ${ocrProgress}/${ocrFiles.length}...` : `🚀 Scansiona ${ocrFiles.length > 1 ? `${ocrFiles.length} Documenti` : 'Documento'}`}
              </button>

              {/* Results */}
              {ocrResults.length > 0 && ocrResults.map((result, idx) => (
                <div key={idx} className="border-t pt-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="text-xs text-gray-500">Documento {idx + 1}/{ocrResults.length}</div>
                      <div className="inline-block px-4 py-2 bg-gradient-to-r from-indigo-600 to-pink-600 text-white rounded-lg text-xl font-bold">
                        {result.result.typeName}
                      </div>
                      <p className="mt-1 text-sm text-gray-600">Confidence: {result.result.confidence}%</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Tempo</p>
                      <p className="text-xl font-bold text-indigo-600">
                        {(result.processing.totalDuration / 1000).toFixed(1)}s
                      </p>
                    </div>
                  </div>

                  {result.result.details && Object.keys(result.result.details).length > 0 && (
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {result.result.details.supplier && (
                        <div className="border border-gray-200 rounded p-2">
                          <p className="text-gray-500">Fornitore</p>
                          <p className="font-semibold">{result.result.details.supplier}</p>
                        </div>
                      )}
                      {result.result.details.amount && (
                        <div className="border border-gray-200 rounded p-2">
                          <p className="text-gray-500">Importo</p>
                          <p className="font-semibold text-green-600">
                            {result.result.details.amount} {result.result.details.currency || 'EUR'}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
