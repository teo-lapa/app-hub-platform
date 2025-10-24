/**
 * SKILLS SYSTEM TEST SUITE
 *
 * Tests all agents with skills integration
 * Validates JSON outputs, measures execution time, and verifies analytics tools
 *
 * Usage:
 *   npx tsx scripts/test-skills-system.ts
 *   npx tsx scripts/test-skills-system.ts --agent customer
 *   npx tsx scripts/test-skills-system.ts --verbose
 */

import { CustomerIntelligenceAgent } from '@/lib/maestro-agents/agents/customer-intelligence-agent';
import { ProductIntelligenceAgent } from '@/lib/maestro-agents/agents/product-intelligence-agent';
import { SalesAnalystAgent } from '@/lib/maestro-agents/agents/sales-analyst-agent';
import { MaestroIntelligenceAgent } from '@/lib/maestro-agents/agents/maestro-intelligence-agent';
import { ExternalResearchAgent } from '@/lib/maestro-agents/agents/external-research-agent';
import type { AgentTask, AgentResult } from '@/lib/maestro-agents/types';

// ============================================================================
// TEST CONFIGURATION
// ============================================================================

interface TestCase {
  name: string;
  agent: any;
  task: AgentTask;
  expectedSkill?: string;
  validateOutput: (result: AgentResult) => boolean;
}

interface TestResult {
  testName: string;
  agentName: string;
  passed: boolean;
  duration: number;
  tokensUsed?: number;
  toolsCalled?: string[];
  error?: string;
  validationErrors?: string[];
}

// ============================================================================
// TEST CASES
// ============================================================================

