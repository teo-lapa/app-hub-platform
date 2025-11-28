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

// Configurazione statica con solo i registri principali per import file banca
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
    iban: 'CH25 0027 8278 1220 8760 A',
    journalId: 11,
    journalName: 'UBS EUR 08760A',
    journalCode: 'BNK2',
    currency: 'EUR',
    accountNumber: 'CH25 0027 8278 1220 8760 A',
    description: 'UBS EUR 08760A'
  },
  {
    iban: 'CH62 0483 5397 7497 5100 0',
    journalId: 12,
    journalName: 'Credit Suisse SA 751000',
    journalCode: 'BNK3',
    currency: 'CHF',
    accountNumber: 'CH62 0483 5397 7497 5100 0',
    description: 'Credit Suisse SA 751000'
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
    iban: '4857458008028280',
    journalId: 20,
    journalName: 'CARTA CREDITO UBS EUR',
    journalCode: 'BNK10',
    currency: 'EUR',
    accountNumber: '4857458008028280',
    description: 'CARTA CREDITO UBS EUR (Laura)'
  },
  {
    iban: '4857520004000280',
    journalId: 21,
    journalName: 'CARTA CREDITO UBS CHF',
    journalCode: 'BNK11',
    currency: 'CHF',
    accountNumber: '4857520004000280',
    description: 'CARTA CREDITO UBS CHF (Laura)'
  },
  {
    journalId: 57,
    journalName: 'CARTA CREDITO UBS USD',
    journalCode: 'BNK16',
    currency: 'USD',
    description: 'CARTA CREDITO UBS USD'
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
