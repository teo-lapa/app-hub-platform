/**
 * Timeline Utility Functions for Super Dashboard
 *
 * Provides utilities for date grouping, formatting, and range calculations
 * to support sales timeline visualization and analysis.
 */

import { SalesPeriodGroup, SalesTeamGroup, SalesOrder } from './types';

/**
 * Groups orders by time period (day, week, or month).
 *
 * @param orders - Array of sales orders to group
 * @param groupBy - Time period granularity ('day' | 'week' | 'month')
 * @param dateField - Name of the date field to use for grouping (default: 'commitment_date')
 * @returns Array of period groups with aggregated order data
 *
 * @example
 * ```typescript
 * const dailyGroups = groupOrdersByPeriod(orders, 'day');
 * const weeklyGroups = groupOrdersByPeriod(orders, 'week', 'date_order');
 * ```
 */
export function groupOrdersByPeriod(
  orders: any[],
  groupBy: 'day' | 'week' | 'month',
  dateField: string = 'commitment_date'
): SalesPeriodGroup[] {
  // Handle empty or invalid input
  if (!orders || orders.length === 0) {
    return [];
  }

  // Create a map to group orders by period
  const periodMap = new Map<string, SalesOrder[]>();

  orders.forEach((order) => {
    const dateValue = order[dateField];

    // Skip orders with missing or invalid dates
    if (!dateValue) {
      return;
    }

    const date = new Date(dateValue);

    // Skip invalid dates
    if (isNaN(date.getTime())) {
      return;
    }

    // Generate period key based on groupBy parameter
    let periodKey: string;

    switch (groupBy) {
      case 'day':
        // Format: YYYY-MM-DD
        periodKey = date.toISOString().split('T')[0];
        break;

      case 'week':
        // Get ISO week number and year
        const { year, week } = getISOWeek(date);
        periodKey = `${year}-W${week.toString().padStart(2, '0')}`;
        break;

      case 'month':
        // Format: YYYY-MM
        periodKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        break;

      default:
        periodKey = date.toISOString().split('T')[0];
    }

    // Add order to the period group
    if (!periodMap.has(periodKey)) {
      periodMap.set(periodKey, []);
    }
    periodMap.get(periodKey)!.push(order);
  });

  // Convert map to array of SalesPeriodGroup objects
  const result: SalesPeriodGroup[] = Array.from(periodMap.entries())
    .map(([period, orders]) => {
      const totalValue = orders.reduce((sum, order) => {
        const amount = order.amount_total || 0;
        return sum + amount;
      }, 0);

      return {
        period,
        orderCount: orders.length,
        totalValue,
        orders,
      };
    })
    .sort((a, b) => a.period.localeCompare(b.period)); // Sort chronologically

  return result;
}

/**
 * Groups orders by sales team and salesperson.
 *
 * @param orders - Array of sales orders to group
 * @returns Array of team groups with aggregated order data
 *
 * @example
 * ```typescript
 * const teamGroups = groupOrdersByTeam(orders);
 * teamGroups.forEach(group => {
 *   console.log(`${group.salesperson}: ${group.orderCount} orders`);
 * });
 * ```
 */
export function groupOrdersByTeam(orders: any[]): SalesTeamGroup[] {
  // Handle empty or invalid input
  if (!orders || orders.length === 0) {
    return [];
  }

  // Create a map to group orders by salesperson
  // Key format: "salesperson_id|salesperson_name|team_id|team_name"
  const teamMap = new Map<string, {
    orders: SalesOrder[];
    teamName: string;
    salesperson: string;
  }>();

  orders.forEach((order) => {
    // Extract salesperson info (Odoo many2one format: [id, name])
    const userId = order.user_id;
    if (!userId || !Array.isArray(userId) || userId.length < 2) {
      return; // Skip orders without valid salesperson
    }

    const salespersonId = userId[0];
    const salespersonName = userId[1] || 'Unknown';

    // Extract team info (optional)
    const teamId = order.team_id;
    const teamName = teamId && Array.isArray(teamId) && teamId.length >= 2
      ? teamId[1]
      : 'No Team';

    // Create unique key for this salesperson
    const key = `${salespersonId}|${salespersonName}|${teamName}`;

    if (!teamMap.has(key)) {
      teamMap.set(key, {
        orders: [],
        teamName,
        salesperson: salespersonName,
      });
    }

    teamMap.get(key)!.orders.push(order);
  });

  // Convert map to array of SalesTeamGroup objects
  const result: SalesTeamGroup[] = Array.from(teamMap.values())
    .map(({ orders, teamName, salesperson }) => {
      const totalValue = orders.reduce((sum, order) => {
        const amount = order.amount_total || 0;
        return sum + amount;
      }, 0);

      const avgOrderValue = orders.length > 0 ? totalValue / orders.length : 0;

      return {
        teamName,
        salesperson,
        orderCount: orders.length,
        totalValue,
        avgOrderValue,
      };
    })
    .sort((a, b) => b.totalValue - a.totalValue); // Sort by total value descending

  return result;
}

