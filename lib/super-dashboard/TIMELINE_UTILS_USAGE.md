# Timeline Utils - Usage Guide

Comprehensive utility functions for date grouping, formatting, and range calculations in the Super Dashboard.

## Installation

The utilities are located at `lib/super-dashboard/timeline-utils.ts` and use native JavaScript Date objects (no external dependencies required).

## Quick Start

```typescript
import {
  groupOrdersByPeriod,
  groupOrdersByTeam,
  formatPeriodLabel,
  getDateRange,
  filterOrdersByDateRange,
  isValidDate,
  getPeriodStart,
  getPeriodEnd,
} from '@/lib/super-dashboard/timeline-utils';
```

## Functions

### 1. `groupOrdersByPeriod()`

Groups orders by time period (day, week, or month).

**Signature:**
```typescript
function groupOrdersByPeriod(
  orders: any[],
  groupBy: 'day' | 'week' | 'month',
  dateField?: string
): SalesPeriodGroup[]
```

**Parameters:**
- `orders` - Array of sales orders to group
- `groupBy` - Time period granularity ('day' | 'week' | 'month')
- `dateField` - (Optional) Date field name, default: 'commitment_date'

**Returns:**
```typescript
interface SalesPeriodGroup {
  period: string;        // ISO format: "2025-11-06", "2025-W45", "2025-11"
  orderCount: number;
  totalValue: number;
  orders: SalesOrder[];
}
```

**Example:**
```typescript
const orders = [
  { id: 1, commitment_date: '2025-11-05', amount_total: 1000, ... },
  { id: 2, commitment_date: '2025-11-06', amount_total: 1500, ... },
];

// Group by day
const dailyGroups = groupOrdersByPeriod(orders, 'day');
// Result: [{ period: "2025-11-05", orderCount: 1, totalValue: 1000, ... }]

// Group by week
const weeklyGroups = groupOrdersByPeriod(orders, 'week');
// Result: [{ period: "2025-W45", orderCount: 2, totalValue: 2500, ... }]

// Group by month
const monthlyGroups = groupOrdersByPeriod(orders, 'month');
// Result: [{ period: "2025-11", orderCount: 2, totalValue: 2500, ... }]

// Use custom date field
const orderDateGroups = groupOrdersByPeriod(orders, 'day', 'date_order');
```

**Edge Cases:**
- Empty array returns `[]`
- Orders with missing dates are skipped
- Invalid dates are skipped
- Results are sorted chronologically

---

### 2. `groupOrdersByTeam()`

Groups orders by sales team and salesperson.

**Signature:**
```typescript
function groupOrdersByTeam(orders: any[]): SalesTeamGroup[]
```

**Parameters:**
- `orders` - Array of sales orders to group

**Returns:**
```typescript
interface SalesTeamGroup {
  teamName: string;
  salesperson: string;
  orderCount: number;
  totalValue: number;
  avgOrderValue: number;
}
```

**Example:**
```typescript
const orders = [
  {
    id: 1,
    user_id: [1, 'John Doe'],      // Odoo many2one format
    team_id: [1, 'Sales Team A'],
    amount_total: 1000,
    ...
  },
  {
    id: 2,
    user_id: [2, 'Jane Smith'],
    team_id: [1, 'Sales Team A'],
    amount_total: 1500,
    ...
  },
];

const teamGroups = groupOrdersByTeam(orders);
/* Result: [
  {
    teamName: "Sales Team A",
    salesperson: "John Doe",
    orderCount: 1,
    totalValue: 1000,
    avgOrderValue: 1000
  },
  {
    teamName: "Sales Team A",
    salesperson: "Jane Smith",
    orderCount: 1,
    totalValue: 1500,
    avgOrderValue: 1500
  }
] */
```

**Edge Cases:**
- Empty array returns `[]`
- Orders without `user_id` are skipped
- Missing `team_id` defaults to "No Team"
- Results sorted by total value (descending)

---

### 3. `formatPeriodLabel()`

Formats period strings into human-readable labels (Italian locale).

**Signature:**
```typescript
function formatPeriodLabel(
  date: string,
  groupBy: 'day' | 'week' | 'month'
): string
```

**Parameters:**
- `date` - ISO date string or period key
- `groupBy` - Period type to determine formatting

