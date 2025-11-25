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

    // Carica TUTTI i journal e poi filtra manualmente
    const allJournals = await odoo.searchRead(
      'account.journal',
      [],  // Nessun filtro
      ['id', 'name', 'code', 'currency_id', 'bank_account_id', 'type']
    );

    // Filtra solo quelli di tipo bank o cash
    const journals = allJournals.filter((j: any) =>
      j.type === 'bank' || j.type === 'cash'
    );

    console.log(`✅ Recuperati ${journals.length} journals (bank o cash) da Odoo`);

    if (!journals || journals.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Nessun journal bancario trovato in Odoo'
      }, { status: 404 });
    }

    // Batch query ottimizzata: recupera tutti gli IBAN in UNA sola chiamata
    // 1. Raccogli tutti i bank_account_id
    const bankAccountIds = journals
      .filter((j: any) => j.bank_account_id && Array.isArray(j.bank_account_id))
      .map((j: any) => j.bank_account_id[0]);

    // 2. UNA sola chiamata per tutti gli IBAN (invece di N chiamate)
    let ibanMap = new Map<number, { iban: string | null; accountNumber: string | null }>();

    if (bankAccountIds.length > 0) {
      try {
        const bankAccounts = await odoo.searchRead(
          'res.partner.bank',
          [['id', 'in', bankAccountIds]],
          ['id', 'acc_number', 'sanitized_acc_number']
        );

        // 3. Crea mappa ID -> IBAN per lookup veloce
        ibanMap = new Map(
          bankAccounts.map((ba: any) => [
            ba.id,
            {
              iban: ba.sanitized_acc_number || ba.acc_number,
              accountNumber: ba.acc_number
            }
          ])
        );
      } catch (error) {
        console.error('Errore recupero IBAN batch:', error);
      }
    }

    // 4. Mappa journals con IBAN usando la mappa pre-costruita
    const journalsWithIban = journals.map((journal: any) => {
      const bankAccountId = journal.bank_account_id?.[0];
      const bankInfo = bankAccountId ? ibanMap.get(bankAccountId) : null;

      // Estrai nome valuta da currency_id
      const currency = Array.isArray(journal.currency_id)
        ? journal.currency_id[1].split(' ')[0]  // Es: "CHF" da "CHF Swiss Franc"
        : 'CHF';  // Default

      return {
        id: journal.id,
        name: journal.name,
        code: journal.code,
        currency: currency,
        iban: bankInfo?.iban || null,
        accountNumber: bankInfo?.accountNumber || null,
        type: journal.type  // Aggiunto per debugging
      };
    });

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
