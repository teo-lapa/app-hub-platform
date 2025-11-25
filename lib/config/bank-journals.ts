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
    accountNumber: '0278 00122087.01',
    description: 'Conto corrente UBS in franchi svizzeri'
  },
  {
    iban: 'CH25 0027 8278 1220 8760 A',
    journalId: 11,
    journalName: 'UBS EUR 08760A',
    journalCode: 'BNK2',
    currency: 'EUR',
    accountNumber: '0278 00122087.60',
    description: 'Conto corrente UBS in euro'
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
export function findJournalByAccountNumber(accountNumber: string): BankJournalConfig | undefined {
  if (!accountNumber) return undefined;

  return BANK_JOURNALS.find(j => j.accountNumber === accountNumber);
}

// Helper per ottenere journal predefinito basato su valuta
export function getDefaultJournal(currency: 'CHF' | 'EUR'): BankJournalConfig {
  return BANK_JOURNALS.find(j => j.currency === currency) || BANK_JOURNALS[0];
}

// Helper per tutti i journal disponibili
export function getAllJournals(): BankJournalConfig[] {
  return BANK_JOURNALS;
}
