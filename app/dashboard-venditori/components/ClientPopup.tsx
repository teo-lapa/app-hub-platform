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
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl sm:rounded-2xl w-full max-w-[95vw] sm:max-w-[90vw] md:max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Popup Header */}
        <div className="bg-gradient-to-r from-blue-600 to-emerald-600 text-white p-3 sm:p-4 md:p-6 rounded-t-xl sm:rounded-t-2xl relative">
          <button
            onClick={onClose}
            className="absolute top-2 right-2 sm:top-4 sm:right-4 w-8 h-8 sm:w-10 sm:h-10 bg-white/20 hover:bg-white/30 active:bg-white/40 rounded-full flex items-center justify-center text-xl sm:text-2xl transition min-h-touch min-w-touch"
          >
            ✕
          </button>

          <h2 className="text-lg sm:text-2xl md:text-3xl font-bold mb-2 pr-10 sm:pr-12 line-clamp-2">{client.name}</h2>
          <div className="flex flex-wrap gap-2 sm:gap-3 md:gap-4 text-xs sm:text-sm opacity-90">
            {client.address && <span className="truncate max-w-[200px] sm:max-w-none">📍 {client.address}</span>}
            {client.phone && <span>📞 {client.phone}</span>}
            {client.email && <span className="truncate max-w-[150px] sm:max-w-none">📧 {client.email}</span>}
          </div>
        </div>

        <div className="p-3 sm:p-4 md:p-6">
          {/* Health Score Section */}
          <div className="text-center mb-4 sm:mb-6 md:mb-8">
            <div className="text-4xl sm:text-5xl md:text-6xl font-bold text-slate-800 mb-1 sm:mb-2">
              {client.healthScore}
            </div>
            <div className="text-slate-600 font-semibold mb-2 sm:mb-3 text-xs sm:text-sm md:text-base">
              Punteggio Salute Cliente
            </div>
            <div className="h-2 sm:h-3 bg-slate-200 rounded-full overflow-hidden max-w-md mx-auto">
              <div
                className="h-full bg-gradient-to-r from-red-500 via-amber-500 to-green-500 rounded-full transition-all"
                style={{ width: `${client.healthScore}%` }}
              ></div>
            </div>
          </div>

          {/* Detailed Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-6 md:mb-8">
            <div className="bg-slate-50 p-2 sm:p-3 md:p-4 rounded-lg sm:rounded-xl text-center">
              <div className="text-lg sm:text-2xl md:text-3xl font-bold text-slate-800 truncate">
                <span className="hidden xs:inline">CHF </span>
                {Math.round(client.monthlyInvoiced).toLocaleString()}
              </div>
              <div className="text-[10px] sm:text-xs md:text-sm text-slate-600 mt-0.5 sm:mt-1">Fatturato Mese</div>
              <div className="text-[9px] sm:text-xs text-green-600 font-semibold mt-0.5 sm:mt-1">↗ +12%</div>
            </div>
            <div className="bg-slate-50 p-2 sm:p-3 md:p-4 rounded-lg sm:rounded-xl text-center">
              <div className="text-lg sm:text-2xl md:text-3xl font-bold text-slate-800">
                {client.monthlyOrderCount}
              </div>
              <div className="text-[10px] sm:text-xs md:text-sm text-slate-600 mt-0.5 sm:mt-1">Ordini Mese</div>
              <div className="text-[9px] sm:text-xs text-slate-600 font-semibold mt-0.5 sm:mt-1">→ =</div>
            </div>
            <div className="bg-slate-50 p-2 sm:p-3 md:p-4 rounded-lg sm:rounded-xl text-center">
              <div className="text-lg sm:text-2xl md:text-3xl font-bold text-slate-800 truncate">
                <span className="hidden xs:inline">CHF </span>
                {Math.round(
                  client.monthlyInvoiced / (client.monthlyOrderCount || 1)
                ).toLocaleString()}
              </div>
              <div className="text-[10px] sm:text-xs md:text-sm text-slate-600 mt-0.5 sm:mt-1">Ordine Medio</div>
              <div className="text-[9px] sm:text-xs text-amber-600 font-semibold mt-0.5 sm:mt-1">↘ -8%</div>
            </div>
            <div className="bg-slate-50 p-2 sm:p-3 md:p-4 rounded-lg sm:rounded-xl text-center">
              <div className="text-lg sm:text-2xl md:text-3xl font-bold text-slate-800">
                {client.lastOrderDays}
              </div>
              <div className="text-[10px] sm:text-xs md:text-sm text-slate-600 mt-0.5 sm:mt-1">Giorni fa</div>
              <div className="text-[9px] sm:text-xs text-green-600 font-semibold mt-0.5 sm:mt-1">↗ Bene</div>
            </div>
          </div>

          {/* AI Insights */}
          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-5 mb-4 sm:mb-5 md:mb-6">
            <h4 className="text-sm sm:text-base md:text-lg font-bold text-blue-900 mb-2 sm:mb-3 flex items-center gap-2">
              🤖 Suggerimenti AI
            </h4>
            <ul className="space-y-1.5 sm:space-y-2">
              <li className="flex items-start gap-2 text-xs sm:text-sm text-blue-800">
                <span className="shrink-0">🎯</span>
                <span>Cliente ad alto potenziale, aumenta la frequenza di contatto</span>
              </li>
              <li className="flex items-start gap-2 text-xs sm:text-sm text-blue-800">
                <span className="shrink-0">📞</span>
                <span>Consigliata chiamata entro 2 giorni per follow-up ordine</span>
              </li>
              <li className="flex items-start gap-2 text-xs sm:text-sm text-blue-800">
                <span className="shrink-0">💡</span>
                <span>Proponi prodotti correlati basati su ordini precedenti</span>
              </li>
            </ul>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
            <a
              href={`tel:${client.phone}`}
              className="px-3 sm:px-4 py-2 sm:py-3 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white rounded-lg text-center font-semibold transition text-xs sm:text-sm md:text-base min-h-touch"
            >
              📞 <span className="hidden xs:inline">Chiama</span>
            </a>
            <a
              href={createWhatsAppUrl(client.phone, client.name)}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 sm:px-4 py-2 sm:py-3 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-lg text-center font-semibold transition text-xs sm:text-sm md:text-base min-h-touch"
            >
              💬 <span className="hidden xs:inline">WhatsApp</span>
            </a>
            <a
              href={createEmailUrl(client.email, client.name)}
              className="px-3 sm:px-4 py-2 sm:py-3 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white rounded-lg text-center font-semibold transition text-xs sm:text-sm md:text-base min-h-touch"
            >
              📧 <span className="hidden xs:inline">Email</span>
            </a>
            <a
              href={createGoogleMapsUrl(client.address, client.name)}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 sm:px-4 py-2 sm:py-3 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white rounded-lg text-center font-semibold transition text-xs sm:text-sm md:text-base min-h-touch"
            >
              📍 <span className="hidden xs:inline">Visita</span>
            </a>
            <button
              onClick={onOpenAdvanced}
              className="px-3 sm:px-4 py-2 sm:py-3 bg-purple-500 hover:bg-purple-600 active:bg-purple-700 text-white rounded-lg text-center font-semibold transition text-xs sm:text-sm md:text-base min-h-touch col-span-2 sm:col-span-1"
            >
              📊 <span className="hidden sm:inline">Dashboard</span>
              <span className="sm:hidden">Dettagli</span>
            </button>
            <button
              onClick={onOpenFinancial}
              className="px-3 sm:px-4 py-2 sm:py-3 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white rounded-lg text-center font-semibold transition text-xs sm:text-sm md:text-base min-h-touch col-span-2 sm:col-span-1"
            >
              💰 <span className="hidden sm:inline">Analisi</span>
              <span className="sm:hidden">Finanza</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
