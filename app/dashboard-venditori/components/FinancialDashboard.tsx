interface FinancialDashboardProps {
  client: any;
  onClose: () => void;
}

export function FinancialDashboard({ client, onClose }: FinancialDashboardProps) {
  // Dati finanziari simulati (saranno sostituiti con dati reali da Odoo)
  const financialData = {
    paid: client.financialData?.paid || 15000,
    pending: client.financialData?.pending || 3500,
    overdue: client.financialData?.overdue || 1200,
    total: client.financialData?.total || 19700
  };

  const paidPercent = Math.round((financialData.paid / financialData.total) * 100);
  const pendingPercent = Math.round((financialData.pending / financialData.total) * 100);
  const overduePercent = Math.round((financialData.overdue / financialData.total) * 100);

  const recentInvoices = [
    {
      id: 1,
      number: 'INV-2024-001',
      date: '2024-09-15',
      amount: 2500,
      status: 'paid',
      dueDate: '2024-10-15'
    },
    {
      id: 2,
      number: 'INV-2024-002',
      date: '2024-09-20',
      amount: 1800,
      status: 'pending',
      dueDate: '2024-10-20'
    },
    {
      id: 3,
      number: 'INV-2024-003',
      date: '2024-08-25',
      amount: 1200,
      status: 'overdue',
      dueDate: '2024-09-25'
    },
    {
      id: 4,
      number: 'INV-2024-004',
      date: '2024-09-10',
      amount: 3200,
      status: 'paid',
      dueDate: '2024-10-10'
    },
    {
      id: 5,
      number: 'INV-2024-005',
      date: '2024-09-25',
      amount: 1700,
      status: 'pending',
      dueDate: '2024-10-25'
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-700';
      case 'pending':
        return 'bg-amber-100 text-amber-700';
      case 'overdue':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'paid':
        return 'Pagata';
      case 'pending':
        return 'In Sospeso';
      case 'overdue':
        return 'Scaduta';
      default:
        return 'Sconosciuto';
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white p-6 rounded-t-2xl relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-2xl transition"
          >
            ✕
          </button>
          <h2 className="text-3xl font-bold">Analisi Finanziaria</h2>
          <p className="opacity-90 mt-1">Stato Pagamenti e Crediti - {client.name}</p>
        </div>

        <div className="p-6">
          {/* Financial Overview */}
          <div className="mb-8">
            <h3 className="text-xl font-bold text-slate-800 mb-4">
              💰 Panoramica Finanziaria
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-green-50 border-2 border-green-200 p-5 rounded-xl text-center">
                <div className="text-4xl font-bold text-green-700">
                  CHF {financialData.paid.toLocaleString()}
                </div>
                <div className="text-slate-700 font-semibold mt-2">Fatture Pagate</div>
                <div className="text-sm text-green-600 font-semibold mt-1">
                  {paidPercent}% del totale
                </div>
              </div>
              <div className="bg-amber-50 border-2 border-amber-200 p-5 rounded-xl text-center">
                <div className="text-4xl font-bold text-amber-700">
                  CHF {financialData.pending.toLocaleString()}
                </div>
                <div className="text-slate-700 font-semibold mt-2">
                  In Sospeso (Non Scadute)
                </div>
                <div className="text-sm text-amber-600 font-semibold mt-1">
                  {pendingPercent}% del totale
                </div>
              </div>
              <div className="bg-red-50 border-2 border-red-200 p-5 rounded-xl text-center">
                <div className="text-4xl font-bold text-red-700">
                  CHF {financialData.overdue.toLocaleString()}
                </div>
                <div className="text-slate-700 font-semibold mt-2">Scadute Non Pagate</div>
                <div className="text-sm text-red-600 font-semibold mt-1">
                  {overduePercent}% del totale
                </div>
              </div>
            </div>
          </div>

          {/* Risk Indicators */}
          <div className="mb-8">
            <h3 className="text-xl font-bold text-slate-800 mb-4">⚠️ Indicatori di Rischio</h3>
            <div className="bg-slate-50 p-5 rounded-xl">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex justify-between items-center">
                  <span className="text-slate-700 font-medium">Score Solvibilità:</span>
                  <div className="text-2xl font-bold text-green-600">85/100</div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-700 font-medium">Giorni Medi Ritardo:</span>
                  <div className="text-2xl font-bold text-amber-600">12 giorni</div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-700 font-medium">Pagamenti in Ritardo:</span>
                  <div className="text-2xl font-bold text-red-600">15%</div>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Trend Chart */}
          <div className="mb-8">
            <h3 className="text-xl font-bold text-slate-800 mb-4">
              📈 Andamento Pagamenti (Ultimi 6 Mesi)
            </h3>
            <div className="bg-slate-50 p-5 rounded-xl">
              <div className="flex items-end h-48 gap-3">
                {[5000, 6500, 5800, 7200, 6000, 8500].map((value, index) => (
                  <div key={index} className="flex-1 flex flex-col items-center gap-2">
                    <div
                      className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t hover:from-blue-700 hover:to-blue-500 transition cursor-pointer"
                      style={{ height: `${(value / 8500) * 100}%` }}
                      title={`CHF ${value.toLocaleString()}`}
                    ></div>
                    <span className="text-xs text-slate-600">
                      {new Date(2024, index + 3, 1).toLocaleDateString('it-IT', {
                        month: 'short'
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Invoices */}
          <div className="mb-8">
            <h3 className="text-xl font-bold text-slate-800 mb-4">📋 Ultime 5 Fatture</h3>
            <div className="space-y-3">
              {recentInvoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="bg-white border border-slate-200 p-4 rounded-xl hover:shadow-md transition"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="font-bold text-slate-800">{invoice.number}</div>
                      <div className="text-sm text-slate-600">
                        Data: {new Date(invoice.date).toLocaleDateString('it-IT')} | Scadenza:{' '}
                        {new Date(invoice.dueDate).toLocaleDateString('it-IT')}
                      </div>
                    </div>
                    <div className="font-bold text-lg text-slate-800">
                      CHF {invoice.amount.toLocaleString()}
                    </div>
                    <span
                      className={`px-4 py-1.5 rounded-full text-sm font-semibold ${getStatusColor(
                        invoice.status
                      )}`}
                    >
                      {getStatusLabel(invoice.status)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3 justify-center">
            <button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition">
              📄 Esporta Report Finanziario
            </button>
            <button className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition">
              💬 Contatta per Sollecito
            </button>
            <button className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition">
              📊 Storico Completo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
