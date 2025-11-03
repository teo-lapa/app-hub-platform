'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Calendar,
  TrendingUp,
  Package,
  ArrowLeft,
  AlertCircle,
  Loader2,
  Download,
  FileText,
  X,
} from 'lucide-react';
import { ProductAnalysisDashboard } from '@/components/analisi-prodotto/ProductAnalysisDashboard';
import jsPDF from 'jspdf';
import toast from 'react-hot-toast';

interface Product {
  id: number;
  name: string;
  default_code: string | null;
  barcode: string | null;
  image_url?: string;
}

interface AnalysisData {
  product: {
    id: number;
    name: string;
    current_stock: number;
    uom: string;
    avg_price: number;
    supplier_name: string;
  };
  period: {
    dateFrom: string;
    dateTo: string;
    days: number;
  };
  sales: {
    totalQuantity: number;
    totalRevenue: number;
    avgDailyQuantity: number;
    avgDailyRevenue: number;
    trend: number;
  };
  customers: {
    totalCustomers: number;
    topCustomers: Array<{
      id: number;
      name: string;
      quantity: number;
      revenue: number;
      orders: number;
    }>;
  };
  timeline: Array<{
    date: string;
    quantity: number;
    revenue: number;
    orders: number;
  }>;
  stockAnalysis: {
    daysOfStock: number;
    reorderPoint: number;
    suggestedOrderQty: number;
    stockStatus: 'critical' | 'low' | 'adequate' | 'high';
  };
}