const testCases: TestCase[] = [
  // CUSTOMER INTELLIGENCE AGENT TESTS
  {
    name: 'Customer Profiling - Basic Query',
    agent: new CustomerIntelligenceAgent(),
    task: {
      task_id: 'test-001',
      user_query: 'Chi è il cliente Bar Centrale?',
      agent_role: 'customer_intelligence',
      context: {
        salesperson_id: 'test-salesperson-1',
      },
    },
    expectedSkill: 'customer-profiling',
    validateOutput: (result) => {
      if (!result.success) return false;
      if (!result.data) return false;
      // Should have used customer tools
      const toolNames = result.tool_calls?.map(tc => tc.tool_name) || [];
      return toolNames.some(name => name.includes('customer'));
    },
  },
  {
    name: 'Churn Prediction - Risk Analysis',
    agent: new CustomerIntelligenceAgent(),
    task: {
      task_id: 'test-002',
      user_query: 'Quali clienti hanno alto rischio churn?',
      agent_role: 'customer_intelligence',
      context: {
        salesperson_id: 'test-salesperson-1',
      },
    },
    expectedSkill: 'churn-prediction',
    validateOutput: (result) => {
      if (!result.success) return false;
      // Should have used churn-related tools
      const toolNames = result.tool_calls?.map(tc => tc.tool_name) || [];
      return toolNames.some(name =>
        name.includes('churn') ||
        name.includes('customer') ||
        name === 'calculate_churn_probability'
      );
    },
  },
  {
    name: 'Purchase Pattern Analysis',
    agent: new CustomerIntelligenceAgent(),
    task: {
      task_id: 'test-003',
      user_query: 'Analizza i pattern di acquisto dei miei clienti top',
      agent_role: 'customer_intelligence',
      context: {
        salesperson_id: 'test-salesperson-1',
      },
    },
    expectedSkill: 'purchase-pattern-analysis',
    validateOutput: (result) => {
      if (!result.success) return false;
      // Should have analytics or customer tools
      const toolNames = result.tool_calls?.map(tc => tc.tool_name) || [];
      return toolNames.length > 0;
    },
  },

  // PRODUCT INTELLIGENCE AGENT TESTS
  {
    name: 'Product Analysis - Performance',
    agent: new ProductIntelligenceAgent(),
    task: {
      task_id: 'test-004',
      user_query: 'Analizza le performance dei prodotti premium',
      agent_role: 'product_intelligence',
      context: {
        salesperson_id: 'test-salesperson-1',
      },
    },
    expectedSkill: 'product-analysis',
    validateOutput: (result) => {
      if (!result.success) return false;
      const toolNames = result.tool_calls?.map(tc => tc.tool_name) || [];
      return toolNames.some(name => name.includes('product'));
    },
  },
  {
    name: 'Cross-Sell Suggestions',
    agent: new ProductIntelligenceAgent(),
    task: {
      task_id: 'test-005',
      user_query: 'Quali prodotti dovrei suggerire come cross-sell per Parmigiano?',
      agent_role: 'product_intelligence',
      context: {
        product_name: 'Parmigiano Reggiano 36 mesi',
      },
    },
    expectedSkill: 'cross-sell-suggestions',
    validateOutput: (result) => {
      if (!result.success) return false;
      const toolNames = result.tool_calls?.map(tc => tc.tool_name) || [];
      return toolNames.length > 0;
    },
  },
  {
    name: 'Category Trends',
    agent: new ProductIntelligenceAgent(),
    task: {
      task_id: 'test-006',
      user_query: 'Quali sono i trend nella categoria formaggi?',
      agent_role: 'product_intelligence',
    },
    expectedSkill: 'category-trends',
    validateOutput: (result) => {
      if (!result.success) return false;
      return true;
    },
  },

  // SALES ANALYST AGENT TESTS
  {
    name: 'KPI Calculation - Monthly Performance',
    agent: new SalesAnalystAgent(),
    task: {
      task_id: 'test-007',
      user_query: 'Calcola i KPI principali per questo mese',
      agent_role: 'sales_analyst',
      context: {
        salesperson_id: 'test-salesperson-1',
        period: 'current_month',
      },
    },
    expectedSkill: 'kpi-calculation',
    validateOutput: (result) => {
      if (!result.success) return false;
      const toolNames = result.tool_calls?.map(tc => tc.tool_name) || [];
      return toolNames.some(name =>
        name.includes('performance') ||
        name.includes('calculate') ||
        name.includes('salesperson')
      );
    },
  },
  {
    name: 'Sales Forecasting',
    agent: new SalesAnalystAgent(),
    task: {
      task_id: 'test-008',
      user_query: 'Prevedi le vendite per il prossimo trimestre',
      agent_role: 'sales_analyst',
    },
    expectedSkill: 'sales-forecasting',
    validateOutput: (result) => {
      if (!result.success) return false;
      const toolNames = result.tool_calls?.map(tc => tc.tool_name) || [];
      return toolNames.some(name =>
        name.includes('forecast') ||
        name.includes('trend') ||
        name.includes('performance')
      );
    },
  },
  {
    name: 'Performance Benchmarking',
    agent: new SalesAnalystAgent(),
    task: {
      task_id: 'test-009',
      user_query: 'Confronta la mia performance con il team',
      agent_role: 'sales_analyst',
      context: {
        salesperson_id: 'test-salesperson-1',
      },
    },
    expectedSkill: 'performance-benchmarking',
    validateOutput: (result) => {
      if (!result.success) return false;
      const toolNames = result.tool_calls?.map(tc => tc.tool_name) || [];
      return toolNames.some(name =>
        name.includes('leaderboard') ||
        name.includes('performance')
      );
    },
  },

  // MAESTRO INTELLIGENCE AGENT TESTS
  {
    name: 'Recommendation Engine - Daily Plan',
    agent: new MaestroIntelligenceAgent(),
    task: {
      task_id: 'test-010',
      user_query: 'Genera il piano d\'azione ottimizzato per oggi',
      agent_role: 'maestro_intelligence',
      context: {
        salesperson_id: 'test-salesperson-1',
      },
    },
    expectedSkill: 'recommendation-engine',
    validateOutput: (result) => {
      if (!result.success) return false;
      const toolNames = result.tool_calls?.map(tc => tc.tool_name) || [];
      return toolNames.some(name =>
        name.includes('recommendation') ||
        name.includes('action_plan')
      );
    },
  },
  {
    name: 'Timing Optimization',
    agent: new MaestroIntelligenceAgent(),
    task: {
      task_id: 'test-011',
      user_query: 'Qual è il momento migliore per contattare questo cliente?',
      agent_role: 'maestro_intelligence',
      context: {
        customer_id: 'test-customer-1',
      },
    },
    expectedSkill: 'timing-optimization',
    validateOutput: (result) => {
      if (!result.success) return false;
      return true;
    },
  },

  // EXTERNAL RESEARCH AGENT TESTS
  {
    name: 'Menu Analysis',
    agent: new ExternalResearchAgent(),
    task: {
      task_id: 'test-012',
      user_query: 'Analizza il menu del Ristorante Da Mario',
      agent_role: 'external_research',
      context: {
        restaurant_name: 'Ristorante Da Mario',
        city: 'Lugano',
      },
    },
    expectedSkill: 'menu-analysis',
    validateOutput: (result) => {
      if (!result.success) return false;
      const toolNames = result.tool_calls?.map(tc => tc.tool_name) || [];
      return toolNames.some(name => name.includes('menu') || name.includes('restaurant'));
    },
  },
  {
    name: 'Review Aggregation',
    agent: new ExternalResearchAgent(),
    task: {
      task_id: 'test-013',
      user_query: 'Raccogli le recensioni del ristorante',
      agent_role: 'external_research',
      context: {
        restaurant_name: 'Ristorante Da Mario',
      },
    },
    expectedSkill: 'review-aggregation',
    validateOutput: (result) => {
      if (!result.success) return false;
      const toolNames = result.tool_calls?.map(tc => tc.tool_name) || [];
      return toolNames.some(name => name.includes('review'));
    },
  },
];

