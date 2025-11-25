with open('app/scarichi-parziali/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Rendi motivazione cliccabile
content = content.replace(
    '<p className="text-sm text-gray-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">\n                          {getReasonSummary(order)}\n                        </p>',
    '<button onClick={() => setSelectedOrderForMotivation(order)} className="w-full text-left text-sm text-gray-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 hover:bg-yellow-100 cursor-pointer">\n                          {getReasonSummary(order)}\n                        </button>'
)

# 2. Aggiungi modal PRIMA della chiusura finale
# Trova la chiusura: </div>\n    </div>\n  );\n}
insert_pos = content.rfind('      </div>\n    </div>\n  );\n}')

modal = '''
      {/* Modal Motivazione Completa */}
      <AnimatePresence>
        {selectedOrderForMotivation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col">
              <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-5 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <FileText className="w-6 h-6 text-white" />
                  <h3 className="text-xl font-bold text-white">Motivazione Scarico Parziale</h3>
                </div>
                <button onClick={() => setSelectedOrderForMotivation(null)} className="text-white hover:bg-white/20 rounded-lg p-2"><X className="w-6 h-6" /></button>
              </div>
              <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 uppercase">Ordine</p>
                  <p className="text-lg font-bold">{selectedOrderForMotivation.numeroOrdineResiduo}</p>
                </div>
                {selectedOrderForMotivation.messaggiScaricoParziale && selectedOrderForMotivation.messaggiScaricoParziale.length > 0 ? (
                  selectedOrderForMotivation.messaggiScaricoParziale.map((msg, idx) => (
                    <div key={idx} className="bg-yellow-50 border-l-4 border-yellow-400 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold">{msg.autore}</span>
                        <span className="text-xs text-gray-500">{new Date(msg.data).toLocaleString('it-IT')}</span>
                      </div>
                      {msg.messaggio && <p className="text-sm whitespace-pre-wrap">{msg.messaggio}</p>}
                      {msg.allegati && msg.allegati.length > 0 && (
                        <div className="mt-3 space-y-1">
                          {msg.allegati.map((att: any, i: number) => (
                            <div key={i} className="text-sm flex items-center space-x-2">
                              {att.tipo?.includes('audio') ? <Volume2 className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                              <span>{att.nome}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 italic">Nessuna motivazione</p>
                )}
              </div>
              <div className="px-6 py-4 bg-gray-50 border-t">
                <button onClick={() => setSelectedOrderForMotivation(null)} className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-800">Chiudi</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
'''

content = content[:insert_pos] + modal + '\n' + content[insert_pos:]

with open('app/scarichi-parziali/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('File ricostruito correttamente!')
