import { NextRequest, NextResponse } from 'next/server'

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

// Helper functions - Updated 2025-11-11
function convertDateFormat(dateStr: string): string {
  // Converte DD.MM.YYYY o DD-MM-YYYY a YYYY-MM-DD
  if (!dateStr) return ''

  // Se già in formato corretto YYYY-MM-DD, ritorna così com'è
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr
  }

  // Gestisci DD.MM.YYYY
  let parts = dateStr.split('.')
  if (parts.length === 3 && parts[0].length <= 2) {
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
  }

  // Gestisci DD-MM-YYYY
  parts = dateStr.split('-')
  if (parts.length === 3 && parts[0].length <= 2) {
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
  }

  return dateStr
}

function extractBeneficiary(text: string): string {
  // Estrae beneficiario dal testo Credit Suisse
  if (!text) return 'N/A'

  // Cerca pattern comuni
  const patterns = [
    /Pagamento carta.*?(\w+\s+\w+)/,
    /Trasferimento.*?([A-Z][a-z]+.*?GmbH)/,
    /([A-Z][a-z]+\s+[A-Z][a-z]+)/
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) return match[1]
  }

  // Se non trova pattern, prende prime 40 caratteri
  return text.substring(0, 40)
}

function extractTransactionNr(text: string): string {
  // Estrae numero transazione se presente
  const match = text.match(/no\.\s*carta\s*(\d+\s*\d+XX\s*XXXX\s*\d+)/)
  if (match) return match[1]

  const dncsMatch = text.match(/(DNCS-\d{8}-[A-Z0-9]+)/)
  if (dncsMatch) return dncsMatch[1]

  return ''
}

