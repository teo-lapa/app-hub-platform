// Configuration for Bank Journals mapping IBAN → Odoo Journal

export interface BankJournalConfig {
  iban?: string; // Opzionale per supportare Credit Suisse senza IBAN
  journalId: number;
  journalName: string;
  journalCode: string;
  currency: 'CHF' | 'EUR';
  accountNumber?: string;
  description: string;
}

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

// Helper per trovare journal da IBAN
export function findJournalByIban(iban: string): BankJournalConfig | undefined {
  if (!iban) return undefined;

  // Normalizza IBAN (rimuovi spazi)
  const normalizedIban = iban.replace(/\s/g, '');
  const found = BANK_JOURNALS.find(j => j.iban?.replace(/\s/g, '') === normalizedIban);

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
