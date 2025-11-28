'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Calculator, ArrowLeft, TrendingUp, TrendingDown, Target, AlertTriangle, CheckCircle } from 'lucide-react';
import Link from 'next/link';

// Livelli di fatturato disponibili
const REVENUE_LEVELS = [200000, 250000, 300000, 350000, 400000, 500000];

// Calcola il budget per un dato fatturato
function calculateBudget(revenue: number, marginPercent: number) {
  const costoMerci = revenue * (1 - marginPercent / 100);
  const margineLordo = revenue - costoMerci;

  // Scala i salari in base al fatturato
  let salari: number;
  if (revenue <= 200000) salari = 38000;
  else if (revenue <= 250000) salari = 45000;
  else if (revenue <= 300000) salari = 48000;
  else if (revenue <= 350000) salari = 52000;
  else if (revenue <= 400000) salari = 55000;
  else salari = 65000;

  const contributi = salari * 0.10;
  const spesePasti = Math.round(400 + (revenue - 200000) / 50000 * 100);

  // Costi fissi
  const affitto = 11650;
  const leasing = 3550;

  // Costi variabili (scalano con il fatturato)
  const energia = Math.round(1500 + (revenue - 200000) / 100000 * 500);
  const telefonoInternet = 750;
  const assicurazioniMezzi = revenue <= 200000 ? 1500 : 2100;
  const manutenzioneMezzi = Math.round(300 + (revenue - 200000) / 100000 * 200);
  const oneriBancari = Math.round(revenue * 0.01);
  const carburante = Math.round(2000 + (revenue - 200000) / 100000 * 1300);
  const costiInformatici = Math.round(800 + (revenue - 200000) / 150000 * 300);
  const marketing = revenue <= 200000 ? 0 : Math.round((revenue - 200000) / 100000 * 500);
  const altriCosti = Math.round(2000 + (revenue - 200000) / 100000 * 1500);

  const totalePersonale = salari + contributi + spesePasti;
  const totaleAltriCosti = affitto + leasing + energia + telefonoInternet + assicurazioniMezzi +
    manutenzioneMezzi + oneriBancari + carburante + costiInformatici + marketing + altriCosti;

  const totaleCosti = totalePersonale + totaleAltriCosti;
  const ebitda = margineLordo - totaleCosti;

  return {
    revenue,
    marginPercent,
    costoMerci,
    margineLordo,
    salari,
    contributi,
    spesePasti,
    totalePersonale,
    affitto,
    leasing,
    energia,
    telefonoInternet,
    assicurazioniMezzi,
    manutenzioneMezzi,
    oneriBancari,
    carburante,
    costiInformatici,
    marketing,
    altriCosti,
    totaleAltriCosti,
    totaleCosti,
    ebitda,
  };
}

