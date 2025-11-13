'use client'

import { useState } from 'react'
import { Upload, FileText, CheckCircle, XCircle, AlertCircle, Download, TrendingUp, TrendingDown, ArrowLeft, Home } from 'lucide-react'
import Link from 'next/link'

interface Transaction {
  date: string
  valutaDate: string
  description: string
  beneficiary: string
  amount: number
  balance: number
  transactionNr: string
  type: 'income' | 'expense'
  paymentReason?: string // Zahlungsgrund - motivo di pagamento
}

interface ParseResult {
  success: boolean
  accountInfo?: {
    accountNumber: string
    iban: string
    startDate: string
    endDate: string
    startBalance: number
    endBalance: number
    currency: string
    transactionCount: number
  }
  transactions?: Transaction[]
  errors?: string[]
  stats?: {
    totalIncome: number
    totalExpense: number
    netChange: number
  }
}

export default function ImportMovimentiUBS() {
  const [files, setFiles] = useState<File[]>([])
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [parseResults, setParseResults] = useState<ParseResult[]>([])
  const [currentFileIndex, setCurrentFileIndex] = useState(0)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files
    if (selectedFiles && selectedFiles.length > 0) {
      // Prendi TUTTI i file selezionati
      const filesArray = Array.from(selectedFiles)
      setFiles(filesArray)
      setParseResults([])
      setCurrentFileIndex(0)
    }
  }

  const handleParse = async () => {
    if (files.length === 0) return

    setParsing(true)
    const results: ParseResult[] = []

    // Processa TUTTI i file uno per uno
    for (let i = 0; i < files.length; i++) {
      setCurrentFileIndex(i)
      const file = files[i]

      try {
        const formData = new FormData()
        formData.append('file', file)

        const response = await fetch('/api/import-ubs/parse', {
          method: 'POST',
          body: formData
        })

        const result = await response.json()
        results.push(result)
      } catch (error) {
        console.error(`Errore parsing file ${file.name}:`, error)
        results.push({
          success: false,
          errors: [`Errore durante il parsing di ${file.name}`]
        })
      }
    }

    setParseResults(results)
    setParsing(false)
  }

  const handleImport = async () => {
    if (parseResults.length === 0) return

    setImporting(true)

    let totalImported = 0
    let totalSkipped = 0
    let totalErrors = 0
    let totalTransactions = 0

    // Importa TUTTI i file processati
    for (let i = 0; i < parseResults.length; i++) {
      const parseResult = parseResults[i]

      if (!parseResult.success || !parseResult.transactions) {
        totalErrors++
        continue
      }

      setCurrentFileIndex(i)

      try {
        const response = await fetch('/api/import-ubs/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountInfo: parseResult.accountInfo,
            transactions: parseResult.transactions
          })
        })

        const result = await response.json()

        if (result.success) {
          totalImported += result.imported || 0
          totalSkipped += result.skipped || 0
          totalErrors += result.errors || 0
          totalTransactions += result.total || 0
        } else {
          totalErrors++
        }
      } catch (error) {
        console.error(`Errore importazione file ${i + 1}:`, error)
        totalErrors++
      }
    }

    // Mostra riepilogo finale
    let message = `🎉 IMPORT COMPLETATO!\n\n`
    message += `📊 File processati: ${parseResults.length}\n`
    message += `✅ Movimenti importati: ${totalImported}/${totalTransactions}\n`

    if (totalSkipped > 0) {
      message += `⏭️  Duplicati saltati: ${totalSkipped}\n`
    }

    if (totalErrors > 0) {
      message += `❌ Errori: ${totalErrors}\n`
    }

    alert(message)

    // Reset
    setFiles([])
    setParseResults([])
    setCurrentFileIndex(0)
    setImporting(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8 border border-blue-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-4 rounded-xl">
                <FileText className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Import Movimenti UBS
                </h1>
                <p className="text-gray-600">
                  Carica il file CSV esportato dalla tua UBS e-banking
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  v3.0 - Sistema anti-duplicati Odoo (unique_import_id)
                </p>
              </div>
            </div>

            {/* Pulsanti Navigazione */}
            <div className="flex items-center gap-3">
              <Link href="/super-dashboard">
                <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-lg font-semibold shadow-lg transition-all">
                  <ArrowLeft className="w-5 h-5" />
                  <span>Indietro</span>
                </button>
              </Link>
              <Link href="/">
                <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-lg font-semibold shadow-lg transition-all">
                  <Home className="w-5 h-5" />
                  <span>Home</span>
                </button>
              </Link>
            </div>
          </div>
        </div>

        {/* Upload Section */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8 border border-blue-100">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Upload className="w-6 h-6 text-blue-600" />
            Carica File CSV
          </h2>

          <div className="space-y-6">
            {/* File Input */}
            <div className="border-2 border-dashed border-blue-300 rounded-xl p-8 text-center hover:border-blue-500 transition-colors">
              <input
                type="file"
                accept=".csv"
                multiple
                onChange={handleFileChange}
                className="hidden"
                id="csv-upload"
              />
              <label htmlFor="csv-upload" className="cursor-pointer">
                <div className="flex flex-col items-center gap-4">
                  <Upload className="w-16 h-16 text-blue-400" />
                  <div>
                    <p className="text-lg font-semibold text-gray-700">
                      Click per selezionare i file CSV
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Puoi selezionare più file contemporaneamente - verranno processati tutti insieme
                    </p>
                  </div>
                </div>
              </label>
            </div>

            {/* Files Selected */}
            {files.length > 0 && (
              <div className="space-y-3">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <FileText className="w-8 h-8 text-blue-600" />
                      <div>
                        <p className="font-semibold text-gray-800">
                          {files.length} file selezionati
                        </p>
                        <p className="text-sm text-gray-600">
                          {(files.reduce((acc, f) => acc + f.size, 0) / 1024).toFixed(2)} KB totali
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleParse}
                      disabled={parsing}
                      className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50"
                    >
                      {parsing ? `Analizzando ${currentFileIndex + 1}/${files.length}...` : `Analizza Tutti (${files.length})`}
                    </button>
                </div>
              </div>
            </div>
            )}
          </div>
        </div>

        {/* Parse Results */}
        {parseResults.length > 0 && (
          <div className="space-y-6">
            {parseResults.map((parseResult, idx) => (
              <div key={idx}>
                <h3 className="text-lg font-bold text-gray-700 mb-3">
                  File {idx + 1}/{parseResults.length}: {files[idx]?.name}
                </h3>

                {/* Account Info */}
                {parseResult.success && parseResult.accountInfo && (
              <div className="bg-white rounded-2xl shadow-xl p-8 border border-green-100">
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                  Informazioni Conto
                </h2>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gradient-to-br from-blue-50 to-purple-50 p-4 rounded-xl">
                    <p className="text-sm text-gray-600 mb-1">IBAN</p>
                    <p className="font-bold text-gray-800">{parseResult.accountInfo.iban}</p>
                  </div>
                  <div className="bg-gradient-to-br from-blue-50 to-purple-50 p-4 rounded-xl">
                    <p className="text-sm text-gray-600 mb-1">Periodo</p>
                    <p className="font-bold text-gray-800">
                      {parseResult.accountInfo.startDate} → {parseResult.accountInfo.endDate}
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-xl">
                    <p className="text-sm text-gray-600 mb-1">Saldo Iniziale</p>
                    <p className="font-bold text-green-700">
                      {parseResult.accountInfo.currency} {parseResult.accountInfo.startBalance.toLocaleString('de-CH', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-xl">
                    <p className="text-sm text-gray-600 mb-1">Saldo Finale</p>
                    <p className="font-bold text-green-700">
                      {parseResult.accountInfo.currency} {parseResult.accountInfo.endBalance.toLocaleString('de-CH', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                {parseResult.stats && (
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-xl">
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="w-5 h-5 text-green-600" />
                        <p className="text-sm text-gray-600">Entrate</p>
                      </div>
                      <p className="font-bold text-xl text-green-700">
                        CHF {parseResult.stats.totalIncome.toLocaleString('de-CH', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="bg-gradient-to-br from-red-50 to-pink-50 p-4 rounded-xl">
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingDown className="w-5 h-5 text-red-600" />
                        <p className="text-sm text-gray-600">Uscite</p>
                      </div>
                      <p className="font-bold text-xl text-red-700">
                        CHF {parseResult.stats.totalExpense.toLocaleString('de-CH', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className={`bg-gradient-to-br p-4 rounded-xl ${parseResult.stats.netChange >= 0 ? 'from-green-50 to-emerald-50' : 'from-red-50 to-pink-50'}`}>
                      <p className="text-sm text-gray-600 mb-1">Variazione Netta</p>
                      <p className={`font-bold text-xl ${parseResult.stats.netChange >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        CHF {parseResult.stats.netChange.toLocaleString('de-CH', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Transactions List */}
            {parseResult.success && parseResult.transactions && parseResult.transactions.length > 0 && (
              <div className="bg-white rounded-2xl shadow-xl p-8 border border-blue-100">
                <div className="mb-6">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <FileText className="w-6 h-6 text-blue-600" />
                    Movimenti Trovati ({parseResult.transactions.length})
                  </h2>
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {parseResult.transactions.map((tx, i) => (
                    <div
                      key={i}
                      className={`border rounded-xl p-4 hover:shadow-md transition-shadow ${
                        tx.type === 'income' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            {tx.type === 'income' ? (
                              <TrendingUp className="w-5 h-5 text-green-600" />
                            ) : (
                              <TrendingDown className="w-5 h-5 text-red-600" />
                            )}
                            <p className="font-bold text-gray-800">{tx.beneficiary}</p>
                          </div>
                          <p className="text-sm text-gray-600 mb-1">{tx.description}</p>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span>📅 {tx.date}</span>
                            <span>🏦 {tx.transactionNr}</span>
                            {tx.paymentReason && (
                              <span className="font-semibold text-blue-700">💳 Zahlungsgrund: {tx.paymentReason}</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-2xl font-bold ${tx.type === 'income' ? 'text-green-700' : 'text-red-700'}`}>
                            {tx.type === 'income' ? '+' : '-'} CHF {Math.abs(tx.amount).toLocaleString('de-CH', { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            Saldo: CHF {tx.balance.toLocaleString('de-CH', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Errors */}
            {!parseResult.success && parseResult.errors && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-8">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-red-700">
                  <XCircle className="w-6 h-6" />
                  Errori
                </h2>
                <ul className="space-y-2">
                  {parseResult.errors.map((error, i) => (
                    <li key={i} className="flex items-start gap-2 text-red-700">
                      <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </li>
                  ))}
                </ul>
              </div>
                )}
              </div>
            ))}

            {/* Import All Button */}
            {parseResults.some(r => r.success) && (
              <div className="flex justify-center mt-6">
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-12 py-4 rounded-xl font-bold text-lg hover:shadow-xl transition-all disabled:opacity-50 flex items-center gap-3"
                >
                  <Download className="w-6 h-6" />
                  {importing ? `Importando ${currentFileIndex + 1}/${parseResults.length}...` : `Importa Tutti in Odoo (${parseResults.length} file)`}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        {parseResults.length === 0 && (
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-8 border border-blue-200">
            <h2 className="text-xl font-bold mb-4 text-gray-800">
              📖 Come usare
            </h2>
            <ol className="space-y-3 text-gray-700">
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">1</span>
                <span>Vai su <strong>UBS e-banking</strong> → Accounts and Cards → Overview</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">2</span>
                <span>Seleziona il conto <strong>UBS CHF 701J</strong></span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">3</span>
                <span>Click su <strong>Transactions</strong> e poi sull'icona <strong>CSV/Excel</strong></span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">4</span>
                <span>Scarica il file CSV e caricalo qui sopra</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">5</span>
                <span>Click su <strong>"Analizza File"</strong> per vedere i movimenti</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">6</span>
                <span>Click su <strong>"Importa in Odoo"</strong> per registrare i movimenti</span>
              </li>
            </ol>
          </div>
        )}
      </div>
    </div>
  )
}