// ============================================================================
// ANALYTICS TOOLS TESTS
// ============================================================================

const analyticsToolsTests = [
  {
    name: 'Math Tools - Percentage Change',
    agent: new SalesAnalystAgent(),
    task: {
      task_id: 'test-math-001',
      user_query: 'Test: Use calculate_percentage_change with old_value=1000, new_value=1200',
      agent_role: 'sales_analyst',
    },
    validateOutput: (result: AgentResult) => {
      if (!result.success) return false;
      const toolNames = result.tool_calls?.map(tc => tc.tool_name) || [];
      return toolNames.includes('calculate_percentage_change');
    },
  },
  {
    name: 'Analytics Tools - Trend Calculation',
    agent: new ProductIntelligenceAgent(),
    task: {
      task_id: 'test-analytics-001',
      user_query: 'Test: Calculate trend from values [100, 120, 115, 130, 145]',
      agent_role: 'product_intelligence',
    },
    validateOutput: (result: AgentResult) => {
      if (!result.success) return false;
      const toolNames = result.tool_calls?.map(tc => tc.tool_name) || [];
      return toolNames.includes('calculate_trend');
    },
  },
  {
    name: 'Forecasting Tools - Linear Forecast',
    agent: new SalesAnalystAgent(),
    task: {
      task_id: 'test-forecast-001',
      user_query: 'Test: Forecast 3 periods ahead from [1000, 1100, 1150, 1200]',
      agent_role: 'sales_analyst',
    },
    validateOutput: (result: AgentResult) => {
      if (!result.success) return false;
      const toolNames = result.tool_calls?.map(tc => tc.tool_name) || [];
      return toolNames.includes('linear_forecast');
    },
  },
  {
    name: 'Churn Tools - Probability Calculation',
    agent: new CustomerIntelligenceAgent(),
    task: {
      task_id: 'test-churn-001',
      user_query: 'Test: Calculate churn probability for customer with 60 days since last order, avg frequency 30 days',
      agent_role: 'customer_intelligence',
    },
    validateOutput: (result: AgentResult) => {
      if (!result.success) return false;
      const toolNames = result.tool_calls?.map(tc => tc.tool_name) || [];
      return toolNames.includes('calculate_churn_probability');
    },
  },
];

// ============================================================================
// TEST RUNNER
// ============================================================================

