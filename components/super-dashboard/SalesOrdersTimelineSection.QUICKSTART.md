# SalesOrdersTimelineSection - Quick Start Guide

## 🚀 5-Minute Setup

### 1. Import the Component
```tsx
import { SalesOrdersTimelineSection } from '@/components/super-dashboard';
```

### 2. Use in Your Page
```tsx
export default function DashboardPage() {
  return (
    <SalesOrdersTimelineSection
      period="month"
      groupBy="week"
    />
  );
}
```

### 3. That's it! ✅

The component will:
- Fetch data from `/api/super-dashboard/sales-timeline`
- Display summary cards (Total Orders, Total Value, Avg Order Value)
- Show interactive charts (Bar + Line combo)
- Render sortable team performance table
- Provide tab navigation between timeline and team views

---

## 📊 What You Get

### Summary Cards (Top Section)
```
┌─────────────────────────────────────────────────────────────┐
│  [Icon] Total Orders      [Icon] Total Value    [Icon] Avg  │
│         1,250                     CHF 2.5M            2,000  │
│         +12% ↑                                               │
└─────────────────────────────────────────────────────────────┘
```

### Chart View (Per Periodo Tab)
```
  Order Count (Bars)    Total Value (Line)
        │                    ╱╲
   400 ┤█                  ╱  ╲
        │█                ╱    ╲
   300 ┤█    █          ╱      ╲
        │█    █        ╱        ╲
   200 ┤█    █    █  ╱          ╲
        │█    █    █╱            ╲
   100 ┤█    █    █              █
        │█    █    █              █
     0 └┴────┴────┴──────────────┴────
       W1   W2   W3   W4   W5   W6
```

### Table View (Per Team Tab)
```
┌──────────────┬──────┬────────┬──────────────┬────────────┬─────────────┐
│ Salesperson  │ Team │ Orders │ Total Value  │ Avg Value  │ Conversion  │
├──────────────┼──────┼────────┼──────────────┼────────────┼─────────────┤
│ Mario Rossi  │ North│   150  │ CHF 300,000  │ CHF 2,000  │    42% ✓    │
│ Luca Bianchi │ South│   120  │ CHF 240,000  │ CHF 2,000  │    38% ⚠    │
└──────────────┴──────┴────────┴──────────────┴────────────┴─────────────┘
(Click headers to sort ▲▼)
```

---

## 🎨 Visual Features

### Colors
- **Blue** (#3b82f6) - Order count
- **Emerald** (#10b981) - Total value
- **Purple** (#8b5cf6) - Average value
- **Dark Theme** - Slate background with transparency

### Animations
- ✨ Smooth fade-in on mount
- ✨ Staggered card entrance
- ✨ Tab transition effects
- ✨ Hover states on interactive elements

### Responsive
- 📱 Mobile: Single column, horizontal scroll tables
- 💻 Desktop: Multi-column, full-width charts
- 🎯 Tablet: Optimized layout for medium screens

---

## 🔧 Common Customizations

### Change Time Period Dynamically
```tsx
'use client';
import { useState } from 'react';
import { SalesOrdersTimelineSection } from '@/components/super-dashboard';

export default function Page() {
  const [period, setPeriod] = useState('month');

  return (
    <>
      <select value={period} onChange={(e) => setPeriod(e.target.value)}>
        <option value="today">Today</option>
        <option value="week">This Week</option>
        <option value="month">This Month</option>
        <option value="quarter">This Quarter</option>
        <option value="year">This Year</option>
      </select>

      <SalesOrdersTimelineSection period={period} groupBy="week" />
    </>
  );
}
```

### Change Grouping
```tsx
<SalesOrdersTimelineSection
  period="month"
  groupBy="day"    // or "week", "month", "team"
/>
```

---

## 📝 Props Reference

```typescript
interface Props {
  period: string;                           // 'today' | 'week' | 'month' | 'quarter' | 'year'
  groupBy: 'day' | 'week' | 'month' | 'team';  // How to group timeline data
}
```

---

## 🔌 API Endpoint

The component fetches from:
```
GET /api/super-dashboard/sales-timeline?period={period}&groupBy={groupBy}
```

Already implemented at:
```
app/api/super-dashboard/sales-timeline/route.ts
```

---

## 📦 Files Created

### Core Component
```
components/super-dashboard/SalesOrdersTimelineSection.tsx
```
The main React component (850+ lines)

### Export
```
components/super-dashboard/index.ts
```
Added export for easy importing

### Documentation
```
components/super-dashboard/SalesOrdersTimelineSection.md
components/super-dashboard/SalesOrdersTimelineSection.example.tsx
components/super-dashboard/SALESORDERS_IMPLEMENTATION.md
```

### API Updates
```
app/api/super-dashboard/sales-timeline/route.ts
```
Updated to match component's expected data format

---

## ✅ Features Checklist

- ✅ Summary cards with total orders, value, and average
- ✅ Growth indicator with percentage change
- ✅ Combo chart (Bar for orders + Line for value)
- ✅ Sortable team performance table
- ✅ Tab navigation (Per Periodo / Per Team)
- ✅ GroupBy dropdown (Giorno, Settimana, Mese, Team)
- ✅ Loading skeleton with pulse animation
- ✅ Error handling with user-friendly messages
- ✅ Responsive design (mobile-friendly)
- ✅ Framer Motion animations
- ✅ Lucide React icons
- ✅ Tailwind CSS styling
- ✅ TypeScript with full type safety
- ✅ Follows existing dashboard patterns

---

## 🎯 Usage in Existing Dashboard

Add to your super-dashboard page:

```tsx
// app/super-dashboard/page.tsx
import {
  KPISummarySection,
  SalesOrdersTimelineSection,
  TeamPerformanceSection
} from '@/components/super-dashboard';

export default function SuperDashboard() {
  return (
    <div className="min-h-screen bg-slate-900 p-6 space-y-6">
      <KPISummarySection period="month" />

      {/* NEW: Sales Timeline Section */}
      <SalesOrdersTimelineSection period="month" groupBy="week" />

      <TeamPerformanceSection />
    </div>
  );
}
```

---

## 🐛 Troubleshooting

### Component not showing?
1. Check import path is correct
2. Verify API endpoint is accessible
3. Check browser console for errors

### Chart not rendering?
1. Ensure Recharts is installed: `npm install recharts`
2. Check parent container has height defined

### Styling broken?
1. Verify Tailwind CSS is configured
2. Check `tailwind.config.js` includes components directory

---

## 📚 More Info

- **Full Documentation**: `SalesOrdersTimelineSection.md`
- **Examples**: `SalesOrdersTimelineSection.example.tsx`
- **Implementation Guide**: `SALESORDERS_IMPLEMENTATION.md`

---

## 🎉 You're Ready!

The component is production-ready and follows all patterns from:
- `KPISummarySection.tsx` - Structure and loading states
- `FinanceSection.tsx` - Recharts integration
- `TeamPerformanceSection.tsx` - Table and sorting

Start using it in your dashboard now! 🚀
