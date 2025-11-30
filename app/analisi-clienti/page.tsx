'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Calendar, TrendingUp, TrendingDown, DollarSign,
  ShoppingCart, Package, AlertCircle, Download, ArrowLeft,
  Loader2, FileBarChart, Sparkles, ChevronDown, ChevronUp
} from 'lucide-react';
import Link from 'next/link';

interface Cliente {
  id: number;
  name: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  customer_rank: number;
}

interface AnalisiData {
  cliente: Cliente;
  periodo: {
    inizio: string;
    fine: string;
  };
  statistiche: {
    totaleOrdinato: number;
    numeroOrdini: number;
    imponibileMedio: number;
    prodottiUnici: number;
    prodottiConVariazioni: number;
    righeOrdiniTotali: number;
  };
  topProdotti: any[];
  prodottiConPiuVariazioni: any[];
  simulazioneImpatti: any[];
  ordini: any[];
  prodotti: any[];
}

export default function AnalisiClientiPage() {
  const [clienti, setClienti] = useState<any[]>([]);
  const [loadingClienti, setLoadingClienti] = useState(true);
  const [selectedCliente, setSelectedCliente] = useState('');
  const [periodo, setPeriodo] = useState('year');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analisiData, setAnalisiData] = useState<AnalisiData | null>(null);
  const [error, setError] = useState('');
  const [showAIInsights, setShowAIInsights] = useState(false);
  const [aiInsights, setAiInsights] = useState('');
  const [generatingInsights, setGeneratingInsights] = useState(false);

  // Carica lista clienti
  useEffect(() => {
    fetch('/api/odoo/customers')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          // Ordina per customer_rank decrescente
          const sorted = data.customers.sort((a: any, b: any) =>
            (b.customer_rank || 0) - (a.customer_rank || 0)
          );
          setClienti(sorted);
        }
        setLoadingClienti(false);
      })
      .catch(err => {
        console.error('Errore caricamento clienti:', err);
        setLoadingClienti(false);
      });
  }, []);

  const getPeriodDates = () => {
    const now = new Date();
    let startDate = '';
    let endDate = now.toISOString().split('T')[0];

    switch (periodo) {
      case 'month':
        const oneMonthAgo = new Date(now);
        oneMonthAgo.setMonth(now.getMonth() - 1);
        startDate = oneMonthAgo.toISOString().split('T')[0];
        break;
      case 'quarter':
        const threeMonthsAgo = new Date(now);
        threeMonthsAgo.setMonth(now.getMonth() - 3);
        startDate = threeMonthsAgo.toISOString().split('T')[0];
        break;
      case 'year':
        startDate = `${now.getFullYear()}-01-01`;
        break;
      case 'custom':
        startDate = customStartDate;
        endDate = customEndDate;
        break;
      default:
        startDate = `${now.getFullYear()}-01-01`;
    }

    return { startDate, endDate };
  };

  const handleAnalizza = async () => {
    if (!selectedCliente) {
      setError('Seleziona un cliente');
      return;
    }

    const { startDate, endDate } = getPeriodDates();

    if (periodo === 'custom' && (!startDate || !endDate)) {
      setError('Inserisci date valide');
      return;
    }

    setError('');
    setAnalyzing(true);
    setAnalisiData(null);
    setAiInsights('');
    setShowAIInsights(false);

    try {
      const response = await fetch('/api/analisi-clienti', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: selectedCliente,
          startDate,
          endDate
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore durante l\'analisi');
      }

      setAnalisiData(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const generateAIInsights = async () => {
    if (!analisiData) return;

    setGeneratingInsights(true);
    setShowAIInsights(true);

    // Simula generazione insights con AI (puoi integrare con OpenAI/Claude API)
    setTimeout(() => {
      const insights = generateInsightsText(analisiData);
      setAiInsights(insights);
      setGeneratingInsights(false);
    }, 1500);
  };

  const generateInsightsText = (data: AnalisiData): string => {
    const { statistiche, topProdotti, prodottiConPiuVariazioni } = data;

    let text = `## Sommario Esecutivo\n\n`;
    text += `Il cliente **${data.cliente.name}** ha generato un fatturato di **CHF ${statistiche.totaleOrdinato.toLocaleString()}** con **${statistiche.numeroOrdini} ordini** nel periodo analizzato.\n\n`;

    text += `### Insights Chiave\n\n`;

    // Ordine medio
    const ordineMedio = statistiche.totaleOrdinato / statistiche.numeroOrdini;
    text += `- **Ordine medio**: CHF ${ordineMedio.toFixed(2)} (${statistiche.numeroOrdini} ordini)\n`;

    // Prodotti
    text += `- **Prodotti ordinati**: ${statistiche.prodottiUnici} prodotti unici (${statistiche.righeOrdiniTotali} righe totali)\n`;
    text += `- **Variazioni prezzo**: ${statistiche.prodottiConVariazioni} prodotti (${((statistiche.prodottiConVariazioni / statistiche.prodottiUnici) * 100).toFixed(1)}% del totale)\n\n`;

    // Top prodotti
    if (topProdotti.length > 0) {
      text += `### Top 3 Prodotti\n\n`;
      topProdotti.slice(0, 3).forEach((p, i) => {
        const pct = (p.subtotale / statistiche.totaleOrdinato * 100).toFixed(1);
        text += `${i + 1}. **${p.product_name}**: CHF ${p.subtotale.toFixed(2)} (${pct}% del totale)\n`;
        if (p.num_variazioni > 0) {
          const variazione = ((p.prezzo_ultimo - p.prezzo_primo) / p.prezzo_primo * 100);
          text += `   - ${p.num_variazioni} variazioni di prezzo (${variazione > 0 ? '+' : ''}${variazione.toFixed(1)}%)\n`;
        }
      });
      text += `\n`;
    }

    // Prodotti con variazioni significative
    if (prodottiConPiuVariazioni.length > 0) {
      text += `### Variazioni Prezzo Significative\n\n`;
      const prodottiConGrandiVariazioni = prodottiConPiuVariazioni.filter(p => {
        const variazionePct = Math.abs((p.prezzo_ultimo - p.prezzo_primo) / p.prezzo_primo * 100);
        return variazionePct > 10 || p.num_variazioni > 5;
      }).slice(0, 3);

      if (prodottiConGrandiVariazioni.length > 0) {
        text += `⚠️ **Attenzione**: I seguenti prodotti hanno avuto variazioni significative:\n\n`;
        prodottiConGrandiVariazioni.forEach(p => {
          const variazionePct = ((p.prezzo_ultimo - p.prezzo_primo) / p.prezzo_primo * 100);
          text += `- **${p.product_name}**: ${p.num_variazioni} variazioni, ${variazionePct > 0 ? '+' : ''}${variazionePct.toFixed(1)}% (da CHF ${p.prezzo_primo.toFixed(2)} a CHF ${p.prezzo_ultimo.toFixed(2)})\n`;
        });
        text += `\n`;
      }
    }

    // Raccomandazioni
    text += `### Raccomandazioni\n\n`;

    // Raccomandazione prezzi
    if (statistiche.prodottiConVariazioni > statistiche.prodottiUnici * 0.3) {
      text += `1. **Stabilizzazione prezzi**: ${statistiche.prodottiConVariazioni} prodotti hanno subito variazioni. Considera contratti a prezzo fisso sui top prodotti per migliorare la prevedibilità.\n`;
    }

    // Raccomandazione volume
    const top3Pct = topProdotti.slice(0, 3).reduce((sum, p) => sum + (p.subtotale / statistiche.totaleOrdinato * 100), 0);
    if (top3Pct > 40) {
      text += `2. **Concentrazione prodotti**: I primi 3 prodotti rappresentano il ${top3Pct.toFixed(1)}% del fatturato. Opportunità di diversificazione o di sconti volume.\n`;
    }

    // Raccomandazione ordini
    if (ordineMedio < 250) {
      text += `3. **Incremento ordine medio**: L'ordine medio (CHF ${ordineMedio.toFixed(2)}) è relativamente basso. Proponi bundle o soglie di spesa minima con incentivi.\n`;
    }

    // Raccomandazione upselling
    if (statistiche.prodottiUnici < 30) {
      text += `4. **Opportunità upselling**: Il cliente ordina solo ${statistiche.prodottiUnici} prodotti. Identifica prodotti complementari da proporre.\n`;
    }

    return text;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <div className="sticky top-0 z-50 backdrop-blur-xl bg-slate-900/80 border-b border-purple-500/20">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/super-dashboard">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-all"
                >
                  <ArrowLeft className="w-5 h-5" />
                  Indietro
                </motion.button>
              </Link>

              <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                  <FileBarChart className="w-8 h-8 text-blue-400" />
                  Analisi Clienti
                </h1>
                <p className="text-slate-300 text-sm mt-1">
                  Analisi ordini, prezzi e variazioni per cliente
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto px-6 py-6 space-y-6">
        {/* Form Selezione */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Dropdown Cliente */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Seleziona Cliente
              </label>
              <div className="relative">
                <select
                  value={selectedCliente}
                  onChange={(e) => setSelectedCliente(e.target.value)}
                  disabled={loadingClienti}
                  className="w-full bg-slate-700 text-white border border-slate-600 rounded-lg px-4 py-3 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 appearance-none"
                >
                  <option value="">
                    {loadingClienti ? 'Caricamento...' : 'Seleziona un cliente'}
                  </option>
                  {clienti.map(c => (
                    <option key={c.id} value={c.name}>
                      {c.name} {c.city ? `(${c.city})` : ''}
                    </option>
                  ))}
                </select>
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Periodo */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Periodo
              </label>
              <select
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
                className="w-full bg-slate-700 text-white border border-slate-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="month">Ultimo Mese</option>
                <option value="quarter">Ultimo Trimestre</option>
                <option value="year">Anno Corrente</option>
                <option value="custom">Periodo Personalizzato</option>
              </select>
            </div>

            {/* Pulsante Analizza */}
            <div className="flex items-end">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleAnalizza}
                disabled={analyzing || !selectedCliente}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold py-3 px-6 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Analizzando...
                  </>
                ) : (
                  <>
                    <FileBarChart className="w-5 h-5" />
                    Analizza
                  </>
                )}
              </motion.button>
            </div>
          </div>

          {/* Date personalizzate */}
          {periodo === 'custom' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="grid grid-cols-2 gap-4 mt-4"
            >
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Data Inizio
                </label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full bg-slate-700 text-white border border-slate-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Data Fine
                </label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full bg-slate-700 text-white border border-slate-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </motion.div>
          )}

          {/* Errore */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg flex items-center gap-2"
            >
              <AlertCircle className="w-5 h-5" />
              {error}
            </motion.div>
          )}
        </motion.div>

        {/* Risultati */}
        <AnimatePresence>
          {analisiData && (
            <>
              {/* KPI Cards */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
              >
                {/* Totale Ordinato */}
                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-6 text-white">
                  <div className="flex items-center justify-between mb-2">
                    <DollarSign className="w-8 h-8" />
                  </div>
                  <h3 className="text-sm opacity-80 mb-1">Totale Ordinato</h3>
                  <div className="text-3xl font-bold">
                    CHF {analisiData.statistiche.totaleOrdinato.toLocaleString()}
                  </div>
                  <p className="text-xs opacity-70 mt-1">
                    {analisiData.periodo.inizio} - {analisiData.periodo.fine}
                  </p>
                </div>

                {/* Numero Ordini */}
                <div className="bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl p-6 text-white">
                  <div className="flex items-center justify-between mb-2">
                    <ShoppingCart className="w-8 h-8" />
                  </div>
                  <h3 className="text-sm opacity-80 mb-1">Numero Ordini</h3>
                  <div className="text-3xl font-bold">
                    {analisiData.statistiche.numeroOrdini}
                  </div>
                  <p className="text-xs opacity-70 mt-1">
                    Media: CHF {analisiData.statistiche.imponibileMedio.toFixed(2)}
                  </p>
                </div>

                {/* Prodotti Unici */}
                <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl p-6 text-white">
                  <div className="flex items-center justify-between mb-2">
                    <Package className="w-8 h-8" />
                  </div>
                  <h3 className="text-sm opacity-80 mb-1">Prodotti Unici</h3>
                  <div className="text-3xl font-bold">
                    {analisiData.statistiche.prodottiUnici}
                  </div>
                  <p className="text-xs opacity-70 mt-1">
                    {analisiData.statistiche.righeOrdiniTotali} righe totali
                  </p>
                </div>

                {/* Variazioni Prezzo */}
                <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-xl p-6 text-white">
                  <div className="flex items-center justify-between mb-2">
                    <TrendingUp className="w-8 h-8" />
                  </div>
                  <h3 className="text-sm opacity-80 mb-1">Variazioni Prezzo</h3>
                  <div className="text-3xl font-bold">
                    {analisiData.statistiche.prodottiConVariazioni}
                  </div>
                  <p className="text-xs opacity-70 mt-1">
                    {((analisiData.statistiche.prodottiConVariazioni / analisiData.statistiche.prodottiUnici) * 100).toFixed(1)}% dei prodotti
                  </p>
                </div>
              </motion.div>

              {/* AI Insights */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="bg-gradient-to-br from-indigo-900/50 to-purple-900/50 backdrop-blur-sm rounded-2xl p-6 border border-indigo-500/30"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                    <Sparkles className="w-7 h-7 text-yellow-400" />
                    AI Insights
                  </h2>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={generateAIInsights}
                    disabled={generatingInsights}
                    className="bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white font-semibold py-2 px-4 rounded-lg transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {generatingInsights ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generando...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Genera Insights
                      </>
                    )}
                  </motion.button>
                </div>

                {showAIInsights && (
                  <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                    {generatingInsights ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                      </div>
                    ) : (
                      <div className="prose prose-invert max-w-none">
                        <pre className="whitespace-pre-wrap text-slate-200 font-sans text-sm leading-relaxed">
                          {aiInsights}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>

              {/* Top Prodotti */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20"
              >
                <h2 className="text-2xl font-bold text-white mb-4">Top 10 Prodotti</h2>
                <div className="space-y-3">
                  {analisiData.topProdotti.map((p, i) => {
                    const pct = (p.subtotale / analisiData.statistiche.totaleOrdinato * 100);
                    const variazione = p.num_variazioni > 0 ? ((p.prezzo_ultimo - p.prezzo_primo) / p.prezzo_primo * 100) : 0;

                    return (
                      <div key={p.product_id} className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                                {i + 1}
                              </div>
                              <div>
                                <h3 className="text-white font-semibold">{p.product_name}</h3>
                                <p className="text-slate-400 text-xs">
                                  {p.num_ordini} ordini • {p.qty_totale} pezzi
                                </p>
                              </div>
                            </div>
                            {p.num_variazioni > 0 && (
                              <div className="ml-11 text-xs text-slate-300">
                                {p.num_variazioni} variazioni: CHF {p.prezzo_min.toFixed(2)} - {p.prezzo_max.toFixed(2)}
                                <span className={`ml-2 ${variazione >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                  ({variazione > 0 ? '+' : ''}{variazione.toFixed(1)}%)
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="text-white font-bold text-lg">
                              CHF {p.subtotale.toFixed(2)}
                            </div>
                            <div className="text-slate-400 text-xs">
                              {pct.toFixed(1)}% del totale
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>

              {/* Simulazione Impatti */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20"
              >
                <h2 className="text-2xl font-bold text-white mb-4">Simulazione Impatto Variazioni Prezzi</h2>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  {analisiData.simulazioneImpatti.map((sim, i) => (
                    <div
                      key={i}
                      className={`rounded-xl p-4 border ${
                        sim.percentuale === 0
                          ? 'bg-blue-500/20 border-blue-500/50'
                          : sim.percentuale < 0
                          ? 'bg-red-500/20 border-red-500/50'
                          : 'bg-green-500/20 border-green-500/50'
                      }`}
                    >
                      <div className={`text-sm font-medium mb-1 ${
                        sim.percentuale === 0 ? 'text-blue-300' :
                        sim.percentuale < 0 ? 'text-red-300' : 'text-green-300'
                      }`}>
                        {sim.scenario}
                      </div>
                      <div className="text-white font-bold text-xl">
                        CHF {sim.nuovo_totale.toFixed(0)}
                      </div>
                      {sim.percentuale !== 0 && (
                        <div className={`text-xs mt-1 ${
                          sim.percentuale < 0 ? 'text-red-200' : 'text-green-200'
                        }`}>
                          {sim.differenza > 0 ? '+' : ''}{sim.differenza.toFixed(0)} CHF
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
