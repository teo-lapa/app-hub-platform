'use client';

import { useState, ChangeEvent } from 'react';
import { Sparkles, FileText, Download, Send, Plus, Trash2, Wand2 } from 'lucide-react';

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

interface InvoiceData {
  invoiceNumber: string;
  date: string;
  dueDate: string;
  template: string;
  clientName: string;
  clientAddress: string;
  clientVAT: string;
  items: InvoiceItem[];
  notes: string;
}

export default function InvoiceGeneratorDemo() {
  const [invoiceData, setInvoiceData] = useState<InvoiceData>({
    invoiceNumber: `INV-${new Date().getFullYear()}-001`,
    date: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    template: 'modern',
    clientName: '',
    clientAddress: '',
    clientVAT: '',
    items: [{ id: '1', description: '', quantity: 1, unitPrice: 0, taxRate: 22 }],
    notes: '',
  });

  const [isGenerating, setIsGenerating] = useState(false);

  const addItem = () => {
    setInvoiceData({
      ...invoiceData,
      items: [
        ...invoiceData.items,
        { id: Date.now().toString(), description: '', quantity: 1, unitPrice: 0, taxRate: 22 },
      ],
    });
  };

  const removeItem = (id: string) => {
    setInvoiceData({
      ...invoiceData,
      items: invoiceData.items.filter((item) => item.id !== id),
    });
  };

  const updateItem = (id: string, field: keyof InvoiceItem, value: string | number) => {
    setInvoiceData({
      ...invoiceData,
      items: invoiceData.items.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    });
  };

  const calculateSubtotal = () => {
    return invoiceData.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  };

  const calculateTax = () => {
    return invoiceData.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice * (item.taxRate / 100),
      0
    );
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTax();
  };

  const handleAISuggestion = async () => {
    setIsGenerating(true);
    // Simula chiamata AI
    setTimeout(() => {
      setInvoiceData({
        ...invoiceData,
        clientName: 'Ristorante Il Buongustaio',
        clientAddress: 'Via Roma 123, 00100 Roma',
        clientVAT: 'IT12345678901',
        items: [
          {
            id: '1',
            description: 'Fornitura prodotti alimentari premium - Novembre 2025',
            quantity: 1,
            unitPrice: 1500.0,
            taxRate: 22,
          },
          {
            id: '2',
            description: 'Servizio consegna express (3 consegne settimanali)',
            quantity: 4,
            unitPrice: 50.0,
            taxRate: 22,
          },
        ],
        notes: 'Pagamento da effettuare entro 30 giorni dalla data di emissione.\nModalità di pagamento: Bonifico bancario\n\nGrazie per aver scelto LAPA App Platform!',
      });
      setIsGenerating(false);
    }, 1500);
  };

  return (
    <div className="container max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileText className="h-8 w-8 text-blue-600" />
            Invoice Generator
            <span className="text-sm bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
              DEMO
            </span>
          </h1>
          <p className="text-gray-600 mt-1">
            Crea fatture professionali in pochi click con AI
          </p>
        </div>
        <button
          onClick={handleAISuggestion}
          disabled={isGenerating}
          className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2 shadow-lg transition-all disabled:opacity-50"
        >
          {isGenerating ? (
            <>
              <Wand2 className="h-4 w-4 animate-spin" />
              Generazione...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Compila con AI
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form Section */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6 space-y-4 border">
            <h2 className="text-xl font-semibold">Informazioni Fattura</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="invoiceNumber" className="block text-sm font-medium mb-1">
                  Numero Fattura
                </label>
                <input
                  id="invoiceNumber"
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={invoiceData.invoiceNumber}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setInvoiceData({ ...invoiceData, invoiceNumber: e.target.value })
                  }
                />
              </div>
              <div>
                <label htmlFor="template" className="block text-sm font-medium mb-1">
                  Template
                </label>
                <select
                  id="template"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={invoiceData.template}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                    setInvoiceData({ ...invoiceData, template: e.target.value })
                  }
                >
                  <option value="modern">Moderno</option>
                  <option value="classic">Classico</option>
                  <option value="minimal">Minimale</option>
                  <option value="elegant">Elegante</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="date" className="block text-sm font-medium mb-1">
                  Data Emissione
                </label>
                <input
                  id="date"
                  type="date"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={invoiceData.date}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setInvoiceData({ ...invoiceData, date: e.target.value })
                  }
                />
              </div>
              <div>
                <label htmlFor="dueDate" className="block text-sm font-medium mb-1">
                  Scadenza
                </label>
                <input
                  id="dueDate"
                  type="date"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={invoiceData.dueDate}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setInvoiceData({ ...invoiceData, dueDate: e.target.value })
                  }
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 space-y-4 border">
            <h2 className="text-xl font-semibold">Dati Cliente</h2>

            <div>
              <label htmlFor="clientName" className="block text-sm font-medium mb-1">
                Nome Cliente
              </label>
              <input
                id="clientName"
                type="text"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Es: Ristorante La Taverna"
                value={invoiceData.clientName}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setInvoiceData({ ...invoiceData, clientName: e.target.value })
                }
              />
            </div>

            <div>
              <label htmlFor="clientAddress" className="block text-sm font-medium mb-1">
                Indirizzo
              </label>
              <input
                id="clientAddress"
                type="text"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Via, CAP Città"
                value={invoiceData.clientAddress}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setInvoiceData({ ...invoiceData, clientAddress: e.target.value })
                }
              />
            </div>

            <div>
              <label htmlFor="clientVAT" className="block text-sm font-medium mb-1">
                Partita IVA
              </label>
              <input
                id="clientVAT"
                type="text"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="IT12345678901"
                value={invoiceData.clientVAT}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setInvoiceData({ ...invoiceData, clientVAT: e.target.value })
                }
              />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 space-y-4 border">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Voci di Fattura</h2>
              <button
                onClick={addItem}
                className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors flex items-center gap-1"
              >
                <Plus className="h-4 w-4" />
                Aggiungi
              </button>
            </div>

            <div className="space-y-3">
              {invoiceData.items.map((item, index) => (
                <div key={item.id} className="p-4 border rounded-lg space-y-3 bg-gray-50">
                  <div className="flex items-start justify-between">
                    <span className="text-sm font-medium text-gray-600">
                      Voce {index + 1}
                    </span>
                    {invoiceData.items.length > 1 && (
                      <button
                        onClick={() => removeItem(item.id)}
                        className="p-1 hover:bg-red-100 rounded transition-colors"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </button>
                    )}
                  </div>

                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Descrizione prodotto/servizio"
                    value={item.description}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      updateItem(item.id, 'description', e.target.value)
                    }
                  />

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs font-medium">Quantità</label>
                      <input
                        type="number"
                        min="1"
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={item.quantity}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          updateItem(item.id, 'quantity', parseInt(e.target.value) || 1)
                        }
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium">Prezzo (€)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={item.unitPrice}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)
                        }
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium">IVA (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={item.taxRate}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          updateItem(item.id, 'taxRate', parseFloat(e.target.value) || 22)
                        }
                      />
                    </div>
                  </div>

                  <div className="text-right text-sm font-medium">
                    Totale: €
                    {(item.quantity * item.unitPrice * (1 + item.taxRate / 100)).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 space-y-4 border">
            <h2 className="text-xl font-semibold">Note</h2>
            <textarea
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Note aggiuntive, termini di pagamento, ecc..."
              rows={4}
              value={invoiceData.notes}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                setInvoiceData({ ...invoiceData, notes: e.target.value })
              }
            />
          </div>
        </div>

        {/* Preview Section */}
        <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <div className="bg-white rounded-lg shadow-xl p-8 border">
            <div className="space-y-6">
              {/* Header */}
              <div className="flex justify-between items-start border-b-2 border-blue-600 pb-4">
                <div>
                  <h1 className="text-3xl font-bold text-blue-600">FATTURA</h1>
                  <p className="text-sm text-gray-600 mt-1">{invoiceData.invoiceNumber}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">LAPA App Platform</p>
                  <p className="text-xs text-gray-600">Fornitore Finest Italian Food</p>
                  <p className="text-xs text-gray-600 mt-1">Via Example 123</p>
                  <p className="text-xs text-gray-600">00100 Roma</p>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-semibold">Data Emissione:</p>
                  <p>{new Date(invoiceData.date).toLocaleDateString('it-IT')}</p>
                </div>
                <div>
                  <p className="font-semibold">Scadenza:</p>
                  <p>{new Date(invoiceData.dueDate).toLocaleDateString('it-IT')}</p>
                </div>
              </div>

              {/* Client Info */}
              <div className="border-l-4 border-blue-600 pl-4">
                <p className="text-xs text-gray-600 font-semibold mb-1">FATTURATO A:</p>
                <p className="font-semibold">
                  {invoiceData.clientName || 'Nome Cliente'}
                </p>
                <p className="text-sm text-gray-600">
                  {invoiceData.clientAddress || 'Indirizzo Cliente'}
                </p>
                <p className="text-sm text-gray-600">
                  P.IVA: {invoiceData.clientVAT || 'IT00000000000'}
                </p>
              </div>

              {/* Items Table */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="text-left p-2 font-semibold">Descrizione</th>
                      <th className="text-right p-2 font-semibold w-20">Qta</th>
                      <th className="text-right p-2 font-semibold w-24">Prezzo</th>
                      <th className="text-right p-2 font-semibold w-24">Totale</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceData.items.map((item) => (
                      <tr key={item.id} className="border-t">
                        <td className="p-2">{item.description || 'Descrizione...'}</td>
                        <td className="text-right p-2">{item.quantity}</td>
                        <td className="text-right p-2">€{item.unitPrice.toFixed(2)}</td>
                        <td className="text-right p-2">
                          €{(item.quantity * item.unitPrice).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="space-y-2 border-t pt-4">
                <div className="flex justify-between text-sm">
                  <span>Imponibile:</span>
                  <span className="font-semibold">€{calculateSubtotal().toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>IVA:</span>
                  <span className="font-semibold">€{calculateTax().toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t-2 pt-2">
                  <span>TOTALE:</span>
                  <span className="text-blue-600">€{calculateTotal().toFixed(2)}</span>
                </div>
              </div>

              {/* Notes */}
              {invoiceData.notes && (
                <div className="bg-gray-50 p-4 rounded-lg text-sm">
                  <p className="font-semibold mb-1">Note:</p>
                  <p className="text-gray-700 whitespace-pre-wrap">{invoiceData.notes}</p>
                </div>
              )}

              {/* Footer */}
              <div className="text-center text-xs text-gray-600 pt-4 border-t">
                <p>Documento generato con LAPA Invoice Generator</p>
                <p className="mt-1">
                  Template: <span className="capitalize">{invoiceData.template}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3">
            <button className="w-full px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
              <Download className="h-4 w-4" />
              Scarica PDF
            </button>
            <button className="w-full px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2">
              <Send className="h-4 w-4" />
              Invia Email
            </button>
          </div>

          {/* Demo Notice */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <Sparkles className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-yellow-900">Modalità Demo</p>
                <p className="text-yellow-800 mt-1">
                  Questa è una versione dimostrativa. Le funzioni di salvataggio, download e
                  invio saranno disponibili nella versione completa.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
