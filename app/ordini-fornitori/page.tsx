'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  ShoppingCart,
  Building2,
  ChevronDown,
  ChevronUp,
  X,
  Check,
  FileText,
  CheckSquare,
  Square
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { AppHeader, MobileHomeButton } from '@/components/layout/AppHeader';
import toast from 'react-hot-toast';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface Product {
  id: number;
  name: string;
  code: string;
  category: string;
  supplier: string;
  supplierId: number;
  currentStock: number;
  dailySales: number;
  leadTime: number;
  reorderPoint: number;
  suggestedQuantity: number;
  status: 'critical' | 'warning' | 'ok';
  trend: 'up' | 'down' | 'stable';
  salesData: number[];
  detailedHistory?: DayHistory[];
}

interface DayHistory {
  date: string;
  dailyTotal: number;
  customerSales: CustomerSale[];
}

interface CustomerSale {
  customer: string;
  quantity: number;
}

interface Supplier {
  id: number;
  name: string;
  leadTime: number;
  reliability: number;
  rating: number;
}

interface Order {
  id: string;
  supplier: string;
  products: { name: string; quantity: number; }[];
  totalValue: number;
  date: string;
  status: string;
}

interface SalesHistoryPopup {
  product: Product;
  history: DayHistory[];
  advancedAnalysis: any;
  dataSource: string;
  stats: {
    totalSold: number;
    avgDaily: number;
    projectedNeed: number;
    recommendation: string;
    safetyStock: number;
    safetyMargin: number;
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const formatNumber = (num: number | null | undefined, decimals: number = 1): string => {
  if (num === null || num === undefined) return '0';
  return Number(num).toFixed(decimals);
};

const formatCurrency = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined) return '€0,00';
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

const formatInteger = (num: number | null | undefined): string => {
  if (num === null || num === undefined) return '0';
  return Math.round(Number(num)).toString();
};

// ============================================================================
// ODOO CONNECTION FUNCTIONS
// ============================================================================

function csrf(): string | null {
  try {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'csrf_token') return decodeURIComponent(value);
    }

    const metaCsrf = document.querySelector('meta[name="csrf-token"]');
    if (metaCsrf) return metaCsrf.getAttribute('content');

    if (typeof window !== 'undefined' && (window as any).odoo && (window as any).odoo.csrf_token) {
      return (window as any).odoo.csrf_token;
    }

    console.warn('🔍 CSRF token non trovato, app potrebbe essere fuori contesto Odoo');
  } catch (e) {
    console.error('CSRF token error:', e);
  }
  return null;
}

async function rpc(model: string, method: string, args: any[]): Promise<any> {
  const token = csrf();
  if (!token) {
    console.warn('🔍 Nessun CSRF token - app in modalità demo');
    throw new Error('CSRF token non trovato - usando dati demo');
  }

  const response = await fetch('/web/dataset/call_kw', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': token
    },
    credentials: 'include',
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model: model,
        method: method,
        args: args,
        kwargs: {}
      },
      id: Math.floor(Math.random() * 1000000000)
    })
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.data?.message || data.error.message || 'Errore RPC');
  }
  return data.result;
}

async function searchRead(model: string, domain: any[], fields: string[], limit: number | false = false): Promise<any[]> {
  const args: any[] = [domain, fields];
  if (limit) args.push(0, limit);
  return await rpc(model, 'search_read', args);
}

// ============================================================================
// DATA LOADING FUNCTIONS
// ============================================================================

async function loadRealSalesData(productId: number, days: number = 40) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    const salesLines = await searchRead('sale.order.line', [
      ['product_id', '=', productId],
      ['create_date', '>=', startDateStr + ' 00:00:00']
    ], ['product_uom_qty', 'order_id', 'create_date']);

    if (!salesLines || salesLines.length === 0) {
      throw new Error('Nessuna vendita trovata');
    }

    const orderIds = Array.from(new Set(salesLines.map((line: any) => line.order_id ? line.order_id[0] : null).filter((id: any) => id)));

    const orders = await searchRead('sale.order', [
      ['id', 'in', orderIds],
      ['state', 'in', ['sale', 'done']]
    ], ['partner_id', 'date_order', 'name']);

    const orderToCustomer: any = {};
    const orderToDate: any = {};
    orders.forEach((order: any) => {
      orderToCustomer[order.id] = order.partner_id ? order.partner_id[1] : 'Cliente Sconosciuto';
      orderToDate[order.id] = order.date_order ? order.date_order.split(' ')[0] : null;
    });

    const salesByDay: any = {};
    const customersByDay: any = {};

    salesLines.forEach((line: any) => {
      const orderId = line.order_id ? line.order_id[0] : null;
      const orderDate = orderToDate[orderId];
      const customerName = orderToCustomer[orderId] || 'Cliente Sconosciuto';
      const quantity = line.product_uom_qty || 0;

      if (orderDate && quantity > 0) {
        if (!salesByDay[orderDate]) {
          salesByDay[orderDate] = 0;
        }
        salesByDay[orderDate] += quantity;

        if (!customersByDay[orderDate]) {
          customersByDay[orderDate] = {};
        }
        if (!customersByDay[orderDate][customerName]) {
          customersByDay[orderDate][customerName] = 0;
        }
        customersByDay[orderDate][customerName] += quantity;
      }
    });

    const result = {
      dailySales: [] as number[],
      detailedHistory: [] as DayHistory[]
    };

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const dailyTotal = salesByDay[dateStr] || 0;
      result.dailySales.push(dailyTotal);

      const customerSales: CustomerSale[] = [];
      if (customersByDay[dateStr]) {
        for (const [customer, qty] of Object.entries(customersByDay[dateStr])) {
          customerSales.push({
            customer: customer,
            quantity: qty as number
          });
        }
      }

      result.detailedHistory.push({
        date: dateStr,
        dailyTotal: dailyTotal,
        customerSales: customerSales
      });
    }

    return result;
  } catch (error) {
    console.error('Errore caricamento dati vendite:', error);
    throw error;
  }
}

