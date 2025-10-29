/**
 * Query Helper per Analisi Fornitori
 *
 * Script interattivo per query rapide sui dati di cadenza fornitori
 */

import * as fs from 'fs';
import * as path from 'path';

interface SupplierAnalysis {
  id: number;
  name: string;
  total_orders: number;
  average_days_between_orders: number;
  most_frequent_days: string[];
  average_lead_time_days: number;
  average_order_value: number;
  last_order_date: string;
}

interface AnalysisResult {
  analysis_date: string;
  period: string;
  suppliers: SupplierAnalysis[];
}

// Carica dati
function loadData(): AnalysisResult {
  const dataPath = path.join(process.cwd(), 'data', 'supplier-cadence-analysis.json');

  if (!fs.existsSync(dataPath)) {
    console.error('File di analisi non trovato. Esegui prima: npm run analyze:suppliers');
    process.exit(1);
  }

  return JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
}

// Query functions

function getTopByOrders(data: AnalysisResult, n: number = 10): SupplierAnalysis[] {
  return data.suppliers.slice(0, n);
}

function getByFrequency(data: AnalysisResult, maxDays: number): SupplierAnalysis[] {
  return data.suppliers
    .filter(s => s.average_days_between_orders <= maxDays)
    .sort((a, b) => a.average_days_between_orders - b.average_days_between_orders);
}

function getByLeadTime(data: AnalysisResult, category: 'fast' | 'standard' | 'slow'): SupplierAnalysis[] {
  const thresholds = {
    fast: [0, 1.5],
    standard: [1.5, 5],
    slow: [5, 999]
  };

  const [min, max] = thresholds[category];

  return data.suppliers
    .filter(s => s.average_lead_time_days >= min && s.average_lead_time_days < max)
    .sort((a, b) => a.average_lead_time_days - b.average_lead_time_days);
}

function getByValue(data: AnalysisResult, minValue: number): SupplierAnalysis[] {
  return data.suppliers
    .filter(s => s.average_order_value >= minValue)
    .sort((a, b) => b.average_order_value - a.average_order_value);
}

function getByDay(data: AnalysisResult, day: string): SupplierAnalysis[] {
  return data.suppliers
    .filter(s => s.most_frequent_days.includes(day))
    .sort((a, b) => a.average_days_between_orders - b.average_days_between_orders);
}

function searchByName(data: AnalysisResult, query: string): SupplierAnalysis[] {
  const lowerQuery = query.toLowerCase();
  return data.suppliers.filter(s => s.name.toLowerCase().includes(lowerQuery));
}

function getStatistics(data: AnalysisResult) {
  const totalOrders = data.suppliers.reduce((sum, s) => sum + s.total_orders, 0);
  const avgOrderValue = data.suppliers.reduce((sum, s) => sum + s.average_order_value, 0) / data.suppliers.length;
  const avgCadence = data.suppliers.reduce((sum, s) => sum + s.average_days_between_orders, 0) / data.suppliers.length;
  const avgLeadTime = data.suppliers.reduce((sum, s) => sum + s.average_lead_time_days, 0) / data.suppliers.length;

  return {
    total_suppliers: data.suppliers.length,
    total_orders: totalOrders,
    average_order_value: Math.round(avgOrderValue * 100) / 100,
    average_cadence_days: Math.round(avgCadence * 10) / 10,
    average_lead_time_days: Math.round(avgLeadTime * 10) / 10,
    highest_value_supplier: data.suppliers.reduce((max, s) =>
      s.average_order_value > max.average_order_value ? s : max
    ),
    most_frequent_supplier: data.suppliers.reduce((min, s) =>
      s.average_days_between_orders < min.average_days_between_orders ? s : min
    )
  };
}

// Print helpers

function printSupplier(supplier: SupplierAnalysis) {
  console.log(`\n${supplier.name} (ID: ${supplier.id})`);
  console.log(`  Orders: ${supplier.total_orders}`);
  console.log(`  Cadence: ${supplier.average_days_between_orders} days`);
  console.log(`  Lead Time: ${supplier.average_lead_time_days} days`);
  console.log(`  Avg Value: €${supplier.average_order_value.toLocaleString()}`);
  console.log(`  Frequent Days: ${supplier.most_frequent_days.join(', ')}`);
  console.log(`  Last Order: ${supplier.last_order_date}`);
}

function printSuppliers(suppliers: SupplierAnalysis[], title?: string) {
  if (title) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(title);
    console.log('='.repeat(60));
  }

  if (suppliers.length === 0) {
    console.log('\nNo suppliers found matching criteria.');
    return;
  }

  suppliers.forEach(printSupplier);
  console.log(`\nTotal: ${suppliers.length} suppliers`);
}