**Returns:**
- Formatted label string in Italian

**Examples:**
```typescript
// Day format
formatPeriodLabel("2025-11-06", "day")
// Returns: "06 Nov 2025"

// Week format
formatPeriodLabel("2025-W45", "week")
// Returns: "Settimana 45, 2025"

// Month format
formatPeriodLabel("2025-11", "month")
// Returns: "Novembre 2025"

// Invalid input
formatPeriodLabel("invalid", "day")
// Returns: "Invalid Date"
```

**Edge Cases:**
- Invalid dates return "Invalid Date"
- Empty string returns "Invalid Date"
- Null/undefined returns "Invalid Date"

---

### 4. `getDateRange()`

Calculates start and end dates for common time periods.

**Signature:**
```typescript
function getDateRange(
  period: 'today' | 'week' | 'month' | 'quarter' | 'year'
): { startDate: string; endDate: string }
```

**Parameters:**
- `period` - Time period to calculate

**Returns:**
```typescript
{
  startDate: string;  // ISO format: "YYYY-MM-DD"
  endDate: string;    // ISO format: "YYYY-MM-DD"
}
```

**Examples:**
```typescript
// Today (Nov 6, 2025)
getDateRange('today')
// Returns: { startDate: "2025-11-06", endDate: "2025-11-06" }

// Current week (Monday to Sunday)
getDateRange('week')
// Returns: { startDate: "2025-11-03", endDate: "2025-11-09" }

// Current month
getDateRange('month')
// Returns: { startDate: "2025-11-01", endDate: "2025-11-30" }

// Current quarter (Q4: Oct-Dec)
getDateRange('quarter')
// Returns: { startDate: "2025-10-01", endDate: "2025-12-31" }

// Current year
getDateRange('year')
// Returns: { startDate: "2025-01-01", endDate: "2025-12-31" }
```

**Notes:**
- Week starts on Monday (ISO 8601)
- Quarter: Q1=Jan-Mar, Q2=Apr-Jun, Q3=Jul-Sep, Q4=Oct-Dec
- Times: start at 00:00:00, end at 23:59:59

---

### 5. `filterOrdersByDateRange()`

Filters orders within a specific date range.

**Signature:**
```typescript
function filterOrdersByDateRange(
  orders: any[],
  startDate: string,
  endDate: string,
  dateField?: string
): any[]
```

**Parameters:**
- `orders` - Array of orders to filter
- `startDate` - Start date (ISO format)
- `endDate` - End date (ISO format)
- `dateField` - (Optional) Date field name, default: 'commitment_date'

**Example:**
```typescript
const orders = [
  { id: 1, commitment_date: '2025-11-05', ... },
  { id: 2, commitment_date: '2025-11-15', ... },
  { id: 3, commitment_date: '2025-12-01', ... },
];

const { startDate, endDate } = getDateRange('month'); // Nov 2025
const novemberOrders = filterOrdersByDateRange(orders, startDate, endDate);
// Returns: [{ id: 1, ... }, { id: 2, ... }]

// Custom date field
const filtered = filterOrdersByDateRange(
  orders,
  '2025-11-01',
  '2025-11-30',
  'date_order'
);
```

**Edge Cases:**
- Invalid date range returns all orders
- Orders with missing dates are excluded
- Inclusive range (includes both start and end dates)

---

### 6. `isValidDate()`

Validates if a date string is valid.

**Signature:**
```typescript
function isValidDate(dateString: string | null | undefined): boolean
```

**Examples:**
```typescript
isValidDate("2025-11-06")  // true
isValidDate("invalid")     // false
isValidDate(null)          // false
isValidDate(undefined)     // false
isValidDate("")            // false
```

---

### 7. `getPeriodStart()`

Gets the start of a period (day, week, or month).

**Signature:**
```typescript
function getPeriodStart(
  date: Date,
  period: 'day' | 'week' | 'month'
): Date
```

**Examples:**
```typescript
const date = new Date('2025-11-06'); // Thursday

// Day start
getPeriodStart(date, 'day')
// Returns: 2025-11-06 00:00:00

// Week start (Monday)
getPeriodStart(date, 'week')
// Returns: 2025-11-03 00:00:00

// Month start
getPeriodStart(date, 'month')
// Returns: 2025-11-01 00:00:00
```