// ============================================================================
// CALCULATION FUNCTIONS
// ============================================================================

function calculateAdvancedReorderSuggestion(
  product: Product,
  salesData: number[],
  leadTime: number,
  currentStock: number
) {
  const recentDays = 7;
  const mediumDays = 14;
  const longDays = 30;
  const veryLongDays = 60;

  const recentSales = salesData.slice(-recentDays);
  const mediumSales = salesData.slice(-mediumDays);
  const longSales = salesData.slice(-longDays);
  const veryLongSales = salesData.slice(-veryLongDays);

  const avgRecent = recentSales.reduce((a, b) => a + b, 0) / recentDays;
  const avgMedium = mediumSales.reduce((a, b) => a + b, 0) / mediumDays;
  const avgLong = longSales.reduce((a, b) => a + b, 0) / longDays;
  const avgVeryLong = veryLongSales.reduce((a, b) => a + b, 0) / veryLongDays;

  const weightedAvgDaily = (avgRecent * 0.4 + avgMedium * 0.3 + avgLong * 0.2 + avgVeryLong * 0.1);

  const variance = recentSales.reduce((sum, val) => sum + Math.pow(val - avgRecent, 2), 0) / recentDays;
  const stdDev = Math.sqrt(variance);
  const variability = stdDev / (avgRecent || 1);

  let safetyMargin = 0.15;
  if (variability > 0.5) safetyMargin = 0.25;
  else if (variability > 0.3) safetyMargin = 0.20;
  if (leadTime > 7) safetyMargin += 0.05;
  if (leadTime > 14) safetyMargin += 0.05;

  const baseNeed = weightedAvgDaily * leadTime;
  const safetyStock = baseNeed * safetyMargin;
  const totalNeed = baseNeed + safetyStock;

  const daysUntilStockout = weightedAvgDaily > 0 ? currentStock / weightedAvgDaily : 999;

  let urgency: 'critica' | 'alta' | 'media' | 'bassa';
  if (daysUntilStockout < leadTime * 0.5) urgency = 'critica';
  else if (daysUntilStockout < leadTime) urgency = 'alta';
  else if (daysUntilStockout < leadTime * 1.5) urgency = 'media';
  else urgency = 'bassa';

  const suggestedOrder = Math.max(0, Math.ceil(totalNeed - currentStock));

  const trend = avgRecent > avgMedium * 1.1 ? 'crescente' :
                avgRecent < avgMedium * 0.9 ? 'decrescente' : 'stabile';

  return {
    suggestion: suggestedOrder,
    analysis: {
      avgRecent,
      avgMedium,
      avgLong,
      avgVeryLong,
      weightedAvgDaily,
      stdDev,
      variability,
      baseNeed,
      safetyStock,
      safetyMargin,
      totalNeed,
      daysUntilStockout,
      urgency,
      trend
    }
  };
}

function getProductStatus(currentStock: number, dailySales: number, leadTime: number): 'critical' | 'warning' | 'ok' {
  const daysOfStock = dailySales > 0 ? currentStock / dailySales : 999;
  if (daysOfStock < leadTime * 0.5) return 'critical';
  if (daysOfStock < leadTime) return 'warning';
  return 'ok';
}

// ============================================================================
// DEMO DATA
// ============================================================================

