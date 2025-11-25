import { NextRequest, NextResponse } from 'next/server';
import { getOdooClient } from '@/lib/odoo-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/odoo/journals
 * Recupera tutti i journal bancari da Odoo con i relativi IBAN
 */
export async function GET(request: NextRequest) {
  try {
    const odoo = await getOdooClient();

    // Cerca solo journal di tipo 'bank'
    const journals = await odoo.searchRead(
      'account.journal',
      [
        ['type', '=', 'bank']  // Solo journal bancari
      ],
      ['id', 'name', 'code', 'currency_id', 'bank_account_id']
    );

    if (!journals || journals.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Nessun journal bancario trovato in Odoo'
      }, { status: 404 });
    }

    // Per ogni journal, recupera l'IBAN dal bank_account_id
    const journalsWithIban = await Promise.all(
      journals.map(async (journal: any) => {
        let iban = null;
        let accountNumber = null;

        // Se il journal ha un bank_account_id, recupera l'IBAN
        if (journal.bank_account_id && Array.isArray(journal.bank_account_id)) {
          const bankAccountId = journal.bank_account_id[0];

          try {
            const bankAccounts = await odoo.searchRead(
              'res.partner.bank',
              [['id', '=', bankAccountId]],
              ['acc_number', 'sanitized_acc_number']
            );

            if (bankAccounts && bankAccounts.length > 0) {
              iban = bankAccounts[0].sanitized_acc_number || bankAccounts[0].acc_number;
              accountNumber = bankAccounts[0].acc_number;
            }
          } catch (error) {
            console.error(`Errore recupero IBAN per journal ${journal.id}:`, error);
          }
        }

        // Estrai nome valuta da currency_id
        const currency = Array.isArray(journal.currency_id)
          ? journal.currency_id[1].split(' ')[0]  // Es: "CHF" da "CHF Swiss Franc"
          : 'CHF';  // Default

        return {
          id: journal.id,
          name: journal.name,
          code: journal.code,
          currency: currency,
          iban: iban,
          accountNumber: accountNumber
        };
      })
    );

    return NextResponse.json({
      success: true,
      journals: journalsWithIban,
      count: journalsWithIban.length
    });

  } catch (error: any) {
    console.error('❌ Errore recupero journals da Odoo:', error);

    return NextResponse.json({
      success: false,
      error: error.message || 'Errore durante il recupero dei journal',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
