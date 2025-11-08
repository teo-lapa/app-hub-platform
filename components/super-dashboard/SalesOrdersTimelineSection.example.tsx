/**
 * Example usage of SalesOrdersTimelineSection component
 *
 * This file demonstrates different ways to integrate the SalesOrdersTimelineSection
 * into your application.
 */

'use client';

import { useState } from 'react';
import { SalesOrdersTimelineSection } from './SalesOrdersTimelineSection';

/**
 * Example 1: Basic Usage
 * Simple implementation with fixed props
 */
export function BasicExample() {
  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <h1 className="text-3xl font-bold text-white mb-6">Sales Timeline Dashboard</h1>

      <SalesOrdersTimelineSection
        period="month"
        groupBy="week"
      />
    </div>
  );
}

/**
 * Example 2: With Period Selector
 * Allow users to change the time period dynamically
 */
export function WithPeriodSelector() {
  const [period, setPeriod] = useState<string>('month');
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month' | 'team'>('week');

  const periodLabels: Record<string, string> = {
    today: 'Oggi',
    week: 'Questa Settimana',
    month: 'Questo Mese',
    quarter: 'Questo Trimestre',
    year: 'Quest\'Anno',
  };

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-4">
          Analisi Timeline Vendite
        </h1>

        {/* Period Selector */}
        <div className="flex gap-4 items-center">
          <label className="text-slate-400 text-sm font-medium">
            Periodo:
          </label>
          <div className="flex gap-2">
            {Object.entries(periodLabels).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setPeriod(value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  period === value
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline Component */}
      <SalesOrdersTimelineSection
        period={period}
        groupBy={groupBy}
      />
    </div>
  );
}

/**
 * Example 3: Multiple Sections Dashboard
 * Combine with other dashboard sections
 */
export function DashboardExample() {
  const [period, setPeriod] = useState<string>('month');

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Global Period Selector */}
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white">
            Super Dashboard
          </h1>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="bg-slate-800 text-white border border-slate-700 rounded-lg px-4 py-2"
          >
            <option value="today">Oggi</option>
            <option value="week">Questa Settimana</option>
            <option value="month">Questo Mese</option>
            <option value="quarter">Questo Trimestre</option>
            <option value="year">Quest'Anno</option>
          </select>
        </div>

        {/* Dashboard Sections */}
        <div className="space-y-6">
          {/* Add other dashboard sections here */}
          {/* <KPISummarySection period={period} /> */}

          <SalesOrdersTimelineSection
            period={period}
            groupBy="week"
          />

          {/* <TeamPerformanceSection /> */}
        </div>
      </div>
    </div>
  );
}

/**
 * Example 4: Embedded in Existing Page
 * Use as a widget in an existing dashboard
 */
export function EmbeddedExample() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
      {/* Other widgets */}
      <div className="bg-slate-800 rounded-xl p-6">
        <h3 className="text-white text-xl font-bold mb-4">Quick Stats</h3>
        {/* ... stats content ... */}
      </div>

      {/* Sales Timeline - Full Width */}
      <div className="lg:col-span-2">
        <SalesOrdersTimelineSection
          period="month"
          groupBy="day"
        />
      </div>

      {/* More widgets */}
      <div className="bg-slate-800 rounded-xl p-6">
        <h3 className="text-white text-xl font-bold mb-4">Recent Activity</h3>
        {/* ... activity content ... */}
      </div>
    </div>
  );
}

/**
 * Example 5: Responsive Layout
 * Optimize for different screen sizes
 */
export function ResponsiveExample() {
  const [period, setPeriod] = useState<string>('month');

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Mobile Header */}
      <div className="lg:hidden bg-slate-800 p-4 sticky top-0 z-10">
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="w-full bg-slate-700 text-white border border-slate-600 rounded-lg px-3 py-2"
        >
          <option value="today">Oggi</option>
          <option value="week">Settimana</option>
          <option value="month">Mese</option>
          <option value="quarter">Trimestre</option>
          <option value="year">Anno</option>
        </select>
      </div>

      {/* Desktop Header */}
      <div className="hidden lg:block bg-slate-800 p-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Timeline Vendite</h1>
          <div className="flex gap-2">
            {['today', 'week', 'month', 'quarter', 'year'].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-lg text-sm ${
                  period === p
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 lg:p-6">
        <div className="max-w-7xl mx-auto">
          <SalesOrdersTimelineSection
            period={period}
            groupBy="week"
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Example 6: With Custom Styling
 * Override default colors and styles
 */
export function CustomStyledExample() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="backdrop-blur-xl bg-white/5 rounded-2xl p-8 border border-white/10">
          <h1 className="text-4xl font-bold text-white mb-8 text-center">
            Sales Analytics
          </h1>

          <SalesOrdersTimelineSection
            period="month"
            groupBy="week"
          />
        </div>
      </div>
    </div>
  );
}

// Export all examples for testing
export const examples = {
  BasicExample,
  WithPeriodSelector,
  DashboardExample,
  EmbeddedExample,
  ResponsiveExample,
  CustomStyledExample,
};
