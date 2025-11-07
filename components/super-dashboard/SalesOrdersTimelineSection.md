# SalesOrdersTimelineSection Component

## Overview
A comprehensive React component for visualizing sales orders timeline data in the Super Dashboard. This component provides multiple views including time-based analysis and team performance breakdown.

## Features

### 1. **Summary Cards**
- **Total Orders**: Displays total number of orders with growth percentage
- **Total Value**: Shows total revenue in CHF with formatted numbers
- **Avg Order Value**: Average value per order

### 2. **Interactive Visualizations**
- **Combo Chart**: Combined bar and line chart showing:
  - Bar chart: Order count (blue)
  - Line chart: Total value (emerald green)
  - Dashed line: Average order value (purple)
- **Responsive Design**: Adapts to different screen sizes

### 3. **Tab Navigation**
- **Per Periodo**: Timeline view showing data over time
- **Per Team**: Table view showing team performance breakdown

### 4. **Team Performance Table**
- Sortable columns:
  - Salesperson name
  - Team assignment
  - Order count
  - Total value
  - Average order value
  - Conversion rate
- Color-coded conversion rates:
  - Green: ≥40%
  - Yellow: 30-39%
  - Red: <30%

### 5. **Advanced Features**
- **Dynamic GroupBy Dropdown**: Switch between Day, Week, Month, Team
- **Loading Skeleton**: Smooth loading animation
- **Error Handling**: Clear error messages with retry capability
- **Framer Motion Animations**: Smooth transitions and entrance animations
- **Responsive Tables**: Mobile-friendly with horizontal scrolling

## Props

```typescript
interface SalesOrdersTimelineSectionProps {
  period: string;          // Period filter (e.g., 'today', 'week', 'month', 'quarter', 'year')
  groupBy: 'day' | 'week' | 'month' | 'team';  // Initial grouping option
}
```

## API Integration

### Expected API Response Format

**Endpoint**: `/api/super-dashboard/sales-timeline?period={period}&groupBy={groupBy}`

**Response Structure**:
```typescript
{
  success: boolean;
  data: {
    summary: {
      totalOrders: number;
      totalValue: number;
      avgOrderValue: number;
      growth: number;        // Percentage growth vs previous period
    };
    timeline: Array<{
      period: string;        // Label for X-axis (e.g., "Week 1", "January", "2024-01-01")
      orderCount: number;
      totalValue: number;
      avgOrderValue: number;
    }>;
    byTeam: Array<{
      team: string;
      salesperson: string;
      orderCount: number;
      totalValue: number;
      avgOrderValue: number;
      conversionRate: number;  // Percentage 0-100
    }>;
  };
  error?: string;
}
```

### Example API Response

```json
{
  "success": true,
  "data": {
    "summary": {
      "totalOrders": 1250,
      "totalValue": 2500000,
      "avgOrderValue": 2000,
      "growth": 12.5
    },
    "timeline": [
      {
        "period": "Week 1",
        "orderCount": 250,
        "totalValue": 500000,
        "avgOrderValue": 2000
      },
      {
        "period": "Week 2",
        "orderCount": 280,
        "totalValue": 560000,
        "avgOrderValue": 2000
      }
    ],
    "byTeam": [
      {
        "team": "North",
        "salesperson": "Mario Rossi",
        "orderCount": 150,
        "totalValue": 300000,
        "avgOrderValue": 2000,
        "conversionRate": 42
      },
      {
        "team": "South",
        "salesperson": "Luca Bianchi",
        "orderCount": 120,
        "totalValue": 240000,
        "avgOrderValue": 2000,
        "conversionRate": 38
      }
    ]
  }
}
```

## Usage Examples

### Basic Usage
```tsx
import { SalesOrdersTimelineSection } from '@/components/super-dashboard';

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <SalesOrdersTimelineSection
        period="month"
        groupBy="week"
      />
    </div>
  );
}
```

