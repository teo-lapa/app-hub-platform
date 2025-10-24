# Analytics Tools Reference Guide

Quick reference for all shared analytics tools available to Maestro agents.

## MATH TOOLS

### calculate_percentage_change
Calculate percentage change between two values.

**Input:**
```json
{
  "old_value": 1000,
  "new_value": 1200
}
```

**Output:**
```json
{
  "percentage_change": 20.0,
  "absolute_change": 200,
  "direction": "increase"
}
```

**Use Cases:**
- Revenue growth/decline
- Customer value changes
- Product sales trends

---

### calculate_average
Calculate mean, sum, min, max of numbers.

**Input:**
```json
{
  "values": [100, 150, 120, 180, 160]
}
```

**Output:**
```json
{
  "average": 142.0,
  "sum": 710,
  "count": 5,
  "min": 100,
  "max": 180
}
```

**Use Cases:**
- Average order value
- Mean customer lifetime value
- Average days between orders

---

### calculate_standard_deviation
Calculate statistical variance and standard deviation.

**Input:**
```json
{
  "values": [100, 120, 110, 130, 115]
}
```

**Output:**
```json
{
  "std_dev": 10.67,
  "variance": 113.89,
  "mean": 115.0,
  "coefficient_of_variation": 9.28
}
```

**Use Cases:**
- Customer behavior consistency
- Product demand variability
- Sales performance stability

---

### calculate_percentile
Find value at specific percentile.

**Input:**
```json
{
  "values": [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
  "percentile": 90
}
```

**Output:**
```json
{
  "value": 90,
  "percentile": 90,
  "position": 9,
  "total_count": 10
}
```

**Use Cases:**
- Top 10% customers by revenue
- 95th percentile order value
- Performance benchmarks

---

## ANALYTICS TOOLS

### calculate_trend
Linear regression trend analysis.

**Input:**
```json
{
  "values": [100, 110, 115, 125, 130],
  "periods": 5
}
```

**Output:**
```json
{
  "trend": "increasing",
  "slope": 7.5,
  "intercept": 97.0,
  "r_squared": 0.95,
  "direction": "upward",
  "strength": "strong"
}
```

**Use Cases:**
- Revenue trend analysis
- Product sales trajectory
- Customer engagement trends

---

### group_by_range
Group values into buckets for distribution analysis.

**Input:**
```json
{
  "values": [25, 50, 75, 100, 125, 150, 175, 200],
  "bucket_size": 50
}
```

**Output:**
```json
{
  "buckets": [
    {
      "range": "0-50",
      "min": 0,
      "max": 50,
      "count": 2,
      "percentage": 25.0
    },
    {
      "range": "50-100",
      "min": 50,
      "max": 100,
      "count": 2,
      "percentage": 25.0
    }
  ],
  "total_values": 8
}
```

**Use Cases:**
- Customer value segmentation
- Order value distribution
- Product price ranges

---

### calculate_correlation
Calculate correlation between two datasets.

**Input:**
```json
{
  "dataset_x": [10, 20, 30, 40, 50],
  "dataset_y": [15, 25, 35, 45, 55]
}
```

**Output:**
```json
{
  "correlation": 1.0,
  "strength": "strong",
  "direction": "positive"
}
```

**Use Cases:**
- Revenue vs. customer satisfaction
- Order frequency vs. customer value
- Product sales vs. seasonality

---

## FORECASTING TOOLS

### simple_moving_average
Calculate moving average for smoothing.

**Input:**
```json
{
  "values": [100, 110, 105, 115, 120, 125],
  "window": 3
}
```

**Output:**
```json
{
  "moving_averages": [105.0, 110.0, 113.33, 120.0],
  "latest_ma": 120.0,
  "window": 3,
  "original_count": 6,
  "ma_count": 4
}
```

**Use Cases:**
- Smooth noisy sales data
- Identify underlying trends
- Short-term forecasting

---

### exponential_smoothing
Weighted forecasting (recent data weighted more).

**Input:**
```json
{
  "values": [100, 110, 105, 120, 130],
  "alpha": 0.3
}
```

**Output:**
```json
{
  "smoothed_values": [100.0, 103.0, 103.6, 108.52, 114.96],
  "forecast": 114.96,
  "alpha": 0.3,
  "original_count": 5
}
```

**Use Cases:**
- Adaptive forecasting
- Responsive to recent changes
- Demand prediction

---

### linear_forecast
Forecast future values using linear regression.

**Input:**
```json
{
  "values": [100, 110, 120, 130, 140],
  "periods_ahead": 3
}
```

**Output:**
```json
{
  "forecasts": [
    { "period": 1, "value": 150.0 },
    { "period": 2, "value": 160.0 },
    { "period": 3, "value": 170.0 }
  ],
  "slope": 10.0,
  "intercept": 90.0,
  "trend": "increasing",
  "historical_periods": 5
}
```

**Use Cases:**
- Revenue forecasting
- Sales projections
- Growth predictions

---

## CHURN TOOLS

### calculate_churn_probability
Calculate customer churn risk score.

**Input:**
```json
{
  "days_since_last_order": 60,
  "avg_order_frequency": 30,
  "engagement_score": 40,
  "revenue_trend": "decreasing"
}
```

**Output:**
```json
{
  "churn_probability": 78,
  "risk_level": "high",
  "days_overdue": 30,
  "expected_order_ratio": 2.0,
  "factors": {
    "time_factor": true,
    "engagement_factor": true,
    "revenue_factor": true
  }
}
```

**Use Cases:**
- Identify at-risk customers
- Prioritize retention efforts
- Trigger intervention actions

---

### calculate_customer_lifetime_value
Calculate predicted CLV.

