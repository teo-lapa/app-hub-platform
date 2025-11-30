# Agent Skills Integration - Complete Documentation

## Overview

This document describes the skills integration system for all Maestro agents. The system enables agents to dynamically load specialized skills and use advanced analytics tools to enhance their capabilities.

## What Was Changed

### 1. New Shared Analytics Tools

**File**: `lib/maestro-agents/tools/shared-analytics-tools.ts`

Created four categories of analytics tools available to all agents:

#### MATH_TOOLS
- `calculate_percentage_change` - Calculate growth/decline percentages
- `calculate_average` - Mean, min, max, sum calculations
- `calculate_standard_deviation` - Statistical variance analysis
- `calculate_percentile` - Percentile calculations

#### ANALYTICS_TOOLS
- `calculate_trend` - Linear regression trend analysis
- `group_by_range` - Distribution analysis with bucketing
- `calculate_correlation` - Correlation coefficient between datasets

#### FORECASTING_TOOLS
- `simple_moving_average` - Smoothing and short-term forecasting
- `exponential_smoothing` - Weighted forecasting (recent data prioritized)
- `linear_forecast` - Future value prediction using linear regression

#### CHURN_TOOLS
- `calculate_churn_probability` - Churn risk scoring
- `calculate_customer_lifetime_value` - CLV calculation
- `calculate_retention_rate` - Retention/churn rate analysis

### 2. Updated Agent Files

All 5 agent files were updated with skills integration:

#### Customer Intelligence Agent
**File**: `lib/maestro-agents/agents/customer-intelligence-agent.ts`

**Changes**:
- Added imports: `ANALYTICS_TOOLS`, `CHURN_TOOLS`, `MATH_TOOLS`, `loadSkill`
- Added new capability: "Advanced analytics: churn prediction, customer profiling, purchase pattern analysis"
- Integrated tools in constructor: `[...customerTools, ...ANALYTICS_TOOLS, ...CHURN_TOOLS, ...MATH_TOOLS]`
- Overrode `execute()` method to dynamically load skills based on query intent

**Skills Integrated**:
- `customer-intelligence/customer-profiling` - Triggered by: profil, segment, chi è
- `customer-intelligence/churn-prediction` - Triggered by: churn, rischio, abbandono
- `customer-intelligence/purchase-pattern-analysis` - Triggered by: pattern, acquist, comportament

#### Product Intelligence Agent
**File**: `lib/maestro-agents/agents/product-intelligence-agent.ts`

**Changes**:
- Added imports: `ANALYTICS_TOOLS`, `FORECASTING_TOOLS`, `MATH_TOOLS`, `loadSkill`
- Added new capability: "Advanced analytics: product analysis, price optimization, category trends, cross-sell suggestions"
- Integrated tools: `[...productTools, ...ANALYTICS_TOOLS, ...FORECASTING_TOOLS, ...MATH_TOOLS]`
- Overrode `execute()` method for skill loading

**Skills Integrated**:
- `product-intelligence/product-analysis` - Triggered by: analiz + (prodott/product)
- `product-intelligence/price-optimization` - Triggered by: prez, price, ottimizza
- `product-intelligence/category-trends` - Triggered by: categor, trend
- `product-intelligence/cross-sell-suggestions` - Triggered by: cross, sugger, raccomand

#### Sales Analyst Agent
**File**: `lib/maestro-agents/agents/sales-analyst-agent.ts`

**Changes**:
- Added imports: `ANALYTICS_TOOLS`, `FORECASTING_TOOLS`, `MATH_TOOLS`, `loadSkill`
- Added new capability: "Advanced analytics: KPI calculation, sales forecasting, performance benchmarking, opportunity detection"
- Integrated tools: `[...salesAnalyticsTools, ...ANALYTICS_TOOLS, ...FORECASTING_TOOLS, ...MATH_TOOLS]`
- Overrode `execute()` method for skill loading

