/**
 * LAPA Smart Ordering - Data Service
 *
 * Gestisce caricamento e caching dati da:
 * - File JSON analisi (sales-analysis-data.json)
 * - Odoo API (real-time stock updates)
 * - Cache locale
 */

import { ProductData } from './prediction-engine';
import salesData from '@/sales-analysis-data.json';

export interface SupplierInfo {
  id: number;
  name: string;
  leadTime: number;
  reliability: number;
  products: ProductData[];
}

export interface SmartOrderingData {
  lastUpdate: Date;
  products: ProductData[];
  suppliers: SupplierInfo[];
  criticalProducts: ProductData[];
  warningProducts: ProductData[];
  okProducts: ProductData[];
}

class SmartOrderingDataService {
  private cache: SmartOrderingData | null = null;
  private cacheExpiry: number = 1000 * 60 * 60; // 1 ora

  /**
   * Carica dati da file JSON analisi
   */
  async loadFromAnalysisFile(): Promise<SmartOrderingData> {
    console.log('📂 Caricamento dati da sales-analysis-data.json...');

    // Parse prodotti critici
    const criticalProducts: ProductData[] = [];

    // Out of stock products
    if (salesData.critical_alerts?.out_of_stock) {
      salesData.critical_alerts.out_of_stock.forEach((item: any, idx: number) => {
        criticalProducts.push({
          productId: 10000 + idx, // Temporary ID
          productName: item.product,
          currentStock: item.current_stock || 0,
          avgDailySales: item.avg_daily_sales || 0,
          variability: 0.5,
          leadTimeDays: 3,
          reorderPoint: item.reorder_point,
          trend: 'stable'
        });
      });
    }

    // Critical stock products
    if (salesData.critical_alerts?.critical_stock) {
      salesData.critical_alerts.critical_stock.forEach((item: any, idx: number) => {
        criticalProducts.push({
          productId: 20000 + idx,
          productName: item.product,
          currentStock: item.current_stock || 0,
          avgDailySales: item.avg_daily_sales || 0,
          variability: 0.5,
          leadTimeDays: 3,
          reorderPoint: item.reorder_point,
          trend: 'stable'
        });
      });
    }

    // Warning products
    const warningProducts: ProductData[] = [];
    if (salesData.critical_alerts?.order_soon) {
      salesData.critical_alerts.order_soon.forEach((item: any, idx: number) => {
        warningProducts.push({
          productId: 30000 + idx,
          productName: item.product,
          currentStock: item.current_stock || 0,
          avgDailySales: item.avg_daily_sales || 0,
          variability: 0.5,
          leadTimeDays: 3,
          reorderPoint: item.reorder_point,
          trend: 'stable'
        });
      });
    }

    // Top products (OK)
    const okProducts: ProductData[] = [];
    if (salesData.top_products) {
      salesData.top_products.slice(0, 20).forEach((item: any) => {
        okProducts.push({
          productId: 40000 + item.rank,
          productName: item.product,
          currentStock: 1000, // TODO: get from Odoo
          avgDailySales: item.avg_daily_sales || 0,
          variability: item.variability || 0.5,
          leadTimeDays: 7,
          preferredDays: item.preferred_days || [],
          trend: item.trend || 'stable',
          category: item.category
        });
      });
    }

    const allProducts = [...criticalProducts, ...warningProducts, ...okProducts];

    // Raggruppa per fornitore (TODO: get real supplier data)
    const suppliers: SupplierInfo[] = this.groupProductsBySupplier(allProducts);

    const data: SmartOrderingData = {
      lastUpdate: new Date(),
      products: allProducts,
      suppliers,
      criticalProducts,
      warningProducts,
      okProducts
    };

    this.cache = data;
    return data;
  }

  /**
   * Raggruppa prodotti per fornitore
   */
  private groupProductsBySupplier(products: ProductData[]): SupplierInfo[] {
    // TODO: Get real supplier mapping from Odoo
    // For now, group by category as proxy

    const supplierMap = new Map<string, SupplierInfo>();

    products.forEach(product => {
      const category = product.category || 'general';

      if (!supplierMap.has(category)) {
        supplierMap.set(category, {
          id: supplierMap.size + 1,
          name: this.getCategorySupplierName(category),
          leadTime: 3,
          reliability: 90,
          products: []
        });
      }

      supplierMap.get(category)!.products.push(product);
    });

    return Array.from(supplierMap.values());
  }

  /**
   * Get supplier name from category
   */
  private getCategorySupplierName(category: string): string {
    const mapping: Record<string, string> = {
      'formaggi_freschi': 'Caseificio Napoli',
      'packaging': 'Packaging Pro',
      'conserve': 'Conserve Italia',
      'farine': 'Molino Caputo',
      'latticini': 'Latteria Centrale',
      'spezie': 'Spezie del Mondo',
      'non_food': 'Forniture Generali'
    };

    return mapping[category] || 'Fornitore Generico';
  }

  /**
   * Carica dati (con cache)
   */
  async loadData(forceRefresh: boolean = false): Promise<SmartOrderingData> {
    if (!forceRefresh && this.cache) {
      console.log('✅ Dati caricati da cache');
      return this.cache;
    }

    return await this.loadFromAnalysisFile();
  }

  /**
   * Refresh da Odoo (real-time stock)
   */
  async refreshFromOdoo(): Promise<void> {
    console.log('🔄 Refresh stock da Odoo...');
    // TODO: Implementare chiamata a Odoo per aggiornare stock reale
    // Per ora usa dati statici
  }

  /**
   * Get prodotto by ID
   */
  async getProduct(productId: number): Promise<ProductData | null> {
    const data = await this.loadData();
    return data.products.find(p => p.productId === productId) || null;
  }

  /**
   * Get prodotti critici
   */
  async getCriticalProducts(): Promise<ProductData[]> {
    const data = await this.loadData();
    return data.criticalProducts;
  }

  /**
   * Get prodotti warning
   */
  async getWarningProducts(): Promise<ProductData[]> {
    const data = await this.loadData();
    return data.warningProducts;
  }

  /**
   * Get tutti i fornitori
   */
  async getSuppliers(): Promise<SupplierInfo[]> {
    const data = await this.loadData();
    return data.suppliers;
  }

  /**
   * Get KPI summary
   */
  async getKPISummary() {
    const data = await this.loadData();

    return {
      totalProducts: data.products.length,
      criticalCount: data.criticalProducts.length,
      warningCount: data.warningProducts.length,
      okCount: data.okProducts.length,
      suppliersCount: data.suppliers.length,
      lastUpdate: data.lastUpdate,
      peakDay: salesData.patterns?.peak_days?.[0] || 'tuesday',
      weekdayWeekendRatio: salesData.patterns?.weekday_weekend_ratio || 15.7
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache = null;
  }
}

// Export singleton
export const dataService = new SmartOrderingDataService();
