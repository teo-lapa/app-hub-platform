with open('app/scarichi-parziali/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Sostituisci il Card Header
old_header = '''                  {/* Card Header */}
                  <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Truck className="w-6 h-6 text-white" />
                        <div>
                          <h3 className="text-lg font-bold text-white">
                            {order.numeroOrdineResiduo}
                          </h3>
                          <p className="text-sm text-orange-100">
                            {order.salesOrder}
                          </p>
                        </div>
                      </div>
                      {order.prodottiNonScaricati && order.prodottiNonScaricati.length > 0 && (
                        <div className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
                          <span className="text-sm font-semibold text-white">
                            {order.prodottiNonScaricati.length} prodotti
                          </span>
                        </div>
                      )}
                    </div>
                  </div>'''

new_header = '''                  {/* Card Header */}
                  <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-4 relative">
                    {/* Pallino verde se transfer creato */}
                    {order.returnCreated && (
                      <div className="absolute top-3 right-3 bg-green-500 rounded-full p-1.5 shadow-lg animate-pulse" title="Transfer già creato">
                        <CheckCircle className="w-5 h-5 text-white" />
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <Truck className="w-6 h-6 text-white" />
                        <div>
                          <button
                            onClick={() => openPickingInOdoo(order.numeroOrdineResiduo)}
                            className="text-lg font-bold text-white hover:text-orange-100 hover:underline flex items-center space-x-1 transition-colors"
                            title="Apri documento in Odoo"
                          >
                            <span>{order.numeroOrdineResiduo}</span>
                            <ExternalLink className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openSalesOrderInOdoo(order.salesOrder)}
                            className="text-sm text-orange-100 hover:text-white hover:underline flex items-center space-x-1 transition-colors"
                            title="Apri Sales Order in Odoo"
                          >
                            <span>{order.salesOrder}</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      {order.prodottiNonScaricati && order.prodottiNonScaricati.length > 0 && (
                        <div className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
                          <span className="text-sm font-semibold text-white">
                            {order.prodottiNonScaricati.length} prodotti
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {/* Info autista e veicolo */}
                    {(order.autista || order.veicolo) && (
                      <div className="flex items-center space-x-4 text-sm text-white/90 mt-2">
                        {order.autista && (
                          <div className="flex items-center space-x-1.5">
                            <User className="w-4 h-4" />
                            <span>{order.autista}</span>
                          </div>
                        )}
                        {order.veicolo && (
                          <div className="flex items-center space-x-1.5">
                            <Car className="w-4 h-4" />
                            <span>{order.veicolo}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>'''

content = content.replace(old_header, new_header)

with open('app/scarichi-parziali/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Card Header aggiornato!')