**Input:**
```json
{
  "avg_order_value": 500,
  "order_frequency_per_year": 12,
  "avg_customer_lifespan_years": 3,
  "profit_margin": 20
}
```

**Output:**
```json
{
  "customer_lifetime_value": 18000.0,
  "lifetime_profit": 3600.0,
  "annual_value": 6000.0,
  "monthly_value": 500.0,
  "total_orders_expected": 36,
  "value_per_order": 500
}
```

**Use Cases:**
- Customer value segmentation
- Marketing spend optimization
- Retention ROI calculation

---

### calculate_retention_rate
Calculate retention and churn rates.

**Input:**
```json
{
  "customers_at_start": 100,
  "customers_at_end": 95,
  "new_customers": 10
}
```

**Output:**
```json
{
  "retention_rate": 85.0,
  "churn_rate": 15.0,
  "retained_customers": 85,
  "churned_customers": 15,
  "growth_rate": -5.0
}
```

**Use Cases:**
- Track customer retention
- Measure business health
- Evaluate retention campaigns

---

## Tool Selection Guide

### For Customer Intelligence Agent
**Primary Tools:**
- `calculate_churn_probability`
- `calculate_customer_lifetime_value`
- `calculate_retention_rate`
- `calculate_trend`
- `calculate_percentage_change`

**Use When:**
- Analyzing customer health
- Identifying at-risk customers
- Segmenting customer base
- Tracking customer value trends

---

### For Product Intelligence Agent
**Primary Tools:**
- `calculate_trend`
- `calculate_correlation`
- `group_by_range`
- `linear_forecast`
- `simple_moving_average`

**Use When:**
- Analyzing product performance
- Forecasting demand
- Identifying seasonal patterns
- Comparing product categories

---

### For Sales Analyst Agent
**Primary Tools:**
- `calculate_percentage_change`
- `calculate_average`
- `calculate_trend`
- `linear_forecast`
- `exponential_smoothing`

**Use When:**
- Tracking sales KPIs
- Forecasting revenue
- Comparing performance periods
- Benchmarking against team

---

### For Maestro Intelligence Agent
**Primary Tools:**
- `calculate_churn_probability`
- `calculate_trend`
- `linear_forecast`
- `calculate_correlation`

**Use When:**
- Prioritizing recommendations
- Optimizing timing
- Predicting success rates
- Learning from patterns

---

## Best Practices

### 1. Combine Multiple Tools
Don't rely on a single tool. Combine for richer insights:
```
calculate_trend() + linear_forecast() = Complete trend analysis
calculate_average() + calculate_standard_deviation() = Statistical profile
calculate_churn_probability() + calculate_customer_lifetime_value() = Retention priority
```

### 2. Validate Inputs
Check data quality before using tools:
- Minimum data points (e.g., 2+ for trends, 5+ for forecasts)
- No null/missing values
- Reasonable value ranges

### 3. Interpret Results
Always explain what the numbers mean:
- Don't just say "slope: 5.2"
- Say "Revenue is growing at CHF 5,200 per month (strong upward trend)"

### 4. Consider Context
Use domain knowledge:
- Seasonality affects trends
- Holidays impact forecasts
- Customer segments behave differently

### 5. Error Handling
Tools return errors for invalid inputs:
```json
{
  "error": "Not enough data points for specified window",
  "required": 7,
  "available": 3
}
```

Always check for and handle errors gracefully.

---

## Examples by Use Case

### Use Case: Customer Health Dashboard
```typescript
// 1. Calculate churn risk
const churn = await calculate_churn_probability({
  days_since_last_order: 45,
  avg_order_frequency: 30,
  engagement_score: 60
});

// 2. Calculate CLV
const clv = await calculate_customer_lifetime_value({
  avg_order_value: 800,
  order_frequency_per_year: 12
});

// 3. Analyze revenue trend
const trend = await calculate_trend({
  values: monthlyRevenue // [1000, 1100, 950, 1200, ...]
});

// Result: Comprehensive customer health score
```

### Use Case: Product Performance Analysis
```typescript
// 1. Calculate sales trend
const trend = await calculate_trend({
  values: monthlySales
});

// 2. Forecast next quarter
const forecast = await linear_forecast({
  values: monthlySales,
  periods_ahead: 3
});

// 3. Calculate volatility
const volatility = await calculate_standard_deviation({
  values: monthlySales
});

// Result: Complete product performance report
```

### Use Case: Sales Team Benchmarking
```typescript
// 1. Calculate team average
const teamAvg = await calculate_average({
  values: [50000, 60000, 55000, 70000, 65000]
});

// 2. Find top 20% threshold
const topPerformer = await calculate_percentile({
  values: salesPersonRevenues,
  percentile: 80
});

// 3. Calculate growth rate
const growth = await calculate_percentage_change({
  old_value: lastMonthRevenue,
  new_value: thisMonthRevenue
});

// Result: Performance benchmarking report
```

---

## Tool Performance Notes

### Fast (< 10ms)
- `calculate_percentage_change`
- `calculate_average`
- `calculate_percentile`

### Medium (10-50ms)
- `calculate_standard_deviation`
- `calculate_trend`
- `group_by_range`

### Complex (50-100ms)
- `calculate_correlation`
- `exponential_smoothing`
- `linear_forecast`

### Note
All tools are optimized for datasets < 10,000 points. For larger datasets, consider pre-aggregation.

---

## Support

For questions or issues with analytics tools:
1. Check this reference guide
2. Review tool implementations in `shared-analytics-tools.ts`
3. Run test suite: `npx tsx scripts/test-skills-system.ts`
4. Contact Agent 7 (Integration & Testing)