async function runTest(testCase: TestCase, verbose: boolean = false): Promise<TestResult> {
  const startTime = Date.now();

  try {
    if (verbose) {
      console.log(`\n  Running: ${testCase.name}`);
      console.log(`  Agent: ${testCase.agent.name}`);
      console.log(`  Query: ${testCase.task.user_query}`);
    }

    const result = await testCase.agent.execute(testCase.task);
    const duration = Date.now() - startTime;

    const validationErrors: string[] = [];

    // Run validation
    let passed = true;
    try {
      passed = testCase.validateOutput(result);
      if (!passed) {
        validationErrors.push('Custom validation failed');
      }
    } catch (error: any) {
      passed = false;
      validationErrors.push(`Validation error: ${error.message}`);
    }

    // Additional validations
    if (!result.success && !result.error) {
      validationErrors.push('Result marked as failure but no error message provided');
      passed = false;
    }

    if (result.success && !result.data) {
      validationErrors.push('Result marked as success but no data returned');
      passed = false;
    }

    return {
      testName: testCase.name,
      agentName: testCase.agent.name,
      passed,
      duration,
      tokensUsed: result.tokens_used,
      toolsCalled: result.tool_calls?.map(tc => tc.tool_name),
      error: result.error,
      validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    return {
      testName: testCase.name,
      agentName: testCase.agent.name,
      passed: false,
      duration,
      error: error.message,
    };
  }
}

async function runAllTests(filterAgent?: string, verbose: boolean = false) {
  console.log('\n=======================================================');
  console.log('  SKILLS SYSTEM TEST SUITE');
  console.log('=======================================================\n');

  // Filter tests if agent specified
  let testsToRun = testCases;
  if (filterAgent) {
    testsToRun = testCases.filter(tc =>
      tc.agent.role.includes(filterAgent.toLowerCase())
    );
    console.log(`Filtering tests for agent: ${filterAgent}`);
    console.log(`Running ${testsToRun.length} tests\n`);
  }

  const results: TestResult[] = [];
  let passed = 0;
  let failed = 0;

  // Run main tests
  console.log('📋 AGENT INTEGRATION TESTS\n');

  for (const testCase of testsToRun) {
    const result = await runTest(testCase, verbose);
    results.push(result);

    if (result.passed) {
      passed++;
      console.log(`  ✅ ${result.testName}`);
    } else {
      failed++;
      console.log(`  ❌ ${result.testName}`);
      if (result.error) {
        console.log(`     Error: ${result.error}`);
      }
      if (result.validationErrors) {
        result.validationErrors.forEach(err => {
          console.log(`     Validation: ${err}`);
        });
      }
    }

    if (verbose && result.toolsCalled) {
      console.log(`     Tools: ${result.toolsCalled.join(', ')}`);
      console.log(`     Duration: ${result.duration}ms`);
      console.log(`     Tokens: ${result.tokensUsed || 'N/A'}`);
    }
  }

  // Run analytics tools tests
  if (!filterAgent) {
    console.log('\n\n🔧 ANALYTICS TOOLS TESTS\n');

    for (const testCase of analyticsToolsTests) {
      const result = await runTest(testCase, verbose);
      results.push(result);

      if (result.passed) {
        passed++;
        console.log(`  ✅ ${result.testName}`);
      } else {
        failed++;
        console.log(`  ❌ ${result.testName}`);
        if (result.error) {
          console.log(`     Error: ${result.error}`);
        }
      }

      if (verbose && result.toolsCalled) {
        console.log(`     Tools: ${result.toolsCalled.join(', ')}`);
      }
    }
  }

  // Summary
  console.log('\n\n=======================================================');
  console.log('  TEST SUMMARY');
  console.log('=======================================================\n');

  console.log(`  Total Tests: ${results.length}`);
  console.log(`  Passed: ${passed} (${Math.round((passed / results.length) * 100)}%)`);
  console.log(`  Failed: ${failed} (${Math.round((failed / results.length) * 100)}%)`);

  // Performance stats
  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
  const totalTokens = results.reduce((sum, r) => sum + (r.tokensUsed || 0), 0);

  console.log(`\n  Average Duration: ${Math.round(avgDuration)}ms`);
  console.log(`  Total Tokens Used: ${totalTokens}`);

  // Agent breakdown
  console.log('\n  Results by Agent:');
  const agentStats = new Map<string, { passed: number; failed: number }>();

  results.forEach(r => {
    const stats = agentStats.get(r.agentName) || { passed: 0, failed: 0 };
    if (r.passed) {
      stats.passed++;
    } else {
      stats.failed++;
    }
    agentStats.set(r.agentName, stats);
  });

  agentStats.forEach((stats, agentName) => {
    const total = stats.passed + stats.failed;
    const passRate = Math.round((stats.passed / total) * 100);
    console.log(`    - ${agentName}: ${stats.passed}/${total} (${passRate}%)`);
  });

  console.log('\n=======================================================\n');

  // Exit with error code if any tests failed
  if (failed > 0) {
    process.exit(1);
  }
}

// ============================================================================
// CLI INTERFACE
// ============================================================================

const args = process.argv.slice(2);
const filterAgent = args.find(arg => arg.startsWith('--agent='))?.split('=')[1];
const agentShorthand = args.find(arg => !arg.startsWith('--'));
const verbose = args.includes('--verbose') || args.includes('-v');

const agent = filterAgent || agentShorthand;

// Run tests
runAllTests(agent, verbose).catch(error => {
  console.error('\n❌ Test suite failed with error:', error);
  process.exit(1);
});