// Main CLI

function main() {
  const data = loadData();
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Supplier Cadence Query Tool');
    console.log('\nUsage: npm run query:suppliers -- [command] [options]');
    console.log('\nCommands:');
    console.log('  stats                          - Show overall statistics');
    console.log('  top [n]                        - Show top N suppliers by orders (default: 10)');
    console.log('  frequent [maxDays]             - Suppliers with cadence <= maxDays');
    console.log('  leadtime [fast|standard|slow]  - Filter by lead time category');
    console.log('  value [minValue]               - Suppliers with avg order >= minValue');
    console.log('  day [Monday|Tuesday|...]       - Suppliers ordering on specific day');
    console.log('  search [name]                  - Search supplier by name');
    console.log('\nExamples:');
    console.log('  npm run query:suppliers -- top 5');
    console.log('  npm run query:suppliers -- frequent 4');
    console.log('  npm run query:suppliers -- leadtime fast');
    console.log('  npm run query:suppliers -- value 2000');
    console.log('  npm run query:suppliers -- day Monday');
    console.log('  npm run query:suppliers -- search aligro');
    return;
  }

  const command = args[0];

  switch (command) {
    case 'stats': {
      const stats = getStatistics(data);
      console.log('\n=== SUPPLIER STATISTICS ===');
      console.log(`Analysis Date: ${data.analysis_date}`);
      console.log(`Period: ${data.period}`);
      console.log(`\nTotal Suppliers: ${stats.total_suppliers}`);
      console.log(`Total Orders: ${stats.total_orders}`);
      console.log(`Average Order Value: €${stats.average_order_value.toLocaleString()}`);
      console.log(`Average Cadence: ${stats.average_cadence_days} days`);
      console.log(`Average Lead Time: ${stats.average_lead_time_days} days`);
      console.log(`\nHighest Value Supplier: ${stats.highest_value_supplier.name}`);
      console.log(`  €${stats.highest_value_supplier.average_order_value.toLocaleString()} per order`);
      console.log(`\nMost Frequent Supplier: ${stats.most_frequent_supplier.name}`);
      console.log(`  ${stats.most_frequent_supplier.average_days_between_orders} days between orders`);
      break;
    }

    case 'top': {
      const n = parseInt(args[1]) || 10;
      const suppliers = getTopByOrders(data, n);
      printSuppliers(suppliers, `TOP ${n} SUPPLIERS BY ORDER COUNT`);
      break;
    }

    case 'frequent': {
      const maxDays = parseInt(args[1]);
      if (isNaN(maxDays)) {
        console.error('Please specify max days: npm run query:suppliers -- frequent [maxDays]');
        return;
      }
      const suppliers = getByFrequency(data, maxDays);
      printSuppliers(suppliers, `SUPPLIERS WITH CADENCE <= ${maxDays} DAYS`);
      break;
    }

    case 'leadtime': {
      const category = args[1] as 'fast' | 'standard' | 'slow';
      if (!['fast', 'standard', 'slow'].includes(category)) {
        console.error('Category must be: fast, standard, or slow');
        return;
      }
      const suppliers = getByLeadTime(data, category);
      const ranges = {
        fast: '0-1.5 days',
        standard: '1.5-5 days',
        slow: '5+ days'
      };
      printSuppliers(suppliers, `SUPPLIERS WITH ${category.toUpperCase()} LEAD TIME (${ranges[category]})`);
      break;
    }

    case 'value': {
      const minValue = parseInt(args[1]);
      if (isNaN(minValue)) {
        console.error('Please specify min value: npm run query:suppliers -- value [minValue]');
        return;
      }
      const suppliers = getByValue(data, minValue);
      printSuppliers(suppliers, `SUPPLIERS WITH AVG ORDER VALUE >= €${minValue.toLocaleString()}`);
      break;
    }

    case 'day': {
      const day = args[1];
      if (!day) {
        console.error('Please specify day: npm run query:suppliers -- day [Monday|Tuesday|...]');
        return;
      }
      const suppliers = getByDay(data, day);
      printSuppliers(suppliers, `SUPPLIERS ORDERING ON ${day.toUpperCase()}`);
      break;
    }

    case 'search': {
      const query = args[1];
      if (!query) {
        console.error('Please specify search query: npm run query:suppliers -- search [name]');
        return;
      }
      const suppliers = searchByName(data, query);
      printSuppliers(suppliers, `SEARCH RESULTS FOR "${query}"`);
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      console.log('Run without arguments to see help.');
  }
}

main();
