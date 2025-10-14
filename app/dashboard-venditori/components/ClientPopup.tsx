interface ClientPopupProps {
  client: any;
  onClose: () => void;
  onOpenAdvanced: () => void;
  onOpenFinancial: () => void;
}

export function ClientPopup({
  client,
  onClose,
  onOpenAdvanced,
  onOpenFinancial
}: ClientPopupProps) {
  const createWhatsAppUrl = (phone: string, clientName: string) => {
    if (!phone) return '#';
    let cleanPhone = phone.replace(/[^0-9+]/g, '');
    if (!cleanPhone.startsWith('+')) {
      cleanPhone = '+41' + cleanPhone;
    }
    const message = encodeURIComponent(`Ciao ${clientName}! Come va con gli ordini?`);
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    return isMobile
      ? `whatsapp://send?phone=${cleanPhone}&text=${message}`
      : `https://wa.me/${cleanPhone}?text=${message}`;
  };

  const createEmailUrl = (email: string, clientName: string) => {
    if (!email) return '#';
    const subject = encodeURIComponent(`Offerta speciale per ${clientName}`);
    const body = encodeURIComponent(
      `Ciao ${clientName},\n\nAbbiamo delle offerte speciali pensate per voi!\n\nBuona giornata`
    );
    return `mailto:${email}?subject=${subject}&body=${body}`;
  };

  const createGoogleMapsUrl = (address: string, clientName: string) => {
    if (!address) return '#';
    const query = encodeURIComponent(`${clientName}, ${address}`);
    return `https://www.google.com/maps/search/?api=1&query=${query}`;
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Popup Header */}
        <div className="bg-gradient-to-r from-blue-600 to-emerald-600 text-white p-6 rounded-t-2xl relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-2xl transition"
          >
            ✕
          </button>

          <h2 className="text-3xl font-bold mb-2">{client.name}</h2>
          <div className="flex flex-wrap gap-4 text-sm opacity-90">
            {client.address && <span>📍 {client.address}</span>}
            {client.phone && <span>📞 {client.phone}</span>}
            {client.email && <span>📧 {client.email}</span>}
          </div>
        </div>

        <div className="p-6">
          {/* Health Score Section */}
          <div className="text-center mb-8">
            <div className="text-6xl font-bold text-slate-800 mb-2">
              {client.healthScore}
            </div>
            <div className="text-slate-600 font-semibold mb-3">
              Punteggio Salute Cliente
            </div>
            <div className="h-3 bg-slate-200 rounded-full overflow-hidden max-w-md mx-auto">
              <div
                className="h-full bg-gradient-to-r from-red-500 via-amber-500 to-green-500 rounded-full transition-all"
                style={{ width: `${client.healthScore}%` }}
              ></div>
            </div>
          </div>

          {/* Detailed Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-slate-50 p-4 rounded-xl text-center">
              <div className="text-3xl font-bold text-slate-800">
                CHF {Math.round(client.monthlyInvoiced).toLocaleString()}
              </div>
              <div className="text-sm text-slate-600 mt-1">Fatturato Mese</div>
              <div className="text-xs text-green-600 font-semibold mt-1">↗ +12%</div>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl text-center">
              <div className="text-3xl font-bold text-slate-800">
                {client.monthlyOrderCount}
              </div>
              <div className="text-sm text-slate-600 mt-1">Ordini Mese</div>
              <div className="text-xs text-slate-600 font-semibold mt-1">→ =</div>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl text-center">
              <div className="text-3xl font-bold text-slate-800">
                CHF{' '}
                {Math.round(
                  client.monthlyInvoiced / (client.monthlyOrderCount || 1)
                ).toLocaleString()}
              </div>
              <div className="text-sm text-slate-600 mt-1">Ordine Medio</div>
              <div className="text-xs text-amber-600 font-semibold mt-1">↘ -8%</div>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl text-center">
              <div className="text-3xl font-bold text-slate-800">
                {client.lastOrderDays}
              </div>
              <div className="text-sm text-slate-600 mt-1">Giorni fa</div>
              <div className="text-xs text-green-600 font-semibold mt-1">↗ Bene</div>
            </div>
          </div>

          {/* AI Insights */}
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-5 mb-6">
            <h4 className="text-lg font-bold text-blue-900 mb-3 flex items-center gap-2">
              🤖 Suggerimenti AI
            </h4>
            <ul className="space-y-2">
              <li className="flex items-start gap-2 text-sm text-blue-800">
                <span>🎯</span>
                <span>Cliente ad alto potenziale, aumenta la frequenza di contatto</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-blue-800">
                <span>📞</span>
                <span>Consigliata chiamata entro 2 giorni per follow-up ordine</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-blue-800">
                <span>💡</span>
                <span>Proponi prodotti correlati basati su ordini precedenti</span>
              </li>
            </ul>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <a
              href={`tel:${client.phone}`}
              className="px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg text-center font-semibold transition"
            >
              📞 Chiama
            </a>
            <a
              href={createWhatsAppUrl(client.phone, client.name)}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-center font-semibold transition"
            >
              💬 WhatsApp
            </a>
            <a
              href={createEmailUrl(client.email, client.name)}
              className="px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-center font-semibold transition"
            >
              📧 Email
            </a>
            <a
              href={createGoogleMapsUrl(client.address, client.name)}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg text-center font-semibold transition"
            >
              📍 Visita
            </a>
            <button
              onClick={onOpenAdvanced}
              className="px-4 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-center font-semibold transition"
            >
              📊 Dashboard Dettagliata
            </button>
            <button
              onClick={onOpenFinancial}
              className="px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-center font-semibold transition"
            >
              💰 Analisi Finanziaria
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