const DEMO_PRODUCTS: Product[] = [
  {
    id: 1,
    name: 'Latte Intero UHT 1L',
    code: 'LAT001',
    category: 'Latticini',
    supplier: 'Latteria Alpha S.r.l.',
    supplierId: 101,
    currentStock: 45,
    dailySales: 12.5,
    leadTime: 5,
    reorderPoint: 60,
    suggestedQuantity: 80,
    status: 'critical',
    trend: 'up',
    salesData: [10, 12, 11, 15, 13, 14, 12, 10, 11, 13, 15, 12, 11, 14]
  },
  {
    id: 2,
    name: 'Olive Taggiasche 500g',
    code: 'OLI002',
    category: 'Conserve',
    supplier: 'Beta Foods S.p.A.',
    supplierId: 102,
    currentStock: 85,
    dailySales: 8.2,
    leadTime: 7,
    reorderPoint: 50,
    suggestedQuantity: 60,
    status: 'warning',
    trend: 'stable',
    salesData: [8, 9, 7, 8, 9, 8, 7, 9, 8, 8, 9, 7, 8, 9]
  },
  {
    id: 3,
    name: 'Pecorino Romano DOP 1kg',
    code: 'FOR003',
    category: 'Formaggi',
    supplier: 'Gamma Cheese Ltd.',
    supplierId: 103,
    currentStock: 25,
    dailySales: 6.5,
    leadTime: 10,
    reorderPoint: 70,
    suggestedQuantity: 90,
    status: 'critical',
    trend: 'up',
    salesData: [5, 6, 7, 8, 6, 7, 5, 6, 8, 7, 6, 5, 7, 8]
  }
];

