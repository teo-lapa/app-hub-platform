'use client'

import { useState, useEffect } from 'react'
import { Upload, FileText, CheckCircle, XCircle, AlertCircle, Download, TrendingUp, TrendingDown, ArrowLeft, Home } from 'lucide-react'
import Link from 'next/link'
import type { BankJournalConfig } from '@/lib/config/bank-journals'
import { getAllJournals, findJournalByIban } from '@/lib/config/bank-journals'

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
  suggestedJournal?: BankJournalConfig // Journal suggerito automaticamente
  availableJournals?: BankJournalConfig[] // Tutti i journal disponibili
}

export default function ImportMovimentiUBS() {
  const [files, setFiles] = useState<File[]>([])
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [parseResults, setParseResults] = useState<ParseResult[]>([])
  const [currentFileIndex, setCurrentFileIndex] = useState(0)
  const [selectedJournals, setSelectedJournals] = useState<Record<number, number>>({}) // fileIndex → journalId
  const [availableJournals, setAvailableJournals] = useState<BankJournalConfig[]>([])
  const [loadingJournals, setLoadingJournals] = useState(true)
  const [showSummaryModal, setShowSummaryModal] = useState(false)
  const [summaryData, setSummaryData] = useState<{
    totalImported: number
    totalSkipped: number
    totalErrors: number
    totalTransactions: number
    errorDetails: string[]
  } | null>(null)

  // Carica i journal dalla configurazione statica
  useEffect(() => {
    setLoadingJournals(true)
    try {
      const journals = getAllJournals()
      setAvailableJournals(journals)
    } catch (error) {
      console.error('❌ Errore caricamento journals:', error)
    } finally {
      setLoadingJournals(false)
    }
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files
    if (selectedFiles && selectedFiles.length > 0) {
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

        if (result.success && result.accountInfo?.iban) {
          const iban = result.accountInfo.iban
          const matchedJournal = findJournalByIban(iban, availableJournals)

          if (matchedJournal) {
            setSelectedJournals(prev => ({
              ...prev,
              [i]: matchedJournal.journalId
            }))
          }
        }
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

    const missingJournals: number[] = [];
    for (let i = 0; i < parseResults.length; i++) {
      if (!selectedJournals[i]) {
        missingJournals.push(i + 1);
      }
    }

    if (missingJournals.length > 0) {
      alert(
        `⚠️ Seleziona il registro bancario per i seguenti file:\n` +
        missingJournals.map(n => `- File ${n}`).join('\n')
      );
      return;
    }

    setImporting(true)

    let totalImported = 0
    let totalSkipped = 0
    let totalErrors = 0
    let totalTransactions = 0
    const allErrorDetails: string[] = []

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
            transactions: parseResult.transactions,
            journalId: selectedJournals[i]
          })
        })

        const result = await response.json()

        if (result.success) {
          totalImported += result.imported || 0
          totalSkipped += result.skipped || 0
          totalErrors += result.errors || 0
          totalTransactions += result.total || 0

          if (result.errorDetails && result.errorDetails.length > 0) {
            allErrorDetails.push(...result.errorDetails)
          }
        } else {
          totalErrors++
          const errorMsg = `File ${i + 1}: ${result.error}`
          allErrorDetails.push(errorMsg)
        }
      } catch (error: any) {
        console.error(`Errore importazione file ${i + 1}:`, error)
        const errorMsg = `File ${i + 1}: ${error.message || 'Errore sconosciuto'}`
        allErrorDetails.push(errorMsg)
        totalErrors++
      }
    }

    // Mostra riepilogo finale con modal
    setSummaryData({
      totalImported,
      totalSkipped,
      totalErrors,
      totalTransactions,
      errorDetails: allErrorDetails
    })
    setShowSummaryModal(true)

    setFiles([])
    setParseResults([])
    setCurrentFileIndex(0)
    setImporting(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 sm:p-6 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 md:p-8 mb-6 md:mb-8 border border-blue-100">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-4">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-3 md:p-4 rounded-lg md:rounded-xl flex-shrink-0">
                <FileText className="w-6 h-6 md:w-8 md:h-8 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent truncate">
                  Import Movimenti UBS
                </h1>
                <p className="text-sm md:text-base text-gray-600 hidden sm:block">
                  Carica il file CSV esportato dalla tua UBS e-banking
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  v3.0 - Sistema anti-duplicati Odoo
                </p>
              </div>
            </div>

            {/* Pulsanti Navigazione */}
            <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
              <Link href="/super-dashboard" className="flex-1 sm:flex-none">
                <button className="w-full flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-lg font-semibold shadow-lg transition-all text-sm sm:text-base">
                  <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">Indietro</span>
                </button>
              </Link>
              <Link href="/" className="flex-1 sm:flex-none">
                <button className="w-full flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-lg font-semibold shadow-lg transition-all text-sm sm:text-base">
                  <Home className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">Home</span>
                </button>
              </Link>
            </div>
          </div>
        </div>

        {/* Upload Section */}
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 md:p-8 mb-6 md:mb-8 border border-blue-100">
          <h2 className="text-lg md:text-xl font-bold mb-4 md:mb-6 flex items-center gap-2">
            <Upload className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
            Carica File CSV
          </h2>

          <div className="space-y-4 md:space-y-6">
            {/* File Input */}
            <div className="border-2 border-dashed border-blue-300 rounded-xl p-6 md:p-8 text-center hover:border-blue-500 active:border-blue-600 transition-colors">
              <input
                type="file"
                accept=".csv"
                multiple
                onChange={handleFileChange}
                className="hidden"
                id="csv-upload"
              />
              <label htmlFor="csv-upload" className="cursor-pointer block">
                <div className="flex flex-col items-center gap-3 md:gap-4">
                  <Upload className="w-12 h-12 md:w-16 md:h-16 text-blue-400" />
                  <div>
                    <p className="text-base md:text-lg font-semibold text-gray-700">
                      Click per selezionare i file CSV
                    </p>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1 px-2">
                      Puoi selezionare più file contemporaneamente
                    </p>
                  </div>
                </div>
              </label>
            </div>

            {/* Files Selected */}
            {files.length > 0 && (
              <div className="space-y-3">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <FileText className="w-6 h-6 md:w-8 md:h-8 text-blue-600 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-gray-800 text-sm md:text-base">
                          {files.length} file selezionat{files.length > 1 ? 'i' : 'o'}
                        </p>
                        <p className="text-xs sm:text-sm text-gray-600">
                          {(files.reduce((acc, f) => acc + f.size, 0) / 1024).toFixed(2)} KB totali
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleParse}
                      disabled={parsing}
                      className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 sm:px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 text-sm md:text-base"
                    >
                      {parsing ? `Analizzando ${currentFileIndex + 1}/${files.length}...` : `Analizza ${files.length > 1 ? 'Tutti' : ''} (${files.length})`}
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
                <h3 className="text-base sm:text-lg font-bold text-gray-700 mb-3 px-2">
                  File {idx + 1}/{parseResults.length}: <span className="text-sm sm:text-base break-all">{files[idx]?.name}</span>
                </h3>

                {/* Account Info */}
                {parseResult.success && parseResult.accountInfo && (
              <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 md:p-8 border border-green-100">
                <h2 className="text-lg md:text-xl font-bold mb-4 md:mb-6 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
                  Informazioni Conto
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                  <div className="bg-gradient-to-br from-blue-50 to-purple-50 p-3 md:p-4 rounded-xl">
                    <p className="text-xs md:text-sm text-gray-600 mb-1">IBAN</p>
                    <p className="font-bold text-gray-800 text-sm md:text-base break-all">{parseResult.accountInfo.iban}</p>
                  </div>
                  <div className="bg-gradient-to-br from-blue-50 to-purple-50 p-3 md:p-4 rounded-xl">
                    <p className="text-xs md:text-sm text-gray-600 mb-1">Periodo</p>
                    <p className="font-bold text-gray-800 text-xs sm:text-sm md:text-base">
                      {parseResult.accountInfo.startDate} → {parseResult.accountInfo.endDate}
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-3 md:p-4 rounded-xl">
                    <p className="text-xs md:text-sm text-gray-600 mb-1">Saldo Iniziale</p>
                    <p className="font-bold text-green-700 text-sm md:text-base">
                      {parseResult.accountInfo.currency} {parseResult.accountInfo.startBalance.toLocaleString('de-CH', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-3 md:p-4 rounded-xl">
                    <p className="text-xs md:text-sm text-gray-600 mb-1">Saldo Finale</p>
                    <p className="font-bold text-green-700 text-sm md:text-base">
                      {parseResult.accountInfo.currency} {parseResult.accountInfo.endBalance.toLocaleString('de-CH', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                {parseResult.stats && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mt-4">
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-3 md:p-4 rounded-xl">
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-green-600" />
                        <p className="text-xs md:text-sm text-gray-600">Entrate</p>
                      </div>
                      <p className="font-bold text-lg md:text-xl text-green-700">
                        CHF {parseResult.stats.totalIncome.toLocaleString('de-CH', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="bg-gradient-to-br from-red-50 to-pink-50 p-3 md:p-4 rounded-xl">
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingDown className="w-4 h-4 md:w-5 md:h-5 text-red-600" />
                        <p className="text-xs md:text-sm text-gray-600">Uscite</p>
                      </div>
                      <p className="font-bold text-lg md:text-xl text-red-700">
                        CHF {parseResult.stats.totalExpense.toLocaleString('de-CH', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className={`bg-gradient-to-br p-3 md:p-4 rounded-xl ${parseResult.stats.netChange >= 0 ? 'from-green-50 to-emerald-50' : 'from-red-50 to-pink-50'}`}>
                      <p className="text-xs md:text-sm text-gray-600 mb-1">Variazione Netta</p>
                      <p className={`font-bold text-lg md:text-xl ${parseResult.stats.netChange >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        CHF {parseResult.stats.netChange.toLocaleString('de-CH', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                )}

                {/* Journal Selection */}
                {availableJournals.length > 0 && (
                  <div className="bg-gradient-to-br from-purple-50 to-blue-50 p-4 md:p-6 rounded-xl mt-4 md:mt-6 border-2 border-purple-200">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="bg-purple-600 p-2 rounded-lg flex-shrink-0">
                        <svg className="w-4 h-4 md:w-5 md:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs md:text-sm font-bold text-gray-800">Registro Bancario Odoo</p>
                        <p className="text-xs text-gray-600">Seleziona dove registrare queste transazioni</p>
                      </div>
                    </div>

                    <select
                      value={selectedJournals[idx] || ''}
                      onChange={(e) => {
                        const journalId = parseInt(e.target.value)
                        setSelectedJournals(prev => ({
                          ...prev,
                          [idx]: journalId
                        }))
                      }}
                      className="w-full px-3 md:px-4 py-2 md:py-3 bg-white border-2 border-purple-300 rounded-lg font-semibold text-gray-800 hover:border-purple-500 focus:border-purple-600 focus:ring-2 focus:ring-purple-200 transition-all cursor-pointer text-sm md:text-base"
                    >
                      <option value="">-- Seleziona registro bancario --</option>
                      {availableJournals.map(journal => (
                        <option key={journal.journalId} value={journal.journalId}>
                          {journal.journalName} ({journal.currency}) - {journal.journalCode}
                        </option>
                      ))}
                    </select>

                    {/* Info IBAN match */}
                    {parseResult.suggestedJournal && selectedJournals[idx] === parseResult.suggestedJournal.journalId && (
                      <div className="mt-3 flex items-center gap-2 text-xs text-green-700 bg-green-50 px-3 py-2 rounded-lg">
                        <CheckCircle className="w-4 h-4 flex-shrink-0" />
                        <span className="break-all">
                          ✅ Registro suggerito automaticamente da IBAN: <strong>{parseResult.accountInfo.iban}</strong>
                        </span>
                      </div>
                    )}

                    {/* Warning IBAN non riconosciuto */}
                    {!parseResult.suggestedJournal && parseResult.accountInfo.iban && (
                      <div className="mt-3 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span className="break-all">
                          ⚠️ IBAN {parseResult.accountInfo.iban} non riconosciuto. Seleziona manualmente il registro corretto.
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Transactions List */}
            {parseResult.success && parseResult.transactions && parseResult.transactions.length > 0 && (
              <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 md:p-8 border border-blue-100">
                <div className="mb-4 md:mb-6">
                  <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
                    <FileText className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                    Movimenti Trovati ({parseResult.transactions.length})
                  </h2>
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {parseResult.transactions.map((tx, i) => (
                    <div
                      key={i}
                      className={`border rounded-lg md:rounded-xl p-3 md:p-4 hover:shadow-md transition-shadow ${
                        tx.type === 'income' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 md:gap-3 mb-2">
                            {tx.type === 'income' ? (
                              <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-green-600 flex-shrink-0" />
                            ) : (
                              <TrendingDown className="w-4 h-4 md:w-5 md:h-5 text-red-600 flex-shrink-0" />
                            )}
                            <p className="font-bold text-gray-800 text-sm md:text-base truncate">{tx.beneficiary}</p>
                          </div>
                          <p className="text-xs md:text-sm text-gray-600 mb-1 break-words">{tx.description}</p>
                          <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs text-gray-500">
                            <span>📅 {tx.date}</span>
                            <span className="break-all">🏦 {tx.transactionNr}</span>
                            {tx.paymentReason && (
                              <span className="font-semibold text-blue-700 break-words">💳 Zahlungsgrund: {tx.paymentReason}</span>
                            )}
                          </div>
                        </div>
                        <div className="text-left sm:text-right flex-shrink-0">
                          <p className={`text-xl md:text-2xl font-bold ${tx.type === 'income' ? 'text-green-700' : 'text-red-700'}`}>
                            {tx.type === 'income' ? '+' : '-'} CHF {Math.abs(tx.amount).toLocaleString('de-CH', { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-xs md:text-sm text-gray-600 mt-1">
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
              <div className="bg-red-50 border border-red-200 rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8">
                <h2 className="text-lg md:text-xl font-bold mb-4 flex items-center gap-2 text-red-700">
                  <XCircle className="w-5 h-5 md:w-6 md:h-6" />
                  Errori
                </h2>
                <ul className="space-y-2">
                  {parseResult.errors.map((error, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs md:text-sm text-red-700">
                      <AlertCircle className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0 mt-0.5" />
                      <span className="break-words">{error}</span>
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
                  className="w-full sm:w-auto bg-gradient-to-r from-green-600 to-emerald-600 text-white px-8 sm:px-12 py-3 md:py-4 rounded-xl font-bold text-base md:text-lg hover:shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  <Download className="w-5 h-5 md:w-6 md:h-6" />
                  {importing ? `Importando ${currentFileIndex + 1}/${parseResults.length}...` : `Importa ${parseResults.length > 1 ? 'Tutti' : ''} in Odoo (${parseResults.length} file)`}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        {parseResults.length === 0 && (
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 border border-blue-200">
            <h2 className="text-lg md:text-xl font-bold mb-4 text-gray-800">
              📖 Come usare
            </h2>
            <ol className="space-y-3 text-gray-700 text-sm md:text-base">
              <li className="flex items-start gap-2 md:gap-3">
                <span className="flex-shrink-0 w-6 h-6 md:w-8 md:h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-xs md:text-base">1</span>
                <span>Vai su <strong>UBS e-banking</strong> → Accounts and Cards → Overview</span>
              </li>
              <li className="flex items-start gap-2 md:gap-3">
                <span className="flex-shrink-0 w-6 h-6 md:w-8 md:h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-xs md:text-base">2</span>
                <span>Seleziona il conto <strong>UBS CHF 701J</strong></span>
              </li>
              <li className="flex items-start gap-2 md:gap-3">
                <span className="flex-shrink-0 w-6 h-6 md:w-8 md:h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-xs md:text-base">3</span>
                <span>Click su <strong>Transactions</strong> e poi sull'icona <strong>CSV/Excel</strong></span>
              </li>
              <li className="flex items-start gap-2 md:gap-3">
                <span className="flex-shrink-0 w-6 h-6 md:w-8 md:h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-xs md:text-base">4</span>
                <span>Scarica il file CSV e caricalo qui sopra</span>
              </li>
              <li className="flex items-start gap-2 md:gap-3">
                <span className="flex-shrink-0 w-6 h-6 md:w-8 md:h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-xs md:text-base">5</span>
                <span>Click su <strong>"Analizza File"</strong> per vedere i movimenti</span>
              </li>
              <li className="flex items-start gap-2 md:gap-3">
                <span className="flex-shrink-0 w-6 h-6 md:w-8 md:h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold text-xs md:text-base">6</span>
                <span>Click su <strong>"Importa in Odoo"</strong> per registrare i movimenti</span>
              </li>
            </ol>
          </div>
        )}
      </div>

      {/* Summary Modal - BELLISSIMO POPUP! */}
      {showSummaryModal && summaryData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
             onClick={() => setShowSummaryModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
               onClick={(e) => e.stopPropagation()}>

            {/* Header */}
            <div className={`p-6 sm:p-8 rounded-t-2xl ${
              summaryData.totalErrors === 0 && summaryData.totalSkipped === 0
                ? 'bg-gradient-to-r from-green-500 to-emerald-600'
                : summaryData.totalImported > 0 && summaryData.totalErrors === 0
                ? 'bg-gradient-to-r from-blue-500 to-cyan-600'
                : summaryData.totalImported === 0 && summaryData.totalSkipped > 0 && summaryData.totalErrors === 0
                ? 'bg-gradient-to-r from-gray-400 to-gray-500'
                : 'bg-gradient-to-r from-orange-500 to-red-600'
            }`}>
              <div className="flex items-center justify-between text-white">
                <div className="flex items-center gap-3">
                  {summaryData.totalErrors === 0 && summaryData.totalSkipped === 0 ? (
                    <CheckCircle className="w-10 h-10 sm:w-12 sm:h-12" />
                  ) : summaryData.totalErrors > 0 ? (
                    <AlertCircle className="w-10 h-10 sm:w-12 sm:h-12" />
                  ) : (
                    <CheckCircle className="w-10 h-10 sm:w-12 sm:h-12" />
                  )}
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-bold">
                      {summaryData.totalErrors === 0 && summaryData.totalSkipped === 0
                        ? '🎉 Import Completato!'
                        : summaryData.totalImported > 0 && summaryData.totalErrors === 0
                        ? '🎉 Import Completato!'
                        : summaryData.totalImported === 0 && summaryData.totalSkipped > 0 && summaryData.totalErrors === 0
                        ? 'ℹ️ Nessun Nuovo Movimento'
                        : '⚠️ Import con Errori'}
                    </h2>
                    <p className="text-sm sm:text-base opacity-90 mt-1">
                      {summaryData.totalTransactions} transazion{summaryData.totalTransactions === 1 ? 'e' : 'i'} processate
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSummaryModal(false)}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-all">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 sm:p-8">
              {/* Statistics Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                {/* Importati */}
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                    <p className="text-sm font-semibold text-gray-600">Importati</p>
                  </div>
                  <p className="text-3xl font-bold text-green-700">{summaryData.totalImported}</p>
                  <p className="text-xs text-gray-500 mt-1">nuovi movimenti</p>
                </div>

                {/* Duplicati */}
                {summaryData.totalSkipped > 0 && (
                  <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="w-6 h-6 text-blue-600" />
                      <p className="text-sm font-semibold text-gray-600">Duplicati</p>
                    </div>
                    <p className="text-3xl font-bold text-blue-700">{summaryData.totalSkipped}</p>
                    <p className="text-xs text-gray-500 mt-1">già presenti</p>
                  </div>
                )}

                {/* Errori */}
                {summaryData.totalErrors > 0 && (
                  <div className="bg-gradient-to-br from-red-50 to-pink-50 border-2 border-red-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <XCircle className="w-6 h-6 text-red-600" />
                      <p className="text-sm font-semibold text-gray-600">Errori</p>
                    </div>
                    <p className="text-3xl font-bold text-red-700">{summaryData.totalErrors}</p>
                    <p className="text-xs text-gray-500 mt-1">transazioni fallite</p>
                  </div>
                )}
              </div>

              {/* Message */}
              <div className="bg-gray-50 rounded-xl p-4 sm:p-6 mb-6">
                {summaryData.totalErrors === 0 && summaryData.totalSkipped === 0 ? (
                  <p className="text-gray-700 text-sm sm:text-base leading-relaxed">
                    <strong className="text-green-700">Perfetto! ✅</strong><br />
                    Tutti i {summaryData.totalImported} movimenti sono stati registrati correttamente in Odoo!
                  </p>
                ) : summaryData.totalImported > 0 && summaryData.totalErrors === 0 ? (
                  <p className="text-gray-700 text-sm sm:text-base leading-relaxed">
                    <strong className="text-blue-700">Importazione completata! 📊</strong><br />
                    {summaryData.totalImported} nuovi movimenti sono stati registrati in Odoo.<br />
                    {summaryData.totalSkipped} movimenti erano già stati importati in precedenza e sono stati saltati.
                  </p>
                ) : summaryData.totalImported === 0 && summaryData.totalSkipped > 0 && summaryData.totalErrors === 0 ? (
                  <p className="text-gray-700 text-sm sm:text-base leading-relaxed">
                    <strong className="text-gray-700">Nessun nuovo movimento ℹ️</strong><br />
                    Tutti i {summaryData.totalSkipped} movimenti erano già stati importati in precedenza.<br />
                    Non è stato necessario importare nulla - tutto già presente in Odoo!
                  </p>
                ) : (
                  <p className="text-gray-700 text-sm sm:text-base leading-relaxed">
                    <strong className="text-orange-700">Attenzione! ⚠️</strong><br />
                    L'importazione è stata completata con alcuni errori.<br />
                    {summaryData.totalImported > 0 && `✅ ${summaryData.totalImported} movimenti importati correttamente`}<br />
                    {summaryData.totalSkipped > 0 && `⏭️ ${summaryData.totalSkipped} duplicati saltati`}<br />
                    {summaryData.totalErrors > 0 && `❌ ${summaryData.totalErrors} errori riscontrati`}
                  </p>
                )}
              </div>

              {/* Error Details */}
              {summaryData.totalErrors > 0 && summaryData.errorDetails.length > 0 && (
                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 sm:p-6">
                  <h3 className="text-lg font-bold text-red-700 mb-3 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    Dettagli Errori
                  </h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {summaryData.errorDetails.slice(0, 5).map((error, idx) => (
                      <div key={idx} className="bg-white rounded-lg p-3 text-sm text-gray-700 break-words">
                        <span className="font-bold text-red-600">#{idx + 1}:</span> {error.substring(0, 200)}
                      </div>
                    ))}
                    {summaryData.errorDetails.length > 5 && (
                      <p className="text-xs text-red-600 font-semibold mt-2">
                        ... e altri {summaryData.errorDetails.length - 5} errori. Controlla la console (F12) per i dettagli completi.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Close Button */}
              <div className="flex justify-center mt-6">
                <button
                  onClick={() => setShowSummaryModal(false)}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-3 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all"
                >
                  Chiudi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
