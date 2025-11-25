import { NextRequest, NextResponse } from 'next/server'
import { getOdooSession, callOdoo } from '@/lib/odoo-auth'
import { findJournalByIban, getDefaultJournal } from '@/lib/config/bank-journals'

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

interface AccountInfo {
  accountNumber: string
  iban: string
  startDate: string
  endDate: string
  startBalance: number
  endBalance: number
  currency: string
  transactionCount: number
}

// Journal IDs ora gestiti da lib/config/bank-journals.ts

/**
 * Genera unique_import_id per evitare duplicati in Odoo
 */
function generateUniqueImportId(transaction: Transaction, iban: string): string {
  // Formato: IBAN-DATE-AMOUNT-TXNR
  const dateStr = transaction.date.replace(/-/g, '')
  const amountStr = Math.abs(transaction.amount).toFixed(2).replace('.', '')
  const txNr = transaction.transactionNr || 'NOTX'

  return `${iban}-${dateStr}-${amountStr}-${txNr}`
}

export async function POST(request: NextRequest) {
  try {
    console.log('🏦 [IMPORT-UBS] Inizio import movimenti bancari...')

    const body = await request.json()
    const { accountInfo, transactions, journalId: requestedJournalId } = body as {
      accountInfo: AccountInfo;
      transactions: Transaction[];
      journalId?: number; // Journal selezionato dall'utente (opzionale)
    }

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Nessuna transazione da importare'
      }, { status: 400 })
    }

    console.log(`📊 [IMPORT-UBS] Ricevute ${transactions.length} transazioni`)
    console.log(`💰 [IMPORT-UBS] Valuta: ${accountInfo.currency}`)

    // Ottieni la sessione Odoo dai cookies dell'utente
    const cookieHeader = request.headers.get('cookie')
    const { cookies: odooCookies, uid } = await getOdooSession(cookieHeader || undefined)

    console.log(`✅ [IMPORT-UBS] Autenticato con Odoo (UID: ${uid})`)

    // Determina il journal da usare
    let journalId: number;

    if (requestedJournalId) {
      // Usa il journal specificato dall'utente nella UI
      journalId = requestedJournalId;
      console.log(`📁 [IMPORT-UBS] Journal selezionato dall'utente: ${journalId}`);
    } else {
      // Fallback: determina automaticamente da IBAN o valuta
      const suggestedJournal = findJournalByIban(accountInfo.iban)
        || getDefaultJournal(accountInfo.currency as 'CHF' | 'EUR');
      journalId = suggestedJournal.journalId;
      console.log(`📁 [IMPORT-UBS] Journal auto-determinato: ${journalId} (${suggestedJournal.journalName})`);
    }

    // Importa transazioni una per una
    let imported = 0
    let skipped = 0
    let errors = 0
    const errorDetails: string[] = []

    for (let i = 0; i < transactions.length; i++) {
      const transaction = transactions[i]

      try {
        const uniqueImportId = generateUniqueImportId(transaction, accountInfo.iban)

        // Prepara importo con segno corretto
        // In Odoo: negativo = uscita, positivo = entrata
        let amountValue = parseFloat(String(transaction.amount))

        // Valida amount
        if (isNaN(amountValue)) {
          console.error(`❌ [IMPORT-UBS] Amount non valido: ${transaction.amount}`)
          errors++
          continue
        }

        // Forza segno corretto in base al tipo transazione
        // Questo gestisce eventuali inconsistenze dal parsing
        if (transaction.type === 'expense') {
          amountValue = -Math.abs(amountValue)  // Uscita: sempre negativo
        } else {
          amountValue = Math.abs(amountValue)   // Entrata: sempre positivo
        }

        // Componi payment_ref includendo Zahlungsgrund se presente
        let paymentRef = transaction.description
        if (transaction.paymentReason) {
          paymentRef = `${transaction.description} | Zahlungsgrund: ${transaction.paymentReason}`
        }

        const lineData = {
          journal_id: journalId,
          date: transaction.date,
          payment_ref: paymentRef,
          amount: amountValue,
          unique_import_id: uniqueImportId,
          partner_name: transaction.beneficiary !== 'N/A' ? transaction.beneficiary : false,
          ref: transaction.transactionNr || false,
          narration: transaction.paymentReason || false // Campo note per Zahlungsgrund
        }

        // Crea riga estratto conto in Odoo
        try {
          const result = await callOdoo(
            odooCookies,
            'account.bank.statement.line',
            'create',
            [[lineData]],
            {}
          )

          if (result) {
            imported++
            console.log(`✅ [IMPORT-UBS] Movimento ${i + 1}/${transactions.length} importato: ${amountValue > 0 ? '+' : ''}${amountValue} ${accountInfo.currency}`)
          }
        } catch (createError: any) {
          // Verifica se è un errore di duplicato (unique_import_id constraint)
          if (createError.message?.includes('unique_import_id') ||
              createError.message?.includes('already exists') ||
              createError.message?.includes('duplicate')) {
            skipped++
            console.log(`⏭️  [IMPORT-UBS] Movimento duplicato saltato: ${uniqueImportId}`)
          } else {
            errors++
            const errorMsg = `Riga ${i + 1}: ${createError.message}`
            errorDetails.push(errorMsg)
            console.error(`❌ [IMPORT-UBS] Errore creazione movimento:`, createError.message)
          }
        }

      } catch (error: any) {
        errors++
        const errorMsg = `Riga ${i + 1}: ${error.message}`
        errorDetails.push(errorMsg)
        console.error(`❌ [IMPORT-UBS] Errore generico:`, error.message)
      }
    }

    console.log(`📈 [IMPORT-UBS] RIEPILOGO: ${imported} importati, ${skipped} duplicati, ${errors} errori`)

    return NextResponse.json({
      success: true,
      total: transactions.length,
      imported,
      skipped,
      errors,
      errorDetails: errors > 0 ? errorDetails : undefined,
      message: `Importati ${imported} movimenti, ${skipped} duplicati saltati, ${errors} errori`
    })

  } catch (error: any) {
    console.error('❌ [IMPORT-UBS] Errore critico:', error)
    return NextResponse.json({
      success: false,
      error: 'Errore durante l\'importazione: ' + error.message
    }, { status: 500 })
  }
}