/**
 * Formats a period string into a human-readable label.
 *
 * @param date - ISO date string or period key (e.g., "2025-11-06", "2025-W45", "2025-11")
 * @param groupBy - Time period granularity ('day' | 'week' | 'month')
 * @returns Formatted label in Italian locale
 *
 * @example
 * ```typescript
 * formatPeriodLabel("2025-11-06", "day")     // "06 Nov 2025"
 * formatPeriodLabel("2025-W45", "week")      // "Settimana 45, 2025"
 * formatPeriodLabel("2025-11", "month")      // "Novembre 2025"
 * ```
 */
export function formatPeriodLabel(
  date: string,
  groupBy: 'day' | 'week' | 'month'
): string {
  if (!date) {
    return 'Invalid Date';
  }

  try {
    switch (groupBy) {
      case 'day': {
        // Parse date string (format: YYYY-MM-DD)
        const d = new Date(date);
        if (isNaN(d.getTime())) {
          return 'Invalid Date';
        }

        // Format: "06 Nov 2025"
        const day = d.getDate().toString().padStart(2, '0');
        const month = d.toLocaleDateString('it-IT', { month: 'short' });
        const year = d.getFullYear();

        // Capitalize first letter of month
        const monthCapitalized = month.charAt(0).toUpperCase() + month.slice(1);

        return `${day} ${monthCapitalized} ${year}`;
      }

      case 'week': {
        // Parse week string (format: YYYY-W##)
        const match = date.match(/^(\d{4})-W(\d{2})$/);
        if (!match) {
          return 'Invalid Week';
        }

        const year = match[1];
        const week = parseInt(match[2], 10);

        return `Settimana ${week}, ${year}`;
      }

      case 'month': {
        // Parse month string (format: YYYY-MM)
        const match = date.match(/^(\d{4})-(\d{2})$/);
        if (!match) {
          return 'Invalid Month';
        }

        const year = parseInt(match[1], 10);
        const monthNum = parseInt(match[2], 10);

        // Create date object (use first day of month)
        const d = new Date(year, monthNum - 1, 1);
        if (isNaN(d.getTime())) {
          return 'Invalid Month';
        }

        // Format: "Novembre 2025"
        const monthName = d.toLocaleDateString('it-IT', { month: 'long' });
        const monthCapitalized = monthName.charAt(0).toUpperCase() + monthName.slice(1);

        return `${monthCapitalized} ${year}`;
      }

      default:
        return date;
    }
  } catch (error) {
    console.error('Error formatting period label:', error);
    return 'Invalid Date';
  }
}

/**
 * Calculates start and end dates for common time periods.
 *
 * @param period - Time period to calculate ('today' | 'week' | 'month' | 'quarter' | 'year')
 * @returns Object with startDate and endDate in ISO format (YYYY-MM-DD)
 *
 * @example
 * ```typescript
 * const { startDate, endDate } = getDateRange('week');
 * // Returns current week's Monday to Sunday
 *
 * const { startDate, endDate } = getDateRange('month');
 * // Returns first to last day of current month
 * ```
 */
export function getDateRange(
  period: 'today' | 'week' | 'month' | 'quarter' | 'year'
): { startDate: string; endDate: string } {
  const now = new Date();
  let startDate: Date;
  let endDate: Date;

  switch (period) {
    case 'today':
      // Start and end of today
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      break;

    case 'week':
      // Current week (Monday to Sunday)
      const dayOfWeek = now.getDay();
      const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday is 0, adjust to Monday start

      startDate = new Date(now);
      startDate.setDate(now.getDate() - daysFromMonday);
      startDate.setHours(0, 0, 0, 0);

      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
      break;

    case 'month':
      // Current month (first to last day)
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      break;

    case 'quarter':
      // Current quarter
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const quarterStartMonth = currentQuarter * 3;

      startDate = new Date(now.getFullYear(), quarterStartMonth, 1);
      endDate = new Date(now.getFullYear(), quarterStartMonth + 3, 0, 23, 59, 59, 999);
      break;

    case 'year':
      // Current year (January 1 to December 31)
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      break;

    default:
      // Default to today
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  }

  return {
    startDate: formatDateToISO(startDate),
    endDate: formatDateToISO(endDate),
  };
}

