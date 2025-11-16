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
 * Note: The component now manages its own period internally via dropdown
 */
export function BasicExample() {
  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <h1 className="text-3xl font-bold text-white mb-6">Sales Timeline Dashboard</h1>

      <SalesOrdersTimelineSection
        groupBy="week"
      />
    </div>
  );
}

/**
 * Example 2: Simple Dashboard Layout
 * Note: The component now manages its own period internally
 */
export function WithPeriodSelector() {
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month' | 'team'>('week');

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-4">
          Analisi Timeline Vendite
        </h1>
        <p className="text-slate-400 text-sm">
          Il periodo può essere selezionato direttamente nel componente Timeline
        </p>
      </div>

      {/* Timeline Component */}
      <SalesOrdersTimelineSection
        groupBy={groupBy}
      />
    </div>
  );
}

/**
 * Example 3: Multiple Sections Dashboard
 * Combine with other dashboard sections
 * Note: Each section now manages its own period independently
 */
export function DashboardExample() {
  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Global Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">
            Super Dashboard
          </h1>
          <p className="text-slate-400 text-sm mt-2">
            Ogni sezione ha i propri filtri indipendenti
          </p>
        </div>

        {/* Dashboard Sections */}
        <div className="space-y-6">
          {/* Add other dashboard sections here */}
          {/* <KPISummarySection /> */}

          <SalesOrdersTimelineSection
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
 * Note: The component's internal dropdown handles period selection
 */
export function ResponsiveExample() {
  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <div className="bg-slate-800 p-4 lg:p-6 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-xl lg:text-2xl font-bold text-white">Timeline Vendite</h1>
          <p className="text-slate-400 text-sm mt-1">
            Usa i filtri nel componente per selezionare periodo e raggruppamento
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 lg:p-6">
        <div className="max-w-7xl mx-auto">
          <SalesOrdersTimelineSection
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
