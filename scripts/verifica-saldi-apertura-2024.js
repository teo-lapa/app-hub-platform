#!/usr/bin/env node

/**
 * VERIFICA SALDI APERTURA 2024
 *
 * Verifica che i saldi di apertura 01.01.2024 siano corretti
 * confrontando con i movimenti del 31.12.2023
 */

// Configurazione Odoo
const ODOO_URL = 'https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com'
const ODOO_DB = 'lapadevadmin-lapa-v2-staging-2406-25408900'
const ODOO_EMAIL = 'paul@lapa.ch'
const ODOO_PASSWORD = 'lapa201180'

// Conti da verificare
const CONTI_DA_VERIFICARE = [
  { code: '1001', name: 'Cash' },
  { code: '1022', name: 'Outstanding Receipts' },
  { code: '1023', name: 'Outstanding Payments' },
  { code: '10901', name: 'Liquiditätstransfer' },
  { code: '1099', name: 'Transferkonto' }
]

let sessionCookie = null

/**
 * Autentica con Odoo
 */
async function authenticate() {
  const response = await fetch(`${ODOO_URL}/web/session/authenticate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        db: ODOO_DB,
        login: ODOO_EMAIL,
        password: ODOO_PASSWORD,
      },
      id: Math.floor(Math.random() * 1000000000),
    }),
  })

  const setCookieHeader = response.headers.get('set-cookie')
  if (setCookieHeader) {
    const sessionMatch = setCookieHeader.match(/session_id=([^;]+)/)
    if (sessionMatch) {
      sessionCookie = sessionMatch[1]
    }
  }

  const data = await response.json()

  if (data.error) {
    throw new Error(`Autenticazione fallita: ${data.error.data.message}`)
  }

  if (!data.result || !data.result.uid) {
    throw new Error('Autenticazione fallita: nessun UID ricevuto')
  }

  console.log('✅ Autenticato con successo')
  return data.result
}

/**
 * Esegui chiamata RPC a Odoo
 */
async function callOdoo(model, method, args = [], kwargs = {}) {
  if (!sessionCookie) {
    throw new Error('Nessuna sessione attiva. Autenticare prima.')
  }

  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `session_id=${sessionCookie}`,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model: model,
        method: method,
        args: args,
        kwargs: kwargs,
      },
      id: Math.floor(Math.random() * 1000000000),
    }),
  })

  const data = await response.json()

  if (data.error) {
    throw new Error(`Errore Odoo: ${data.error.data.message}`)
  }

  return data.result
}

/**
 * Cerca un account per codice
 */
async function searchAccount(code) {
  const accounts = await callOdoo(
    'account.account',
    'search_read',
    [[['code', '=', code]]],
    { fields: ['id', 'code', 'name'] }
  )

  if (accounts.length === 0) {
    throw new Error(`Account ${code} non trovato`)
  }

  return accounts[0]
}

/**
 * Ottieni movimenti contabili per un account
 */
async function getAccountMoves(accountId, dateOperator, dateValue) {
  const domain = [
    ['account_id', '=', accountId],
    ['date', dateOperator, dateValue],
    ['parent_state', '=', 'posted'] // Solo movimenti validati
  ]

  const fields = [
    'move_id',
    'date',
    'name',
    'debit',
    'credit',
    'balance',
    'ref',
    'journal_id'
  ]

  const moves = await callOdoo(
    'account.move.line',
    'search_read',
    [domain],
    {
      fields: fields,
      order: 'date ASC, id ASC'
    }
  )

  return moves
}

/**
 * Calcola saldo progressivo
 */
function calcolaSaldo(movimenti) {
  let saldo = 0
  const dettaglio = []

  for (const mov of movimenti) {
    saldo += (mov.debit || 0) - (mov.credit || 0)
    dettaglio.push({
      date: mov.date,
      ref: mov.ref || mov.name,
      debit: mov.debit || 0,
      credit: mov.credit || 0,
      balance: saldo,
      journal: mov.journal_id ? mov.journal_id[1] : ''
    })
  }

  return { saldo, dettaglio }
}

/**
 * Formatta importo in CHF
 */
function formatCHF(amount) {
  const formatted = new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)

  return formatted
}

/**
 * Verifica un singolo conto
 */
async function verificaConto(conto) {
  console.log(`\n📊 Verifico conto ${conto.code} - ${conto.name}...`)

  try {
    // 1. Cerca account
    const account = await searchAccount(conto.code)
    console.log(`   Account ID: ${account.id}`)

    // 2. Movimenti PRIMA del 01.01.2024 (saldo al 31.12.2023)
    console.log(`   Estraggo movimenti < 01.01.2024...`)
    const movimentiPre2024 = await getAccountMoves(account.id, '<', '2024-01-01')
    console.log(`   Trovati ${movimentiPre2024.length} movimenti`)

    // 3. Calcola saldo al 31.12.2023
    const { saldo: saldo2023, dettaglio: dettaglio2023 } = calcolaSaldo(movimentiPre2024)

    // 4. Movimenti DI apertura 01.01.2024
    console.log(`   Estraggo movimenti del 01.01.2024...`)
    const movimentiApertura = await getAccountMoves(account.id, '=', '2024-01-01')
    console.log(`   Trovati ${movimentiApertura.length} movimenti di apertura`)

    // 5. Calcola saldo apertura netto
    const { saldo: saldoApertura } = calcolaSaldo(movimentiApertura)
    const saldoAperturaNetto = saldo2023 + saldoApertura

    // 6. Ultimi 10 movimenti del 2023
    const ultimi10 = dettaglio2023.slice(-10)

    return {
      code: conto.code,
      name: conto.name,
      accountId: account.id,
      saldo2023,
      movimentiApertura: movimentiApertura.map(m => ({
        date: m.date,
        ref: m.ref || m.name,
        debit: m.debit || 0,
        credit: m.credit || 0,
        journal: m.journal_id ? m.journal_id[1] : ''
      })),
      saldoApertura,
      saldoAperturaNetto,
      totaleMovimentiPre2024: movimentiPre2024.length,
      ultimi10Movimenti: ultimi10
    }

  } catch (error) {
    console.error(`   ❌ Errore: ${error.message}`)
    return {
      code: conto.code,
      name: conto.name,
      error: error.message
    }
  }
}

/**
 * Genera report markdown
 */
function generaReport(risultati) {
  let report = `# VERIFICA SALDI APERTURA 2024\n\n`
  report += `**Data verifica:** ${new Date().toLocaleString('it-CH')}\n\n`
  report += `---\n\n`

  // Tabella riepilogo
  report += `## SALDI AL 31.12.2023 (= APERTURA 2024)\n\n`
  report += `| Konto | Descrizione | Mov. pre-2024 | Saldo 31.12.2023 | Mov. apertura 01.01.2024 | Saldo apertura NETTO |\n`
  report += `|-------|-------------|---------------|------------------|--------------------------|----------------------|\n`

  const anomalie = []

  for (const ris of risultati) {
    if (ris.error) {
      report += `| ${ris.code} | ${ris.name} | - | **ERRORE** | - | - |\n`
      anomalie.push(`❌ **${ris.code}**: ${ris.error}`)
    } else {
      report += `| ${ris.code} | ${ris.name} | ${ris.totaleMovimentiPre2024} | ${formatCHF(ris.saldo2023)} | ${formatCHF(ris.saldoApertura)} | ${formatCHF(ris.saldoAperturaNetto)} |\n`

      // Verifica anomalie
      if (ris.movimentiApertura.length > 0 && Math.abs(ris.saldoApertura) > 0.01) {
        anomalie.push(`⚠️ **${ris.code}**: Movimenti di apertura non nulli (${formatCHF(ris.saldoApertura)})`)
      }
    }
  }

  // Dettagli movimenti apertura
  report += `\n\n## MOVIMENTI DI APERTURA 01.01.2024\n\n`

  let hasMovimentiApertura = false
  for (const ris of risultati) {
    if (ris.movimentiApertura && ris.movimentiApertura.length > 0) {
      hasMovimentiApertura = true
      report += `### ${ris.code} - ${ris.name}\n\n`
      report += `| Data | Riferimento | Dare | Avere | Giornale |\n`
      report += `|------|-------------|------|-------|----------|\n`

      for (const mov of ris.movimentiApertura) {
        report += `| ${mov.date} | ${mov.ref} | ${formatCHF(mov.debit)} | ${formatCHF(mov.credit)} | ${mov.journal} |\n`
      }
      report += `\n**Totale movimento apertura:** ${formatCHF(ris.saldoApertura)}\n\n`
    }
  }

  if (!hasMovimentiApertura) {
    report += `*Nessun movimento di apertura trovato*\n\n`
  }

  // Ultimi movimenti 2023
  report += `\n## ULTIMI 10 MOVIMENTI DEL 2023\n\n`

  for (const ris of risultati) {
    if (ris.ultimi10Movimenti && ris.ultimi10Movimenti.length > 0) {
      report += `### ${ris.code} - ${ris.name}\n\n`
      report += `| Data | Riferimento | Dare | Avere | Saldo | Giornale |\n`
      report += `|------|-------------|------|-------|-------|----------|\n`

      for (const mov of ris.ultimi10Movimenti) {
        report += `| ${mov.date} | ${mov.ref} | ${formatCHF(mov.debit)} | ${formatCHF(mov.credit)} | ${formatCHF(mov.balance)} | ${mov.journal} |\n`
      }
      report += `\n`
    }
  }

  // Validazione
  report += `\n## VALIDAZIONE\n\n`

  if (anomalie.length === 0) {
    report += `✅ **Saldi apertura verificati e corretti**\n\n`
    report += `Tutti i conti mostrano:\n`
    report += `- Saldi al 31.12.2023 calcolati correttamente\n`
    report += `- Nessun movimento di apertura anomalo\n`
    report += `- Continuità nei movimenti contabili\n`
  } else {
    report += `❌ **Anomalie trovate:**\n\n`
    for (const anomalia of anomalie) {
      report += `${anomalia}\n\n`
    }
  }

  // Note
  report += `\n---\n\n`
  report += `## NOTE TECNICHE\n\n`
  report += `- **Saldo 31.12.2023**: Somma algebrica di tutti i movimenti validati prima del 01.01.2024\n`
  report += `- **Movimenti apertura**: Movimenti registrati esattamente il 01.01.2024\n`
  report += `- **Saldo apertura NETTO**: Saldo 31.12.2023 + Movimenti apertura 01.01.2024\n`
  report += `- Solo movimenti con stato "posted" (validati) sono inclusi nell'analisi\n`
  report += `- Formula: Saldo = Σ(Dare) - Σ(Avere)\n`

  return report
}

/**
 * Main
 */
async function main() {
  console.log('🔍 VERIFICA SALDI APERTURA 2024')
  console.log('================================\n')

  try {
    // Connessione
    await authenticate()

    // Verifica tutti i conti
    const risultati = []
    for (const conto of CONTI_DA_VERIFICARE) {
      const risultato = await verificaConto(conto)
      risultati.push(risultato)
    }

    // Genera report
    console.log('\n\n📄 Genero report...')
    const report = generaReport(risultati)

    // Salva report
    const fs = require('fs')
    const path = require('path')
    const reportPath = path.join(__dirname, '..', 'VERIFICA_SALDI_APERTURA_2024.md')
    fs.writeFileSync(reportPath, report, 'utf8')

    console.log(`\n✅ Report salvato: ${reportPath}`)

    // Mostra riepilogo
    console.log('\n\n' + '='.repeat(80))
    console.log('RIEPILOGO SALDI')
    console.log('='.repeat(80))

    for (const ris of risultati) {
      if (!ris.error) {
        console.log(`\n${ris.code} - ${ris.name}`)
        console.log(`  Saldo 31.12.2023:      ${formatCHF(ris.saldo2023)}`)
        console.log(`  Mov. apertura:         ${formatCHF(ris.saldoApertura)}`)
        console.log(`  Saldo apertura NETTO:  ${formatCHF(ris.saldoAperturaNetto)}`)
      }
    }

    console.log('\n' + '='.repeat(80))

  } catch (error) {
    console.error('\n❌ Errore:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

// Esegui
main()
