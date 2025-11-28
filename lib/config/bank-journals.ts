// Configuration for Bank Journals mapping IBAN → Odoo Journal

export interface BankJournalConfig {
  iban?: string; // Opzionale per supportare Credit Suisse senza IBAN
  journalId: number;
  journalName: string;
  journalCode: string;
  currency: string; // Cambiato da 'CHF' | 'EUR' a string per supportare tutte le valute
  accountNumber?: string;
  description?: string; // Opzionale
}

// DEPRECATED: Configurazione statica mantenuta per retrocompatibilità
// Usare fetchJournalsFromOdoo() per ottenere i journal dinamicamente
export const BANK_JOURNALS: BankJournalConfig[] = [
  {
    iban: 'CH02 0027 8278 1220 8701 J',
    journalId: 9,
    journalName: 'UBS CHF 701J',
    journalCode: 'BNK1',
    currency: 'CHF',
    accountNumber: 'CH02 0027 8278 1220 8701 J',
    description: 'UBS CHF 701J'
  },
  {
    iban: 'CH66 0027 8278 1335 5760 Q',
    journalId: 53,
    journalName: 'Bank',
    journalCode: 'BNK1',
    currency: 'EUR',
    accountNumber: 'CH66 0027 8278 1335 5760 Q',
    description: 'Bank'
  },
  {
    iban: '4857458008028280',
    journalId: 20,
    journalName: '5565 CARTA CREDITO EUR LAURA',
    journalCode: 'BNK10',
    currency: 'EUR',
    accountNumber: '4857458008028280',
    description: '5565 CARTA CREDITO EUR LAURA'
  },
  {
    iban: '4857520004000280',
    journalId: 21,
    journalName: '0280 CARTA CREDITO CHF LAURA',
    journalCode: 'BNK11',
    currency: 'CHF',
    accountNumber: '4857520004000280',
    description: '0280 CARTA CREDITO CHF LAURA'
  },
  {
    iban: '4857520008435367',
    journalId: 22,
    journalName: 'CARTA CREDITO UBS CHF NON USO',
    journalCode: 'BNK12',
    currency: 'CHF',
    accountNumber: '4857520008435367',
    description: 'CARTA CREDITO UBS CHF NON USO'
  },
  {
    iban: '4857458006360063',
    journalId: 23,
    journalName: '0063 CARTA CREDITO EUR PAUL',
    journalCode: 'BNK13',
    currency: 'EUR',
    accountNumber: '4857458006360063',
    description: '0063 CARTA CREDITO EUR PAUL'
  },
  {
    journalId: 57,
    journalName: 'CARTA CREDITO UBS USD',
    journalCode: 'BNK16',
    currency: 'USD',
    description: 'CARTA CREDITO UBS USD'
  },
  {
    journalId: 60,
    journalName: '1112 CARTA DEBITO CHF AUTISTI',
    journalCode: 'BNK17',
    currency: 'CHF',
    description: '1112 CARTA DEBITO CHF AUTISTI'
  },
  {
    iban: 'IT29 T360 9201 6005 6732 6415 137',
    journalId: 55,
    journalName: 'QONTO Itaempire Italia EUR',
    journalCode: 'BNK2',
    currency: 'CHF',
    accountNumber: 'IT29 T360 9201 6005 6732 6415 137',
    description: 'QONTO Itaempire Italia EUR'
  },
  {
    iban: 'CH25 0027 8278 1220 8760 A',
    journalId: 11,
    journalName: 'UBS EUR 08760A',
    journalCode: 'BNK2',
    currency: 'EUR',
    accountNumber: 'CH25 0027 8278 1220 8760 A',
    description: 'UBS EUR 08760A'
  },
  {
    iban: 'IT29 T360 9201 6005 6732 6415 137',
    journalId: 62,
    journalName: 'IT29T3609201600567326415137',
    journalCode: 'BNK3',
    currency: 'CHF',
    accountNumber: 'IT29 T360 9201 6005 6732 6415 137',
    description: 'IT29T3609201600567326415137'
  },
  {
    iban: 'CH62 0483 5397 7497 5100 0',
    journalId: 12,
    journalName: 'Credit Suisse SA 751000',
    journalCode: 'BNK3',
    currency: 'CHF',
    accountNumber: 'CH62 0483 5397 7497 5100 0',
    description: 'Credit Suisse SA 751000(da mettere tag extra)'
  },
  {
    iban: 'CH35 0483 5397 7497 5100 1',
    journalId: 13,
    journalName: 'Credit Suisse 0.1 751001',
    journalCode: 'BNK4',
    currency: 'CHF',
    accountNumber: 'CH35 0483 5397 7497 5100 1',
    description: 'Credit Suisse 0.1 751001'
  },
  {
    iban: 'IT29 T360 9201 6005 6732 6415 137',
    journalId: 63,
    journalName: 'IT29T3609201600567326415137',
    journalCode: 'BNK4',
    currency: 'CHF',
    accountNumber: 'IT29 T360 9201 6005 6732 6415 137',
    description: 'IT29T3609201600567326415137'
  },
  {
    iban: '5574880670518596',
    journalId: 14,
    journalName: '8596 CARTA DEBITO CHF AUTISTI',
    journalCode: 'BNK5',
    currency: 'CHF',
    accountNumber: '5574880670518596',
    description: '8596 CARTA DEBITO CHF AUTISTI'
  },
  {
    iban: '5574880030845820',
    journalId: 15,
    journalName: '5820 CARTA DEBITO CHF AUTISTI',
    journalCode: 'BNK6',
    currency: 'CHF',
    accountNumber: '5574880030845820',
    description: '5820 CARTA DEBITO CHF AUTISTI'
  },
  {
    iban: '5574880760282152',
    journalId: 16,
    journalName: '2152 CARTA DEBITO CHF AUTISTI',
    journalCode: 'BNK7',
    currency: 'CHF',
    accountNumber: '5574880760282152',
    description: '2152 CARTA DEBITO CHF AUTISTI'
  },
  {
    iban: '5574880378030084',
    journalId: 17,
    journalName: '0084 CARTA DEBITO CHF AUTISTI',
    journalCode: 'BNK8',
    currency: 'CHF',
    accountNumber: '5574880378030084',
    description: '0084 CARTA DEBITO CHF AUTISTI'
  },
  {
    iban: '5574880557241312',
    journalId: 19,
    journalName: '1312 CARTA DEBITO CHF AUTISTI',
    journalCode: 'BNK9',
    currency: 'CHF',
    accountNumber: '5574880557241312',
    description: '1312 CARTA DEBITO CHF AUTISTI'
  },
  {
    iban: '557488xxxxxx3587',
    journalId: 6,
    journalName: '3587 CARTA DEBITO CHF VENDITORE(COSIMO)',
    journalCode: 'BNKS',
    currency: 'CHF',
    accountNumber: '557488xxxxxx3587',
    description: '3587 CARTA DEBITO CHF VENDITORE(COSIMO)'
  },
  {
    iban: '5574880747101475',
    journalId: 27,
    journalName: '1475 CARTA DEBITO CHF VENDITORE (MARCO)',
    journalCode: 'BNKS1',
    currency: 'CHF',
    accountNumber: '5574880747101475',
    description: '1475 CARTA DEBITO CHF VENDITORE (MARCO)'
  },
  {
    journalId: 59,
    journalName: '4338 CARTA DEBITO CHF VENDITORE (ALESSANDRO)',
    journalCode: 'BNKS2',
    currency: 'CHF',
    description: '4338 CARTA DEBITO CHF VENDITORE (ALESSANDRO)'
  },
  {
    journalId: 26,
    journalName: 'CARBONARIUM PAYMENT',
    journalCode: 'CARBP',
    currency: 'CHF',
    description: 'CARBONARIUM PAYMENT'
  },
  {
    journalId: 54,
    journalName: 'Salaries',
    journalCode: 'SLR',
    currency: 'CHF',
    description: 'Salaries'
  }
];