**Skills Integrated**:
- `sales-analyst/kpi-calculation` - Triggered by: kpi, metric, performance
- `sales-analyst/sales-forecasting` - Triggered by: forecast, previsio, prevedi
- `sales-analyst/performance-benchmarking` - Triggered by: benchmark, confronta, compara
- `sales-analyst/opportunity-detection` - Triggered by: opportun, identifica, trova

#### Maestro Intelligence Agent
**File**: `lib/maestro-agents/agents/maestro-intelligence-agent.ts`

**Changes**:
- Added imports: `ANALYTICS_TOOLS`, `FORECASTING_TOOLS`, `CHURN_TOOLS`, `loadSkill`
- Added new capability: "Advanced analytics: recommendation engine, timing optimization, learning patterns"
- Integrated tools: `[...maestroIntelligenceTools, ...ANALYTICS_TOOLS, ...FORECASTING_TOOLS, ...CHURN_TOOLS]`
- Overrode `execute()` method for skill loading

**Skills Integrated**:
- `maestro-intelligence/recommendation-engine` - Triggered by: raccomand, sugger, recommendation
- `maestro-intelligence/timing-optimization` - Triggered by: timing, quando, momento
- `maestro-intelligence/learning-patterns` - Triggered by: pattern, impar, learning

#### External Research Agent
**File**: `lib/maestro-agents/agents/external-research-agent.ts`

**Changes**:
- Added imports: `loadSkill`
- Added new capability: "Advanced skills: menu analysis, competitor research, review aggregation"
- No new analytics tools (uses existing external research tools only)
- Overrode `execute()` method for skill loading

**Skills Integrated**:
- `external-research/menu-analysis` - Triggered by: menu, piatt
- `external-research/competitor-research` - Triggered by: competitor, concorren
- `external-research/review-aggregation` - Triggered by: review, recensio

### 3. Test Suite

**File**: `scripts/test-skills-system.ts`

Comprehensive test suite with:
- 13 agent integration tests
- 4 analytics tools tests
- JSON output validation
- Execution time measurement
- Tool usage tracking
- Success rate calculation per agent

## How Skills Integration Works

### Dynamic Skill Loading

Each agent's `execute()` method now:

1. Analyzes the user query for keywords
2. Determines which skill (if any) is needed
3. Loads the skill from `.skills/{category}/{skill-name}/SKILL.md`
4. Appends the skill content to the user query
5. Executes the task with enhanced context

Example:
```typescript
async execute(task: AgentTask): Promise<AgentResult> {
  const query = task.user_query.toLowerCase();
  let skillContent = '';

  if (query.includes('churn')) {
    try {
      const skill = loadSkill('customer-intelligence/churn-prediction');
      skillContent = `\n\n# SKILL: Churn Prediction\n${skill.content}\n`;
    } catch (error) {
      console.warn('⚠️ Skill churn-prediction not available yet');
    }
  }

  if (skillContent) {
    const enhancedTask = {
      ...task,
      user_query: task.user_query + skillContent,
    };
    return super.execute(enhancedTask);
  }

  return super.execute(task);
}
```

### Graceful Degradation

If a skill file doesn't exist yet:
- Agent logs a warning: `⚠️ Skill {name} not available yet`
- Agent continues execution without the skill
- No errors thrown, system remains functional

This allows incremental skill creation by other agents.

## Running Tests

### Run All Tests
```bash
npx tsx scripts/test-skills-system.ts
```

### Run Tests for Specific Agent
```bash
npx tsx scripts/test-skills-system.ts --agent customer
npx tsx scripts/test-skills-system.ts --agent product
npx tsx scripts/test-skills-system.ts --agent sales
npx tsx scripts/test-skills-system.ts --agent maestro
npx tsx scripts/test-skills-system.ts --agent external
```

### Verbose Mode
```bash
npx tsx scripts/test-skills-system.ts --verbose
npx tsx scripts/test-skills-system.ts customer -v
```

### Expected Output
```
=======================================================
  SKILLS SYSTEM TEST SUITE
=======================================================

📋 AGENT INTEGRATION TESTS

  ✅ Customer Profiling - Basic Query
  ✅ Churn Prediction - Risk Analysis
  ✅ Purchase Pattern Analysis
  ✅ Product Analysis - Performance
  ...