function extractPaymentReason(text: string): string {
  // Estrae il Zahlungsgrund dal campo Beschreibung3
  if (!text) return ''

  const match = text.match(/Zahlungsgrund:\s*([^;]+)/)
  if (match) {
    return match[1].trim()
  }

  return ''
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { success: false, errors: ['Nessun file caricato'] },
        { status: 400 }
      )
    }

    // Leggi il contenuto del file
    const text = await file.text()
    const lines = text.split('\n')

    // Rileva tipo file (UBS o Credit Suisse)
    const isUBS = text.includes('Kontonummer:') && text.includes('IBAN:')
    const isCreditSuisse = text.includes('Registrazioni') && text.includes('Data di registrazione,Testo')

    if (!isUBS && !isCreditSuisse) {
      return NextResponse.json({
        success: false,
        errors: ['Formato file non riconosciuto. Supportati: UBS e Credit Suisse']
      })
    }

    // Parsing header info
    const accountInfo = {
      accountNumber: '',
      iban: '',
      startDate: '',
      endDate: '',
      startBalance: 0,
      endBalance: 0,
      currency: 'CHF',
      transactionCount: 0
    }

    let headerIndex = -1

    if (isUBS) {
      // Parsea header UBS (formato originale)
      for (let i = 0; i < Math.min(10, lines.length); i++) {
        const line = lines[i].trim()
        if (!line) continue

        const parts = line.split(';')

        if (line.startsWith('Kontonummer:')) {
          accountInfo.accountNumber = parts[1]?.trim() || ''
        } else if (line.startsWith('IBAN:')) {
          accountInfo.iban = parts[1]?.trim() || ''
        } else if (line.startsWith('Von:')) {
          accountInfo.startDate = parts[1]?.trim() || ''
        } else if (line.startsWith('Bis:')) {
          accountInfo.endDate = parts[1]?.trim() || ''
        } else if (line.startsWith('Anfangssaldo:')) {
          accountInfo.startBalance = parseFloat(parts[1]?.replace(',', '.') || '0')
        } else if (line.startsWith('Schlusssaldo:')) {
          accountInfo.endBalance = parseFloat(parts[1]?.replace(',', '.') || '0')
        } else if (line.startsWith('Bewertet in:')) {
          accountInfo.currency = parts[1]?.trim() || 'CHF'
        } else if (line.startsWith('Anzahl Transaktionen')) {
          accountInfo.transactionCount = parseInt(parts[1]?.trim() || '0')
        }
      }

      // Trova header transazioni UBS
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('Abschlussdatum;') && lines[i].includes('Buchungsdatum;')) {
          headerIndex = i
          break
        }
      }
    } else {
      // Parsea header Credit Suisse
      for (let i = 0; i < Math.min(10, lines.length); i++) {
        const line = lines[i].trim()
        if (!line) continue

        if (line.startsWith('Conto,')) {
          const accountMatch = line.match(/(\d{7}-\d{2})/)
          if (accountMatch) accountInfo.accountNumber = accountMatch[1]
        } else if (line.startsWith('Saldo,')) {
          const balanceMatch = line.match(/Saldo,([0-9']+\.\d{2})/)
          if (balanceMatch) {
            accountInfo.endBalance = parseFloat(balanceMatch[1].replace(/'/g, ''))
          }
        }
      }

      // Trova header transazioni Credit Suisse
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('Data di registrazione,Testo')) {
          headerIndex = i
          break
        }
      }
    }

    if (headerIndex === -1) {
      return NextResponse.json({
        success: false,
        errors: ['Header transazioni non trovato nel file.']
      })
    }

    // Parsea transazioni
    const transactions: Transaction[] = []
    let totalIncome = 0
    let totalExpense = 0

    if (isUBS) {
      // Parser UBS (formato originale con punto e virgola)
      for (let i = headerIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue

        const parts = line.split(';')
        if (parts.length < 14) continue

        try {
        const abschlussdatum = parts[0]?.trim()
        const buchungsdatum = parts[2]?.trim()
        const valutadatum = parts[3]?.trim()
        const currency = parts[4]?.trim()
        const belastung = parts[5]?.trim() // Uscita
        const gutschrift = parts[6]?.trim() // Entrata
        const saldo = parts[8]?.trim()
        const transaktionsNr = parts[9]?.trim()
        const beschreibung1 = parts[10]?.replace(/^"(.*)"$/, '$1').trim()
        const beschreibung2 = parts[11]?.replace(/^"(.*)"$/, '$1').trim()
        const beschreibung3 = parts[12]?.replace(/^"(.*)"$/, '$1').trim()

        // Calcola importo
        let amount = 0
        let type: 'income' | 'expense' = 'income'

        if (gutschrift && gutschrift !== '') {
          // Entrata (positivo)
          amount = parseFloat(gutschrift.replace(',', '.'))
          type = 'income'
          totalIncome += amount
        } else if (belastung && belastung !== '') {
          // Uscita (negativo)
          amount = -parseFloat(belastung.replace(',', '.'))
          type = 'expense'
          totalExpense += Math.abs(amount)
        }

        if (amount === 0) continue // Salta righe senza importo

        // Combina descrizioni
        const descriptionParts = [beschreibung1, beschreibung2, beschreibung3].filter(d => d && d !== '')
        const description = descriptionParts.join('; ')
        const beneficiary = beschreibung2 || beschreibung1 || 'N/A'

        // Estrai Zahlungsgrund da Beschreibung3
        const paymentReason = extractPaymentReason(beschreibung3)

        const balance = parseFloat(saldo.replace(',', '.') || '0')

        transactions.push({
          date: convertDateFormat(valutadatum || buchungsdatum || abschlussdatum),
          valutaDate: convertDateFormat(valutadatum),
          description,
          beneficiary,
          amount,
          balance,
          transactionNr: transaktionsNr,
          type,
          paymentReason: paymentReason || undefined
        })
        } catch (error) {
          console.error('Errore parsing riga UBS:', error)
        }
      }
    } else {
      // Parser Credit Suisse (formato con virgola come separatore)
      for (let i = headerIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue

        try {
          // Parse CSV con virgola (gestisce valori tra virgolette)
          const parts: string[] = []
          let current = ''
          let inQuotes = false

          for (let j = 0; j < line.length; j++) {
            const char = line[j]
            if (char === '"') {
              inQuotes = !inQuotes
            } else if (char === ',' && !inQuotes) {
              parts.push(current.trim())
              current = ''
            } else {
              current += char
            }
          }
          parts.push(current.trim())

          if (parts.length < 6) continue

          const dataRegistrazione = parts[0]?.trim() // 11.11.2025
          const testo = parts[1]?.replace(/^"(.*)"$/, '$1').trim()
          const addebito = parts[2]?.trim() // Uscita
          const accredito = parts[3]?.trim() // Entrata
          const dataValuta = parts[4]?.trim()
          const saldo = parts[5]?.trim()

          // Calcola importo
          let amount = 0
          let type: 'income' | 'expense' = 'income'

          if (accredito && accredito !== '') {
            // Entrata
            amount = parseFloat(accredito.replace(/'/g, '').replace(',', '.'))
            type = 'income'
            totalIncome += amount
          } else if (addebito && addebito !== '') {
            // Uscita
            amount = -parseFloat(addebito.replace(/'/g, '').replace(',', '.'))
            type = 'expense'
            totalExpense += Math.abs(amount)
          }

          if (amount === 0) continue

          const balance = saldo && saldo !== '' ? parseFloat(saldo.replace(/'/g, '').replace(',', '.')) : 0

          // Estrai Zahlungsgrund anche per Credit Suisse (potrebbe essere nel campo testo)
          const paymentReason = extractPaymentReason(testo)

          transactions.push({
            date: convertDateFormat(dataRegistrazione),
            valutaDate: convertDateFormat(dataValuta),
            description: testo,
            beneficiary: extractBeneficiary(testo),
            amount,
            balance,
            transactionNr: extractTransactionNr(testo),
            type,
            paymentReason: paymentReason || undefined
          })
        } catch (error) {
          console.error('Errore parsing riga Credit Suisse:', error)
        }
      }
    }

    if (transactions.length === 0) {
      return NextResponse.json({
        success: false,
        errors: ['Nessuna transazione trovata nel file']
      })
    }

    // Calcola statistiche
    const stats = {
      totalIncome,
      totalExpense,
      netChange: totalIncome - totalExpense
    }

    return NextResponse.json({
      success: true,
      accountInfo,
      transactions,
      stats
    })

  } catch (error) {
    console.error('Errore parsing CSV:', error)
    return NextResponse.json(
      {
        success: false,
        errors: ['Errore durante il parsing del file: ' + (error as Error).message]
      },
      { status: 500 }
    )
  }
}