export default function AnalisiProdottoPage() {
  const router = useRouter();

  // Form State
  const [searchQuery, setSearchQuery] = useState('');
  const [productSuggestions, setProductSuggestions] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Analysis State
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchingProducts, setSearchingProducts] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize dates (last 3 months by default)
  useEffect(() => {
    const today = new Date();
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(today.getMonth() - 3);

    setDateTo(today.toISOString().split('T')[0]);
    setDateFrom(threeMonthsAgo.toISOString().split('T')[0]);
  }, []);

  // Debounced product search
  useEffect(() => {
    if (searchQuery.length < 3) {
      setProductSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      searchProducts(searchQuery);
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery]);

  const searchProducts = async (query: string) => {
    try {
      setSearchingProducts(true);

      // Search via Odoo products API
      const response = await fetch(`/api/products-catalog?search=${encodeURIComponent(query)}`);
      const data = await response.json();

      if (data.success && data.products) {
        // Map to our Product interface
        const products: Product[] = data.products.slice(0, 10).map((p: any) => ({
          id: p.id,
          name: p.name,
          default_code: p.default_code || null,
          barcode: p.barcode || null,
          image_url: p.image_url,
        }));

        setProductSuggestions(products);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error('Error searching products:', error);
      toast.error('Errore durante la ricerca dei prodotti');
    } finally {
      setSearchingProducts(false);
    }
  };

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setSearchQuery(product.name);
    setShowSuggestions(false);
    setProductSuggestions([]);
  };

  const handleAnalyze = async () => {
    if (!selectedProduct) {
      toast.error('Seleziona un prodotto');
      return;
    }

    if (!dateFrom || !dateTo) {
      toast.error('Seleziona un periodo valido');
      return;
    }

    if (new Date(dateFrom) > new Date(dateTo)) {
      toast.error('La data di fine deve essere successiva alla data di inizio');
      return;
    }

    setLoading(true);
    setError(null);
    setAnalysisData(null);

    try {
      const response = await fetch(
        `/api/analisi-prodotto?productName=${encodeURIComponent(selectedProduct.name)}&dateFrom=${dateFrom}&dateTo=${dateTo}`
      );

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Transform API response to match our interface
      const transformedData: AnalysisData = {
        product: {
          id: data.product.id,
          name: data.product.name,
          current_stock: data.product.qtyAvailable,
          uom: data.product.uom,
          avg_price: data.statistics.avgSalePrice,
          supplier_name: data.suppliers[0]?.partnerName || 'N/A',
        },
        period: {
          dateFrom,
          dateTo,
          days: Math.ceil((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / (1000 * 60 * 60 * 24)) + 1,
        },
        sales: {
          totalQuantity: data.statistics.totalSold,
          totalRevenue: data.statistics.totalRevenue,
          avgDailyQuantity: data.statistics.weeklyAvgSales / 7,
          avgDailyRevenue: data.statistics.totalRevenue / (Math.ceil((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / (1000 * 60 * 60 * 24)) + 1),
          trend: 0, // Could be calculated from comparison with previous period
        },
        customers: {
          totalCustomers: data.topCustomers.length,
          topCustomers: data.topCustomers.map((c: any) => ({
            id: 0, // Not available in API response
            name: c.customerName,
            quantity: c.qty,
            revenue: c.revenue,
            orders: c.orders,
          })),
        },
        timeline: data.saleOrders.reduce((acc: any[], order: any) => {
          const date = order.createDate;
          const existing = acc.find(t => t.date === date);
          if (existing) {
            existing.quantity += order.productQty;
            existing.revenue += order.priceSubtotal;
            existing.orders += 1;
          } else {
            acc.push({
              date,
              quantity: order.productQty,
              revenue: order.priceSubtotal,
              orders: 1,
            });
          }
          return acc;
        }, []).sort((a: any, b: any) => a.date.localeCompare(b.date)),
        stockAnalysis: {
          daysOfStock: data.statistics.daysOfCoverage,
          reorderPoint: data.reorderSuggestion.reorderPoint,
          suggestedOrderQty: data.reorderSuggestion.optimalOrderQty,
          stockStatus: data.reorderSuggestion.actionRequired ?
            (data.statistics.daysOfCoverage < 7 ? 'critical' : 'low') :
            (data.statistics.daysOfCoverage > 30 ? 'high' : 'adequate'),
        },
      };

      setAnalysisData(transformedData);
      toast.success('Analisi completata con successo!');
    } catch (error: any) {
      console.error('Error analyzing product:', error);
      setError(error.message || 'Errore durante l\'analisi del prodotto');
      toast.error('Errore durante l\'analisi');
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = () => {
    if (!analysisData) return;

    try {
      const doc = new jsPDF();

      // Title
      doc.setFontSize(20);
      doc.text('Analisi Prodotto', 20, 20);

      // Product Info
      doc.setFontSize(12);
      doc.text(`Prodotto: ${analysisData.product.name}`, 20, 35);
      doc.text(`Periodo: ${new Date(analysisData.period.dateFrom).toLocaleDateString('it-IT')} - ${new Date(analysisData.period.dateTo).toLocaleDateString('it-IT')}`, 20, 45);

      // Sales Summary
      doc.setFontSize(14);
      doc.text('Riepilogo Vendite', 20, 60);
      doc.setFontSize(10);
      doc.text(`Quantità Totale: ${analysisData.sales.totalQuantity.toFixed(1)} ${analysisData.product.uom}`, 20, 70);
      doc.text(`Revenue Totale: CHF ${analysisData.sales.totalRevenue.toFixed(2)}`, 20, 78);
      doc.text(`Media Giornaliera: ${analysisData.sales.avgDailyQuantity.toFixed(1)} ${analysisData.product.uom}/giorno`, 20, 86);

      // Stock Analysis
      doc.setFontSize(14);
      doc.text('Analisi Stock', 20, 100);
      doc.setFontSize(10);
      doc.text(`Stock Corrente: ${analysisData.product.current_stock.toFixed(1)} ${analysisData.product.uom}`, 20, 110);
      doc.text(`Giorni di Copertura: ${analysisData.stockAnalysis.daysOfStock.toFixed(1)} giorni`, 20, 118);
      doc.text(`Punto Riordino: ${analysisData.stockAnalysis.reorderPoint.toFixed(1)} ${analysisData.product.uom}`, 20, 126);
      doc.text(`Qtà Suggerita: ${analysisData.stockAnalysis.suggestedOrderQty.toFixed(0)} ${analysisData.product.uom}`, 20, 134);

      // Top Customers
      doc.setFontSize(14);
      doc.text('Top 5 Clienti', 20, 150);
      doc.setFontSize(10);
      analysisData.customers.topCustomers.slice(0, 5).forEach((customer, index) => {
        doc.text(
          `${index + 1}. ${customer.name}: ${customer.quantity.toFixed(1)} ${analysisData.product.uom} (CHF ${customer.revenue.toFixed(2)})`,
          20,
          160 + (index * 8)
        );
      });

      doc.save(`analisi-${analysisData.product.name.replace(/[^a-z0-9]/gi, '_')}-${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('PDF esportato con successo!');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('Errore durante l\'esportazione PDF');
    }
  };

  const handleExportExcel = () => {
    if (!analysisData) return;

    try {
      // Create CSV content
      let csvContent = 'data:text/csv;charset=utf-8,';

      // Header
      csvContent += 'Analisi Prodotto\n\n';
      csvContent += `Prodotto,${analysisData.product.name}\n`;
      csvContent += `Periodo,${new Date(analysisData.period.dateFrom).toLocaleDateString('it-IT')} - ${new Date(analysisData.period.dateTo).toLocaleDateString('it-IT')}\n\n`;

      // Sales
      csvContent += 'VENDITE\n';
      csvContent += `Quantità Totale,${analysisData.sales.totalQuantity.toFixed(1)} ${analysisData.product.uom}\n`;
      csvContent += `Revenue Totale,CHF ${analysisData.sales.totalRevenue.toFixed(2)}\n`;
      csvContent += `Media Giornaliera,${analysisData.sales.avgDailyQuantity.toFixed(1)} ${analysisData.product.uom}/giorno\n\n`;

      // Stock
      csvContent += 'STOCK\n';
      csvContent += `Stock Corrente,${analysisData.product.current_stock.toFixed(1)} ${analysisData.product.uom}\n`;
      csvContent += `Giorni Copertura,${analysisData.stockAnalysis.daysOfStock.toFixed(1)} giorni\n`;
      csvContent += `Punto Riordino,${analysisData.stockAnalysis.reorderPoint.toFixed(1)} ${analysisData.product.uom}\n\n`;

      // Top Customers
      csvContent += 'TOP CLIENTI\n';
      csvContent += 'Nome,Quantità,Revenue,Ordini\n';
      analysisData.customers.topCustomers.forEach(customer => {
        csvContent += `${customer.name},${customer.quantity.toFixed(1)},${customer.revenue.toFixed(2)},${customer.orders}\n`;
      });

      // Timeline
      csvContent += '\nTIMELINE VENDITE\n';
      csvContent += 'Data,Quantità,Revenue,Ordini\n';
      analysisData.timeline.forEach(day => {
        csvContent += `${new Date(day.date).toLocaleDateString('it-IT')},${day.quantity.toFixed(1)},${day.revenue.toFixed(2)},${day.orders}\n`;
      });

      // Download
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `analisi-${analysisData.product.name.replace(/[^a-z0-9]/gi, '_')}-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Excel esportato con successo!');
    } catch (error) {
      console.error('Error exporting Excel:', error);
      toast.error('Errore durante l\'esportazione Excel');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 flex items-center justify-between"
      >
        <div>
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
            <TrendingUp className="w-10 h-10 text-blue-400" />
            Analisi Prodotto
          </h1>
          <p className="text-blue-200">
            Analizza vendite, clienti e stock di un prodotto per un periodo specifico
          </p>
        </div>
        <button
          onClick={() => router.push('/dashboard')}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all flex items-center gap-2 border border-white/20"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Dashboard</span>
        </button>
      </motion.div>

      {/* Search Form - Sticky */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-6 z-10 mb-8"
      >
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 shadow-2xl">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Product Search */}
            <div className="md:col-span-5 relative">
              <label className="block text-blue-200 text-sm font-semibold mb-2">
                Prodotto
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-blue-300" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => productSuggestions.length > 0 && setShowSuggestions(true)}
                  placeholder="Cerca prodotto per nome o codice..."
                  className="w-full bg-white/10 border border-white/20 rounded-xl pl-10 pr-10 py-3 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {searchingProducts && (
                  <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-blue-300 animate-spin" />
                )}
                {selectedProduct && (
                  <button
                    onClick={() => {
                      setSelectedProduct(null);
                      setSearchQuery('');
                    }}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/50 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              {/* Suggestions Dropdown */}
              <AnimatePresence>
                {showSuggestions && productSuggestions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-white/20 rounded-xl shadow-2xl max-h-80 overflow-y-auto z-20"
                  >
                    {productSuggestions.map((product) => (
                      <button
                        key={product.id}
                        onClick={() => handleSelectProduct(product)}
                        className="w-full px-4 py-3 hover:bg-white/10 transition-all text-left flex items-center gap-3 border-b border-white/5 last:border-0"
                      >
                        <Package className="w-5 h-5 text-blue-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-medium truncate">{product.name}</div>
                          {product.default_code && (
                            <div className="text-blue-300 text-sm">{product.default_code}</div>
                          )}
                        </div>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Date From */}
            <div className="md:col-span-3">
              <label className="block text-blue-200 text-sm font-semibold mb-2">
                Data Inizio
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-blue-300" />
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Date To */}
            <div className="md:col-span-3">
              <label className="block text-blue-200 text-sm font-semibold mb-2">
                Data Fine
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-blue-300" />
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  min={dateFrom}
                  className="w-full bg-white/10 border border-white/20 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Analyze Button */}
            <div className="md:col-span-1 flex items-end">
              <button
                onClick={handleAnalyze}
                disabled={!selectedProduct || !dateFrom || !dateTo || loading}
                className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="hidden lg:inline">Analisi...</span>
                  </>
                ) : (
                  <>
                    <TrendingUp className="w-5 h-5" />
                    <span className="hidden lg:inline">Analizza</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Validation Messages */}
          {selectedProduct && dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo) && (
            <div className="mt-4 flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4" />
              <span>La data di fine deve essere successiva alla data di inizio</span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 bg-red-500/20 border border-red-400/30 rounded-2xl p-6"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-red-400 font-semibold mb-1">Errore durante l'analisi</h3>
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Loading State */}
      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-20"
        >
          <Loader2 className="w-16 h-16 text-blue-400 animate-spin mb-4" />
          <p className="text-white text-xl font-semibold mb-2">Analisi in corso...</p>
          <p className="text-blue-300 text-sm">Recupero dati da Odoo e calcolo statistiche</p>
        </motion.div>
      )}

      {/* Dashboard */}
      {analysisData && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <ProductAnalysisDashboard
            data={analysisData}
            onExportPDF={handleExportPDF}
            onExportExcel={handleExportExcel}
          />
        </motion.div>
      )}

      {/* Empty State */}
      {!analysisData && !loading && !error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-20"
        >
          <div className="bg-white/5 rounded-full p-8 mb-6">
            <TrendingUp className="w-16 h-16 text-blue-400" />
          </div>
          <h3 className="text-white text-2xl font-bold mb-2">Inizia un'analisi</h3>
          <p className="text-blue-300 text-center max-w-md">
            Seleziona un prodotto e un periodo per visualizzare statistiche dettagliate su vendite,
            clienti, stock e suggerimenti di riordino
          </p>
        </motion.div>
      )}
    </div>
  );
}
