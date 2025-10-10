interface Stats {
  totalClients: number;
  weeklyRevenue: number;
  totalOrders: number;
  alertCount: number;
  clientsChange?: string;
  revenueChange?: string;
  ordersChange?: string;
  alertsChange?: string;
}

interface StatsGridProps {
  stats: Stats;
  loading: boolean;
}

export function StatsGrid({ stats, loading }: StatsGridProps) {
  const statCards = [
    {
      number: stats.totalClients,
      label: 'Clienti',
      change: stats.clientsChange || 'Caricamento...',
      changeType: 'neutral' as const,
      borderColor: 'border-l-blue-600'
    },
    {
      number: `CHF ${Math.round(stats.weeklyRevenue).toLocaleString()}`,
      label: 'Fatturato',
      change: stats.revenueChange || 'Caricamento...',
      changeType: 'neutral' as const,
      borderColor: 'border-l-green-600'
    },
    {
      number: stats.totalOrders,
      label: 'Ordini',
      change: stats.ordersChange || 'Caricamento...',
      changeType: 'neutral' as const,
      borderColor: 'border-l-purple-600'
    },
    {
      number: stats.alertCount,
      label: 'Allerte',
      change: stats.alertsChange || 'Caricamento...',
      changeType: 'negative' as const,
      borderColor: 'border-l-red-600'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
      {statCards.map((card, index) => (
        <div
          key={index}
          className={`bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-shadow border-l-4 ${card.borderColor} relative overflow-hidden group`}
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-emerald-600"></div>

          <div className="text-center">
            <div className="text-4xl font-bold text-slate-800 my-3">
              {loading ? (
                <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                card.number
              )}
            </div>
            <div className="text-sm font-semibold text-slate-600 uppercase tracking-wide">
              {card.label}
            </div>
            <div
              className={`text-xs font-semibold mt-2 ${
                card.changeType === 'positive'
                  ? 'text-green-600'
                  : card.changeType === 'negative'
                  ? 'text-red-600'
                  : 'text-amber-600'
              }`}
            >
              {card.change}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
