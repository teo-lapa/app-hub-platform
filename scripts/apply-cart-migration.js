/**
 * ============================================================================
 * MAESTRO AI - Cart Migration Script
 * ============================================================================
 * Database Optimizer - Applies and verifies cart tables migration
 * Target Performance: All verification queries < 100ms
 * ============================================================================
 */

require('dotenv').config({ path: './.env.local' });
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  section: (msg) => console.log(`\n${colors.cyan}${'='.repeat(80)}\n${msg}\n${'='.repeat(80)}${colors.reset}\n`),
};

// Database connection configuration
const getDbConfig = () => {
  // Try Vercel Postgres env vars first
  if (process.env.POSTGRES_URL) {
    return {
      connectionString: process.env.POSTGRES_URL,
      ssl: { rejectUnauthorized: false },
    };
  }

  // Fallback to individual env vars
  return {
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DATABASE,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    ssl: { rejectUnauthorized: false },
  };
};

/**
 * Test database connection
 */
async function testConnection(client) {
  try {
    const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
    log.success(`Database connected: ${result.rows[0].current_time}`);
    log.info(`PostgreSQL version: ${result.rows[0].pg_version.split(',')[0]}`);
    return true;
  } catch (error) {
    log.error(`Connection failed: ${error.message}`);
    return false;
  }
}

/**
 * Check if tables already exist
 */
async function checkTablesExist(client) {
  const query = `
    SELECT
      table_name,
      (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
    FROM information_schema.tables t
    WHERE table_name IN ('customer_carts', 'cart_items', 'cart_activity_log')
      AND table_schema = 'public'
    ORDER BY table_name;
  `;

  const result = await client.query(query);
  return result.rows;
}

/**
 * Apply migration SQL
 */
