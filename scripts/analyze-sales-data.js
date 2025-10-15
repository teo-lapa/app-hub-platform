// Script per analizzare i dati di vendita reali da Odoo staging
// Analisi degli ultimi 90-120 giorni per identificare pattern e prodotti TOP

const fs = require('fs');
const path = require('path');

// Leggi il file .env.local manualmente
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const env = {};

  envContent.split('\n').forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      if (key) {
        env[key.trim()] = valueParts.join('=').trim();
      }
    }
  });

  return env;
}

const env = loadEnv();
const ODOO_URL = env.ODOO_URL || env.NEXT_PUBLIC_ODOO_URL;
const ODOO_DB = env.ODOO_DB;
const ODOO_API_KEY = env.ODOO_API_KEY;

console.log('\n========================================');
console.log('LAPA FOOD BUSINESS ANALYSIS');
console.log('========================================\n');
console.log('Connecting to Odoo:', ODOO_URL);
console.log('Database:', ODOO_DB);
console.log('\n');

// Variabili globali per la sessione
let sessionCookie = null;

// Funzione per autenticarsi
async function authenticate() {
  console.log('Authenticating with Odoo...');

  // Usa le credenziali corrette per Odoo
  const credentials = {
    login: 'paul@lapa.ch',
    password: 'lapa201180'
  };

  const payload = {
    jsonrpc: '2.0',
    method: 'call',
    params: {
      db: ODOO_DB,
      login: credentials.login,
      password: credentials.password,
    },
    id: Date.now(),
  };

  try {
    const response = await fetch(`${ODOO_URL}/web/session/authenticate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const cookies = response.headers.get('set-cookie');
    if (cookies) {
      // Estrai il session_id dal cookie
      const sessionMatch = cookies.match(/session_id=([^;]+)/);
      if (sessionMatch) {
        sessionCookie = `session_id=${sessionMatch[1]}`;
      }
    }

    const data = await response.json();

    if (data.error) {
      console.error('Authentication error:', data.error);
      throw new Error(data.error.message || 'Authentication failed');
    }

    if (!data.result || !data.result.uid) {
      throw new Error('Authentication failed: no UID received');
    }

    console.log('✓ Authenticated successfully! UID:', data.result.uid);
    console.log('✓ User:', data.result.name);
    console.log('✓ Session established\n');

    return data.result;
  } catch (error) {
    console.error('Authentication failed:', error.message);
    throw error;
  }
}

// Utility per chiamate RPC a Odoo
async function odooRPC(model, method, args = [], kwargs = {}) {
  const url = `${ODOO_URL}/web/dataset/call_kw/${model}/${method}`;

  const payload = {
    jsonrpc: '2.0',
    method: 'call',
    params: {
      model,
      method,
      args,
      kwargs,
    },
    id: Date.now(),
  };

  const headers = {
    'Content-Type': 'application/json',
  };

  if (sessionCookie) {
    headers['Cookie'] = sessionCookie;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (data.error) {
      console.error('Odoo RPC Error:', data.error);
      throw new Error(data.error.data?.message || data.error.message);
    }

    return data.result;
  } catch (error) {
    console.error('Fetch error:', error.message);
    throw error;
  }
}

// Funzione per ottenere dati di vendita
async function getSalesData(daysBack = 120) {
  console.log(`\nFetching sales data from last ${daysBack} days...`);

  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - daysBack);
  const dateFromStr = dateFrom.toISOString().split('T')[0];

  console.log('Date from:', dateFromStr);

  try {
    const salesLines = await odooRPC('sale.order.line', 'search_read', [[
      ['create_date', '>=', dateFromStr],
      ['state', 'in', ['sale', 'done']]
    ]], {
      fields: [
        'id',
        'order_id',
        'product_id',
        'product_uom_qty',
        'qty_delivered',
        'price_unit',
        'price_subtotal',
        'create_date',
        'name'
      ],
      limit: 10000,
      order: 'create_date desc'
    });

    console.log(`✓ Found ${salesLines.length} sale order lines`);
    return salesLines;
  } catch (error) {
    console.error('Error fetching sales data:', error);
    return [];
  }
}

// Funzione per ottenere info prodotti
async function getProductsInfo(productIds) {
  console.log(`\nFetching info for ${productIds.length} products...`);

  try {
    const products = await odooRPC('product.product', 'search_read', [[
      ['id', 'in', productIds]
    ]], {
      fields: [
        'id',
        'name',
        'default_code',
        'categ_id',
        'qty_available',
        'virtual_available',
        'uom_id',
        'seller_ids',
        'standard_price',
        'list_price'
      ]
    });

    console.log(`✓ Found ${products.length} products`);
    return products;
  } catch (error) {
    console.error('Error fetching products:', error);
    return [];
  }
}

// Funzione per ottenere info fornitori
async function getSuppliersInfo(sellerIds) {
  if (!sellerIds || sellerIds.length === 0) return {};

  console.log(`\nFetching supplier info for ${sellerIds.length} seller records...`);

  try {
    const sellers = await odooRPC('product.supplierinfo', 'search_read', [[
      ['id', 'in', sellerIds]
    ]], {
      fields: ['id', 'partner_id', 'delay', 'min_qty', 'price', 'product_id']
    });

    console.log(`✓ Found ${sellers.length} supplier records`);
    return sellers.reduce((acc, seller) => {
      acc[seller.id] = seller;
      return acc;
    }, {});
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    return {};
  }
}

// Analisi dei pattern di vendita
function analyzeSalesPatterns(salesLines) {
  console.log('\n\n========================================');
  console.log('ANALYZING SALES PATTERNS');
  console.log('========================================\n');

  const productStats = {};

  // Aggrega dati per prodotto
  salesLines.forEach(line => {
    const productId = line.product_id[0];
    const productName = line.product_id[1];
    const qty = line.product_uom_qty || 0;
    const date = new Date(line.create_date);
    const dayOfWeek = date.getDay(); // 0 = domenica, 1 = lunedì, ...

    if (!productStats[productId]) {
      productStats[productId] = {
        id: productId,
        name: productName,
        totalQty: 0,
        totalRevenue: 0,
        orderCount: 0,
        dates: [],
        dailySales: {},
        weekdaySales: [0, 0, 0, 0, 0, 0, 0], // Lun-Dom
      };
    }

    const stats = productStats[productId];
    stats.totalQty += qty;
    stats.totalRevenue += line.price_subtotal || 0;
    stats.orderCount += 1;
    stats.dates.push(date);
    stats.weekdaySales[dayOfWeek] += qty;

    // Aggrega per giorno
    const dateKey = date.toISOString().split('T')[0];
    stats.dailySales[dateKey] = (stats.dailySales[dateKey] || 0) + qty;
  });

  // Calcola metriche avanzate
  Object.values(productStats).forEach(stats => {
    // Ordina le date
    stats.dates.sort((a, b) => a - b);

    if (stats.dates.length > 0) {
      const firstDate = stats.dates[0];
      const lastDate = stats.dates[stats.dates.length - 1];
      const daysActive = Math.max(1, Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24)));

      stats.daysActive = daysActive;
      stats.avgDailySales = stats.totalQty / daysActive;
      stats.avgOrderValue = stats.totalRevenue / stats.orderCount;

      // Calcola variabilità (coefficient of variation)
      const dailyValues = Object.values(stats.dailySales);
      const mean = dailyValues.reduce((a, b) => a + b, 0) / dailyValues.length;
      const variance = dailyValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / dailyValues.length;
      const stdDev = Math.sqrt(variance);
      stats.variability = mean > 0 ? (stdDev / mean) : 0;

      // Identifica giorni preferiti
      const maxWeekdayQty = Math.max(...stats.weekdaySales);
      stats.preferredDays = stats.weekdaySales
        .map((qty, idx) => ({ day: ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'][idx], qty }))
        .filter(d => d.qty > maxWeekdayQty * 0.7)
        .map(d => d.day);
    }
  });

  return productStats;
}

// Identifica prodotti TOP
function identifyTopProducts(productStats, minOrders = 10) {
  console.log('\n\n========================================');
  console.log('TOP PRODUCTS IDENTIFICATION');
  console.log('========================================\n');

  const topProducts = Object.values(productStats)
    .filter(p => p.orderCount >= minOrders)
    .sort((a, b) => b.totalQty - a.totalQty);

  console.log(`Found ${topProducts.length} products with >= ${minOrders} orders\n`);

  // Top 30 per quantità
  console.log('TOP 30 PRODUCTS BY QUANTITY:\n');
  console.log('Rank | Product Name | Total Qty | Orders | Avg Daily | Variability | Preferred Days');
  console.log('-'.repeat(120));

  topProducts.slice(0, 30).forEach((product, idx) => {
    const rank = (idx + 1).toString().padStart(4);
    const name = product.name.substring(0, 40).padEnd(40);
    const qty = product.totalQty.toFixed(1).padStart(10);
    const orders = product.orderCount.toString().padStart(7);
    const avgDaily = product.avgDailySales.toFixed(2).padStart(10);
    const variability = (product.variability * 100).toFixed(0).padStart(5) + '%';
    const days = product.preferredDays.join(', ');

    console.log(`${rank} | ${name} | ${qty} | ${orders} | ${avgDaily} | ${variability} | ${days}`);
  });

  return topProducts;
}

// Analisi stock e criticità
async function analyzeStockCriticality(topProducts, productsInfo) {
  console.log('\n\n========================================');
  console.log('STOCK CRITICALITY ANALYSIS');
  console.log('========================================\n');

  const productsMap = {};
  productsInfo.forEach(p => {
    productsMap[p.id] = p;
  });

  const criticalProducts = [];
  const orderSoonProducts = [];

  topProducts.forEach(stats => {
    const productInfo = productsMap[stats.id];
    if (!productInfo) return;

    const currentStock = productInfo.qty_available || 0;
    const avgDailySales = stats.avgDailySales;

    if (avgDailySales > 0) {
      const daysRemaining = currentStock / avgDailySales;

      const analysis = {
        ...stats,
        currentStock,
        daysRemaining: daysRemaining.toFixed(1),
        reorderPoint: (avgDailySales * 7).toFixed(1), // 1 settimana di buffer
        category: productInfo.categ_id ? productInfo.categ_id[1] : 'N/A',
        code: productInfo.default_code || 'N/A',
      };

      if (daysRemaining < 5) {
        criticalProducts.push(analysis);
      } else if (daysRemaining < 10) {
        orderSoonProducts.push(analysis);
      }
    }
  });

  // Prodotti CRITICI (< 5 giorni)
  console.log('CRITICAL PRODUCTS (< 5 days of stock):\n');
  if (criticalProducts.length === 0) {
    console.log('✓ No critical products found!\n');
  } else {
    console.log('Code     | Product Name                    | Stock | Avg Daily | Days Left | Reorder Point');
    console.log('-'.repeat(100));
    criticalProducts
      .sort((a, b) => parseFloat(a.daysRemaining) - parseFloat(b.daysRemaining))
      .forEach(p => {
        const code = p.code.substring(0, 8).padEnd(8);
        const name = p.name.substring(0, 30).padEnd(30);
        const stock = p.currentStock.toFixed(1).padStart(6);
        const avgDaily = p.avgDailySales.toFixed(1).padStart(9);
        const days = p.daysRemaining.padStart(9);
        const reorder = p.reorderPoint.padStart(13);

        console.log(`${code} | ${name} | ${stock} | ${avgDaily} | ${days} | ${reorder}`);
      });
  }

  // Prodotti da ORDINARE PRESTO (5-10 giorni)
  console.log('\n\nPRODUCTS TO ORDER SOON (5-10 days of stock):\n');
  if (orderSoonProducts.length === 0) {
    console.log('✓ No products need ordering this week!\n');
  } else {
    console.log('Code     | Product Name                    | Stock | Avg Daily | Days Left | Reorder Point');
    console.log('-'.repeat(100));
    orderSoonProducts
      .sort((a, b) => parseFloat(a.daysRemaining) - parseFloat(b.daysRemaining))
      .slice(0, 15) // Top 15
      .forEach(p => {
        const code = p.code.substring(0, 8).padEnd(8);
        const name = p.name.substring(0, 30).padEnd(30);
        const stock = p.currentStock.toFixed(1).padStart(6);
        const avgDaily = p.avgDailySales.toFixed(1).padStart(9);
        const days = p.daysRemaining.padStart(9);
        const reorder = p.reorderPoint.padStart(13);

        console.log(`${code} | ${name} | ${stock} | ${avgDaily} | ${days} | ${reorder}`);
      });
  }

  return { criticalProducts, orderSoonProducts };
}

// Identifica pattern interessanti
function identifyInterestingPatterns(productStats, topProducts) {
  console.log('\n\n========================================');
  console.log('INTERESTING PATTERNS DISCOVERED');
  console.log('========================================\n');

  // Pattern 1: Prodotti con vendite molto stabili (bassa variabilità)
  const stableProducts = topProducts
    .filter(p => p.variability < 0.3 && p.orderCount >= 15)
    .slice(0, 5);

  if (stableProducts.length > 0) {
    console.log('1. MOST STABLE PRODUCTS (consistent sales):\n');
    stableProducts.forEach(p => {
      console.log(`   - ${p.name}`);
      console.log(`     Avg: ${p.avgDailySales.toFixed(1)}/day, Variability: ${(p.variability * 100).toFixed(0)}%\n`);
    });
  }

  // Pattern 2: Prodotti con picchi (alta variabilità)
  const volatileProducts = topProducts
    .filter(p => p.variability > 0.8 && p.orderCount >= 10)
    .slice(0, 5);

  if (volatileProducts.length > 0) {
    console.log('\n2. VOLATILE PRODUCTS (with peaks):\n');
    volatileProducts.forEach(p => {
      console.log(`   - ${p.name}`);
      console.log(`     Avg: ${p.avgDailySales.toFixed(1)}/day, Variability: ${(p.variability * 100).toFixed(0)}%`);
      console.log(`     Preferred days: ${p.preferredDays.join(', ')}\n`);
    });
  }

  // Pattern 3: Prodotti weekend vs weekday
  const weekdayProducts = topProducts
    .filter(p => {
      const weekdayTotal = p.weekdaySales.slice(1, 6).reduce((a, b) => a + b, 0); // Lun-Ven
      const weekendTotal = p.weekdaySales[0] + p.weekdaySales[6]; // Sab-Dom
      return weekdayTotal > weekendTotal * 2 && p.orderCount >= 10;
    })
    .slice(0, 5);

  if (weekdayProducts.length > 0) {
    console.log('\n3. WEEKDAY-FOCUSED PRODUCTS:\n');
    weekdayProducts.forEach(p => {
      const weekdayTotal = p.weekdaySales.slice(1, 6).reduce((a, b) => a + b, 0);
      const weekendTotal = p.weekdaySales[0] + p.weekdaySales[6];
      const ratio = (weekdayTotal / weekendTotal).toFixed(1);

      console.log(`   - ${p.name}`);
      console.log(`     Weekday/Weekend ratio: ${ratio}x more on weekdays\n`);
    });
  }

  // Pattern 4: Crescita/Decrescita trend
  console.log('\n4. TREND ANALYSIS:\n');
  const trendProducts = topProducts.slice(0, 10).map(p => {
    const dates = Object.keys(p.dailySales).sort();
    if (dates.length < 30) return null;

    // Compara primi 30 giorni vs ultimi 30 giorni
    const midpoint = Math.floor(dates.length / 2);
    const firstHalf = dates.slice(0, midpoint);
    const secondHalf = dates.slice(midpoint);

    const firstHalfAvg = firstHalf.reduce((sum, date) => sum + p.dailySales[date], 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, date) => sum + p.dailySales[date], 0) / secondHalf.length;

    const growth = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;

    return {
      name: p.name,
      growth: growth.toFixed(1),
      firstHalfAvg: firstHalfAvg.toFixed(1),
      secondHalfAvg: secondHalfAvg.toFixed(1)
    };
  }).filter(Boolean);

  const growing = trendProducts.filter(p => parseFloat(p.growth) > 20).slice(0, 3);
  const declining = trendProducts.filter(p => parseFloat(p.growth) < -20).slice(0, 3);

  if (growing.length > 0) {
    console.log('   GROWING PRODUCTS:\n');
    growing.forEach(p => {
      console.log(`   - ${p.name}`);
      console.log(`     Growth: +${p.growth}% (from ${p.firstHalfAvg}/day to ${p.secondHalfAvg}/day)\n`);
    });
  }

  if (declining.length > 0) {
    console.log('   DECLINING PRODUCTS:\n');
    declining.forEach(p => {
      console.log(`   - ${p.name}`);
      console.log(`     Decline: ${p.growth}% (from ${p.firstHalfAvg}/day to ${p.secondHalfAvg}/day)\n`);
    });
  }
}

// Suggerimenti per la dashboard
function generateDashboardSuggestions(analysisResults) {
  console.log('\n\n========================================');
  console.log('DASHBOARD DESIGN SUGGESTIONS');
  console.log('========================================\n');

  console.log('Based on the analysis, here are key features for your dashboard:\n');

  console.log('1. REAL-TIME ALERTS PANEL:');
  console.log('   - Red alerts for products with < 5 days stock');
  console.log('   - Yellow warnings for products with 5-10 days stock');
  console.log('   - Auto-calculate optimal reorder quantities based on avg daily sales\n');

  console.log('2. TOP MOVERS SECTION:');
  console.log('   - Display top 20-30 products by daily movement');
  console.log('   - Show trend indicators (growing/stable/declining)');
  console.log('   - Include variability indicators (stable vs volatile)\n');

  console.log('3. SALES PATTERNS VISUALIZATION:');
  console.log('   - Heatmap of weekday/weekend patterns');
  console.log('   - Time-series graphs showing daily trends');
  console.log('   - Seasonal indicators (if data available)\n');

  console.log('4. SMART ORDERING ASSISTANT:');
  console.log('   - Suggested order quantities based on:');
  console.log('     * Average daily consumption');
  console.log('     * Lead time from supplier');
  console.log('     * Safety stock (7-14 days recommended)');
  console.log('     * Day-of-week patterns\n');

  console.log('5. CATEGORY INSIGHTS:');
  console.log('   - Group products by category');
  console.log('   - Show category-level trends');
  console.log('   - Identify which categories drive revenue\n');

  console.log('6. PERFORMANCE METRICS:');
  console.log('   - Stock turnover rate');
  console.log('   - Days of inventory on hand');
  console.log('   - Revenue per product');
  console.log('   - Order frequency optimization\n');
}

// Main execution
async function main() {
  try {
    // Step 0: Authenticate
    await authenticate();

    // Step 1: Get sales data
    const salesLines = await getSalesData(120);

    if (salesLines.length === 0) {
      console.log('No sales data found. Exiting.');
      return;
    }

    // Step 2: Analyze patterns
    const productStats = analyzeSalesPatterns(salesLines);

    // Step 3: Identify top products
    const topProducts = identifyTopProducts(productStats, 10);

    // Step 4: Get product info
    const productIds = topProducts.map(p => p.id);
    const productsInfo = await getProductsInfo(productIds);

    // Step 5: Analyze stock criticality
    const { criticalProducts, orderSoonProducts } = await analyzeStockCriticality(
      topProducts.slice(0, 50), // Top 50 prodotti
      productsInfo
    );

    // Step 6: Identify patterns
    identifyInterestingPatterns(productStats, topProducts);

    // Step 7: Dashboard suggestions
    generateDashboardSuggestions({
      topProducts,
      criticalProducts,
      orderSoonProducts,
      productStats
    });

    console.log('\n\n========================================');
    console.log('ANALYSIS COMPLETE!');
    console.log('========================================\n');

    // Summary stats
    console.log('SUMMARY:');
    console.log(`- Total sale order lines analyzed: ${salesLines.length}`);
    console.log(`- Unique products found: ${Object.keys(productStats).length}`);
    console.log(`- Top products (>10 orders): ${topProducts.length}`);
    console.log(`- Critical products (< 5 days): ${criticalProducts.length}`);
    console.log(`- Products to order soon (5-10 days): ${orderSoonProducts.length}`);
    console.log('\n');

  } catch (error) {
    console.error('\n\nFATAL ERROR:', error);
    console.error('Stack:', error.stack);
  }
}

// Run the analysis
main();