const DEMO_SUPPLIERS: Supplier[] = [
  { id: 101, name: 'Latteria Alpha S.r.l.', leadTime: 5, reliability: 95, rating: 4.8 },
  { id: 102, name: 'Beta Foods S.p.A.', leadTime: 7, reliability: 88, rating: 4.5 },
  { id: 103, name: 'Gamma Cheese Ltd.', leadTime: 10, reliability: 92, rating: 4.7 }
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function OrdiniFornitoriPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  // State management
  const [activeTab, setActiveTab] = useState<'dashboard' | 'products' | 'orders' | 'suppliers'>('dashboard');
  const [products, setProducts] = useState<Product[]>(DEMO_PRODUCTS);
  const [suppliers, setSuppliers] = useState<Supplier[]>(DEMO_SUPPLIERS);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<number[]>([]);
  const [editedQuantities, setEditedQuantities] = useState<Record<number, number>>({});
  const [salesHistoryPopup, setSalesHistoryPopup] = useState<SalesHistoryPopup | null>(null);
  const [expandedSuppliers, setExpandedSuppliers] = useState<Set<string>>(new Set());
  const [isInOdoo, setIsInOdoo] = useState(false);

  // Check Odoo context
  useEffect(() => {
    const inOdoo = typeof window !== 'undefined' && (
      window.location.hostname.includes('odoo') ||
      window.location.hostname.includes('dev.odoo') ||
      document.cookie.includes('session_id') ||
      (window as any).odoo !== undefined
    );
    setIsInOdoo(inOdoo);

    // Load data
    if (inOdoo) {
      loadDashboardData();
    }
  }, []);

  // Load dashboard data from Odoo
  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Carica prodotti venduti negli ultimi 40 giorni
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 40);
      const startDateStr = startDate.toISOString().split('T')[0];

      const salesLines = await searchRead('sale.order.line', [
        ['create_date', '>=', startDateStr + ' 00:00:00']
      ], ['product_id', 'product_uom_qty']);

      // Raggruppa per prodotto
      const productSales: Record<number, number> = {};
      salesLines.forEach((line: any) => {
        const productId = line.product_id[0];
        if (!productSales[productId]) productSales[productId] = 0;
        productSales[productId] += line.product_uom_qty || 0;
      });

      // Carica dettagli prodotti
      const productIds = Object.keys(productSales).map(Number);
      const productsData = await searchRead('product.product', [
        ['id', 'in', productIds]
      ], ['name', 'default_code', 'categ_id', 'seller_ids', 'qty_available']);

      // Elabora prodotti
      const loadedProducts: Product[] = [];
      for (const prod of productsData) {
        try {
          const salesData = await loadRealSalesData(prod.id, 40);
          const supplier = prod.seller_ids && prod.seller_ids.length > 0
            ? await getSupplierInfo(prod.seller_ids[0])
            : null;

          const dailySales = salesData.dailySales.reduce((a: number, b: number) => a + b, 0) / 40;
          const leadTime = supplier?.leadTime || 7;
          const status = getProductStatus(prod.qty_available, dailySales, leadTime);

          if (status === 'critical' || status === 'warning') {
            const analysis = calculateAdvancedReorderSuggestion(
              prod as any,
              salesData.dailySales,
              leadTime,
              prod.qty_available
            );

            loadedProducts.push({
              id: prod.id,
              name: prod.name,
              code: prod.default_code || '',
              category: prod.categ_id ? prod.categ_id[1] : 'Altro',
              supplier: supplier?.name || 'Nessun Fornitore',
              supplierId: supplier?.id || 0,
              currentStock: prod.qty_available,
              dailySales: dailySales,
              leadTime: leadTime,
              reorderPoint: analysis.analysis.baseNeed,
              suggestedQuantity: analysis.suggestion,
              status: status,
              trend: analysis.analysis.trend === 'crescente' ? 'up' :
                     analysis.analysis.trend === 'decrescente' ? 'down' : 'stable',
              salesData: salesData.dailySales,
              detailedHistory: salesData.detailedHistory
            });
          }
        } catch (err) {
          console.error(`Errore elaborazione prodotto ${prod.id}:`, err);
        }
      }

      setProducts(loadedProducts);
    } catch (err: any) {
      console.error('Errore caricamento dati:', err);
      toast.error('Errore caricamento dati. Utilizzo dati demo.');
    } finally {
      setLoading(false);
    }
  };

  const getSupplierInfo = async (supplierInfoId: number) => {
    try {
      const supplierInfo = await searchRead('product.supplierinfo', [
        ['id', '=', supplierInfoId]
      ], ['partner_id', 'delay']);

      if (supplierInfo && supplierInfo.length > 0) {
        return {
          id: supplierInfo[0].partner_id[0],
          name: supplierInfo[0].partner_id[1],
          leadTime: supplierInfo[0].delay || 7
        };
      }
    } catch (err) {
      console.error('Errore caricamento fornitore:', err);
    }
    return null;
  };

  // Product selection handlers
  const toggleProductSelection = (productId: number) => {
    setSelectedProducts(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const selectAllSupplierProducts = (supplierName: string) => {
    const supplierProducts = products.filter(p => p.supplier === supplierName);
    const supplierProductIds = supplierProducts.map(p => p.id);
    const allSelected = supplierProductIds.every(id => selectedProducts.includes(id));

    if (allSelected) {
      setSelectedProducts(prev => prev.filter(id => !supplierProductIds.includes(id)));
    } else {
      setSelectedProducts(prev => Array.from(new Set([...prev, ...supplierProductIds])));
    }
  };

  const updateQuantity = (productId: number, newQuantity: number) => {
    setEditedQuantities(prev => ({
      ...prev,
      [productId]: newQuantity
    }));
  };

  const getProductQuantity = (product: Product): number => {
    return editedQuantities[product.id] ?? product.suggestedQuantity;
  };

  // Toggle supplier expansion
  const toggleSupplierExpansion = (supplierName: string) => {
    setExpandedSuppliers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(supplierName)) {
        newSet.delete(supplierName);
      } else {
        newSet.add(supplierName);
      }
      return newSet;
    });
  };

  // Open sales history popup
  const openSalesHistory = (product: Product) => {
    const analysis = calculateAdvancedReorderSuggestion(
      product,
      product.salesData,
      product.leadTime,
      product.currentStock
    );

    const totalSold = product.salesData.reduce((sum, qty) => sum + qty, 0);

    setSalesHistoryPopup({
      product: product,
      history: product.detailedHistory || [],
      advancedAnalysis: analysis,
      dataSource: isInOdoo ? 'ODOO REALE' : 'DEMO',
      stats: {
        totalSold: totalSold,
        avgDaily: analysis.analysis.weightedAvgDaily,
        projectedNeed: analysis.analysis.baseNeed,
        recommendation: analysis.suggestion.toString(),
        safetyStock: analysis.analysis.safetyStock,
        safetyMargin: analysis.analysis.safetyMargin
      }
    });
  };

  // Create bulk order
  const createBulkOrder = async () => {
    if (selectedProducts.length === 0) {
      toast.error('Seleziona almeno un prodotto per creare gli ordini');
      return;
    }

    const selectedProductsData = products.filter(p => selectedProducts.includes(p.id));

    const productsWithoutSupplier = selectedProductsData.filter(p => !p.supplierId || p.supplier === 'Nessun Fornitore');
    if (productsWithoutSupplier.length > 0) {
      const productNames = productsWithoutSupplier.map(p => `• ${p.name}`).join('\n');
      toast.error(
        `Alcuni prodotti non hanno un fornitore configurato!\n\n` +
        `Prodotti senza fornitore:\n${productNames}\n\n` +
        `Configura i fornitori in Odoo prima di creare gli ordini.`
      );
      return;
    }

    // Raggruppa per fornitore
    const ordersBySupplier: Record<string, any> = {};
    selectedProductsData.forEach(product => {
      const supplierKey = `${product.supplierId}_${product.supplier}`;
      const quantity = getProductQuantity(product);

      if (!ordersBySupplier[supplierKey]) {
        ordersBySupplier[supplierKey] = {
          supplierId: product.supplierId,
          supplierName: product.supplier || 'Fornitore Sconosciuto',
          products: [],
          totalQty: 0,
          totalValue: 0
        };
      }

      const productWithQty = { ...product, finalQuantity: quantity };
      ordersBySupplier[supplierKey].products.push(productWithQty);
      ordersBySupplier[supplierKey].totalQty += quantity;
      ordersBySupplier[supplierKey].totalValue += quantity * 1;
    });

    const orderSummary = Object.values(ordersBySupplier)
      .map((data: any) => {
        const productList = data.products.map((p: any) => `  - ${p.name}: ${p.finalQuantity} pz`).join('\n');
        return `📦 ${data.supplierName} (ID: ${data.supplierId})\n${productList}\n  Totale: ${data.totalQty} pezzi`;
      }).join('\n\n');

    const supplierCount = Object.keys(ordersBySupplier).length;

    const confirmed = confirm(
      `🛒 RIEPILOGO ORDINI DA CREARE\n\n` +
      `${supplierCount} ordini separati per ${supplierCount} fornitori\n` +
      `Totale prodotti: ${selectedProducts.length}\n\n` +
      `DETTAGLIO:\n${orderSummary}\n\n` +
      `⚠️ IMPORTANTE: Ogni ordine sarà creato per il fornitore specifico!\n` +
      `💰 I prezzi verranno calcolati automaticamente da Odoo\n` +
      `📋 Modalità: ${isInOdoo ? 'ODOO REALE' : 'DEMO'}\n\n` +
      `Confermi la creazione di questi ordini separati?`
    );

    if (confirmed) {
      setLoading(true);
      try {
        if (isInOdoo) {
          // Crea ordini reali in Odoo
          for (const [key, orderData] of Object.entries(ordersBySupplier)) {
            await createPurchaseOrderInOdoo(orderData);
          }
          toast.success(`✅ ${supplierCount} ordini creati con successo in Odoo!`);
        } else {
          // Modalità demo
          const newOrders: Order[] = Object.values(ordersBySupplier).map((data: any) => ({
            id: `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            supplier: data.supplierName,
            products: data.products.map((p: any) => ({ name: p.name, quantity: p.finalQuantity })),
            totalValue: data.totalValue * 10,
            date: new Date().toISOString().split('T')[0],
            status: 'draft'
          }));
          setOrders(prev => [...prev, ...newOrders]);
          toast.success(`✅ ${supplierCount} ordini creati (modalità demo)!`);
        }

        // Reset selection
        setSelectedProducts([]);
        setEditedQuantities({});
      } catch (err: any) {
        console.error('Errore creazione ordini:', err);
        toast.error('Errore nella creazione degli ordini: ' + err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const createPurchaseOrderInOdoo = async (orderData: any) => {
    // Cerca preventivi draft esistenti per questo fornitore
    const existingDrafts = await searchRead('purchase.order', [
      ['partner_id', '=', orderData.supplierId],
      ['state', '=', 'draft']
    ], ['id', 'name', 'order_line'], 1);

    let purchaseOrderId;

    if (existingDrafts && existingDrafts.length > 0) {
      // Aggiorna preventivo esistente
      purchaseOrderId = existingDrafts[0].id;
      toast(`Aggiornamento preventivo esistente: ${existingDrafts[0].name}`);
    } else {
      // Crea nuovo ordine
      const orderValues = {
        partner_id: orderData.supplierId,
        date_order: new Date().toISOString(),
        notes: `Ordine creato automaticamente da Sistema Riordino Intelligente\nData: ${new Date().toLocaleString('it-IT')}`
      };

      const result = await rpc('purchase.order', 'create', [[orderValues]]);
      purchaseOrderId = result;
    }

    // Aggiungi/aggiorna righe ordine
    for (const product of orderData.products) {
      const lineValues = {
        order_id: purchaseOrderId,
        product_id: product.id,
        product_qty: product.finalQuantity,
        date_planned: new Date().toISOString()
      };

      await rpc('purchase.order.line', 'create', [[lineValues]]);
    }

    // Forza ricalcolo prezzi
    await rpc('purchase.order', '_onchange_product_id', [[purchaseOrderId]]);
  };

  // Computed values
  const criticalProducts = useMemo(() => products.filter(p => p.status === 'critical'), [products]);
  const warningProducts = useMemo(() => products.filter(p => p.status === 'warning'), [products]);
  const totalToOrder = useMemo(() =>
    [...criticalProducts, ...warningProducts].reduce((sum, p) => sum + p.suggestedQuantity, 0),
    [criticalProducts, warningProducts]
  );

  const productsBySupplier = useMemo(() => {
    const grouped: Record<string, Product[]> = {};
    [...criticalProducts, ...warningProducts].forEach(product => {
      if (!grouped[product.supplier]) {
        grouped[product.supplier] = [];
      }
      grouped[product.supplier].push(product);
    });
    return grouped;
  }, [criticalProducts, warningProducts]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <AppHeader
        title="🛒 Ordini Fornitori Intelligenti"
        subtitle="Sistema automatico di riordino basato su AI"
      />
      <MobileHomeButton />

      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Navigation Tabs */}
        <div className="bg-white rounded-xl shadow-lg p-2 mb-6 flex gap-2 overflow-x-auto">
          {[
            { id: 'dashboard', label: '📊 Dashboard', icon: Package },
            { id: 'products', label: '📦 Prodotti', icon: Package },
            { id: 'orders', label: '🛒 Ordini', icon: ShoppingCart },
            { id: 'suppliers', label: '🏭 Fornitori', icon: Building2 }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 min-w-[120px] px-4 py-3 rounded-lg font-semibold transition-all ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Info Banner */}
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded-r-xl">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-900">
                  <p className="font-semibold mb-1">💡 Come usare questa dashboard:</p>
                  <ul className="list-disc list-inside space-y-1 text-blue-800">
                    <li>Seleziona i prodotti da ordinare con le checkbox</li>
                    <li>Modifica le quantità se necessario (default = quantità suggerita)</li>
                    <li>Clicca su "Vendite/Gg" per vedere lo storico vendite dettagliato</li>
                    <li>Clicca "Crea Ordini" per generare automaticamente gli ordini per fornitore</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="bg-gradient-to-br from-red-500 to-red-600 text-white rounded-xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold">Prodotti Critici</h3>
                  <AlertCircle className="w-8 h-8 opacity-80" />
                </div>
                <p className="text-4xl font-bold">{criticalProducts.length}</p>
                <p className="text-sm opacity-90 mt-2">Ordina subito!</p>
              </div>

              <div className="bg-gradient-to-br from-yellow-500 to-orange-500 text-white rounded-xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold">In Attenzione</h3>
                  <AlertCircle className="w-8 h-8 opacity-80" />
                </div>
                <p className="text-4xl font-bold">{warningProducts.length}</p>
                <p className="text-sm opacity-90 mt-2">Monitora attentamente</p>
              </div>

              <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold">Totale da Ordinare</h3>
                  <ShoppingCart className="w-8 h-8 opacity-80" />
                </div>
                <p className="text-4xl font-bold">{totalToOrder}</p>
                <p className="text-sm opacity-90 mt-2">pezzi suggeriti</p>
              </div>
            </div>

            {/* Products by Supplier */}
            <div className="space-y-4">
              {Object.entries(productsBySupplier).map(([supplierName, supplierProducts]) => {
                const isExpanded = expandedSuppliers.has(supplierName);
                const supplierSelectedCount = supplierProducts.filter(p => selectedProducts.includes(p.id)).length;

                return (
                  <div key={supplierName} className="bg-white rounded-xl shadow-lg overflow-hidden">
                    {/* Supplier Header */}
                    <div
                      className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 cursor-pointer hover:from-purple-700 hover:to-blue-700 transition-all"
                      onClick={() => toggleSupplierExpansion(supplierName)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Building2 className="w-6 h-6" />
                          <div>
                            <h3 className="font-bold text-lg">{supplierName}</h3>
                            <p className="text-sm opacity-90">
                              {supplierProducts.length} prodotti da ordinare
                              {supplierSelectedCount > 0 && ` • ${supplierSelectedCount} selezionati`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toast(`Apertura catalogo ${supplierName}...`);
                            }}
                            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-semibold transition-colors"
                          >
                            📋 Catalogo Fornitore
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              selectAllSupplierProducts(supplierName);
                            }}
                            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-semibold transition-colors"
                          >
                            {supplierProducts.every(p => selectedProducts.includes(p.id))
                              ? '❌ Deseleziona Tutto'
                              : '✅ Seleziona Tutto'}
                          </button>
                          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </div>
                      </div>
                    </div>

                    {/* Products Table */}
                    {isExpanded && (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50 border-b-2 border-gray-200">
                            <tr>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Sel.</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Prodotto</th>
                              <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Giacenza</th>
                              <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Vendite/Gg</th>
                              <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Lead Time</th>
                              <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Qta da Ordinare</th>
                              <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {supplierProducts.map(product => (
                              <tr key={product.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-3">
                                  <button
                                    onClick={() => toggleProductSelection(product.id)}
                                    className="text-gray-600 hover:text-blue-600 transition-colors"
                                  >
                                    {selectedProducts.includes(product.id) ? (
                                      <CheckSquare className="w-5 h-5 text-blue-600" />
                                    ) : (
                                      <Square className="w-5 h-5" />
                                    )}
                                  </button>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-3 h-3 rounded-full ${
                                      product.status === 'critical' ? 'bg-red-500' :
                                      product.status === 'warning' ? 'bg-yellow-500' : 'bg-green-500'
                                    }`} />
                                    <div>
                                      <p className="font-semibold text-gray-900">{product.name}</p>
                                      <p className="text-sm text-gray-500">{product.code}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className="font-semibold text-gray-900">{formatInteger(product.currentStock)}</span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <button
                                    onClick={() => openSalesHistory(product)}
                                    className="text-blue-600 hover:text-blue-800 font-semibold underline"
                                  >
                                    {formatNumber(product.dailySales, 1)}
                                  </button>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className="text-gray-700">{product.leadTime} gg</span>
                                </td>
                                <td className="px-4 py-3">
                                  <input
                                    type="number"
                                    value={getProductQuantity(product)}
                                    onChange={(e) => updateQuantity(product.id, parseInt(e.target.value) || 0)}
                                    min="0"
                                    className="w-20 px-3 py-2 border-2 border-blue-300 rounded-lg text-center font-semibold focus:border-blue-500 focus:outline-none"
                                  />
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                                    product.status === 'critical' ? 'bg-red-100 text-red-700' :
                                    product.status === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-green-100 text-green-700'
                                  }`}>
                                    {product.status === 'critical' ? '🔥 CRITICO' :
                                     product.status === 'warning' ? '⚠️ ATTENZIONE' : '✅ OK'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Action Buttons */}
            {selectedProducts.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="fixed bottom-6 right-6 z-50 flex gap-3"
              >
                <button
                  onClick={() => {
                    setSelectedProducts([]);
                    setEditedQuantities({});
                  }}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-4 rounded-xl font-bold shadow-2xl transition-all"
                >
                  ❌ Deseleziona ({selectedProducts.length})
                </button>
                <button
                  onClick={createBulkOrder}
                  className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white px-8 py-4 rounded-xl font-bold shadow-2xl transition-all flex items-center gap-2"
                >
                  <ShoppingCart className="w-5 h-5" />
                  🛒 Crea Ordini ({selectedProducts.length})
                </button>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Products Tab */}
        {activeTab === 'products' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-xl shadow-lg p-6"
          >
            <h2 className="text-2xl font-bold mb-4">📦 Tutti i Prodotti</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Prodotto</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Categoria</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Fornitore</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold">Trend</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(product => (
                    <tr key={product.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold">{product.name}</td>
                      <td className="px-4 py-3">{product.category}</td>
                      <td className="px-4 py-3">{product.supplier}</td>
                      <td className="px-4 py-3 text-center">
                        {product.trend === 'up' ? (
                          <TrendingUp className="w-5 h-5 text-green-600 mx-auto" />
                        ) : product.trend === 'down' ? (
                          <TrendingDown className="w-5 h-5 text-red-600 mx-auto" />
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                          product.status === 'critical' ? 'bg-red-100 text-red-700' :
                          product.status === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {product.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold mb-4">🛒 Ordini Creati</h2>
              {orders.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <ShoppingCart className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>Nessun ordine creato ancora</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map(order => (
                    <div key={order.id} className="border-2 border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-bold text-lg">{order.supplier}</h3>
                          <p className="text-sm text-gray-500">Ordine: {order.id}</p>
                          <p className="text-sm text-gray-500">Data: {order.date}</p>
                        </div>
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
                          {order.status}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {order.products.map((prod, idx) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span>{prod.name}</span>
                            <span className="font-semibold">{prod.quantity} pz</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-right font-bold">
                          Valore stimato: {formatCurrency(order.totalValue)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Suppliers Tab */}
        {activeTab === 'suppliers' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-xl shadow-lg p-6"
          >
            <h2 className="text-2xl font-bold mb-4">🏭 Fornitori</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Fornitore</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold">Affidabilità</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold">Lead Time</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold">Prodotti Forniti</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold">Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map(supplier => (
                    <tr key={supplier.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold">{supplier.name}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-green-600 h-2 rounded-full"
                              style={{ width: `${supplier.reliability}%` }}
                            />
                          </div>
                          <span className="text-sm font-semibold">{supplier.reliability}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">{supplier.leadTime} giorni</td>
                      <td className="px-4 py-3 text-center">
                        {products.filter(p => p.supplierId === supplier.id).length}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-yellow-500">{'⭐'.repeat(Math.floor(supplier.rating))}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </div>

      {/* Sales History Popup */}
      <AnimatePresence>
        {salesHistoryPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSalesHistoryPopup(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            >
              {/* Popup Header */}
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-t-2xl">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-2xl font-bold mb-2">{salesHistoryPopup.product.name}</h3>
                    <p className="text-sm opacity-90">
                      📊 Fonte dati: <span className="font-bold">{salesHistoryPopup.dataSource}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => setSalesHistoryPopup(null)}
                    className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Popup Content */}
              <div className="p-6">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-sm text-blue-600 font-semibold mb-1">Totale Venduto</p>
                    <p className="text-2xl font-bold text-blue-900">
                      {formatInteger(salesHistoryPopup.stats.totalSold)}
                    </p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <p className="text-sm text-green-600 font-semibold mb-1">Media Giornaliera</p>
                    <p className="text-2xl font-bold text-green-900">
                      {formatNumber(salesHistoryPopup.stats.avgDaily, 1)}
                    </p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4">
                    <p className="text-sm text-purple-600 font-semibold mb-1">Fabbisogno</p>
                    <p className="text-2xl font-bold text-purple-900">
                      {formatInteger(salesHistoryPopup.stats.projectedNeed)}
                    </p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-4">
                    <p className="text-sm text-orange-600 font-semibold mb-1">Consigliato</p>
                    <p className="text-2xl font-bold text-orange-900">
                      {salesHistoryPopup.stats.recommendation}
                    </p>
                  </div>
                </div>

                {/* Analysis Card */}
                <div className="bg-gray-50 rounded-xl p-6 mb-6">
                  <h4 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-blue-600" />
                    Analisi Matematica Avanzata
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Trend:</p>
                      <p className="font-bold text-gray-900">{salesHistoryPopup.advancedAnalysis.analysis.trend}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Variabilità:</p>
                      <p className="font-bold text-gray-900">
                        {formatNumber(salesHistoryPopup.advancedAnalysis.analysis.variability * 100, 1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Urgenza:</p>
                      <p className={`font-bold ${
                        salesHistoryPopup.advancedAnalysis.analysis.urgency === 'critica' ? 'text-red-600' :
                        salesHistoryPopup.advancedAnalysis.analysis.urgency === 'alta' ? 'text-orange-600' :
                        salesHistoryPopup.advancedAnalysis.analysis.urgency === 'media' ? 'text-yellow-600' :
                        'text-green-600'
                      }`}>
                        {salesHistoryPopup.advancedAnalysis.analysis.urgency.toUpperCase()}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Giorni fino esaurimento:</p>
                      <p className="font-bold text-gray-900">
                        {formatNumber(salesHistoryPopup.advancedAnalysis.analysis.daysUntilStockout, 1)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Sales Chart (Simple Bar Chart) */}
                <div className="mb-6">
                  <h4 className="font-bold text-lg mb-4">📈 Vendite Ultimi 14 Giorni</h4>
                  <div className="flex items-end justify-between gap-2 h-40 bg-gray-50 rounded-lg p-4">
                    {salesHistoryPopup.product.salesData.slice(-14).map((qty, idx) => {
                      const maxQty = Math.max(...salesHistoryPopup.product.salesData.slice(-14));
                      const height = maxQty > 0 ? (qty / maxQty) * 100 : 0;
                      return (
                        <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                          <div
                            className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t transition-all hover:from-blue-700 hover:to-blue-500"
                            style={{ height: `${height}%`, minHeight: qty > 0 ? '4px' : '0' }}
                            title={`Giorno ${idx + 1}: ${qty} pz`}
                          />
                          <span className="text-xs text-gray-500">{qty}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Top Customers */}
                {salesHistoryPopup.history.length > 0 && (
                  <div>
                    <h4 className="font-bold text-lg mb-4">👥 Top 5 Clienti</h4>
                    <div className="space-y-2">
                      {(() => {
                        const customerTotals: Record<string, number> = {};
                        salesHistoryPopup.history.forEach(day => {
                          day.customerSales.forEach(sale => {
                            if (sale.customer !== 'Cliente Sconosciuto') {
                              customerTotals[sale.customer] = (customerTotals[sale.customer] || 0) + sale.quantity;
                            }
                          });
                        });
                        const topCustomers = Object.entries(customerTotals)
                          .sort(([, a], [, b]) => b - a)
                          .slice(0, 5);

                        return topCustomers.map(([customer, total], idx) => (
                          <div key={customer} className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                            <span className="text-2xl font-bold text-gray-400">#{idx + 1}</span>
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900">{customer}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <div className="flex-1 bg-gray-200 rounded-full h-2">
                                  <div
                                    className="bg-blue-600 h-2 rounded-full"
                                    style={{ width: `${(total / salesHistoryPopup.stats.totalSold) * 100}%` }}
                                  />
                                </div>
                                <span className="text-sm font-semibold text-gray-700">{total} pz</span>
                              </div>
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                )}
              </div>

              {/* Popup Footer */}
              <div className="bg-gray-50 p-6 rounded-b-2xl">
                <button
                  onClick={() => setSalesHistoryPopup(null)}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-3 rounded-xl font-bold transition-all"
                >
                  Chiudi
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 shadow-2xl">
            <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-center font-semibold text-gray-700">Caricamento...</p>
          </div>
        </div>
      )}
    </div>
  );
}
