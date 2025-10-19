'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

// Lazy load Recharts for better performance
const LineChart = dynamic(
  () => import('recharts').then(mod => mod.LineChart),
  {
    loading: () => (
      <div className="h-[250px] sm:h-[300px] flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
      </div>
    ),
    ssr: false
  }
);

const Line = dynamic(() => import('recharts').then(mod => mod.Line), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(mod => mod.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(mod => mod.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then(mod => mod.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(mod => mod.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then(mod => mod.ResponsiveContainer), { ssr: false });
const Legend = dynamic(() => import('recharts').then(mod => mod.Legend), { ssr: false });

interface RevenueChartProps {
  data: Array<{
    month: string;
    revenue: number;
    orders: number;
  }>;
}

export function RevenueChart({ data }: RevenueChartProps) {
  return (
    <ResponsiveContainer width="100%" height={250} className="sm:h-[300px]">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis dataKey="month" stroke="#94a3b8" />
        <YAxis
          yAxisId="left"
          stroke="#10b981"
          label={{ value: 'CHF', angle: -90, position: 'insideLeft', fill: '#10b981' }}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          stroke="#3b82f6"
          label={{ value: 'Ordini', angle: 90, position: 'insideRight', fill: '#3b82f6' }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '8px',
            color: '#fff'
          }}
        />
        <Legend />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="revenue"
          stroke="#10b981"
          strokeWidth={3}
          name="Revenue (CHF)"
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="orders"
          stroke="#3b82f6"
          strokeWidth={3}
          name="Ordini"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
