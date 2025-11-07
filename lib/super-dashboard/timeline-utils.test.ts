/**
 * Test file for timeline-utils.ts
 * Run with: npx ts-node lib/super-dashboard/timeline-utils.test.ts
 */

import {
  groupOrdersByPeriod,
  groupOrdersByTeam,
  formatPeriodLabel,
  getDateRange,
  filterOrdersByDateRange,
  isValidDate,
  getPeriodStart,
  getPeriodEnd,
} from './timeline-utils';

// Mock order data
const mockOrders = [
  {
    id: 1,
    name: 'SO001',
    date_order: '2025-11-01',
    commitment_date: '2025-11-05',
    amount_total: 1000,
    user_id: [1, 'John Doe'],
    team_id: [1, 'Sales Team A'],
    state: 'sale',
  },
  {
    id: 2,
    name: 'SO002',
    date_order: '2025-11-03',
    commitment_date: '2025-11-06',
    amount_total: 1500,
    user_id: [2, 'Jane Smith'],
    team_id: [1, 'Sales Team A'],
    state: 'sale',
  },
  {
    id: 3,
    name: 'SO003',
    date_order: '2025-11-10',
    commitment_date: '2025-11-15',
    amount_total: 2000,
    user_id: [1, 'John Doe'],
    team_id: [2, 'Sales Team B'],
    state: 'sale',
  },
  {
    id: 4,
    name: 'SO004',
    date_order: '2025-10-15',
    commitment_date: '2025-10-20',
    amount_total: 800,
    user_id: [3, 'Bob Johnson'],
    team_id: [1, 'Sales Team A'],
    state: 'sale',
  },
];

console.log('=== Testing Timeline Utilities ===\n');

// Test 1: groupOrdersByPeriod - Day
console.log('1. Group by Day:');
const dailyGroups = groupOrdersByPeriod(mockOrders, 'day');
console.log(JSON.stringify(dailyGroups.slice(0, 2), null, 2));
console.log(`Total groups: ${dailyGroups.length}\n`);

// Test 2: groupOrdersByPeriod - Week
console.log('2. Group by Week:');
const weeklyGroups = groupOrdersByPeriod(mockOrders, 'week');
console.log(JSON.stringify(weeklyGroups, null, 2));
console.log();

// Test 3: groupOrdersByPeriod - Month
console.log('3. Group by Month:');
const monthlyGroups = groupOrdersByPeriod(mockOrders, 'month');
console.log(JSON.stringify(monthlyGroups, null, 2));
console.log();

// Test 4: groupOrdersByTeam
console.log('4. Group by Team:');
const teamGroups = groupOrdersByTeam(mockOrders);
console.log(JSON.stringify(teamGroups, null, 2));
console.log();

// Test 5: formatPeriodLabel
console.log('5. Format Period Labels:');
console.log(`Day: ${formatPeriodLabel('2025-11-06', 'day')}`);
console.log(`Week: ${formatPeriodLabel('2025-W45', 'week')}`);
console.log(`Month: ${formatPeriodLabel('2025-11', 'month')}`);
console.log();

// Test 6: getDateRange
console.log('6. Get Date Ranges:');
console.log('Today:', getDateRange('today'));
console.log('Week:', getDateRange('week'));
console.log('Month:', getDateRange('month'));
console.log('Quarter:', getDateRange('quarter'));
console.log('Year:', getDateRange('year'));
console.log();

// Test 7: filterOrdersByDateRange
console.log('7. Filter by Date Range (November 2025):');
const novemberOrders = filterOrdersByDateRange(
  mockOrders,
  '2025-11-01',
  '2025-11-30'
);
console.log(`Orders in November: ${novemberOrders.length}`);
console.log(novemberOrders.map(o => `${o.name}: ${o.commitment_date}`));
console.log();

// Test 8: isValidDate
console.log('8. Validate Dates:');
console.log(`Valid: '2025-11-06' -> ${isValidDate('2025-11-06')}`);
console.log(`Invalid: 'invalid' -> ${isValidDate('invalid')}`);
console.log(`Null: null -> ${isValidDate(null)}`);
console.log();

// Test 9: getPeriodStart and getPeriodEnd
console.log('9. Period Start/End:');
const testDate = new Date('2025-11-06');
console.log(`Date: ${testDate.toISOString()}`);
console.log(`Week Start: ${getPeriodStart(testDate, 'week').toISOString()}`);
console.log(`Week End: ${getPeriodEnd(testDate, 'week').toISOString()}`);
console.log(`Month Start: ${getPeriodStart(testDate, 'month').toISOString()}`);
console.log(`Month End: ${getPeriodEnd(testDate, 'month').toISOString()}`);
console.log();

// Test 10: Edge cases
console.log('10. Edge Cases:');
console.log('Empty array:', groupOrdersByPeriod([], 'day'));
console.log('Invalid date field:', groupOrdersByPeriod(mockOrders, 'day', 'invalid_field'));
console.log('Invalid groupBy:', formatPeriodLabel('invalid', 'day'));
console.log();

console.log('=== All Tests Complete ===');