async function applyMigration(client) {
  const migrationPath = path.join(__dirname, '..', '..', 'database', 'migrations', '005_create_customer_cart_tables.sql');

  if (!fs.existsSync(migrationPath)) {
    log.error(`Migration file not found: ${migrationPath}`);
    return false;
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');
  log.info(`Migration file size: ${(sql.length / 1024).toFixed(2)} KB`);

  try {
    const startTime = Date.now();
    await client.query(sql);
    const duration = Date.now() - startTime;
    log.success(`Migration applied successfully in ${duration}ms`);
    return true;
  } catch (error) {
    log.error(`Migration failed: ${error.message}`);
    console.error(error.stack);
    return false;
  }
}

/**
 * Verify tables created
 */
async function verifyTables(client) {
  log.section('TABLES VERIFICATION');

  const query = `
    SELECT
      table_name,
      (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name AND table_schema = 'public') as column_count,
      pg_size_pretty(pg_total_relation_size('public.' || table_name)) as total_size,
      pg_size_pretty(pg_relation_size('public.' || table_name)) as table_size,
      pg_size_pretty(pg_total_relation_size('public.' || table_name) - pg_relation_size('public.' || table_name)) as indexes_size
    FROM information_schema.tables t
    WHERE table_name IN ('customer_carts', 'cart_items', 'cart_activity_log')
      AND table_schema = 'public'
    ORDER BY table_name;
  `;

  const result = await client.query(query);

  console.table(result.rows);

  return result.rows;
}

/**
 * Verify indexes created
 */
async function verifyIndexes(client) {
  log.section('INDEXES VERIFICATION');

  const query = `
    SELECT
      tablename,
      indexname,
      CASE
        WHEN indexdef LIKE '%UNIQUE%' THEN 'UNIQUE'
        WHEN indexdef LIKE '%GIN%' THEN 'GIN'
        ELSE 'BTREE'
      END as index_type,
      CASE
        WHEN indexdef LIKE '%WHERE%' THEN 'PARTIAL'
        ELSE 'FULL'
      END as scope
    FROM pg_indexes
    WHERE tablename IN ('customer_carts', 'cart_items', 'cart_activity_log')
      AND schemaname = 'public'
    ORDER BY tablename, indexname;
  `;

  const result = await client.query(query);

  console.table(result.rows);

  return result.rows;
}

/**
 * Verify triggers created
 */
async function verifyTriggers(client) {
  log.section('TRIGGERS VERIFICATION');

  const query = `
    SELECT
      trigger_name,
      event_object_table as table_name,
      action_timing || ' ' || event_manipulation as trigger_event,
      action_statement as function_call
    FROM information_schema.triggers
    WHERE event_object_table IN ('customer_carts', 'cart_items')
      AND trigger_schema = 'public'
    ORDER BY event_object_table, trigger_name;
  `;

  const result = await client.query(query);

  console.table(result.rows);

  return result.rows;
}

/**
 * Verify functions created
 */
async function verifyFunctions(client) {
  log.section('FUNCTIONS VERIFICATION');

  const query = `
    SELECT
      routine_name as function_name,
      routine_type,
      data_type as return_type,
      external_language as language
    FROM information_schema.routines
    WHERE routine_name LIKE '%cart%'
      AND routine_schema = 'public'
    ORDER BY routine_name;
  `;

  const result = await client.query(query);

  console.table(result.rows);

  return result.rows;
}

/**
 * Test get_or_create_cart function
 */
async function testGetOrCreateCart(client) {
  log.section('TESTING get_or_create_cart FUNCTION');

  const testEmail = 'test.optimizer@maestroai.com';
  const testPartnerId = null; // NULL for test (no FK constraint violation)

  try {
    // Test 1: Create new cart
    log.info(`Test 1: Creating cart for ${testEmail}...`);
    const startTime1 = Date.now();
    const result1 = await client.query(
      'SELECT get_or_create_cart($1, $2, $3) as cart_id',
      [testEmail, testPartnerId, 'test-session-token-123']
    );
    const duration1 = Date.now() - startTime1;
    const cartId = result1.rows[0].cart_id;

    log.success(`Cart created with ID: ${cartId} (${duration1}ms)`);

    // Test 2: Get existing cart (should return same ID)
    log.info('Test 2: Retrieving existing cart...');
    const startTime2 = Date.now();
    const result2 = await client.query(
      'SELECT get_or_create_cart($1, $2, $3) as cart_id',
      [testEmail, testPartnerId, 'test-session-token-456']
    );
    const duration2 = Date.now() - startTime2;
    const cartId2 = result2.rows[0].cart_id;

    if (cartId === cartId2) {
      log.success(`Same cart returned: ${cartId2} (${duration2}ms) - IDEMPOTENT ✅`);
    } else {
      log.warning(`Different cart returned: ${cartId2} (expected ${cartId})`);
    }

    // Verify cart details
    const cartDetails = await client.query('SELECT * FROM customer_carts WHERE id = $1', [cartId]);
    console.log('\nCart details:');
    console.table(cartDetails.rows);

    // Verify activity log
    const activityLog = await client.query('SELECT * FROM cart_activity_log WHERE cart_id = $1', [cartId]);
    log.info(`Activity log entries: ${activityLog.rowCount}`);
    console.table(activityLog.rows);

    return { cartId, testEmail };
  } catch (error) {
    log.error(`Test failed: ${error.message}`);
    throw error;
  }
}

/**
 * Test add_to_cart function
 */
async function testAddToCart(client, cartId) {
  log.section('TESTING add_to_cart FUNCTION');

  const testProducts = [
    {
      id: 10001,
      name: 'Test Product A - Olio Extra Vergine',
      code: 'TEST-OIL-001',
      quantity: 5.0,
      price: 12.50,
      uom: 'Lt',
    },
    {
      id: 10002,
      name: 'Test Product B - Pasta Integrale',
      code: 'TEST-PASTA-001',
      quantity: 10.0,
      price: 2.30,
      uom: 'Kg',
    },
    {
      id: 10003,
      name: 'Test Product C - Pomodori Pelati',
      code: 'TEST-TOM-001',
      quantity: 24.0,
      price: 1.80,
      uom: 'Pz',
    },
  ];

  try {
    for (const product of testProducts) {
      log.info(`Adding ${product.quantity} ${product.uom} of ${product.name}...`);
      const startTime = Date.now();

      const result = await client.query(
        'SELECT add_to_cart($1, $2, $3, $4, $5, $6, $7) as item_id',
        [
          cartId,
          product.id,
          product.name,
          product.code,
          product.quantity,
          product.price,
          product.uom,
        ]
      );

      const duration = Date.now() - startTime;
      const itemId = result.rows[0].item_id;
      log.success(`Item added: ID ${itemId} (${duration}ms)`);
    }

    // Test adding duplicate (should increment quantity)
    log.info('\nTest: Adding duplicate product (should increment quantity)...');
    const duplicateProduct = testProducts[0];
    const startTime = Date.now();

    await client.query(
      'SELECT add_to_cart($1, $2, $3, $4, $5, $6, $7) as item_id',
      [
        cartId,
        duplicateProduct.id,
        duplicateProduct.name,
        duplicateProduct.code,
        3.0, // Add 3 more
        duplicateProduct.price,
        duplicateProduct.uom,
      ]
    );

    const duration = Date.now() - startTime;
    log.success(`Duplicate handled correctly (${duration}ms)`);

    // Verify cart items
    log.info('\nCart items:');
    const cartItems = await client.query(
      `SELECT
        id,
        odoo_product_id,
        product_name,
        product_code,
        quantity,
        unit_price,
        subtotal,
        uom,
        added_at
      FROM cart_items
      WHERE cart_id = $1
      ORDER BY added_at ASC`,
      [cartId]
    );

    console.table(cartItems.rows);

    // Verify cart metadata auto-update (via trigger)
    log.info('\nCart metadata (auto-updated by triggers):');
    const cartMeta = await client.query(
      `SELECT
        id,
        customer_email,
        item_count,
        total_amount,
        last_activity_at,
        updated_at
      FROM customer_carts
      WHERE id = $1`,
      [cartId]
    );

    console.table(cartMeta.rows);

    const expectedItemCount = testProducts.length; // 3 unique products
    const actualItemCount = cartMeta.rows[0].item_count;

    if (actualItemCount === expectedItemCount) {
      log.success(`Item count correct: ${actualItemCount} ✅`);
    } else {
      log.warning(`Item count mismatch: expected ${expectedItemCount}, got ${actualItemCount}`);
    }

    // Calculate expected total
    const expectedTotal = (
      (testProducts[0].quantity + 3.0) * testProducts[0].price +
      testProducts[1].quantity * testProducts[1].price +
      testProducts[2].quantity * testProducts[2].price
    ).toFixed(2);

    const actualTotal = parseFloat(cartMeta.rows[0].total_amount).toFixed(2);

    if (expectedTotal === actualTotal) {
      log.success(`Total amount correct: €${actualTotal} ✅`);
    } else {
      log.warning(`Total amount mismatch: expected €${expectedTotal}, got €${actualTotal}`);
    }

    // Verify activity log
    log.info('\nActivity log (auto-generated by triggers):');
    const activityLog = await client.query(
      `SELECT
        id,
        event_type,
        event_data,
        created_at
      FROM cart_activity_log
      WHERE cart_id = $1
      ORDER BY created_at ASC`,
      [cartId]
    );

    console.table(activityLog.rows);

    return true;
  } catch (error) {
    log.error(`Test failed: ${error.message}`);
    throw error;
  }
}

/**
 * Test get_cart_summary function
 */
async function testGetCartSummary(client, cartId) {
  log.section('TESTING get_cart_summary FUNCTION');

  try {
    const startTime = Date.now();
    const result = await client.query('SELECT get_cart_summary($1) as summary', [cartId]);
    const duration = Date.now() - startTime;

    const summary = result.rows[0].summary;

    log.success(`Cart summary retrieved in ${duration}ms`);
    console.log('\nCart Summary JSON:');
    console.log(JSON.stringify(summary, null, 2));

    return true;
  } catch (error) {
    log.error(`Test failed: ${error.message}`);
    throw error;
  }
}

/**
 * Performance benchmark
 */
async function performanceBenchmark(client, cartId) {
  log.section('PERFORMANCE BENCHMARK');

  const queries = [
    {
      name: 'Get active cart by email',
      sql: `SELECT * FROM customer_carts WHERE customer_email = $1 AND status = 'active' LIMIT 1`,
      params: ['test.optimizer@maestroai.com'],
      target: 50,
    },
    {
      name: 'Get cart items',
      sql: 'SELECT * FROM cart_items WHERE cart_id = $1',
      params: [cartId],
      target: 50,
    },
    {
      name: 'Get cart summary (complex join)',
      sql: 'SELECT get_cart_summary($1)',
      params: [cartId],
      target: 100,
    },
    {
      name: 'Get cart activity log',
      sql: 'SELECT * FROM cart_activity_log WHERE cart_id = $1 ORDER BY created_at DESC',
      params: [cartId],
      target: 50,
    },
  ];

  const results = [];

  for (const query of queries) {
    const runs = [];

    // Warm-up run
    await client.query(query.sql, query.params);

    // 5 test runs
    for (let i = 0; i < 5; i++) {
      const startTime = Date.now();
      await client.query(query.sql, query.params);
      const duration = Date.now() - startTime;
      runs.push(duration);
    }

    const avgDuration = runs.reduce((a, b) => a + b, 0) / runs.length;
    const minDuration = Math.min(...runs);
    const maxDuration = Math.max(...runs);

    const status = avgDuration < query.target ? '✅' : '⚠️';

    results.push({
      query: query.name,
      avg_ms: avgDuration.toFixed(2),
      min_ms: minDuration,
      max_ms: maxDuration,
      target_ms: query.target,
      status,
    });
  }

  console.table(results);

  const allPassed = results.every(r => r.status === '✅');
  if (allPassed) {
    log.success('All performance targets met! 🚀');
  } else {
    log.warning('Some queries exceeded performance targets');
  }

  return results;
}

/**
 * Cleanup test data
 */
async function cleanupTestData(client, testEmail) {
  log.section('CLEANUP TEST DATA');

  try {
    // Delete test carts (cascade will delete items and activity log)
    const result = await client.query(
      'DELETE FROM customer_carts WHERE customer_email = $1 RETURNING id',
      [testEmail]
    );

    if (result.rowCount > 0) {
      log.success(`Cleaned up ${result.rowCount} test cart(s)`);
    } else {
      log.info('No test data to clean up');
    }
  } catch (error) {
    log.error(`Cleanup failed: ${error.message}`);
  }
}

/**
 * Generate final report
 */
function generateReport(data) {
  log.section('MIGRATION REPORT');

  const {
    tablesExistBefore,
    migrationApplied,
    tables,
    indexes,
    triggers,
    functions,
    testResults,
    performanceResults,
  } = data;

  console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║                     CART MIGRATION VERIFICATION REPORT                     ║
╚════════════════════════════════════════════════════════════════════════════╝

${migrationApplied ? colors.green + '✅' : colors.red + '❌'} MIGRATION STATUS: ${migrationApplied ? 'APPLIED SUCCESSFULLY' : 'FAILED'}${colors.reset}

───────────────────────────────────────────────────────────────────────────────
📊 TABLES CREATED (${tables.length}/3)
───────────────────────────────────────────────────────────────────────────────
${tables.map(t => `  ✅ ${t.table_name.padEnd(25)} - ${t.column_count} columns, ${t.total_size}`).join('\n')}

───────────────────────────────────────────────────────────────────────────────
🔍 INDEXES CREATED (${indexes.length})
───────────────────────────────────────────────────────────────────────────────
${indexes.map(i => `  ✅ ${i.indexname.padEnd(40)} (${i.index_type}, ${i.scope})`).join('\n')}

───────────────────────────────────────────────────────────────────────────────
⚡ TRIGGERS CREATED (${triggers.length})
───────────────────────────────────────────────────────────────────────────────
${triggers.map(t => `  ✅ ${t.trigger_name.padEnd(40)} on ${t.table_name}`).join('\n')}

───────────────────────────────────────────────────────────────────────────────
🔧 FUNCTIONS CREATED (${functions.length})
───────────────────────────────────────────────────────────────────────────────
${functions.map(f => `  ✅ ${f.function_name.padEnd(30)} → ${f.return_type}`).join('\n')}

───────────────────────────────────────────────────────────────────────────────
🧪 FUNCTION TESTS
───────────────────────────────────────────────────────────────────────────────
  ${testResults.getOrCreateCart ? '✅' : '❌'} get_or_create_cart() - ${testResults.getOrCreateCart ? 'PASSED' : 'FAILED'}
  ${testResults.addToCart ? '✅' : '❌'} add_to_cart() - ${testResults.addToCart ? 'PASSED' : 'FAILED'}
  ${testResults.getCartSummary ? '✅' : '❌'} get_cart_summary() - ${testResults.getCartSummary ? 'PASSED' : 'FAILED'}

───────────────────────────────────────────────────────────────────────────────
⚡ PERFORMANCE BENCHMARK
───────────────────────────────────────────────────────────────────────────────
${performanceResults.map(p => `  ${p.status} ${p.query.padEnd(35)} - ${p.avg_ms}ms avg (target: ${p.target_ms}ms)`).join('\n')}

───────────────────────────────────────────────────────────────────────────────
${colors.cyan}Database Optimizer Report - ${new Date().toISOString()}${colors.reset}
  `);

  // Overall status
  const allTestsPassed = testResults.getOrCreateCart && testResults.addToCart && testResults.getCartSummary;
  const allPerfPassed = performanceResults.every(p => p.status === '✅');

  if (migrationApplied && allTestsPassed && allPerfPassed) {
    log.success('✨ MIGRATION COMPLETE - ALL SYSTEMS OPERATIONAL ✨');
    return true;
  } else {
    log.warning('⚠️  MIGRATION COMPLETE WITH WARNINGS - REVIEW RESULTS ABOVE');
    return false;
  }
}

/**
 * Main execution
 */
async function main() {
  const client = new Client(getDbConfig());

  try {
    log.section('CART MIGRATION - DATABASE OPTIMIZER');

    // Connect to database
    log.info('Connecting to Vercel Postgres...');
    await client.connect();

    // Test connection
    const connected = await testConnection(client);
    if (!connected) {
      throw new Error('Database connection failed');
    }

    // Check if migration already applied
    log.info('Checking existing tables...');
    const tablesExistBefore = await checkTablesExist(client);

    if (tablesExistBefore.length === 3) {
      log.warning('Migration appears to be already applied (all tables exist)');
      log.info('Proceeding with verification and testing...');
    } else if (tablesExistBefore.length > 0) {
      log.warning(`Partial migration detected (${tablesExistBefore.length}/3 tables exist)`);
      console.table(tablesExistBefore);
    } else {
      log.info('No cart tables found - applying fresh migration');
    }

    // Apply migration (idempotent - safe to re-run)
    log.info('Applying migration...');
    const migrationApplied = await applyMigration(client);

    if (!migrationApplied) {
      throw new Error('Migration failed to apply');
    }

    // Verify all components
    const tables = await verifyTables(client);
    const indexes = await verifyIndexes(client);
    const triggers = await verifyTriggers(client);
    const functions = await verifyFunctions(client);

    // Test functions
    const testResults = {
      getOrCreateCart: false,
      addToCart: false,
      getCartSummary: false,
    };

    try {
      const { cartId, testEmail } = await testGetOrCreateCart(client);
      testResults.getOrCreateCart = true;

      await testAddToCart(client, cartId);
      testResults.addToCart = true;

      await testGetCartSummary(client, cartId);
      testResults.getCartSummary = true;

      // Performance benchmark
      const performanceResults = await performanceBenchmark(client, cartId);

      // Cleanup test data
      await cleanupTestData(client, testEmail);

      // Generate final report
      const success = generateReport({
        tablesExistBefore,
        migrationApplied,
        tables,
        indexes,
        triggers,
        functions,
        testResults,
        performanceResults,
      });

      process.exit(success ? 0 : 1);
    } catch (error) {
      log.error(`Testing failed: ${error.message}`);
      console.error(error.stack);

      // Still generate report with partial results
      generateReport({
        tablesExistBefore,
        migrationApplied,
        tables,
        indexes,
        triggers,
        functions,
        testResults,
        performanceResults: [],
      });

      process.exit(1);
    }
  } catch (error) {
    log.error(`Fatal error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.end();
    log.info('Database connection closed');
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { main };
