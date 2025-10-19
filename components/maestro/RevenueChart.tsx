'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

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