/**
 * Helper function to get ISO week number and year for a given date.
 * ISO week 1 is the first week with a Thursday in it.
 *
 * @param date - Date object to get week number from
 * @returns Object with year and week number
 * @internal
 */
function getISOWeek(date: Date): { year: number; week: number } {
  // Create a copy to avoid modifying the original date
  const d = new Date(date.getTime());

  // Set to nearest Thursday: current date + 4 - current day number
  // Make Sunday's day number 7
  const dayNum = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - dayNum);

  // Get first day of year
  const yearStart = new Date(d.getFullYear(), 0, 1);

  // Calculate full weeks to nearest Thursday
  const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

  return {
    year: d.getFullYear(),
    week: weekNum,
  };
}

/**
 * Helper function to format a Date object to ISO date string (YYYY-MM-DD).
 *
 * @param date - Date object to format
 * @returns ISO formatted date string
 * @internal
 */
function formatDateToISO(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Filters orders by date range.
 *
 * @param orders - Array of sales orders to filter
 * @param startDate - Start date in ISO format (YYYY-MM-DD)
 * @param endDate - End date in ISO format (YYYY-MM-DD)
 * @param dateField - Name of the date field to use for filtering (default: 'commitment_date')
 * @returns Filtered array of orders within the date range
 *
 * @example
 * ```typescript
 * const { startDate, endDate } = getDateRange('month');
 * const monthOrders = filterOrdersByDateRange(orders, startDate, endDate);
 * ```
 */
export function filterOrdersByDateRange(
  orders: any[],
  startDate: string,
  endDate: string,
  dateField: string = 'commitment_date'
): any[] {
  if (!orders || orders.length === 0) {
    return [];
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  // Validate dates
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    console.error('Invalid date range provided');
    return orders;
  }

  return orders.filter((order) => {
    const dateValue = order[dateField];

    if (!dateValue) {
      return false;
    }

    const orderDate = new Date(dateValue);

    if (isNaN(orderDate.getTime())) {
      return false;
    }

    return orderDate >= start && orderDate <= end;
  });
}

/**
 * Validates if a date string is valid.
 *
 * @param dateString - Date string to validate
 * @returns True if the date string is valid, false otherwise
 *
 * @example
 * ```typescript
 * isValidDate("2025-11-06")  // true
 * isValidDate("invalid")     // false
 * isValidDate(null)          // false
 * ```
 */
export function isValidDate(dateString: string | null | undefined): boolean {
  if (!dateString) {
    return false;
  }

  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

/**
 * Gets the start of a period (day, week, or month) for a given date.
 *
 * @param date - Date to get period start from
 * @param period - Period type ('day' | 'week' | 'month')
 * @returns Date object representing the start of the period
 *
 * @example
 * ```typescript
 * const date = new Date('2025-11-06');
 * const weekStart = getPeriodStart(date, 'week');  // Monday of that week
 * const monthStart = getPeriodStart(date, 'month'); // Nov 1, 2025
 * ```
 */
export function getPeriodStart(
  date: Date,
  period: 'day' | 'week' | 'month'
): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);

  switch (period) {
    case 'day':
      // Start of day (already set above)
      break;

    case 'week':
      // Start of week (Monday)
      const dayOfWeek = result.getDay();
      const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      result.setDate(result.getDate() - daysFromMonday);
      break;

    case 'month':
      // Start of month
      result.setDate(1);
      break;
  }

  return result;
}

/**
 * Gets the end of a period (day, week, or month) for a given date.
 *
 * @param date - Date to get period end from
 * @param period - Period type ('day' | 'week' | 'month')
 * @returns Date object representing the end of the period
 *
 * @example
 * ```typescript
 * const date = new Date('2025-11-06');
 * const weekEnd = getPeriodEnd(date, 'week');  // Sunday of that week
 * const monthEnd = getPeriodEnd(date, 'month'); // Nov 30, 2025
 * ```
 */
export function getPeriodEnd(
  date: Date,
  period: 'day' | 'week' | 'month'
): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);

  switch (period) {
    case 'day':
      // End of day (already set above)
      break;

    case 'week':
      // End of week (Sunday)
      const dayOfWeek = result.getDay();
      const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
      result.setDate(result.getDate() + daysToSunday);
      break;

    case 'month':
      // End of month
      result.setMonth(result.getMonth() + 1, 0);
      break;
  }

  return result;
}
