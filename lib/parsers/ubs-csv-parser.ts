/**
 * UBS Bank Statement CSV Parser
 *
 * Parses UBS Switzerland bank statements in CSV format.
 * Handles multi-line transactions and various transaction types.
 *
 * Format:
 * - Header: Account info (lines 1-9)
 * - Column headers (line 10)
 * - Transactions (line 11+): Some transactions span multiple lines
 */

import * as fs from 'fs';
import * as path from 'path';
import * as csv from 'csv-parse/sync';

export interface UBSAccountInfo {
  accountNumber: string;
  iban: string;
  dateFrom: Date;
  dateTo: Date;
  openingBalance: number;
  closingBalance: number;
  currency: string;
  transactionCount: number;
}

export interface UBSTransaction {
  settlementDate: Date | null; // Abschlussdatum
  settlementTime: string | null; // Abschlusszeit
  bookingDate: Date | null; // Buchungsdatum
  valueDate: Date | null; // Valutadatum
  currency: string;
  debit: number; // Belastung (negative)
  credit: number; // Gutschrift (positive)
  singleAmount: number; // Einzelbetrag
  balance: number; // Saldo
  transactionNumber: string;
  description1: string;
  description2: string;
  description3: string;
  footnotes: string;

  // Computed fields
  amount: number; // credit - debit
  partner: string; // extracted from descriptions
  reference: string; // extracted from descriptions
}

export interface UBSStatement {
  accountInfo: UBSAccountInfo;
  transactions: UBSTransaction[];
  fileName: string;
}

/**
 * Parse UBS date format: DD/MM/YYYY
 */
function parseUBSDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim() === '') return null;

  const [day, month, year] = dateStr.split('/').map(Number);
  if (!day || !month || !year) return null;

  return new Date(year, month - 1, day);
}

/**
 * Parse UBS number format: 123456.78 or 123'456.78
 */
