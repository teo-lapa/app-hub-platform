import { useState } from 'react';

interface AdvancedDashboardProps {
  client: any;
  onClose: () => void;
}

export function AdvancedDashboard({ client, onClose }: AdvancedDashboardProps) {
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiResults, setAiResults] = useState<any>(null);
  const [showNotes, setShowNotes] = useState(false);

  const runAIAnalysis = () => {
    setAiAnalyzing(true);
    // Simula analisi AI
    setTimeout(() => {
      setAiResults({
        insights: [
          'Trend di crescita positivo negli ultimi 3 mesi',
          'Alta fedeltà del cliente con ordini regolari',
          'Opportunità di upselling su categoria premium'
        ],
        recommendations: [
          'Proponi piano abbonamento mensile',
          'Offri sconto volume su ordini >CHF 5000',
          'Pianifica visita commerciale entro 2 settimane'
        ],
        opportunities: [
          'Cross-selling: prodotti complementari',
          'Espansione a nuove linee di prodotto',
          'Referral program per nuovi clienti'
        ]
      });
      setAiAnalyzing(false);
    }, 2000);
  };

  // Dati simulati per i grafici
  const weeklyRevenueData = [1200, 1500, 1800, 1400, 2000, 1700, 1900];
  const weeklyOrdersData = [8, 10, 12, 9, 13, 11, 12];
  const weekDays = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

  const topProducts = [
    { name: 'Prodotto A', quantity: 45, revenue: 2250 },
    { name: 'Prodotto B', quantity: 32, revenue: 1920 },
    { name: 'Prodotto C', quantity: 28, revenue: 1680 }
  ];

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6 rounded-t-2xl relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-2xl transition"
          >
            ✕
          </button>
          <h2 className="text-3xl font-bold">Dashboard Dettagliata</h2>
          <p className="opacity-90 mt-1">Analisi Avanzata Cliente - {client.name}</p>
        </div>

        <div className="p-6">
          {/* Analytics Section */}
          <div className="mb-8">
            <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              📊 Analytics Avanzati
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Weekly Revenue Chart */}
              <div className="bg-slate-50 p-5 rounded-xl">
                <h4 className="font-bold text-slate-700 mb-3">
                  📈 Andamento Settimanale - Valore Ordini
                </h4>
                <div className="flex items-end h-40 gap-2">
                  {weeklyRevenueData.map((value, index) => (
                    <div key={index} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition cursor-pointer"
                        style={{
                          height: `${(value / Math.max(...weeklyRevenueData)) * 100}%`
                        }}
                        title={`CHF ${value}`}
                      ></div>
                      <span className="text-xs text-slate-600">{weekDays[index]}</span>
                    </div>
                  ))}
                </div>
                <div className="text-sm text-slate-600 mt-3">
                  Media: CHF {Math.round(weeklyRevenueData.reduce((a, b) => a + b) / weeklyRevenueData.length)}
                </div>
              </div>

              {/* Weekly Orders Chart */}
              <div className="bg-slate-50 p-5 rounded-xl">
                <h4 className="font-bold text-slate-700 mb-3">
                  📊 Andamento Settimanale - Ordini
                </h4>
                <div className="flex items-end h-40 gap-2">
                  {weeklyOrdersData.map((value, index) => (
                    <div key={index} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full bg-emerald-500 rounded-t hover:bg-emerald-600 transition cursor-pointer"
                        style={{
                          height: `${(value / Math.max(...weeklyOrdersData)) * 100}%`
                        }}
                        title={`${value} ordini`}
                      ></div>
                      <span className="text-xs text-slate-600">{weekDays[index]}</span>
                    </div>
                  ))}
                </div>
                <div className="text-sm text-slate-600 mt-3">
                  Media: {Math.round(weeklyOrdersData.reduce((a, b) => a + b) / weeklyOrdersData.length)} ordini
                </div>
              </div>

              {/* Top Products */}
              <div className="bg-slate-50 p-5 rounded-xl">
                <h4 className="font-bold text-slate-700 mb-3">🛒 Top Prodotti (30gg)</h4>
                <div className="space-y-3">
                  {topProducts.map((product, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center p-3 bg-white rounded-lg"
                    >
                      <div>
                        <div className="font-semibold text-slate-800">{product.name}</div>
                        <div className="text-sm text-slate-600">{product.quantity} unità</div>
                      </div>
                      <div className="font-bold text-blue-600">
                        CHF {product.revenue.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Comparison */}
              <div className="bg-slate-50 p-5 rounded-xl">
                <h4 className="font-bold text-slate-700 mb-3">
                  📈 VS Altri Clienti del Team
                </h4>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Fatturato</span>
                      <span className="font-semibold">+25% sopra media</span>
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: '75%' }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Frequenza Ordini</span>
                      <span className="font-semibold">+10% sopra media</span>
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: '60%' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* AI Analysis Section */}
          <div className="mb-8">
            <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              🤖 Analisi AI Avanzata
            </h3>

            {!aiResults ? (
              <div className="text-center py-8">
                <button
                  onClick={runAIAnalysis}
                  disabled={aiAnalyzing}
                  className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-bold text-lg hover:shadow-lg transition disabled:opacity-50"
                >
                  {aiAnalyzing ? (
                    <>
                      <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                      Analizzando...
                    </>
                  ) : (
                    '🧠 Analizza con AI'
                  )}
                </button>
                <p className="text-slate-600 mt-3">
                  Clicca per analizzare cliente con AI
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 p-5 rounded-xl">
                  <h4 className="font-bold text-blue-900 mb-3">💡 Insights Intelligenti</h4>
                  <ul className="space-y-2">
                    {aiResults.insights.map((insight: string, index: number) => (
                      <li key={index} className="text-sm text-blue-800">
                        • {insight}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-emerald-50 p-5 rounded-xl">
                  <h4 className="font-bold text-emerald-900 mb-3">🎯 Raccomandazioni</h4>
                  <ul className="space-y-2">
                    {aiResults.recommendations.map((rec: string, index: number) => (
                      <li key={index} className="text-sm text-emerald-800">
                        • {rec}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-amber-50 p-5 rounded-xl">
                  <h4 className="font-bold text-amber-900 mb-3">🚀 Opportunità</h4>
                  <ul className="space-y-2">
                    {aiResults.opportunities.map((opp: string, index: number) => (
                      <li key={index} className="text-sm text-amber-800">
                        • {opp}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 justify-center">
            <button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition">
              📄 Esporta Report Completo
            </button>
            <button className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition">
              📅 Pianifica Follow-up
            </button>
            <button
              onClick={() => setShowNotes(!showNotes)}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition"
            >
              📝 {showNotes ? 'Nascondi' : 'Mostra'} Note Cliente
            </button>
          </div>

          {/* Notes Section */}
          {showNotes && (
            <div className="mt-6 bg-slate-50 p-5 rounded-xl">
              <h4 className="font-bold text-slate-800 mb-3">📝 Note Cliente</h4>
              <textarea
                className="w-full p-4 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition"
                rows={4}
                placeholder="Scrivi qui le tue note sul cliente..."
              ></textarea>
              <div className="flex gap-2 mt-3">
                <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition">
                  💾 Salva Note
                </button>
                <button className="px-4 py-2 bg-slate-300 hover:bg-slate-400 text-slate-700 rounded-lg font-semibold transition">
                  🔄 Ricarica
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
