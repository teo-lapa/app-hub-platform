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
      <div className="text-center py-12 text-slate-500">
        Nessun cliente trovato con i filtri selezionati.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {clients.map((client) => (
        <div
          key={client.id}
          onClick={() => onClientClick(client)}
          className="bg-white border border-slate-200 rounded-xl p-5 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-xl"
        >
          {/* Client Header */}
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-lg font-bold text-slate-800 flex-1">
              {client.name}
            </h3>
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${getStatusColor(
                client.status
              )}`}
            >
              {getStatusLabel(client.status)}
            </span>
          </div>

          {/* Client Info */}
          <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
            <div>
              <div className="text-slate-500">Venditore</div>
              <div className="font-semibold text-slate-800">{client.salesperson}</div>
            </div>
            <div>
              <div className="text-slate-500">Ordini (mese)</div>
              <div className="font-semibold text-slate-800">{client.monthlyOrderCount}</div>
            </div>
            <div>
              <div className="text-slate-500">Fatturato</div>
              <div className="font-semibold text-slate-800">
                CHF {Math.round(client.monthlyInvoiced).toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-slate-500">Ultimo Ordine</div>
              <div className="font-semibold text-slate-800">{client.lastOrderDays}g fa</div>
            </div>
          </div>

          {/* Financial Status */}
          {client.invoicesPaid !== undefined && (
            <div className="grid grid-cols-3 gap-2 mb-4 text-xs">
              <div className="bg-green-50 p-2 rounded text-center">
                <div className="text-green-700 font-bold">
                  CHF {Math.round(client.invoicesPaid || 0).toLocaleString()}
                </div>
                <div className="text-green-600">💰 Pagate</div>
              </div>
              <div className="bg-amber-50 p-2 rounded text-center">
                <div className="text-amber-700 font-bold">
                  CHF {Math.round(client.invoicesPending || 0).toLocaleString()}
                </div>
                <div className="text-amber-600">⏳ Pending</div>
              </div>
              <div className="bg-red-50 p-2 rounded text-center">
                <div className="text-red-700 font-bold">
                  CHF {Math.round(client.invoicesOverdue || 0).toLocaleString()}
                </div>
                <div className="text-red-600">🚨 Scadute</div>
              </div>
            </div>
          )}

          {/* Health Score */}
          <div className="mt-4 pt-4 border-t border-slate-200">
            <div className="flex justify-between items-center text-sm mb-2">
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
            <div className="mt-4">
              <div className="text-xs text-slate-600 font-medium mb-2">
                📊 Ultimi 12 Settimane
              </div>
              <div className="flex items-end h-20 gap-0.5 bg-slate-50 rounded-lg p-2">
                {client.weeklyData.map((value, index) => {
                  const maxValue = Math.max(...client.weeklyData!, 1);
                  const heightPercent = maxValue > 0 ? (value / maxValue) * 100 : 0;
                  return (
                    <div
                      key={index}
                      className="flex-1 bg-blue-500 rounded-t hover:bg-blue-600 transition-all cursor-pointer"
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
            <div className="mt-3">
              <div className="text-xs text-slate-600 font-medium mb-2">
                📅 Ultimi 12 Mesi
              </div>
              <div className="flex items-end h-16 gap-0.5 bg-slate-50 rounded-lg p-2">
                {client.monthlyData.map((value, index) => {
                  const maxValue = Math.max(...client.monthlyData!, 1);
                  const heightPercent = maxValue > 0 ? (value / maxValue) * 100 : 0;
                  return (
                    <div
                      key={index}
                      className="flex-1 bg-emerald-500 rounded-t hover:bg-emerald-600 transition-all cursor-pointer"
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