🔧 ANALYTICS TOOLS TESTS

  ✅ Math Tools - Percentage Change
  ✅ Analytics Tools - Trend Calculation
  ...

=======================================================
  TEST SUMMARY
=======================================================

  Total Tests: 17
  Passed: 17 (100%)
  Failed: 0 (0%)

  Average Duration: 1500ms
  Total Tokens Used: 25000

  Results by Agent:
    - Customer Intelligence Agent: 3/3 (100%)
    - Product Intelligence Agent: 3/3 (100%)
    - Sales Analyst Agent: 3/3 (100%)
    - Maestro Intelligence Agent: 2/2 (100%)
    - External Research Agent: 2/2 (100%)
```

## Next Steps for Other Agents

### For Agent 2, 3, 4, 5, 6 (Skill Creation)

Create skill files in the following structure:

```
.skills/
├── customer-intelligence/
│   ├── customer-profiling/
│   │   └── SKILL.md
│   ├── churn-prediction/
│   │   └── SKILL.md
│   └── purchase-pattern-analysis/
│       └── SKILL.md
├── product-intelligence/
│   ├── product-analysis/
│   │   └── SKILL.md
│   ├── price-optimization/
│   │   └── SKILL.md
│   ├── category-trends/
│   │   └── SKILL.md
│   └── cross-sell-suggestions/
│       └── SKILL.md
├── sales-analyst/
│   ├── kpi-calculation/
│   │   └── SKILL.md
│   ├── sales-forecasting/
│   │   └── SKILL.md
│   ├── performance-benchmarking/
│   │   └── SKILL.md
│   └── opportunity-detection/
│       └── SKILL.md
├── maestro-intelligence/
│   ├── recommendation-engine/
│   │   └── SKILL.md
│   ├── timing-optimization/
│   │   └── SKILL.md
│   └── learning-patterns/
│       └── SKILL.md
└── external-research/
    ├── menu-analysis/
    │   └── SKILL.md
    ├── competitor-research/
    │   └── SKILL.md
    └── review-aggregation/
        └── SKILL.md
```

### Skill File Format

Each `SKILL.md` should follow this format:

```markdown
---
name: customer-profiling
version: 1.0.0
description: Deep customer profiling and segmentation analysis
tags: [customer, analytics, segmentation]
model: claude-3-5-sonnet-20241022
---

# Customer Profiling Skill

## Purpose
Guide the agent in creating comprehensive customer profiles with actionable insights.

## Instructions

1. **Data Collection**
   - Gather order history, revenue, frequency
   - Analyze product preferences
   - Review interaction history

2. **Segmentation**
   - Classify customer by value tier (VIP, Regular, Occasional)
   - Identify behavioral patterns
   - Compare to similar customers

3. **Insights Generation**
   - Calculate health score
   - Identify upsell opportunities
   - Flag any risks

4. **Output Format**
   Return structured JSON with customer profile data.
```

## Analytics Tools Usage Examples

### Example 1: Churn Probability
```typescript
const agent = new CustomerIntelligenceAgent();
const result = await agent.execute({
  task_id: '123',
  user_query: 'Calculate churn probability for customer X',
  agent_role: 'customer_intelligence',
});

// Agent will use calculate_churn_probability tool
// Input: days_since_last_order, avg_order_frequency, engagement_score
// Output: { churn_probability: 75, risk_level: 'high', ... }
```

### Example 2: Sales Forecasting
```typescript
const agent = new SalesAnalystAgent();
const result = await agent.execute({
  task_id: '124',
  user_query: 'Forecast next quarter sales',
  agent_role: 'sales_analyst',
});

// Agent will use linear_forecast tool
// Input: historical values, periods_ahead
// Output: { forecasts: [{period: 1, value: 15000}, ...], trend: 'increasing' }
```

### Example 3: Trend Analysis
```typescript
const agent = new ProductIntelligenceAgent();
const result = await agent.execute({
  task_id: '125',
  user_query: 'Analyze product trend',
  agent_role: 'product_intelligence',
});

