interface Client {
  id: number;
  name: string;
  email: string;
  phone: string;
  address: string;
  salesperson: string;
  orderCount: number;
  totalInvoiced: number;
  monthlyInvoiced: number;
  monthlyOrderCount: number;
  healthScore: number;
  status: 'active' | 'warning' | 'inactive';
  lastOrderDays: number;
  weeklyData?: number[];
  monthlyData?: number[];
  invoicesPaid?: number;
  invoicesPending?: number;
  invoicesOverdue?: number;
}

interface ClientGridProps {
  clients: Client[];
  onClientClick: (client: Client) => void;
}

export function ClientGrid({ clients, onClientClick }: ClientGridProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-700';
      case 'warning':
        return 'bg-amber-100 text-amber-700';
      case 'inactive':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active':
        return 'Attivo';
      case 'warning':
        return 'Attenzione';
      case 'inactive':
        return 'Inattivo';
      default:
        return 'Sconosciuto';
    }
  };

  if (clients.length === 0) {
    return (
      <div className="text-center py-8 sm:py-12 text-slate-500 text-sm sm:text-base">
        Nessun cliente trovato con i filtri selezionati.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-5">
      {clients.map((client) => (
        <div
          key={client.id}
          onClick={() => onClientClick(client)}
          className="bg-white border border-slate-200 rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-5 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-xl active:scale-98 min-h-touch"
        >
          {/* Client Header */}
          <div className="flex justify-between items-start mb-3 sm:mb-4 gap-2">
            <h3 className="text-sm sm:text-base md:text-lg font-bold text-slate-800 flex-1 line-clamp-2">
              {client.name}
            </h3>
            <span
              className={`px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-semibold uppercase shrink-0 ${getStatusColor(
                client.status
              )}`}
            >
              {getStatusLabel(client.status)}
            </span>
          </div>

          {/* Client Info */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-3 sm:mb-4 text-xs sm:text-sm">
            <div>
              <div className="text-slate-500 text-[10px] sm:text-xs">Venditore</div>
              <div className="font-semibold text-slate-800 truncate">{client.salesperson}</div>
            </div>
            <div>
              <div className="text-slate-500 text-[10px] sm:text-xs">Ordini (mese)</div>
              <div className="font-semibold text-slate-800">{client.monthlyOrderCount}</div>
            </div>
            <div>
              <div className="text-slate-500 text-[10px] sm:text-xs">Fatturato</div>
              <div className="font-semibold text-slate-800 truncate">
                <span className="hidden xs:inline">CHF </span>
                {Math.round(client.monthlyInvoiced).toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-slate-500 text-[10px] sm:text-xs">Ultimo Ordine</div>
              <div className="font-semibold text-slate-800">{client.lastOrderDays}g fa</div>
            </div>
          </div>

          {/* Financial Status */}
          {client.invoicesPaid !== undefined && (
            <div className="grid grid-cols-3 gap-1 sm:gap-2 mb-3 sm:mb-4 text-[10px] sm:text-xs">
              <div className="bg-green-50 p-1.5 sm:p-2 rounded text-center">
                <div className="text-green-700 font-bold text-[10px] sm:text-xs truncate">
                  <span className="hidden xs:inline">CHF </span>
                  {Math.round(client.invoicesPaid || 0).toLocaleString()}
                </div>
                <div className="text-green-600 text-[9px] sm:text-[10px]">
                  <span className="sm:hidden">💰</span>
                  <span className="hidden sm:inline">💰 Pagate</span>
                </div>
              </div>
              <div className="bg-amber-50 p-1.5 sm:p-2 rounded text-center">
                <div className="text-amber-700 font-bold text-[10px] sm:text-xs truncate">
                  <span className="hidden xs:inline">CHF </span>
                  {Math.round(client.invoicesPending || 0).toLocaleString()}
                </div>
                <div className="text-amber-600 text-[9px] sm:text-[10px]">
                  <span className="sm:hidden">⏳</span>
                  <span className="hidden sm:inline">⏳ Pending</span>
                </div>
              </div>
              <div className="bg-red-50 p-1.5 sm:p-2 rounded text-center">
                <div className="text-red-700 font-bold text-[10px] sm:text-xs truncate">
                  <span className="hidden xs:inline">CHF </span>
                  {Math.round(client.invoicesOverdue || 0).toLocaleString()}
                </div>
                <div className="text-red-600 text-[9px] sm:text-[10px]">
                  <span className="sm:hidden">🚨</span>
                  <span className="hidden sm:inline">🚨 Scadute</span>
                </div>
              </div>
            </div>
          )}

          {/* Health Score */}
          <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-slate-200">
            <div className="flex justify-between items-center text-xs sm:text-sm mb-2">
              <span className="text-slate-600 font-medium">Health Score</span>
              <span className="font-bold text-slate-800">{client.healthScore}/100</span>
            </div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  client.healthScore >= 70
                    ? 'bg-green-500'
                    : client.healthScore >= 40
                    ? 'bg-amber-500'
                    : 'bg-red-500'
                }`}
                style={{ width: `${client.healthScore}%` }}
              ></div>
            </div>
          </div>

          {/* Weekly Trend Chart - Ultimi 12 Settimane */}
          {client.weeklyData && client.weeklyData.length > 0 && (
            <div className="mt-3 sm:mt-4">
              <div className="text-[10px] sm:text-xs text-slate-600 font-medium mb-1.5 sm:mb-2">
                📊 <span className="hidden xs:inline">Ultimi 12 Settimane</span>
                <span className="xs:hidden">12 Sett.</span>
              </div>
              <div className="flex items-end h-16 sm:h-20 gap-0.5 bg-slate-50 rounded-lg p-1.5 sm:p-2">
                {client.weeklyData.map((value, index) => {
                  const maxValue = Math.max(...client.weeklyData!, 1);
                  const heightPercent = maxValue > 0 ? (value / maxValue) * 100 : 0;
                  return (
                    <div
                      key={index}
                      className="flex-1 bg-blue-500 rounded-t hover:bg-blue-600 transition-all cursor-pointer active:bg-blue-700"
                      style={{
                        height: `${Math.max(heightPercent, 2)}%`,
                        minHeight: value > 0 ? '4px' : '2px'
                      }}
                      title={`Settimana ${index + 1}: CHF ${Math.round(value).toLocaleString()}`}
                    ></div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Monthly Trend Chart - Ultimi 12 Mesi */}
          {client.monthlyData && client.monthlyData.length > 0 && (
            <div className="mt-2 sm:mt-3">
              <div className="text-[10px] sm:text-xs text-slate-600 font-medium mb-1.5 sm:mb-2">
                📅 <span className="hidden xs:inline">Ultimi 12 Mesi</span>
                <span className="xs:hidden">12 Mesi</span>
              </div>
              <div className="flex items-end h-14 sm:h-16 gap-0.5 bg-slate-50 rounded-lg p-1.5 sm:p-2">
                {client.monthlyData.map((value, index) => {
                  const maxValue = Math.max(...client.monthlyData!, 1);
                  const heightPercent = maxValue > 0 ? (value / maxValue) * 100 : 0;
                  return (
                    <div
                      key={index}
                      className="flex-1 bg-emerald-500 rounded-t hover:bg-emerald-600 transition-all cursor-pointer active:bg-emerald-700"
                      style={{
                        height: `${Math.max(heightPercent, 2)}%`,
                        minHeight: value > 0 ? '4px' : '2px'
                      }}
                      title={`Mese ${index + 1}: CHF ${Math.round(value).toLocaleString()}`}
                    ></div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
