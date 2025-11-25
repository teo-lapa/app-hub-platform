with open('app/scarichi-parziali/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Rendi la motivazione cliccabile
old_motivazione = '''                    {/* Motivazione */}
                    <div className="flex items-start space-x-3">
                      <FileText className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                          Motivazione scarico parziale
                        </p>
                        <p className="text-sm text-gray-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
                          {getReasonSummary(order)}
                        </p>
                      </div>
                    </div>'''

new_motivazione = '''                    {/* Motivazione */}
                    <div className="flex items-start space-x-3">
                      <FileText className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                          Motivazione scarico parziale
                        </p>
                        <button
                          onClick={() => setSelectedOrderForMotivation(order)}
                          className="w-full text-left text-sm text-gray-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 hover:bg-yellow-100 hover:border-yellow-300 transition-colors cursor-pointer"
                          title="Clicca per vedere dettagli completi"
                        >
                          {getReasonSummary(order)}
                        </button>
                      </div>
                    </div>'''

content = content.replace(old_motivazione, new_motivazione)

# 2. Aggiungi il modal prima della chiusura finale
# Trova l'ultima chiusura </div> prima di );
closing_pos = content.rfind('      </div>\n    </div>\n  );\n}')

modal_code = '''
      {/* Modal Motivazione Completa */}
      <AnimatePresence>
        {selectedOrderForMotivation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col"
            >
              {/* Header Modal */}
              <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-5 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center space-x-3">
                  <FileText className="w-6 h-6 text-white" />
                  <h3 className="text-xl font-bold text-white">Motivazione Scarico Parziale</h3>
                </div>
                <button
                  onClick={() => setSelectedOrderForMotivation(null)}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                  title="Chiudi"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Body Modal - Scrollable */}
              <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
                {/* Info Ordine */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-semibold">Ordine Residuo</p>
                      <p className="text-base font-bold text-gray-900">{selectedOrderForMotivation.numeroOrdineResiduo}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-semibold">Sales Order</p>
                      <p className="text-base font-bold text-gray-900">{selectedOrderForMotivation.salesOrder}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-semibold">Cliente</p>
                      <p className="text-sm text-gray-700">{selectedOrderForMotivation.cliente}</p>
                    </div>
                    {selectedOrderForMotivation.autista && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase font-semibold">Autista</p>
                        <p className="text-sm text-gray-700">{selectedOrderForMotivation.autista}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Messaggi Scarico Parziale */}
                <div>
                  <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">Messaggi e Motivazioni</h4>
                  {selectedOrderForMotivation.messaggiScaricoParziale && selectedOrderForMotivation.messaggiScaricoParziale.length > 0 ? (
                    <div className="space-y-4">
                      {selectedOrderForMotivation.messaggiScaricoParziale.map((msg, idx) => (
                        <div key={idx} className="bg-yellow-50 border-l-4 border-yellow-400 rounded-lg p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <User className="w-4 h-4 text-yellow-700" />
                              <span className="text-sm font-semibold text-gray-900">{msg.autore}</span>
                            </div>
                            <span className="text-xs text-gray-500">
                              {new Date(msg.data).toLocaleString('it-IT', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>

                          {msg.messaggio && (
                            <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                              {msg.messaggio}
                            </p>
                          )}

                          {msg.allegati && msg.allegati.length > 0 && (
                            <div className="pt-3 border-t border-yellow-200">
                              <p className="text-xs font-semibold text-gray-700 uppercase mb-2">Allegati ({msg.allegati.length}):</p>
                              <div className="space-y-2">
                                {msg.allegati.map((att: any, attIdx: number) => (
                                  <div key={attIdx} className="flex items-center space-x-2 text-sm bg-white rounded px-3 py-2">
                                    {att.tipo && att.tipo.includes('audio') ? (
                                      <Volume2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
                                    ) : att.tipo && att.tipo.includes('image') ? (
                                      <ImageIcon className="w-4 h-4 text-green-600 flex-shrink-0" />
                                    ) : (
                                      <FileText className="w-4 h-4 text-gray-600 flex-shrink-0" />
                                    )}
                                    <span className="text-gray-800 flex-1">{att.nome}</span>
                                    <span className="text-xs text-gray-500">{att.tipo?.split('/'