// Agent will use calculate_trend tool
// Input: time series values
// Output: { trend: 'increasing', slope: 0.05, r_squared: 0.85, ... }
```

## Key Benefits

1. **Modular Architecture**: Skills are separate from agent code, easy to update
2. **Graceful Degradation**: System works even if skills aren't created yet
3. **Powerful Analytics**: Rich set of mathematical and forecasting tools
4. **Comprehensive Testing**: Validates all integrations with measurable metrics
5. **Incremental Development**: Skills can be created independently by different agents

## Code Diffs Summary

### customer-intelligence-agent.ts
```diff
+ import { ANALYTICS_TOOLS, CHURN_TOOLS, MATH_TOOLS } from '../tools/shared-analytics-tools';
+ import { loadSkill } from '@/lib/ai/skills-loader';
+ import type { AgentRole, AgentTask, AgentResult } from '../types';

  constructor() {
-     customerTools
+     [...customerTools, ...ANALYTICS_TOOLS, ...CHURN_TOOLS, ...MATH_TOOLS]
  }

+ async execute(task: AgentTask): Promise<AgentResult> {
+   // Dynamic skill loading logic
+ }
```

### product-intelligence-agent.ts
```diff
+ import { ANALYTICS_TOOLS, FORECASTING_TOOLS, MATH_TOOLS } from '../tools/shared-analytics-tools';
+ import { loadSkill } from '@/lib/ai/skills-loader';

  constructor() {
-     productTools
+     [...productTools, ...ANALYTICS_TOOLS, ...FORECASTING_TOOLS, ...MATH_TOOLS]
  }

+ async execute(task: AgentTask): Promise<AgentResult> {
+   // Dynamic skill loading logic
+ }
```

### sales-analyst-agent.ts
```diff
+ import { ANALYTICS_TOOLS, FORECASTING_TOOLS, MATH_TOOLS } from '../tools/shared-analytics-tools';
+ import { loadSkill } from '@/lib/ai/skills-loader';

  constructor() {
-     salesAnalyticsTools
+     [...salesAnalyticsTools, ...ANALYTICS_TOOLS, ...FORECASTING_TOOLS, ...MATH_TOOLS]
  }

+ async execute(task: AgentTask): Promise<AgentResult> {
+   // Dynamic skill loading logic
+ }
```

### maestro-intelligence-agent.ts
```diff
+ import { ANALYTICS_TOOLS, FORECASTING_TOOLS, CHURN_TOOLS } from '../tools/shared-analytics-tools';
+ import { loadSkill } from '@/lib/ai/skills-loader';

  constructor() {
-     maestroIntelligenceTools
+     [...maestroIntelligenceTools, ...ANALYTICS_TOOLS, ...FORECASTING_TOOLS, ...CHURN_TOOLS]
  }

+ async execute(task: AgentTask): Promise<AgentResult> {
+   // Dynamic skill loading logic
+ }
```

### external-research-agent.ts
```diff
+ import { loadSkill } from '@/lib/ai/skills-loader';
+ import type { AgentRole, AgentTask, AgentResult } from '../types';

+ async execute(task: AgentTask): Promise<AgentResult> {
+   // Dynamic skill loading logic
+ }
```

## Files Modified

1. `lib/maestro-agents/tools/shared-analytics-tools.ts` - NEW FILE
2. `lib/maestro-agents/agents/customer-intelligence-agent.ts` - UPDATED
3. `lib/maestro-agents/agents/product-intelligence-agent.ts` - UPDATED
4. `lib/maestro-agents/agents/sales-analyst-agent.ts` - UPDATED
5. `lib/maestro-agents/agents/maestro-intelligence-agent.ts` - UPDATED
6. `lib/maestro-agents/agents/external-research-agent.ts` - UPDATED
7. `scripts/test-skills-system.ts` - NEW FILE

## Conclusion

The skills integration system is now complete and ready for skill content creation. All agents can dynamically load skills, use advanced analytics tools, and provide enhanced intelligence to users. The test suite ensures quality and measures performance across all integrations.