### With Dynamic Period Selection
```tsx
'use client';

import { useState } from 'react';
import { SalesOrdersTimelineSection } from '@/components/super-dashboard';

export default function Dashboard() {
  const [period, setPeriod] = useState('month');

  return (
    <div>
      <select value={period} onChange={(e) => setPeriod(e.target.value)}>
        <option value="today">Today</option>
        <option value="week">This Week</option>
        <option value="month">This Month</option>
        <option value="quarter">This Quarter</option>
        <option value="year">This Year</option>
      </select>

      <SalesOrdersTimelineSection
        period={period}
        groupBy="day"
      />
    </div>
  );
}
```

### Multiple Sections in Dashboard
```tsx
import {
  KPISummarySection,
  SalesOrdersTimelineSection,
  TeamPerformanceSection
} from '@/components/super-dashboard';

export default function SuperDashboard() {
  return (
    <div className="min-h-screen bg-slate-900 p-6 space-y-6">
      <KPISummarySection period="month" />
      <SalesOrdersTimelineSection period="month" groupBy="week" />
      <TeamPerformanceSection />
    </div>
  );
}
```

## Styling & Theme

### Color Scheme
- **Primary (Orders)**: Blue (`#3b82f6`)
- **Success (Value)**: Emerald Green (`#10b981`)
- **Accent (Avg)**: Purple (`#8b5cf6`)
- **Background**: Slate with transparency (`slate-800/40`)
- **Borders**: Slate (`slate-700/50`)

### Responsive Breakpoints
- **Mobile**: Single column layout
- **Tablet (md)**: 3-column summary cards
- **Desktop**: Full table view with all columns

## Dependencies

Required packages (already in project):
- `react` & `react-dom`
- `framer-motion` - Animations
- `recharts` - Charts
- `lucide-react` - Icons
- `tailwindcss` - Styling

## Component Structure

```
SalesOrdersTimelineSection/
├── Props Interface
├── State Management
│   ├── Data fetching with useEffect
│   ├── Tab state (timeline/team)
│   ├── GroupBy selection
│   └── Sorting state
├── Loading State Component
├── Error State Component
├── Main Component
│   ├── Header with GroupBy dropdown
│   ├── Summary Cards (3 cards)
│   ├── Tab Navigation
│   ├── Timeline Tab
│   │   └── ComposedChart (Bar + Line)
│   └── Team Tab
│       └── Sortable Table
```

## Performance Considerations

1. **Memoization**: Consider wrapping in `React.memo` if parent re-renders frequently
2. **Data Size**: Table is optimized for ~50-100 rows
3. **Chart Performance**: Recharts is optimized for datasets up to 1000 points
4. **API Caching**: Implement caching at API level for repeated queries

## Accessibility

- Semantic HTML structure
- ARIA labels on interactive elements
- Keyboard navigation support for table sorting
- Color contrast ratios meet WCAG AA standards
- Screen reader friendly table structure

## Browser Support

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Mobile browsers: ✅ Full support (responsive design)

## Future Enhancements

Potential improvements:
1. Export to CSV/Excel functionality
2. Date range picker for custom periods
3. Drill-down capability (click to see order details)
4. Comparison view (current vs previous period)
5. Real-time updates via WebSocket
6. Print-friendly view
7. Dashboard widget customization (hide/show elements)

## Troubleshooting

### Component doesn't load
- Check API endpoint is accessible
- Verify response format matches expected structure
- Check browser console for errors

### Chart rendering issues
- Ensure Recharts is installed: `npm install recharts`
- Check data format (numbers not strings)
- Verify responsive container has parent with defined height

### Styling issues
- Ensure Tailwind CSS is configured
- Check for conflicting global styles
- Verify all color classes are in Tailwind config

## Support

For issues or questions:
1. Check component props are correct
2. Verify API response format
3. Check browser console for errors
4. Review this documentation

## Version History

- **v1.0.0** (2024-11-06): Initial release
  - Summary cards
  - Timeline chart (bar + line)
  - Team performance table
  - Responsive design
  - Loading & error states