function parseUBSNumber(numStr: string): number {
  if (!numStr || numStr.trim() === '') return 0;

  // Remove thousand separators (apostrophes or spaces)
  const cleaned = numStr.replace(/['\s]/g, '');
  const num = parseFloat(cleaned);

  return isNaN(num) ? 0 : num;
}

/**
 * Extract partner name from description fields
 */
function extractPartner(desc1: string, desc2: string, desc3: string): string {
  // Priority: desc1 usually contains partner name
  if (desc1 && desc1.trim() !== '') {
    // Remove common prefixes
    const cleaned = desc1
      .replace(/^(e-banking-Vergütungsauftrag|e-banking-Sammelauftrag|Gutschrift)/i, '')
      .trim();

    // Extract name before semicolon or comma
    const match = cleaned.match(/^([^;,]+)/);
    return match ? match[1].trim() : cleaned;
  }

  return '';
}

/**
 * Extract payment reference from description fields
 */
function extractReference(desc1: string, desc2: string, desc3: string): string {
  const combined = `${desc2} ${desc3}`;

  // Look for reference patterns
  const patterns = [
    /Zahlungsgrund:\s*([^;]+)/i,
    /Referenz-Nr\.\s*QRR:\s*([^;]+)/i,
    /Ordine\s+([^;]+)/i,
    /Transaktions-Nr\.\s*([^;]+)/i
  ];

  for (const pattern of patterns) {
    const match = combined.match(pattern);
    if (match) return match[1].trim();
  }

  return '';
}

/**
 * Parse UBS CSV file
 */
export function parseUBSCSV(filePath: string): UBSStatement {
  const fileName = path.basename(filePath);
  const content = fs.readFileSync(filePath, { encoding: 'utf-8' });

  // Split into lines
  const lines = content.split('\n');

  // Parse header (lines 1-9)
  const accountInfo = parseAccountInfo(lines);

  // Find data start (line 10 is headers, data starts at line 11)
  const dataStartIndex = 10; // 0-indexed, so line 11

  // Parse transactions
  const transactions = parseTransactions(lines.slice(dataStartIndex), accountInfo.currency);

  return {
    accountInfo,
    transactions,
    fileName
  };
}

/**
 * Parse account info from header lines
 */
function parseAccountInfo(lines: string[]): UBSAccountInfo {
  const getField = (lineIndex: number): string => {
    const parts = lines[lineIndex].split(';');
    return parts[1] || '';
  };

  return {
    accountNumber: getField(0).trim(),
    iban: getField(1).trim(),
    dateFrom: parseUBSDate(getField(2)) || new Date(),
    dateTo: parseUBSDate(getField(3)) || new Date(),
    openingBalance: parseUBSNumber(getField(4)),
    closingBalance: parseUBSNumber(getField(5)),
    currency: getField(6).trim(),
    transactionCount: parseInt(getField(7)) || 0
  };
}

/**
 * Parse transactions, handling multi-line entries
 */
function parseTransactions(lines: string[], currency: string): UBSTransaction[] {
  const transactions: UBSTransaction[] = [];
  let currentTransaction: Partial<UBSTransaction> | null = null;

  for (const line of lines) {
    if (!line || line.trim() === '') continue;

    const fields = line.split(';');

    // Check if this is a main transaction line (has settlement date or booking date)
    const hasSettlementDate = fields[0] && fields[0].trim() !== '';
    const hasBookingDate = fields[2] && fields[2].trim() !== '';

    if (hasSettlementDate || hasBookingDate) {
      // Save previous transaction if exists
      if (currentTransaction && currentTransaction.transactionNumber) {
        transactions.push(finalizeTransaction(currentTransaction, currency));
      }

      // Start new transaction
      // Note: Belastung (debit) is already negative in CSV, Gutschrift (credit) is positive
      const debit = parseUBSNumber(fields[5]); // Already negative
      const credit = parseUBSNumber(fields[6]); // Positive

      currentTransaction = {
        settlementDate: parseUBSDate(fields[0]),
        settlementTime: fields[1]?.trim() || null,
        bookingDate: parseUBSDate(fields[2]),
        valueDate: parseUBSDate(fields[3]),
        currency: fields[4]?.trim() || currency,
        debit: debit,
        credit: credit,
        singleAmount: parseUBSNumber(fields[7]),
        balance: parseUBSNumber(fields[8]),
        transactionNumber: fields[9]?.trim() || '',
        description1: fields[10]?.trim() || '',
        description2: fields[11]?.trim() || '',
        description3: fields[12]?.trim() || '',
        footnotes: fields[13]?.trim() || ''
      };
    } else if (currentTransaction) {
      // This is a continuation line for the current transaction
      // These lines contain additional sub-items (e.g., salary payments in a batch)

      // For multi-line transactions, we can either:
      // 1. Append to description
      // 2. Create separate sub-transactions

      // For now, append to description
      const additionalDesc = fields.slice(4).filter(f => f && f.trim() !== '').join(' | ');

      if (additionalDesc) {
        currentTransaction.description3 =
          (currentTransaction.description3 || '') + ' || ' + additionalDesc;
      }
    }
  }

  // Save last transaction
  if (currentTransaction && currentTransaction.transactionNumber) {
    transactions.push(finalizeTransaction(currentTransaction, currency));
  }

  return transactions;
}

/**
 * Finalize transaction: compute amount, extract partner/reference
 */
function finalizeTransaction(
  tx: Partial<UBSTransaction>,
  currency: string
): UBSTransaction {
  const credit = tx.credit || 0;
  const debit = tx.debit || 0; // Already negative in CSV
  const amount = credit || debit; // Use whichever is non-zero

  const desc1 = tx.description1 || '';
  const desc2 = tx.description2 || '';
  const desc3 = tx.description3 || '';

  return {
    settlementDate: tx.settlementDate || null,
    settlementTime: tx.settlementTime || null,
    bookingDate: tx.bookingDate || null,
    valueDate: tx.valueDate || null,
    currency: tx.currency || currency,
    debit: debit,
    credit: credit,
    singleAmount: tx.singleAmount || 0,
    balance: tx.balance || 0,
    transactionNumber: tx.transactionNumber || '',
    description1: desc1,
    description2: desc2,
    description3: desc3,
    footnotes: tx.footnotes || '',
    amount,
    partner: extractPartner(desc1, desc2, desc3),
    reference: extractReference(desc1, desc2, desc3)
  };
}

/**
 * Parse all UBS CSV files in a directory
 */
export function parseUBSDirectory(dirPath: string): UBSStatement[] {
  const files = fs.readdirSync(dirPath)
    .filter(f => f.endsWith('.csv'))
    .map(f => path.join(dirPath, f));

  return files.map(parseUBSCSV);
}

/**
 * Validate statement: check if closing balance matches
 */
export function validateStatement(statement: UBSStatement): {
  valid: boolean;
  expectedBalance: number;
  actualBalance: number;
  difference: number;
} {
  const { openingBalance, closingBalance } = statement.accountInfo;

  // Calculate expected balance from transactions
  const totalChange = statement.transactions.reduce(
    (sum, tx) => sum + tx.amount,
    0
  );

  const expectedBalance = openingBalance + totalChange;
  const difference = closingBalance - expectedBalance;

  // Allow 0.01 difference for rounding
  const valid = Math.abs(difference) < 0.01;

  return {
    valid,
    expectedBalance,
    actualBalance: closingBalance,
    difference
  };
}

/**
 * Get summary statistics for a statement
 */
export function getStatementSummary(statement: UBSStatement) {
  const { transactions } = statement;

  const totalCredits = transactions
    .filter(tx => tx.amount > 0)
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalDebits = transactions
    .filter(tx => tx.amount < 0)
    .reduce((sum, tx) => sum + tx.amount, 0);

  return {
    transactionCount: transactions.length,
    totalCredits: parseFloat(totalCredits.toFixed(2)),
    totalDebits: parseFloat(totalDebits.toFixed(2)),
    netChange: parseFloat((totalCredits + totalDebits).toFixed(2)),
    openingBalance: statement.accountInfo.openingBalance,
    closingBalance: statement.accountInfo.closingBalance,
    currency: statement.accountInfo.currency,
    period: {
      from: statement.accountInfo.dateFrom,
      to: statement.accountInfo.dateTo
    }
  };
}
