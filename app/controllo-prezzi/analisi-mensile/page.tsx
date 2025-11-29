'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Lock,
  List,
  RefreshCw,
  Download,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Calculator,
  Users,
  Package,
  Layers,
  Search,
  ExternalLink,
  Percent
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { AppHeader } from '@/components/layout/AppHeader';
import { MonthlyAnalysisLine, MonthlyAnalysisStats, MonthlyAnalysisResponse } from '@/lib/types/monthly-analysis';
import toast from 'react-hot-toast';

export default function AnalisiMensilePage() {
  const router = useRouter();
  const { user } = useAuthStore();

  // Controllo accesso: SOLO Admin
  useEffect(() => {
    if (user && user.role !== 'admin') {
      toast.error('Accesso negato: questa app è disponibile solo per amministratori');
      router.push('/');
    }
  }, [user, router]);

  // State
  const [loading, setLoading] = useState(false);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [stats, setStats] = useState<MonthlyAnalysisStats | null>(null);
  const [fixedPriceLines, setFixedPriceLines] = useState<MonthlyAnalysisLine[]>([]);
  const [basePriceLines, setBasePriceLines] = useState<MonthlyAnalysisLine[]>([]);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [activeGroup, setActiveGroup] = useState<'fixed' | 'base'>('fixed');

  // UI state
  const [fixedExpanded, setFixedExpanded] = useState(true);
  const [baseExpanded, setBaseExpanded] = useState(true);
  const [filterDirection, setFilterDirection] = useState<'all' | 'higher' | 'lower'>('all');
  const [groupBy, setGroupBy] = useState<'none' | 'customer' | 'product'>('none');
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyDiscounted, setShowOnlyDiscounted] = useState(false);

  // Odoo URL for links
  const odooBaseUrl = process.env.NEXT_PUBLIC_ODOO_URL || 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';

  // Load data
  const loadData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/controllo-prezzi/analisi-mensile?month=${month}`, {
        credentials: 'include',
      });

      const data: MonthlyAnalysisResponse = await response.json();

      if (data.success) {
        setStats(data.stats);
        setFixedPriceLines(data.fixedPriceLines);
        setBasePriceLines(data.basePriceLines);
        setSelectedIds(new Set());
        toast.success(`Caricati ${data.stats.totalLines} prodotti`);
      } else {
        toast.error(data.error || 'Errore caricamento dati');
      }
    } catch (error: any) {
      toast.error('Errore: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [month]);

  // Filter lines by direction, search, and discount
  const filterLines = (lines: MonthlyAnalysisLine[]) => {
    let filtered = lines;

    // Filter by direction
    if (filterDirection !== 'all') {
      filtered = filtered.filter(l => l.direction === filterDirection);
    }

    // Filter by discount
    if (showOnlyDiscounted) {
      filtered = filtered.filter(l => l.discount > 0);
    }

    // Filter by search query
    if (searchQuery.length >= 2) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(l =>
        l.productName.toLowerCase().includes(query) ||
        l.productCode.toLowerCase().includes(query) ||
        l.customerName.toLowerCase().includes(query) ||
        l.orderName.toLowerCase().includes(query)
      );
    }

    return filtered;
  };

  const filteredFixedLines = useMemo(() => filterLines(fixedPriceLines), [fixedPriceLines, filterDirection, searchQuery, showOnlyDiscounted]);
  const filteredBaseLines = useMemo(() => filterLines(basePriceLines), [basePriceLines, filterDirection, searchQuery, showOnlyDiscounted]);

  // Group lines by customer or product
  type GroupedLines = { key: string; name: string; lines: MonthlyAnalysisLine[]; totalDiff: number; totalProfit: number }[];

  const groupLines = (lines: MonthlyAnalysisLine[]): GroupedLines => {
    if (groupBy === 'none') return [];

    const groupMap = new Map<string, { name: string; lines: MonthlyAnalysisLine[] }>();

    lines.forEach(line => {
      const key = groupBy === 'customer' ? String(line.customerId) : String(line.productId);
      const name = groupBy === 'customer' ? line.customerName : (line.productCode || line.productName);

      if (!groupMap.has(key)) {
        groupMap.set(key, { name, lines: [] });
      }
      groupMap.get(key)!.lines.push(line);
    });

    return Array.from(groupMap.entries())
      .map(([key, { name, lines }]) => ({
        key,
        name,
        lines,
        totalDiff: lines.reduce((sum, l) => sum + l.priceDiffCHF, 0),
        totalProfit: lines.reduce((sum, l) => sum + l.profitCHF, 0)
      }))
      .sort((a, b) => Math.abs(b.totalDiff) - Math.abs(a.totalDiff));
  };

  const groupedFixedLines = useMemo(() => groupLines(filteredFixedLines), [filteredFixedLines, groupBy]);
  const groupedBaseLines = useMemo(() => groupLines(filteredBaseLines), [filteredBaseLines, groupBy]);

  // Get current lines based on active group
  const currentLines = activeGroup === 'fixed' ? filteredFixedLines : filteredBaseLines;

  // Calculate selection average
  const selectionStats = useMemo(() => {
    if (selectedIds.size === 0) return null;

    const allLines = [...fixedPriceLines, ...basePriceLines];
    const selectedLines = allLines.filter(l => selectedIds.has(l.lineId));

    if (selectedLines.length === 0) return null;

    const sumPrice = selectedLines.reduce((sum, l) => sum + l.soldPrice, 0);
    const sumProfit = selectedLines.reduce((sum, l) => sum + l.profitCHF, 0);
    const avgPrice = sumPrice / selectedLines.length;

    return {
      count: selectedLines.length,
      avgPrice,
      totalProfit: sumProfit
    };
  }, [selectedIds, fixedPriceLines, basePriceLines]);

  // Toggle selection
  const toggleSelection = (lineId: number) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(lineId)) {
        newSet.delete(lineId);
      } else {
        newSet.add(lineId);
      }
      return newSet;
    });
  };

  // Select all in current group
  const selectAllInGroup = () => {
    const newSet = new Set(selectedIds);
    currentLines.forEach(l => newSet.add(l.lineId));
    setSelectedIds(newSet);
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  // Copy average to clipboard
  const copyAverageToClipboard = () => {
    if (selectionStats) {
      navigator.clipboard.writeText(selectionStats.avgPrice.toFixed(2));
      toast.success(`Copiato: CHF ${selectionStats.avgPrice.toFixed(2)}`);
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    const allLines = [...fixedPriceLines, ...basePriceLines];
    const linesToExport = selectedIds.size > 0
      ? allLines.filter(l => selectedIds.has(l.lineId))
      : allLines;

    const headers = [
      'Ordine', 'Data Consegna', 'Prodotto', 'Codice', 'Cliente',
      'Quantità', 'Prezzo Venduto', 'Prezzo Riferimento', 'Diff CHF', 'Diff %',
      'Costo', 'Profitto CHF', 'Margine %', 'Gruppo', 'Listino Riferimento'
    ];

    const rows = linesToExport.map(l => [
      l.orderName,
      l.commitmentDate,
      l.productName.replace(/,/g, ';'),
      l.productCode,
      l.customerName.replace(/,/g, ';'),
      l.quantity,
      l.soldPrice.toFixed(2),
      l.referencePrice.toFixed(2),
      l.priceDiffCHF.toFixed(2),
      l.priceDiffPercent.toFixed(2) + '%',
      l.costPrice.toFixed(2),
      l.profitCHF.toFixed(2),
      l.marginPercent.toFixed(2) + '%',
      l.priceGroup === 'fixed' ? 'Prezzo Fisso' : 'Listino Base',
      l.referencePricelistName.replace(/,/g, ';')
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `analisi-prezzi-${month}.csv`;
    a.click();

    toast.success(`Esportati ${linesToExport.length} prodotti`);
  };

  // Format month for display
  const formatMonth = (monthStr: string) => {
    const [year, m] = monthStr.split('-');
    const months = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
      'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
    return `${months[parseInt(m) - 1]} ${year}`;
  };

  // Generate month options (last 12 months)
  const monthOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      options.push({ value, label: formatMonth(value) });
    }
    return options;
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <AppHeader
        title="Analisi Prezzi Mensile"
        showBackButton
        onBack={() => router.push('/controllo-prezzi')}
      />

      <main className="max-w-7xl mx-auto px-4 py-6 pb-32">
        {/* Controls Bar */}
        <div className="glass rounded-2xl p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            {/* Month Selector */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-400">Mese:</label>
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {monthOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Direction Filter */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilterDirection('all')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filterDirection === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                Tutti
              </button>
              <button
                onClick={() => setFilterDirection('higher')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
                  filterDirection === 'higher'
                    ? 'bg-green-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                <TrendingUp className="w-4 h-4" /> Sopra
              </button>
              <button
                onClick={() => setFilterDirection('lower')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
                  filterDirection === 'lower'
                    ? 'bg-red-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                <TrendingDown className="w-4 h-4" /> Sotto
              </button>
            </div>

            {/* Divider */}
            <div className="h-8 w-px bg-slate-600 hidden lg:block" />

            {/* Group By */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400 hidden sm:inline">Raggruppa:</span>
              <button
                onClick={() => setGroupBy(groupBy === 'none' ? 'customer' : groupBy === 'customer' ? 'product' : 'none')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
                  groupBy !== 'none'
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {groupBy === 'none' && <><Layers className="w-4 h-4" /> Nessuno</>}
                {groupBy === 'customer' && <><Users className="w-4 h-4" /> Cliente</>}
                {groupBy === 'product' && <><Package className="w-4 h-4" /> Prodotto</>}
              </button>
            </div>

            {/* Discount Filter */}
            <button
              onClick={() => setShowOnlyDiscounted(!showOnlyDiscounted)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
                showOnlyDiscounted
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <Percent className="w-4 h-4" />
              {showOnlyDiscounted ? 'Con Sconto' : 'Sconto'}
            </button>

            <div className="flex-1" />

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Cerca prodotto, cliente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 w-48 lg:w-64"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Actions */}
            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Aggiorna
            </button>

            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white transition-colors"
            >
              <Download className="w-4 h-4" />
              Esporta CSV
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="glass rounded-xl p-4 border-l-4 border-blue-500">
              <div className="text-3xl font-bold text-blue-400">{stats.totalLines}</div>
              <div className="text-sm text-slate-400">Prodotti Totali</div>
            </div>

            <div className="glass rounded-xl p-4 border-l-4 border-green-500">
              <div className="text-3xl font-bold text-green-400">
                +CHF {(stats.fixedTotalDiffCHF + stats.baseTotalDiffCHF).toFixed(0)}
              </div>
              <div className="text-sm text-slate-400">Delta Totale</div>
            </div>

            <div className="glass rounded-xl p-4 border-l-4 border-yellow-500">
              <div className="text-3xl font-bold text-yellow-400">
                CHF {stats.totalProfitCHF.toFixed(0)}
              </div>
              <div className="text-sm text-slate-400">Profitto Totale</div>
            </div>

            <div className="glass rounded-xl p-4 border-l-4 border-purple-500">
              <div className="text-3xl font-bold text-purple-400">
                {stats.averageMarginPercent.toFixed(1)}%
              </div>
              <div className="text-sm text-slate-400">Margine Medio</div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : (
          <>
            {/* GROUP 1: Fixed Prices */}
            <div className="glass rounded-2xl mb-6 overflow-hidden">
              <button
                onClick={() => setFixedExpanded(!fixedExpanded)}
                className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-blue-600/20 to-blue-500/10 hover:from-blue-600/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Lock className="w-5 h-5 text-blue-400" />
                  <span className="text-lg font-bold text-white">
                    PREZZI BLOCCATI ({stats?.fixedPriceCount || 0})
                  </span>
                  <span className="text-sm text-slate-400">
                    Sopra: <span className="text-green-400">{stats?.fixedHigherCount || 0}</span> |
                    Sotto: <span className="text-red-400">{stats?.fixedLowerCount || 0}</span> |
                    Delta: <span className={`${(stats?.fixedTotalDiffCHF || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      CHF {(stats?.fixedTotalDiffCHF || 0).toFixed(2)}
                    </span>
                  </span>
                </div>
                {fixedExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
              </button>

              <AnimatePresence>
                {fixedExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-4">
                        <button
                          onClick={() => { setActiveGroup('fixed'); selectAllInGroup(); }}
                          className="text-sm text-blue-400 hover:text-blue-300"
                        >
                          Seleziona tutti
                        </button>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-slate-400 border-b border-slate-700">
                              <th className="p-2 w-10"></th>
                              <th className="p-2">Prodotto</th>
                              <th className="p-2">Cliente</th>
                              <th className="p-2 text-right">Costo</th>
                              <th className="p-2 text-right">Venduto</th>
                              <th className="p-2 text-right">Sconto</th>
                              <th className="p-2 text-right">Bloccato</th>
                              <th className="p-2 text-right">Diff</th>
                              <th className="p-2 text-right">Margine</th>
                              <th className="p-2 text-right">Profitto</th>
                            </tr>
                          </thead>
                          <tbody>
                            {groupBy !== 'none' ? (
                              // Grouped view
                              groupedFixedLines.map((group) => (
                                <React.Fragment key={group.key}>
                                  <tr className="bg-blue-900/30 border-b border-slate-600">
                                    <td colSpan={10} className="p-3">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          {groupBy === 'customer' ? <Users className="w-4 h-4 text-blue-400" /> : <Package className="w-4 h-4 text-blue-400" />}
                                          <span className="font-bold text-white">{group.name}</span>
                                          <span className="text-slate-400">({group.lines.length} righe)</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                          <span className={`font-mono font-bold ${group.totalDiff >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            Delta: {group.totalDiff >= 0 ? '+' : ''}{group.totalDiff.toFixed(2)} CHF
                                          </span>
                                          <span className="font-mono text-emerald-400">
                                            Profitto: {group.totalProfit.toFixed(2)} CHF
                                          </span>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                  {group.lines.map((line) => (
                                    <tr
                                      key={line.lineId}
                                      className={`border-b border-slate-700/50 hover:bg-slate-800/50 transition-colors ${
                                        line.direction === 'higher' ? 'border-l-4 border-l-green-500' :
                                        line.direction === 'lower' ? 'border-l-4 border-l-red-500' : ''
                                      }`}
                                    >
                                      <td className="p-2">
                                        <input
                                          type="checkbox"
                                          checked={selectedIds.has(line.lineId)}
                                          onChange={() => toggleSelection(line.lineId)}
                                          className="w-4 h-4 rounded accent-blue-500"
                                        />
                                      </td>
                                      <td className="p-2">
                                        <div className="font-medium text-white truncate max-w-[200px]" title={line.productName}>
                                          {line.productCode || line.productName.slice(0, 30)}
                                        </div>
                                        <a
                                          href={`${odooBaseUrl}/web#id=${line.orderId}&model=sale.order&view_type=form`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-xs text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1"
                                        >
                                          {line.orderName}
                                          <ExternalLink className="w-3 h-3" />
                                        </a>
                                      </td>
                                      <td className="p-2">
                                        <a
                                          href={`${odooBaseUrl}/web#id=${line.customerId}&model=res.partner&view_type=form`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-slate-300 hover:text-blue-300 hover:underline truncate max-w-[150px] block"
                                          title={line.customerName}
                                        >
                                          {line.customerName}
                                        </a>
                                      </td>
                                      <td className="p-2 text-right font-mono text-orange-400">
                                        {line.costPrice.toFixed(2)}
                                      </td>
                                      <td className="p-2 text-right font-mono text-blue-400">
                                        {line.soldPrice.toFixed(2)}
                                      </td>
                                      <td className="p-2 text-right">
                                        {line.discount > 0 ? (
                                          <span className="font-mono text-amber-400 font-bold">
                                            -{line.discount.toFixed(1)}%
                                          </span>
                                        ) : (
                                          <span className="text-slate-600">-</span>
                                        )}
                                      </td>
                                      <td className="p-2 text-right font-mono text-slate-400">
                                        {line.referencePrice.toFixed(2)}
                                      </td>
                                      <td className="p-2 text-right">
                                        <span className={`font-mono font-bold ${
                                          line.direction === 'higher' ? 'text-green-400' :
                                          line.direction === 'lower' ? 'text-red-400' : 'text-slate-400'
                                        }`}>
                                          {line.priceDiffCHF >= 0 ? '+' : ''}{line.priceDiffCHF.toFixed(2)}
                                        </span>
                                        <span className={`ml-1 text-xs ${
                                          line.direction === 'higher' ? 'text-green-400/70' :
                                          line.direction === 'lower' ? 'text-red-400/70' : 'text-slate-500'
                                        }`}>
                                          ({line.priceDiffPercent >= 0 ? '+' : ''}{line.priceDiffPercent.toFixed(1)}%)
                                        </span>
                                      </td>
                                      <td className="p-2 text-right">
                                        <span className={`font-mono ${
                                          line.marginPercent >= 30 ? 'text-green-400' :
                                          line.marginPercent >= 20 ? 'text-yellow-400' : 'text-red-400'
                                        }`}>
                                          {line.marginPercent.toFixed(1)}%
                                        </span>
                                      </td>
                                      <td className="p-2 text-right font-mono text-emerald-400">
                                        {line.profitCHF.toFixed(2)}
                                      </td>
                                    </tr>
                                  ))}
                                </React.Fragment>
                              ))
                            ) : (
                              // Flat view
                              filteredFixedLines.map((line) => (
                                <tr
                                  key={line.lineId}
                                  className={`border-b border-slate-700/50 hover:bg-slate-800/50 transition-colors ${
                                    line.direction === 'higher' ? 'border-l-4 border-l-green-500' :
                                    line.direction === 'lower' ? 'border-l-4 border-l-red-500' : ''
                                  }`}
                                >
                                  <td className="p-2">
                                    <input
                                      type="checkbox"
                                      checked={selectedIds.has(line.lineId)}
                                      onChange={() => toggleSelection(line.lineId)}
                                      className="w-4 h-4 rounded accent-blue-500"
                                    />
                                  </td>
                                  <td className="p-2">
                                    <div className="font-medium text-white truncate max-w-[200px]" title={line.productName}>
                                      {line.productCode || line.productName.slice(0, 30)}
                                    </div>
                                    <a
                                      href={`${odooBaseUrl}/web#id=${line.orderId}&model=sale.order&view_type=form`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1"
                                    >
                                      {line.orderName}
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  </td>
                                  <td className="p-2">
                                    <a
                                      href={`${odooBaseUrl}/web#id=${line.customerId}&model=res.partner&view_type=form`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-slate-300 hover:text-blue-300 hover:underline truncate max-w-[150px] block"
                                      title={line.customerName}
                                    >
                                      {line.customerName}
                                    </a>
                                  </td>
                                  <td className="p-2 text-right font-mono text-orange-400">
                                    {line.costPrice.toFixed(2)}
                                  </td>
                                  <td className="p-2 text-right font-mono text-blue-400">
                                    {line.soldPrice.toFixed(2)}
                                  </td>
                                  <td className="p-2 text-right">
                                    {line.discount > 0 ? (
                                      <span className="font-mono text-amber-400 font-bold">
                                        -{line.discount.toFixed(1)}%
                                      </span>
                                    ) : (
                                      <span className="text-slate-600">-</span>
                                    )}
                                  </td>
                                  <td className="p-2 text-right font-mono text-slate-400">
                                    {line.referencePrice.toFixed(2)}
                                  </td>
                                  <td className="p-2 text-right">
                                    <span className={`font-mono font-bold ${
                                      line.direction === 'higher' ? 'text-green-400' :
                                      line.direction === 'lower' ? 'text-red-400' : 'text-slate-400'
                                    }`}>
                                      {line.priceDiffCHF >= 0 ? '+' : ''}{line.priceDiffCHF.toFixed(2)}
                                    </span>
                                    <span className={`ml-1 text-xs ${
                                      line.direction === 'higher' ? 'text-green-400/70' :
                                      line.direction === 'lower' ? 'text-red-400/70' : 'text-slate-500'
                                    }`}>
                                      ({line.priceDiffPercent >= 0 ? '+' : ''}{line.priceDiffPercent.toFixed(1)}%)
                                    </span>
                                  </td>
                                  <td className="p-2 text-right">
                                    <span className={`font-mono ${
                                      line.marginPercent >= 30 ? 'text-green-400' :
                                      line.marginPercent >= 20 ? 'text-yellow-400' : 'text-red-400'
                                    }`}>
                                      {line.marginPercent.toFixed(1)}%
                                    </span>
                                  </td>
                                  <td className="p-2 text-right font-mono text-emerald-400">
                                    {line.profitCHF.toFixed(2)}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>

                        {filteredFixedLines.length === 0 && (
                          <div className="text-center py-8 text-slate-500">
                            Nessun prodotto con prezzo bloccato
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* GROUP 2: Base Pricelist Prices */}
            <div className="glass rounded-2xl overflow-hidden">
              <button
                onClick={() => setBaseExpanded(!baseExpanded)}
                className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-purple-600/20 to-purple-500/10 hover:from-purple-600/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <List className="w-5 h-5 text-purple-400" />
                  <span className="text-lg font-bold text-white">
                    LISTINO BASE ({stats?.basePriceCount || 0})
                  </span>
                  <span className="text-sm text-slate-400">
                    Sopra: <span className="text-green-400">{stats?.baseHigherCount || 0}</span> |
                    Sotto: <span className="text-red-400">{stats?.baseLowerCount || 0}</span> |
                    Delta: <span className={`${(stats?.baseTotalDiffCHF || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      CHF {(stats?.baseTotalDiffCHF || 0).toFixed(2)}
                    </span>
                  </span>
                </div>
                {baseExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
              </button>

              <AnimatePresence>
                {baseExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-4">
                        <button
                          onClick={() => { setActiveGroup('base'); selectAllInGroup(); }}
                          className="text-sm text-purple-400 hover:text-purple-300"
                        >
                          Seleziona tutti
                        </button>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-slate-400 border-b border-slate-700">
                              <th className="p-2 w-10"></th>
                              <th className="p-2">Prodotto</th>
                              <th className="p-2">Cliente</th>
                              <th className="p-2 text-right">Costo</th>
                              <th className="p-2 text-right">Venduto</th>
                              <th className="p-2 text-right">Sconto</th>
                              <th className="p-2 text-right">Listino</th>
                              <th className="p-2 text-right">Diff</th>
                              <th className="p-2 text-right">Margine</th>
                              <th className="p-2 text-right">Profitto</th>
                            </tr>
                          </thead>
                          <tbody>
                            {groupBy !== 'none' ? (
                              // Grouped view
                              groupedBaseLines.map((group) => (
                                <React.Fragment key={group.key}>
                                  <tr className="bg-purple-900/30 border-b border-slate-600">
                                    <td colSpan={10} className="p-3">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          {groupBy === 'customer' ? <Users className="w-4 h-4 text-purple-400" /> : <Package className="w-4 h-4 text-purple-400" />}
                                          <span className="font-bold text-white">{group.name}</span>
                                          <span className="text-slate-400">({group.lines.length} righe)</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                          <span className={`font-mono font-bold ${group.totalDiff >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            Delta: {group.totalDiff >= 0 ? '+' : ''}{group.totalDiff.toFixed(2)} CHF
                                          </span>
                                          <span className="font-mono text-emerald-400">
                                            Profitto: {group.totalProfit.toFixed(2)} CHF
                                          </span>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                  {group.lines.map((line) => (
                                    <tr
                                      key={line.lineId}
                                      className={`border-b border-slate-700/50 hover:bg-slate-800/50 transition-colors ${
                                        line.direction === 'higher' ? 'border-l-4 border-l-green-500' :
                                        line.direction === 'lower' ? 'border-l-4 border-l-red-500' : ''
                                      }`}
                                    >
                                      <td className="p-2">
                                        <input
                                          type="checkbox"
                                          checked={selectedIds.has(line.lineId)}
                                          onChange={() => toggleSelection(line.lineId)}
                                          className="w-4 h-4 rounded accent-purple-500"
                                        />
                                      </td>
                                      <td className="p-2">
                                        <div className="font-medium text-white truncate max-w-[200px]" title={line.productName}>
                                          {line.productCode || line.productName.slice(0, 30)}
                                        </div>
                                        <a
                                          href={`${odooBaseUrl}/web#id=${line.orderId}&model=sale.order&view_type=form`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-xs text-purple-400 hover:text-purple-300 hover:underline flex items-center gap-1"
                                        >
                                          {line.orderName}
                                          <ExternalLink className="w-3 h-3" />
                                        </a>
                                        <div className="text-xs text-slate-500">{line.referencePricelistName}</div>
                                      </td>
                                      <td className="p-2">
                                        <a
                                          href={`${odooBaseUrl}/web#id=${line.customerId}&model=res.partner&view_type=form`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-slate-300 hover:text-purple-300 hover:underline truncate max-w-[150px] block"
                                          title={line.customerName}
                                        >
                                          {line.customerName}
                                        </a>
                                      </td>
                                      <td className="p-2 text-right font-mono text-orange-400">
                                        {line.costPrice.toFixed(2)}
                                      </td>
                                      <td className="p-2 text-right font-mono text-purple-400">
                                        {line.soldPrice.toFixed(2)}
                                      </td>
                                      <td className="p-2 text-right">
                                        {line.discount > 0 ? (
                                          <span className="font-mono text-amber-400 font-bold">
                                            -{line.discount.toFixed(1)}%
                                          </span>
                                        ) : (
                                          <span className="text-slate-600">-</span>
                                        )}
                                      </td>
                                      <td className="p-2 text-right font-mono text-slate-400">
                                        {line.referencePrice.toFixed(2)}
                                      </td>
                                      <td className="p-2 text-right">
                                        <span className={`font-mono font-bold ${
                                          line.direction === 'higher' ? 'text-green-400' :
                                          line.direction === 'lower' ? 'text-red-400' : 'text-slate-400'
                                        }`}>
                                          {line.priceDiffCHF >= 0 ? '+' : ''}{line.priceDiffCHF.toFixed(2)}
                                        </span>
                                        <span className={`ml-1 text-xs ${
                                          line.direction === 'higher' ? 'text-green-400/70' :
                                          line.direction === 'lower' ? 'text-red-400/70' : 'text-slate-500'
                                        }`}>
                                          ({line.priceDiffPercent >= 0 ? '+' : ''}{line.priceDiffPercent.toFixed(1)}%)
                                        </span>
                                      </td>
                                      <td className="p-2 text-right">
                                        <span className={`font-mono ${
                                          line.marginPercent >= 30 ? 'text-green-400' :
                                          line.marginPercent >= 20 ? 'text-yellow-400' : 'text-red-400'
                                        }`}>
                                          {line.marginPercent.toFixed(1)}%
                                        </span>
                                      </td>
                                      <td className="p-2 text-right font-mono text-emerald-400">
                                        {line.profitCHF.toFixed(2)}
                                      </td>
                                    </tr>
                                  ))}
                                </React.Fragment>
                              ))
                            ) : (
                              // Flat view
                              filteredBaseLines.map((line) => (
                                <tr
                                  key={line.lineId}
                                  className={`border-b border-slate-700/50 hover:bg-slate-800/50 transition-colors ${
                                    line.direction === 'higher' ? 'border-l-4 border-l-green-500' :
                                    line.direction === 'lower' ? 'border-l-4 border-l-red-500' : ''
                                  }`}
                                >
                                  <td className="p-2">
                                    <input
                                      type="checkbox"
                                      checked={selectedIds.has(line.lineId)}
                                      onChange={() => toggleSelection(line.lineId)}
                                      className="w-4 h-4 rounded accent-purple-500"
                                    />
                                  </td>
                                  <td className="p-2">
                                    <div className="font-medium text-white truncate max-w-[200px]" title={line.productName}>
                                      {line.productCode || line.productName.slice(0, 30)}
                                    </div>
                                    <a
                                      href={`${odooBaseUrl}/web#id=${line.orderId}&model=sale.order&view_type=form`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-purple-400 hover:text-purple-300 hover:underline flex items-center gap-1"
                                    >
                                      {line.orderName}
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                    <div className="text-xs text-slate-500">{line.referencePricelistName}</div>
                                  </td>
                                  <td className="p-2">
                                    <a
                                      href={`${odooBaseUrl}/web#id=${line.customerId}&model=res.partner&view_type=form`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-slate-300 hover:text-purple-300 hover:underline truncate max-w-[150px] block"
                                      title={line.customerName}
                                    >
                                      {line.customerName}
                                    </a>
                                  </td>
                                  <td className="p-2 text-right font-mono text-orange-400">
                                    {line.costPrice.toFixed(2)}
                                  </td>
                                  <td className="p-2 text-right font-mono text-purple-400">
                                    {line.soldPrice.toFixed(2)}
                                  </td>
                                  <td className="p-2 text-right">
                                    {line.discount > 0 ? (
                                      <span className="font-mono text-amber-400 font-bold">
                                        -{line.discount.toFixed(1)}%
                                      </span>
                                    ) : (
                                      <span className="text-slate-600">-</span>
                                    )}
                                  </td>
                                  <td className="p-2 text-right font-mono text-slate-400">
                                    {line.referencePrice.toFixed(2)}
                                  </td>
                                  <td className="p-2 text-right">
                                    <span className={`font-mono font-bold ${
                                      line.direction === 'higher' ? 'text-green-400' :
                                      line.direction === 'lower' ? 'text-red-400' : 'text-slate-400'
                                    }`}>
                                      {line.priceDiffCHF >= 0 ? '+' : ''}{line.priceDiffCHF.toFixed(2)}
                                    </span>
                                    <span className={`ml-1 text-xs ${
                                      line.direction === 'higher' ? 'text-green-400/70' :
                                      line.direction === 'lower' ? 'text-red-400/70' : 'text-slate-500'
                                    }`}>
                                      ({line.priceDiffPercent >= 0 ? '+' : ''}{line.priceDiffPercent.toFixed(1)}%)
                                    </span>
                                  </td>
                                  <td className="p-2 text-right">
                                    <span className={`font-mono ${
                                      line.marginPercent >= 30 ? 'text-green-400' :
                                      line.marginPercent >= 20 ? 'text-yellow-400' : 'text-red-400'
                                    }`}>
                                      {line.marginPercent.toFixed(1)}%
                                    </span>
                                  </td>
                                  <td className="p-2 text-right font-mono text-emerald-400">
                                    {line.profitCHF.toFixed(2)}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>

                        {filteredBaseLines.length === 0 && (
                          <div className="text-center py-8 text-slate-500">
                            Nessun prodotto da listino base
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        )}
      </main>

      {/* Selection Summary Bar - Fixed at bottom */}
      <AnimatePresence>
        {selectionStats && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 glass-strong border-t border-blue-500/30 p-4 z-40"
          >
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-6">
                <span className="font-bold text-blue-400">
                  <Check className="w-5 h-5 inline mr-1" />
                  {selectionStats.count} selezionati
                </span>
                <div className="h-8 w-px bg-slate-600" />
                <div>
                  <span className="text-slate-400 text-sm">Media Semplice:</span>
                  <span className="ml-2 text-2xl font-bold text-white">
                    CHF {selectionStats.avgPrice.toFixed(2)}
                  </span>
                </div>
                <div className="h-8 w-px bg-slate-600" />
                <div>
                  <span className="text-slate-400 text-sm">Profitto Totale:</span>
                  <span className="ml-2 text-lg font-bold text-emerald-400">
                    CHF {selectionStats.totalProfit.toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={clearSelection}
                  className="px-4 py-2 glass rounded-lg hover:bg-white/10 text-slate-300 transition-colors flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Cancella
                </button>
                <button
                  onClick={copyAverageToClipboard}
                  className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-500 text-white transition-colors flex items-center gap-2"
                >
                  <Calculator className="w-4 h-4" />
                  Copia Media
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