function formatCHF(value: number): string {
  return new Intl.NumberFormat('de-CH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function BudgetPage() {
  const [selectedRevenue, setSelectedRevenue] = useState<number>(300000);

  const budgetAttuale = calculateBudget(selectedRevenue, 33);
  const budgetTarget = calculateBudget(selectedRevenue, 35);

  const rows = [
    { label: 'Fatturato', attuale: selectedRevenue, target: selectedRevenue, isHeader: true, icon: '💰' },
    { label: 'Costo Merci', attuale: -budgetAttuale.costoMerci, target: -budgetTarget.costoMerci, percent: true },
    { label: 'Margine Lordo', attuale: budgetAttuale.margineLordo, target: budgetTarget.margineLordo, isSubtotal: true, icon: '📊' },
    { label: '', attuale: 0, target: 0, isSpacer: true },
    { label: 'COSTI DEL PERSONALE', attuale: 0, target: 0, isSectionHeader: true },
    { label: 'Salari', attuale: -budgetAttuale.salari, target: -budgetTarget.salari },
    { label: 'Contributi sociali (10%)', attuale: -budgetAttuale.contributi, target: -budgetTarget.contributi },
    { label: 'Spese pasti e alberghi', attuale: -budgetAttuale.spesePasti, target: -budgetTarget.spesePasti },
    { label: 'Totale Personale', attuale: -budgetAttuale.totalePersonale, target: -budgetTarget.totalePersonale, isSubtotal: true },
    { label: '', attuale: 0, target: 0, isSpacer: true },
    { label: 'ALTRI COSTI D\'ESERCIZIO', attuale: 0, target: 0, isSectionHeader: true },
    { label: 'Affitto locali', attuale: -budgetAttuale.affitto, target: -budgetTarget.affitto, isFixed: true },
    { label: 'Leasing auto', attuale: -budgetAttuale.leasing, target: -budgetTarget.leasing, isFixed: true },
    { label: 'Energia', attuale: -budgetAttuale.energia, target: -budgetTarget.energia },
    { label: 'Telefono e Internet', attuale: -budgetAttuale.telefonoInternet, target: -budgetTarget.telefonoInternet },
    { label: 'Assicurazioni mezzi', attuale: -budgetAttuale.assicurazioniMezzi, target: -budgetTarget.assicurazioniMezzi },
    { label: 'Manutenzione mezzi', attuale: -budgetAttuale.manutenzioneMezzi, target: -budgetTarget.manutenzioneMezzi },
    { label: 'Oneri bancari (~1%)', attuale: -budgetAttuale.oneriBancari, target: -budgetTarget.oneriBancari },
    { label: 'Carburante', attuale: -budgetAttuale.carburante, target: -budgetTarget.carburante },
    { label: 'Costi informatici', attuale: -budgetAttuale.costiInformatici, target: -budgetTarget.costiInformatici },
    { label: 'Marketing', attuale: -budgetAttuale.marketing, target: -budgetTarget.marketing },
    { label: 'Altri costi', attuale: -budgetAttuale.altriCosti, target: -budgetTarget.altriCosti },
    { label: 'Totale Altri Costi', attuale: -budgetAttuale.totaleAltriCosti, target: -budgetTarget.totaleAltriCosti, isSubtotal: true },
    { label: '', attuale: 0, target: 0, isSpacer: true },
    { label: 'TOTALE COSTI OPERATIVI', attuale: -budgetAttuale.totaleCosti, target: -budgetTarget.totaleCosti, isTotal: true },
    { label: '', attuale: 0, target: 0, isSpacer: true },
    { label: 'EBITDA', attuale: budgetAttuale.ebitda, target: budgetTarget.ebitda, isEbitda: true, icon: '🎯' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="sticky top-0 z-50 backdrop-blur-xl bg-slate-900/80 border-b border-emerald-500/20"
      >
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
                  <span>Dashboard</span>
                </motion.button>
              </Link>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <Calculator className="w-8 h-8 text-emerald-400" />
                Budget Planner
              </h1>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                <span className="text-slate-300">Attuale (33%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                <span className="text-slate-300">Target (35%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-slate-500"></div>
                <span className="text-slate-300">Costo Fisso</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="max-w-[1800px] mx-auto px-6 py-6 space-y-6">

        {/* Revenue Selector Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 shadow-xl"
        >
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Target className="w-6 h-6 text-emerald-400" />
            Seleziona Fatturato Mensile
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {REVENUE_LEVELS.map((revenue) => {
              const budget = calculateBudget(revenue, 33);
              const isSelected = selectedRevenue === revenue;
              const isProfitable = budget.ebitda > 0;

              return (
                <motion.button
                  key={revenue}
                  whileHover={{ scale: 1.05, y: -4 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedRevenue(revenue)}
                  className={`relative p-6 rounded-xl border-2 transition-all ${
                    isSelected
                      ? 'bg-gradient-to-br from-emerald-600 to-teal-700 border-emerald-400 shadow-lg shadow-emerald-500/30'
                      : 'bg-slate-800/60 border-slate-600 hover:border-slate-500'
                  }`}
                >
                  <div className={`text-2xl font-bold ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                    CHF {(revenue / 1000).toFixed(0)}k
                  </div>
                  <div className={`text-sm mt-2 flex items-center gap-1 ${
                    isProfitable ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {isProfitable ? (
                      <>
                        <TrendingUp className="w-4 h-4" />
                        +{formatCHF(budget.ebitda)}
                      </>
                    ) : (
                      <>
                        <TrendingDown className="w-4 h-4" />
                        {formatCHF(budget.ebitda)}
                      </>
                    )}
                  </div>
                  {isSelected && (
                    <motion.div
                      layoutId="selectedIndicator"
                      className="absolute -top-2 -right-2 w-6 h-6 bg-emerald-400 rounded-full flex items-center justify-center"
                    >
                      <CheckCircle className="w-4 h-4 text-slate-900" />
                    </motion.div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* Summary Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <div className="bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl p-6 shadow-xl">
            <div className="text-white/80 text-sm font-medium mb-1">Fatturato</div>
            <div className="text-3xl font-bold text-white">CHF {formatCHF(selectedRevenue)}</div>
            <p className="text-white/60 text-xs mt-2">Fatturato mensile selezionato</p>
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl p-6 shadow-xl">
            <div className="text-white/80 text-sm font-medium mb-1">Margine Attuale (33%)</div>
            <div className="text-3xl font-bold text-white">CHF {formatCHF(budgetAttuale.margineLordo)}</div>
            <p className="text-white/60 text-xs mt-2">Costo merci 67%</p>
          </div>

          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-6 shadow-xl">
            <div className="text-white/80 text-sm font-medium mb-1">Margine Target (35%)</div>
            <div className="text-3xl font-bold text-white">CHF {formatCHF(budgetTarget.margineLordo)}</div>
            <p className="text-white/60 text-xs mt-2">Costo merci 65%</p>
          </div>

          <div className={`bg-gradient-to-br ${
            budgetTarget.ebitda > 0
              ? 'from-green-500 to-emerald-600'
              : 'from-red-500 to-rose-600'
          } rounded-xl p-6 shadow-xl`}>
            <div className="text-white/80 text-sm font-medium mb-1">EBITDA Target</div>
            <div className="text-3xl font-bold text-white">CHF {formatCHF(budgetTarget.ebitda)}</div>
            <p className="text-white/60 text-xs mt-2">
              {budgetTarget.ebitda > 0 ? 'Profitto' : 'Perdita'} previsto con 35% margine
            </p>
          </div>
        </motion.div>

        {/* Improvement Box */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-gradient-to-r from-purple-600/30 to-pink-600/30 rounded-xl p-6 border border-purple-500/30"
        >
          <div className="flex items-start gap-4">
            <div className="bg-purple-500 rounded-full p-3">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-2">
                Miglioramento potenziale con Target 35%
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-slate-400">Margine extra: </span>
                  <span className="text-emerald-400 font-bold">
                    +CHF {formatCHF(budgetTarget.margineLordo - budgetAttuale.margineLordo)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">EBITDA migliora di: </span>
                  <span className="text-emerald-400 font-bold">
                    +CHF {formatCHF(budgetTarget.ebitda - budgetAttuale.ebitda)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">% EBITDA su fatturato: </span>
                  <span className="text-emerald-400 font-bold">
                    {((budgetTarget.ebitda / selectedRevenue) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Budget Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 shadow-xl"
        >
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <Calculator className="w-6 h-6 text-emerald-400" />
            Dettaglio Budget per CHF {formatCHF(selectedRevenue)}
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-slate-600">
                  <th className="text-left text-slate-300 pb-4 px-4 font-semibold">VOCE</th>
                  <th className="text-right text-orange-400 pb-4 px-4 font-semibold">
                    ATTUALE (33%)
                  </th>
                  <th className="text-right text-emerald-400 pb-4 px-4 font-semibold">
                    TARGET (35%)
                  </th>
                  <th className="text-right text-purple-400 pb-4 px-4 font-semibold">
                    DIFFERENZA
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  if (row.isSpacer) {
                    return <tr key={index} className="h-4"><td colSpan={4}></td></tr>;
                  }

                  if (row.isSectionHeader) {
                    return (
                      <tr key={index} className="bg-slate-700/30">
                        <td colSpan={4} className="py-3 px-4 text-slate-400 font-bold text-sm">
                          {row.label}
                        </td>
                      </tr>
                    );
                  }

                  const diff = row.target - row.attuale;
                  const isPositiveDiff = diff > 0;

                  return (
                    <motion.tr
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.02 * index }}
                      className={`border-b transition-colors ${
                        row.isHeader ? 'border-slate-500 bg-blue-600/20' :
                        row.isSubtotal ? 'border-slate-500 bg-slate-700/30' :
                        row.isTotal ? 'border-slate-500 bg-red-600/20' :
                        row.isEbitda ? 'border-slate-400 bg-gradient-to-r from-emerald-600/30 to-teal-600/30' :
                        'border-slate-700/50 hover:bg-slate-700/30'
                      }`}
                    >
                      <td className={`py-3 px-4 ${
                        row.isHeader || row.isSubtotal || row.isTotal || row.isEbitda
                          ? 'text-white font-bold'
                          : 'text-slate-300'
                      }`}>
                        <div className="flex items-center gap-2">
                          {row.icon && <span>{row.icon}</span>}
                          {row.label}
                          {row.isFixed && (
                            <span className="text-xs bg-slate-600 text-slate-300 px-2 py-0.5 rounded">
                              FISSO
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={`py-3 px-4 text-right font-mono ${
                        row.isHeader ? 'text-white font-bold' :
                        row.isEbitda ? (row.attuale >= 0 ? 'text-green-400 font-bold text-lg' : 'text-red-400 font-bold text-lg') :
                        row.isSubtotal || row.isTotal ? 'text-orange-300 font-bold' :
                        row.attuale < 0 ? 'text-orange-400' : 'text-slate-300'
                      }`}>
                        {row.attuale !== 0 ? `CHF ${formatCHF(Math.abs(row.attuale))}` : '-'}
                        {row.attuale < 0 && row.attuale !== 0 && !row.isHeader && (
                          <span className="text-slate-500 text-xs ml-1">-</span>
                        )}
                      </td>
                      <td className={`py-3 px-4 text-right font-mono ${
                        row.isHeader ? 'text-white font-bold' :
                        row.isEbitda ? (row.target >= 0 ? 'text-green-400 font-bold text-lg' : 'text-red-400 font-bold text-lg') :
                        row.isSubtotal || row.isTotal ? 'text-emerald-300 font-bold' :
                        row.target < 0 ? 'text-emerald-400' : 'text-slate-300'
                      }`}>
                        {row.target !== 0 ? `CHF ${formatCHF(Math.abs(row.target))}` : '-'}
                        {row.target < 0 && row.target !== 0 && !row.isHeader && (
                          <span className="text-slate-500 text-xs ml-1">-</span>
                        )}
                      </td>
                      <td className={`py-3 px-4 text-right font-mono ${
                        row.isHeader || row.isSectionHeader ? '' :
                        isPositiveDiff ? 'text-green-400' : diff < 0 ? 'text-red-400' : 'text-slate-500'
                      }`}>
                        {diff !== 0 && !row.isHeader ? (
                          <span className="flex items-center justify-end gap-1">
                            {isPositiveDiff ? '+' : ''}{formatCHF(diff)}
                          </span>
                        ) : '-'}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Recommendations */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 shadow-xl"
        >
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-yellow-400" />
            Raccomandazioni
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-700/30 rounded-lg p-4">
              <h3 className="text-emerald-400 font-semibold mb-2">Per raggiungere il Target 35%:</h3>
              <ul className="text-slate-300 text-sm space-y-2">
                <li>• Negozia migliori prezzi con i fornitori</li>
                <li>• Riduci gli sprechi e le perdite di magazzino</li>
                <li>• Aumenta i prezzi sui prodotti premium</li>
                <li>• Ottimizza il mix prodotti venduti</li>
              </ul>
            </div>
            <div className="bg-slate-700/30 rounded-lg p-4">
              <h3 className="text-orange-400 font-semibold mb-2">Fatturato minimo consigliato:</h3>
              <div className="text-slate-300 text-sm space-y-2">
                <p>Con margine 33%: <span className="text-orange-400 font-bold">CHF 280.000+</span></p>
                <p>Con margine 35%: <span className="text-emerald-400 font-bold">CHF 250.000+</span></p>
                <p className="text-slate-400 mt-2">
                  Sotto questi livelli rischi di andare in perdita.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="max-w-[1800px] mx-auto px-6 py-8 mt-12 text-center text-slate-400 text-sm"
      >
        <p>
          Budget Planner • LAPA Finest Italian Food •
          Powered by Claude AI
        </p>
      </motion.div>
    </div>
  );
}
