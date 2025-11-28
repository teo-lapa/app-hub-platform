import { NextRequest, NextResponse } from 'next/server'
import { findJournalByIban, findJournalByAccountNumber, getAllJournals } from '@/lib/config/bank-journals'

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
  // Converte DD.MM.YYYY, DD-MM-YYYY o DD/MM/YYYY a YYYY-MM-DD
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

  // Gestisci DD/MM/YYYY (aggiunto per supportare formato con slash)
  parts = dateStr.split('/')
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

    // Rileva tipo file (UBS tedesco, UBS italiano, UBS Carta di Credito, o Credit Suisse)
    const isUBSGerman = text.includes('Kontonummer:') && text.includes('IBAN:')
    const isUBSItalian = text.includes('Numero di conto:') && text.includes('IBAN:')
    const isUBS = isUBSGerman || isUBSItalian
    const isUBSCreditCard = text.includes('Kartennummer') && text.includes('Buchungstext') && !text.includes('IBAN:')
    const isCreditSuisse = text.includes('Registrazioni') && text.includes('Data di registrazione,Testo')

    if (!isUBS && !isUBSCreditCard && !isCreditSuisse) {
      return NextResponse.json({
        success: false,
        errors: ['Formato file non riconosciuto. Supportati: UBS (tedesco/italiano), UBS Carta di Credito e Credit Suisse']
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
      // Parsea header UBS (formato tedesco o italiano)
      for (let i = 0; i < Math.min(10, lines.length); i++) {
        const line = lines[i].trim()
        if (!line) continue

        const parts = line.split(';')

        // Supporta sia tedesco che italiano
        if (line.startsWith('Kontonummer:') || line.startsWith('Numero di conto:')) {
          accountInfo.accountNumber = parts[1]?.trim() || ''
        } else if (line.startsWith('IBAN:')) {
          accountInfo.iban = parts[1]?.trim() || ''
        } else if (line.startsWith('Von:') || line.startsWith('Dal:')) {
          accountInfo.startDate = parts[1]?.trim() || ''
        } else if (line.startsWith('Bis:') || line.startsWith('Al:')) {
          accountInfo.endDate = parts[1]?.trim() || ''
        } else if (line.startsWith('Anfangssaldo:') || line.startsWith('Saldo iniziale:')) {
          accountInfo.startBalance = parseFloat(parts[1]?.replace(',', '.') || '0')
        } else if (line.startsWith('Schlusssaldo:') || line.startsWith('Saldo finale:')) {
          accountInfo.endBalance = parseFloat(parts[1]?.replace(',', '.') || '0')
        } else if (line.startsWith('Bewertet in:') || line.startsWith('Valutazione in:')) {
          accountInfo.currency = parts[1]?.trim() || 'CHF'
        } else if (line.startsWith('Anzahl Transaktionen') || line.startsWith('Numero di transazioni')) {
          accountInfo.transactionCount = parseInt(parts[1]?.trim() || '0')
        }
      }

      // Trova header transazioni UBS (tedesco o italiano)
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        // Tedesco: Abschlussdatum;Buchungsdatum
        // Italiano: Data dell'operazione;Ora dell'operazione;Data di contabilizzazione
        if ((line.includes('Abschlussdatum;') && line.includes('Buchungsdatum;')) ||
            (line.includes('Data dell\'operazione;') && line.includes('Data di contabilizzazione;'))) {
          headerIndex = i
          break
        }
      }
    } else if (isUBSCreditCard) {
      // Parsea header UBS Credit Card
      for (let i = 0; i < Math.min(10, lines.length); i++) {
        const line = lines[i].trim()
        if (!line || line.startsWith('sep=')) continue

        const parts = line.split(';')

        // Prima riga di dati ha il numero conto
        if (parts.length >= 3 && /^\d{4}\s+\d{4}\s+\d{4}$/.test(parts[0]?.trim())) {
          accountInfo.accountNumber = parts[0]?.trim().replace(/\s/g, '') || ''
          accountInfo.currency = 'CHF' // UBS Credit Card è sempre CHF
          break
        }
      }

      // Trova header transazioni UBS Credit Card
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('Kontonummer;') && lines[i].includes('Kartennummer;') && lines[i].includes('Buchungstext;')) {
          headerIndex = i
          break
        }
      }
    } else if (isCreditSuisse) {
      // Parsea header Credit Suisse
      for (let i = 0; i < Math.min(10, lines.length); i++) {
        const line = lines[i].trim()
        if (!line) continue

        if (line.startsWith('Conto,')) {
          const accountMatch = line.match(/(\d+)-(\d{2,5})/)
          if (accountMatch) {
            // Normalizza il numero conto rimuovendo zeri iniziali
            // Es: 0397749-51 → 3977497-51
            const normalized = `${parseInt(accountMatch[1])}-${accountMatch[2]}`
            accountInfo.accountNumber = normalized
          }
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
    let lastValidDate = '' // Traccia l'ultima data valida per le righe figlie di Sammelauftrag

    if (isUBS) {
      // Determina se è formato italiano (ha colonna "Ora dell'operazione")
      const isItalianFormat = lines[headerIndex].includes('Ora dell\'operazione;')

      // Parser UBS (formato tedesco o italiano con punto e virgola)
      for (let i = headerIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue

        // Parse CSV con punto e virgola (gestisce valori tra virgolette)
        const parts: string[] = []
        let current = ''
        let inQuotes = false

        for (let j = 0; j < line.length; j++) {
          const char = line[j]
          if (char === '"') {
            inQuotes = !inQuotes
          } else if (char === ';' && !inQuotes) {
            parts.push(current.trim())
            current = ''
          } else {
            current += char
          }
        }
        parts.push(current.trim())

        if (parts.length < 10) continue // Minimo 10 colonne fino a Transaktions-Nr.

        try {
        // Adatta indici colonne in base al formato
        let abschlussdatum, buchungsdatum, valutadatum, currency, belastung, gutschrift, einzelbetrag, saldo, transaktionsNr, beschreibung1, beschreibung2, beschreibung3

        if (isItalianFormat) {
          // Formato italiano (con colonna "Ora dell'operazione" in posizione 1)
          abschlussdatum = parts[0]?.trim() // Data dell'operazione
          buchungsdatum = parts[2]?.trim() // Data di contabilizzazione
          valutadatum = parts[3]?.trim() // Data di valuta
          currency = parts[4]?.trim() // Moneta
          belastung = parts[5]?.trim() // Addebito
          gutschrift = parts[6]?.trim() // Accredito
          einzelbetrag = parts[7]?.trim() // Importo singolo
          saldo = parts[8]?.trim() // Saldo
          transaktionsNr = parts[9]?.trim() // N. di transazione
          beschreibung1 = parts[10]?.replace(/^"(.*)"$/, '$1').trim() // Descrizione1
          beschreibung2 = parts[11]?.replace(/^"(.*)"$/, '$1').trim() // Descrizione2
          beschreibung3 = parts[12]?.replace(/^"(.*)"$/, '$1').trim() // Descrizione3
        } else {
          // Formato tedesco (originale)
          abschlussdatum = parts[0]?.trim()
          buchungsdatum = parts[2]?.trim()
          valutadatum = parts[3]?.trim()
          currency = parts[4]?.trim()
          belastung = parts[5]?.trim() // Uscita
          gutschrift = parts[6]?.trim() // Entrata
          einzelbetrag = parts[7]?.trim() // Importo singolo per Sammelauftrag
          saldo = parts[8]?.trim()
          transaktionsNr = parts[9]?.trim()
          beschreibung1 = parts[10]?.replace(/^"(.*)"$/, '$1').trim()
          beschreibung2 = parts[11]?.replace(/^"(.*)"$/, '$1').trim()
          beschreibung3 = parts[12]?.replace(/^"(.*)"$/, '$1').trim()
        }

        // Calcola importo
        let amount = 0
        let type: 'income' | 'expense' = 'income'

        // PRIMA: Controlla se è la riga collettiva del Sammelauftrag (da skippare)
        if (beschreibung1.includes('e-banking-Sammelauftrag') && belastung && belastung !== '') {
          console.log(`⏭️  SKIP riga collettiva Sammelauftrag: ${belastung}`)
          continue // Salta questa riga
        }

        // SECONDA: Controlla se è una riga individuale con Einzelbetrag
        // (le righe Sammelauftrag individuali hanno SOLO Einzelbetrag, senza Belastung/Gutschrift)
        if (einzelbetrag && einzelbetrag !== '') {
          // USA EINZELBETRAG
          const einzelbetragValue = parseFloat(einzelbetrag.replace(',', '.'))

          if (einzelbetragValue < 0) {
            // Uscita
            amount = einzelbetragValue // già negativo
            type = 'expense'
            totalExpense += Math.abs(amount)
          } else {
            // Entrata
            amount = einzelbetragValue
            type = 'income'
            totalIncome += amount
          }

        } else if (gutschrift && gutschrift !== '') {
          // Entrata normale
          amount = parseFloat(gutschrift.replace(',', '.'))
          type = 'income'
          totalIncome += amount

        } else if (belastung && belastung !== '') {
          // Uscita normale
          amount = -parseFloat(belastung.replace(',', '.'))
          type = 'expense'
          totalExpense += Math.abs(amount)
        }

        if (amount === 0) continue // Salta righe senza importo

        // Estrai il nome del beneficiario da Beschreibung1 (prima parte prima del ;)
        let beneficiary = 'N/A'
        if (beschreibung1) {
          const namePart = beschreibung1.split(';')[0]?.trim()
          if (namePart) {
            beneficiary = namePart
          }
        }

        // Combina descrizioni
        const descriptionParts = [beschreibung1, beschreibung2, beschreibung3].filter(d => d && d !== '')
        const description = descriptionParts.join('; ')

        // Estrai Zahlungsgrund da Beschreibung3
        const paymentReason = extractPaymentReason(beschreibung3)

        const balance = parseFloat(saldo.replace(',', '.') || '0')

        // Gestione date per righe Sammelauftrag:
        // Se i campi data sono tutti vuoti, usa l'ultima data valida (dalla riga madre del Sammelauftrag)
        const dateStr = convertDateFormat(valutadatum || buchungsdatum || abschlussdatum)

        let finalDate: string
        if (dateStr) {
          // Abbiamo una data valida - salvala per le righe figlie successive
          finalDate = dateStr
          lastValidDate = dateStr
        } else if (lastValidDate) {
          // Nessuna data in questa riga - usa l'ultima data valida (riga madre Sammelauftrag)
          finalDate = lastValidDate
        } else {
          // Fallback estremo: usa data di oggi
          finalDate = new Date().toISOString().split('T')[0]
        }

        transactions.push({
          date: finalDate,
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
    } else if (isUBSCreditCard) {
      // Parser UBS Credit Card (formato con punto e virgola)
      for (let i = headerIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line || line.startsWith('sep=')) continue

        // Parse CSV con punto e virgola
        const parts: string[] = []
        let current = ''
        let inQuotes = false

        for (let j = 0; j < line.length; j++) {
          const char = line[j]
          if (char === '"') {
            inQuotes = !inQuotes
          } else if (char === ';' && !inQuotes) {
            parts.push(current.trim())
            current = ''
          } else {
            current += char
          }
        }
        parts.push(current.trim())

        if (parts.length < 11) continue // Minimo 11 colonne

        try {
          const kontonummer = parts[0]?.trim()
          const kartennummer = parts[1]?.trim()
          const karteninhaber = parts[2]?.trim()
          const einkaufsdatum = parts[3]?.trim() // Data acquisto
          const buchungstext = parts[4]?.trim() // Descrizione
          const branche = parts[5]?.trim() // Categoria
          const betrag = parts[6]?.trim() // Importo originale
          const originalwaehrung = parts[7]?.trim() // Valuta originale
          const kurs = parts[8]?.trim() // Tasso cambio
          const waehrung = parts[9]?.trim() // Valuta finale (CHF)
          const belastung = parts[10]?.trim() // Addebito in CHF
          const gutschrift = parts[11]?.trim() // Accredito in CHF (raro)
          const buchung = parts[12]?.trim() // Data contabilizzazione

          // Calcola importo
          let amount = 0
          let type: 'income' | 'expense' = 'expense'

          if (belastung && belastung !== '') {
            // Uscita (caso più comune per carta credito)
            amount = -parseFloat(belastung.replace(',', '.'))
            type = 'expense'
            totalExpense += Math.abs(amount)
          } else if (gutschrift && gutschrift !== '') {
            // Entrata (es: rimborsi)
            amount = parseFloat(gutschrift.replace(',', '.'))
            type = 'income'
            totalIncome += amount
          }

          if (amount === 0) continue

          // Costruisci descrizione completa
          let description = buchungstext
          if (branche && branche !== buchungstext) {
            description += ` (${branche})`
          }
          if (originalwaehrung && originalwaehrung !== 'CHF' && betrag) {
            description += ` - ${betrag} ${originalwaehrung}`
          }

          transactions.push({
            date: convertDateFormat(buchung || einkaufsdatum),
            valutaDate: convertDateFormat(einkaufsdatum),
            description,
            beneficiary: buchungstext.substring(0, 40), // Primi 40 caratteri del testo
            amount,
            balance: 0, // Credit card non ha saldo running
            transactionNr: kartennummer,
            type
          })
        } catch (error) {
          console.error('Errore parsing riga UBS Credit Card:', error)
        }
      }
    } else if (isCreditSuisse) {
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

    // Trova il journal suggerito basato sull'IBAN o numero conto
    let suggestedJournal = findJournalByIban(accountInfo.iban);

    if (!suggestedJournal && accountInfo.accountNumber) {
      suggestedJournal = findJournalByAccountNumber(accountInfo.accountNumber);
    }

    if (suggestedJournal) {
      console.log(`✅ Journal suggerito: ${suggestedJournal.journalName} (ID: ${suggestedJournal.journalId}) per IBAN ${accountInfo.iban}`);
    } else {
      console.warn(`⚠️ Nessun journal trovato per IBAN ${accountInfo.iban} - richiesta selezione manuale`);
    }

    return NextResponse.json({
      success: true,
      accountInfo,
      transactions,
      stats,
      suggestedJournal, // Journal suggerito automaticamente
      availableJournals: getAllJournals() // Tutti i journal disponibili per il dropdown
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
