import { NextRequest, NextResponse } from 'next/server'
import xmlrpc from 'xmlrpc'

interface Transaction {
  date: string
  valutaDate: string
  description: string
  beneficiary: string
  amount: number
  balance: number
  transactionNr: string
  type: 'income' | 'expense'
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

// Configurazione Odoo da variabili ambiente
const ODOO_URL = process.env.ODOO_URL_STAGING || process.env.ODOO_URL || ''
const ODOO_DB = process.env.ODOO_DB_STAGING || process.env.ODOO_DB || ''
const ODOO_USERNAME = process.env.ODOO_USERNAME || ''
const ODOO_PASSWORD = process.env.ODOO_PASSWORD || ''

// Giornale bancario UBS (da config)
const UBS_CHF_JOURNAL_ID = 9
const UBS_EUR_JOURNAL_ID = 11

/**
 * Genera unique_import_id per evitare duplicati
 */
function generateUniqueImportId(transaction: Transaction, iban: string): string {
  // Formato: IBAN-DATE-AMOUNT-TXNR
  const dateStr = transaction.date.replace(/-/g, '')
  const amountStr = Math.abs(transaction.amount).toFixed(2).replace('.', '')
  const txNr = transaction.transactionNr || 'NOTX'

  return `${iban}-${dateStr}-${amountStr}-${txNr}`
}

/**
 * Connette a Odoo e autentica
 */
async function connectOdoo(): Promise<{ uid: number; models: any } | null> {
  return new Promise((resolve) => {
    const commonClient = xmlrpc.createSecureClient({
      host: ODOO_URL.replace(/^https?:\/\//, '').split('/')[0],
      port: 443,
      path: '/xmlrpc/2/common'
    })

    commonClient.methodCall('authenticate', [
      ODOO_DB,
      ODOO_USERNAME,
      ODOO_PASSWORD,
      {}
    ], (error, uid: number) => {
      if (error || !uid) {
        console.error('Errore autenticazione Odoo:', error)
        resolve(null)
        return
      }

      const modelsClient = xmlrpc.createSecureClient({
        host: ODOO_URL.replace(/^https?:\/\//, '').split('/')[0],
        port: 443,
        path: '/xmlrpc/2/object'
      })

      resolve({ uid, models: modelsClient })
    })
  })
}

/**
 * Crea una riga di estratto conto bancario in Odoo
 */
async function createBankStatementLine(
  models: any,
  uid: number,
  journalId: number,
  transaction: Transaction,
  uniqueImportId: string
): Promise<number | null> {
  return new Promise((resolve) => {
    const data = {
      journal_id: journalId,
      date: transaction.date,
      payment_ref: transaction.description,
      partner_name: transaction.beneficiary !== 'N/A' ? transaction.beneficiary : false,
      amount: transaction.amount,
      unique_import_id: uniqueImportId,
      ref: transaction.transactionNr || false
    }

    models.methodCall('execute_kw', [
      ODOO_DB,
      uid,
      ODOO_PASSWORD,
      'account.bank.statement.line',
      'create',
      [[data]]
    ], (error: any, id: number) => {
      if (error) {
        console.error('Errore creazione movimento:', error)
        // Se errore è per unique_import_id duplicato, ritorna 0 (saltato)
        if (error.faultString?.includes('unique_import_id')) {
          resolve(0)
          return
        }
        resolve(null)
        return
      }

      resolve(id)
    })
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { accountInfo, transactions } = body as { accountInfo: AccountInfo; transactions: Transaction[] }

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Nessuna transazione da importare'
      }, { status: 400 })
    }

    // Verifica configurazione Odoo
    if (!ODOO_URL || !ODOO_DB || !ODOO_USERNAME || !ODOO_PASSWORD) {
      return NextResponse.json({
        success: false,
        error: 'Configurazione Odoo mancante. Verifica le variabili d\'ambiente.'
      }, { status: 500 })
    }

    // Connetti a Odoo
    const odoo = await connectOdoo()
    if (!odoo) {
      return NextResponse.json({
        success: false,
        error: 'Impossibile connettersi a Odoo. Verifica credenziali.'
      }, { status: 500 })
    }

    const { uid, models } = odoo

    // Determina giornale in base a valuta
    const journalId = accountInfo.currency === 'EUR' ? UBS_EUR_JOURNAL_ID : UBS_CHF_JOURNAL_ID

    // Importa transazioni
    let imported = 0
    let skipped = 0
    let errors = 0

    for (const transaction of transactions) {
      try {
        const uniqueImportId = generateUniqueImportId(transaction, accountInfo.iban)
        const result = await createBankStatementLine(models, uid, journalId, transaction, uniqueImportId)

        if (result === null) {
          errors++
        } else if (result === 0) {
          skipped++ // Duplicato
        } else {
          imported++
        }
      } catch (error) {
        console.error('Errore importazione transazione:', error)
        errors++
      }
    }

    return NextResponse.json({
      success: true,
      total: transactions.length,
      imported,
      skipped,
      errors,
      message: `Importati ${imported} movimenti, ${skipped} duplicati saltati, ${errors} errori`
    })

  } catch (error) {
    console.error('Errore import UBS:', error)
    return NextResponse.json({
      success: false,
      error: 'Errore durante l\'importazione: ' + (error as Error).message
    }, { status: 500 })
  }
}