/**
 * Recupera i journal bancari dinamicamente da Odoo
 * @returns Promise<BankJournalConfig[]>
 */
export async function fetchJournalsFromOdoo(): Promise<BankJournalConfig[]> {
  try {
    const response = await fetch('/api/odoo/journals', {
      method: 'GET',
      credentials: 'include' // Importante per inviare i cookies
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    const data = await response.json();

    if (!data.success || !data.journals) {
      throw new Error(data.error || 'Nessun journal ricevuto');
    }

    // Trasforma i dati dall'API in BankJournalConfig
    return data.journals.map((journal: any) => ({
      iban: journal.iban || undefined,
      journalId: journal.id,
      journalName: journal.name,
      journalCode: journal.code,
      currency: journal.currency,
      description: journal.iban ? `${journal.name} - ${journal.iban}` : journal.name
    }));

  } catch (error: any) {
    console.error('❌ Errore recupero journals da Odoo:', error);
    // Fallback alla configurazione statica in caso di errore
    console.warn('⚠️ Uso configurazione statica di fallback');
    return BANK_JOURNALS;
  }
}

// Helper per trovare journal da IBAN
export function findJournalByIban(
  iban: string,
  journals?: BankJournalConfig[]
): BankJournalConfig | undefined {
  if (!iban) return undefined;

  // Usa journals passati come parametro o fallback a BANK_JOURNALS statico
  const journalsToSearch = journals || BANK_JOURNALS;

  // Normalizza IBAN (rimuovi spazi)
  const normalizedIban = iban.replace(/\s/g, '');
  const found = journalsToSearch.find(j => j.iban?.replace(/\s/g, '') === normalizedIban);

  if (!found) {
    console.warn(`⚠️ IBAN non riconosciuto: ${iban}`);
  }

  return found;
}

// Helper per trovare journal da numero conto (per Credit Suisse)
export function findJournalByAccountNumber(
  accountNumber: string,
  journals?: BankJournalConfig[]
): BankJournalConfig | undefined {
  if (!accountNumber) return undefined;

  // Usa journals passati come parametro o fallback a BANK_JOURNALS statico
  const journalsToSearch = journals || BANK_JOURNALS;

  return journalsToSearch.find(j => j.accountNumber === accountNumber);
}

// Helper per ottenere journal predefinito basato su valuta
export function getDefaultJournal(currency: 'CHF' | 'EUR'): BankJournalConfig {
  return BANK_JOURNALS.find(j => j.currency === currency) || BANK_JOURNALS[0];
}

// Helper per tutti i journal disponibili
export function getAllJournals(): BankJournalConfig[] {
  return BANK_JOURNALS;
}
