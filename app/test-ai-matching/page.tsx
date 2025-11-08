'use client';

import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function TestAIMatchingPage() {
  const [customerName, setCustomerName] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleTest = async () => {
    if (!customerName || !message) {
      alert('Inserisci nome cliente e messaggio!');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/test-ai-matching', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName,
          message,
          historyMonths: 6
        })
      });

      const data = await response.json();
      setResult(data);
    } catch (error: any) {
      setResult({ success: false, error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      {/* Header */}
      <div className="max-w-5xl mx-auto mb-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg border border-slate-600 transition-colors mb-6"
        >
          <ArrowLeft className="h-5 w-5 text-slate-300" />
          <span className="text-slate-300">Home</span>
        </Link>

        <h1 className="text-4xl font-bold text-white mb-2">🧪 Test AI Matching Prodotti</h1>
        <p className="text-slate-400">Testa l'intelligenza artificiale nel matching dei prodotti dal messaggio cliente</p>
      </div>

      <div className="max-w-5xl mx-auto space-y-6">
        {/* Input Form */}
        <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl border border-slate-600/50 p-6">
          <div className="space-y-4">
            {/* Nome Cliente */}
            <div>
              <label className="block text-slate-300 font-semibold mb-2">
                Nome Cliente (o Codice)
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Es: Ristorante Da Mario, oppure C00123"
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Messaggio */}
            <div>
              <label className="block text-slate-300 font-semibold mb-2">
                Messaggio Ordine (testo, WhatsApp, email, ecc.)
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Es: Ciao, per domani mi serve:&#10;- 5 forme parmigiano&#10;- 10 kg prosciutto crudo&#10;- 3 cartoni pomodori pelati"
                rows={6}
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Button */}
            <button
              onClick={handleTest}
              disabled={loading}
              className="w-full px-6 py-4 bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600 text-white font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '🔄 Processando con AI...' : '🚀 Testa AI Matching'}
            </button>
          </div>
        </div>

        {/* Results */}
        {result && (
          <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl border border-slate-600/50 p-6">
            {result.success ? (
              <div className="space-y-6">
                {/* Cliente */}
                <div>
                  <h3 className="text-xl font-bold text-emerald-400 mb-3">✅ Cliente Trovato</h3>
                  <div className="bg-slate-900/50 rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-slate-400">Nome:</span>
                        <span className="text-white ml-2 font-semibold">{result.customer.name}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Codice:</span>
                        <span className="text-white ml-2 font-mono">{result.customer.ref || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Storico */}
                <div>
                  <h3 className="text-xl font-bold text-blue-400 mb-3">📊 Storico Acquisti</h3>
                  <div className="bg-slate-900/50 rounded-lg p-4">
                    <div className="grid grid-cols-3 gap-4 text-sm mb-4">
                      <div>
                        <span className="text-slate-400">Ordini:</span>
                        <span className="text-white ml-2 font-bold">{result.history.orders_count}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Prodotti unici:</span>
                        <span className="text-white ml-2 font-bold">{result.history.products_count}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Periodo:</span>
                        <span className="text-white ml-2 font-bold">{result.history.months} mesi</span>
                      </div>
                    </div>

                    <div className="mt-4">
                      <h4 className="text-slate-300 font-semibold mb-2">Top 10 Prodotti Più Ordinati:</h4>
                      <div className="space-y-1 max-h-60 overflow-y-auto">
                        {result.history.top_products.slice(0, 10).map((p: any, i: number) => (
                          <div key={i} className="flex items-center justify-between text-xs bg-slate-800/50 p-2 rounded">
                            <span className="text-slate-300">{i + 1}. {p.product_name}</span>
                            <span className="text-emerald-400 font-semibold">x{p.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* AI Matching Results */}
                <div>
                  <h3 className="text-xl font-bold text-purple-400 mb-3">🤖 AI Matching Results</h3>
                  <div className="bg-slate-900/50 rounded-lg p-4">
                    {result.ai_matching.matches?.map((match: any, i: number) => (
                      <div key={i} className="mb-4 last:mb-0 border-b border-slate-700 pb-4 last:border-0 last:pb-0">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="text-white font-semibold mb-1">
                              📝 "{match.richiesta_originale}"
                            </div>
                            {match.product_name ? (
                              <div className="text-emerald-400 text-sm">
                                ✅ {match.product_name}
                                <span className="text-slate-400 ml-2">(ID: {match.product_id})</span>
                              </div>
                            ) : (
                              <div className="text-red-400 text-sm">❌ NON TROVATO</div>
                            )}
                          </div>
                          <div className="ml-4 flex flex-col items-end">
                            <div className="text-2xl font-bold text-white mb-1">
                              {match.quantita}x
                            </div>
                            <span
                              className={`px-2 py-1 rounded text-xs font-semibold ${
                                match.confidence === 'ALTA'
                                  ? 'bg-green-500/20 text-green-400'
                                  : match.confidence === 'MEDIA'
                                  ? 'bg-yellow-500/20 text-yellow-400'
                                  : match.confidence === 'BASSA'
                                  ? 'bg-orange-500/20 text-orange-400'
                                  : 'bg-red-500/20 text-red-400'
                              }`}
                            >
                              {match.confidence}
                            </span>
                          </div>
                        </div>
                        <div className="text-slate-400 text-xs italic mt-2">
                          💡 {match.reasoning}
                        </div>
                      </div>
                    ))}

                    {result.ai_matching.note_generali && (
                      <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded">
                        <div className="text-blue-400 text-sm">
                          📌 <strong>Note:</strong> {result.ai_matching.note_generali}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-red-400">
                <h3 className="text-xl font-bold mb-2">❌ Errore</h3>
                <p>{result.error}</p>
              </div>
            )}

            {/* Raw JSON */}
            <details className="mt-6">
              <summary className="cursor-pointer text-slate-400 hover:text-white">
                🔍 Vedi JSON completo
              </summary>
              <pre className="mt-4 p-4 bg-slate-950 rounded-lg overflow-x-auto text-xs text-slate-300">
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