---

### 8. `getPeriodEnd()`

Gets the end of a period (day, week, or month).

**Signature:**
```typescript
function getPeriodEnd(
  date: Date,
  period: 'day' | 'week' | 'month'
): Date
```

**Examples:**
```typescript
const date = new Date('2025-11-06'); // Thursday

// Day end
getPeriodEnd(date, 'day')
// Returns: 2025-11-06 23:59:59.999

// Week end (Sunday)
getPeriodEnd(date, 'week')
// Returns: 2025-11-09 23:59:59.999

// Month end
getPeriodEnd(date, 'month')
// Returns: 2025-11-30 23:59:59.999
```

---

## Common Use Cases

### 1. Sales Timeline Chart

```typescript
import { groupOrdersByPeriod, formatPeriodLabel } from '@/lib/super-dashboard/timeline-utils';

// Get orders and group by week
const weeklyGroups = groupOrdersByPeriod(orders, 'week');

// Format for chart
const chartData = weeklyGroups.map(group => ({
  label: formatPeriodLabel(group.period, 'week'),
  value: group.totalValue,
  count: group.orderCount,
}));
```

### 2. Team Performance Dashboard

```typescript
import { groupOrdersByTeam, filterOrdersByDateRange, getDateRange } from '@/lib/super-dashboard/timeline-utils';

// Filter to current month
const { startDate, endDate } = getDateRange('month');
const monthOrders = filterOrdersByDateRange(orders, startDate, endDate);

// Group by team
const teamPerformance = groupOrdersByTeam(monthOrders);

// Display top performers
teamPerformance.forEach(team => {
  console.log(`${team.salesperson}: €${team.totalValue.toFixed(2)}`);
});
```

### 3. Period Comparison

```typescript
import { groupOrdersByPeriod, getDateRange } from '@/lib/super-dashboard/timeline-utils';

// Current month
const { startDate: currentStart, endDate: currentEnd } = getDateRange('month');
const currentMonthOrders = filterOrdersByDateRange(orders, currentStart, currentEnd);
const currentValue = currentMonthOrders.reduce((sum, o) => sum + o.amount_total, 0);

// Previous month
const prevMonth = new Date();
prevMonth.setMonth(prevMonth.getMonth() - 1);
const prevStart = getPeriodStart(prevMonth, 'month');
const prevEnd = getPeriodEnd(prevMonth, 'month');
const prevMonthOrders = filterOrdersByDateRange(orders, prevStart.toISOString(), prevEnd.toISOString());
const prevValue = prevMonthOrders.reduce((sum, o) => sum + o.amount_total, 0);

const growth = ((currentValue - prevValue) / prevValue) * 100;
console.log(`Growth: ${growth.toFixed(2)}%`);
```

## Type Definitions

All types are defined in `lib/super-dashboard/types.ts`:

```typescript
export interface SalesPeriodGroup {
  period: string;
  orderCount: number;
  totalValue: number;
  orders: SalesOrder[];
}

export interface SalesTeamGroup {
  teamName: string;
  salesperson: string;
  orderCount: number;
  totalValue: number;
  avgOrderValue: number;
}

export interface SalesOrder {
  id: number;
  name: string;
  date_order: string;
  commitment_date: string;
  amount_total: number;
  user_id: [number, string];  // Odoo many2one format
  team_id?: [number, string];
  state: string;
}
```

## Timezone Considerations

All date functions use the local timezone of the browser/server. For consistent behavior across timezones:

1. Store dates in UTC format
2. Convert to local timezone for display
3. Use ISO 8601 format for date strings

## Performance

- All grouping operations are O(n) complexity
- Uses Map for efficient grouping
- No external dependencies
- Optimized for large datasets (tested with 10k+ orders)

## Error Handling

All functions handle edge cases gracefully:

- Empty arrays return empty results
- Invalid dates are skipped with warnings
- Null/undefined values are filtered out
- Functions never throw exceptions

## Browser Compatibility

Compatible with all modern browsers supporting:
- ES6 Date objects
- Map/Set collections
- Array methods (map, filter, reduce)
- String methods (padStart, match)
