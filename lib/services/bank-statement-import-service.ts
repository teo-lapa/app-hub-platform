/**
 * Bank Statement Import Service
 *
 * Orchestrates the import of bank statements from various formats into Odoo.
 * Handles validation, deduplication, and balance verification.
 */

import { OdooBankStatementClient, CreateStatementInput } from '../odoo/bank-statement-client';
import { parseUBSCSV, UBSStatement, validateStatement } from '../parsers/ubs-csv-parser';
import * as fs from 'fs';
import * as path from 'path';

export interface ImportConfig {
  odooUrl: string;
  odooDb: string;
  odooUsername: string;
  odooPassword: string;
}

export interface JournalMapping {
  ubsCode: string; // e.g., "UBS CHF", "UBS EUR"
  odooJournalCode: string; // e.g., "UBSCH", "UBEUR"
  currency: string;
  targetBalance?: number; // Expected final balance for validation
}

export interface ImportResult {
  success: boolean;
  statementId?: number;
  fileName: string;
  journalName: string;
  transactionsImported: number;
  balanceStart: number;
  balanceEnd: number;
  computedBalance: number;
  balanceMatches: boolean;
  errors: string[];
  warnings: string[];
}

export interface ImportSummary {
  totalFiles: number;
  successCount: number;
  failureCount: number;
  totalTransactions: number;
  results: ImportResult[];
  balanceVerification: {
    journal: string;
    currency: string;
    expectedBalance: number;
    actualBalance: number;
    matches: boolean;
  }[];
}

export class BankStatementImportService {
  private client: OdooBankStatementClient;
  private config: ImportConfig;

  constructor(config: ImportConfig) {
    this.config = config;
    this.client = new OdooBankStatementClient({
      url: config.odooUrl,
      db: config.odooDb,
      username: config.odooUsername,
      password: config.odooPassword
    });
  }

  /**
   * Connect to Odoo
   */
  async connect(): Promise<void> {
    await this.client.connect();
  }

  /**
   * Import a single UBS CSV file
   */
  async importUBSFile(
    filePath: string,
    journalCode: string,
    options: {
      skipIfExists?: boolean;
      validateBalance?: boolean;
    } = {}
  ): Promise<ImportResult> {
    const fileName = path.basename(filePath);
    const result: ImportResult = {
      success: false,
      fileName,
      journalName: journalCode,
      transactionsImported: 0,
      balanceStart: 0,
      balanceEnd: 0,
      computedBalance: 0,
      balanceMatches: false,
      errors: [],
      warnings: []
    };

    try {
      // 1. Parse CSV
      console.log(`Parsing ${fileName}...`);
      const statement = parseUBSCSV(filePath);

      result.balanceStart = statement.accountInfo.openingBalance;
      result.balanceEnd = statement.accountInfo.closingBalance;

      // 2. Validate statement
      const validation = validateStatement(statement);
      if (!validation.valid) {
        result.warnings.push(
          `Balance mismatch: expected ${validation.expectedBalance.toFixed(2)}, ` +
          `actual ${validation.actualBalance.toFixed(2)}, ` +
          `difference ${validation.difference.toFixed(2)}`
        );
      }

      result.computedBalance = validation.expectedBalance;
      result.balanceMatches = validation.valid;

      // 3. Find journal
      const journal = await this.client.findJournal(journalCode);
      if (!journal) {
        result.errors.push(`Journal "${journalCode}" not found in Odoo`);
        return result;
      }

      result.journalName = journal.name;

      // 4. Generate statement name
      const statementName = this.generateStatementName(statement, fileName);

      // 5. Check if already exists
      const existing = await this.client.findStatement(journal.id, statementName);
      if (existing) {
        if (options.skipIfExists) {
          result.warnings.push(`Statement "${statementName}" already exists (ID: ${existing.id})`);
          result.success = true;
          return result;
        } else {
          result.errors.push(
            `Statement "${statementName}" already exists (ID: ${existing.id}). ` +
            `Delete it first or use skipIfExists option.`
          );
          return result;
        }
      }

      // 6. Convert to Odoo format
      const input = this.convertUBSToOdoo(statement, journal.id, statementName);

      // 7. Import to Odoo
      console.log(`Importing ${input.lines.length} transactions to Odoo...`);
      const importResult = await this.client.importStatement(input);

      result.statementId = importResult.statementId;
      result.transactionsImported = importResult.linesCreated;
      result.balanceMatches = importResult.balanceMatches;
      result.success = true;

      if (!importResult.balanceMatches) {
        result.warnings.push(
          `Odoo computed balance ${importResult.computedBalance.toFixed(2)} ` +
          `does not match expected ${importResult.expectedBalance.toFixed(2)}`
        );
      }

      console.log(`✓ Statement ${statementName} imported successfully (ID: ${importResult.statementId})`);

    } catch (error) {
      result.errors.push(`Import failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return result;
  }

  /**
   * Import multiple UBS files from a directory
   */
  async importUBSDirectory(
    dirPath: string,
    journalCode: string,
    options: {
      skipIfExists?: boolean;
      validateBalance?: boolean;
      pattern?: string; // e.g., "*.csv" or "Q1*.csv"
    } = {}
  ): Promise<ImportSummary> {
    const pattern = options.pattern || '*.csv';
    const files = fs.readdirSync(dirPath)
      .filter(f => this.matchPattern(f, pattern))
      .map(f => path.join(dirPath, f))
      .sort(); // Import in alphabetical order

    console.log(`Found ${files.length} files matching pattern "${pattern}"`);

    const results: ImportResult[] = [];

    for (const file of files) {
      const result = await this.importUBSFile(file, journalCode, options);
      results.push(result);
    }

    const successCount = results.filter(r => r.success).length;
    const totalTransactions = results.reduce((sum, r) => sum + r.transactionsImported, 0);

    return {
      totalFiles: files.length,
      successCount,
      failureCount: files.length - successCount,
      totalTransactions,
      results,
      balanceVerification: []
    };
  }

  /**
   * Import all 2024 bank statements
   */
  async importAll2024(
    baseDir: string,
    mappings: JournalMapping[]
  ): Promise<ImportSummary> {
    const allResults: ImportResult[] = [];

    for (const mapping of mappings) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Importing ${mapping.ubsCode} (${mapping.currency})`);
      console.log('='.repeat(60));

      const dirPath = path.join(baseDir, mapping.ubsCode);

      if (!fs.existsSync(dirPath)) {
        console.warn(`Directory not found: ${dirPath}`);
        continue;
      }

      const summary = await this.importUBSDirectory(
        dirPath,
        mapping.odooJournalCode,
        { skipIfExists: true }
      );

      allResults.push(...summary.results);
    }

    const successCount = allResults.filter(r => r.success).length;
    const totalTransactions = allResults.reduce((sum, r) => sum + r.transactionsImported, 0);

    // Verify final balances
    const balanceVerification = await this.verifyBalances(mappings);

    return {
      totalFiles: allResults.length,
      successCount,
      failureCount: allResults.length - successCount,
      totalTransactions,
      results: allResults,
      balanceVerification
    };
  }

  /**
   * Verify final balances match expected
   */
  async verifyBalances(
    mappings: JournalMapping[]
  ): Promise<ImportSummary['balanceVerification']> {
    const verifications: ImportSummary['balanceVerification'] = [];

    for (const mapping of mappings) {
      if (!mapping.targetBalance) continue;

      const journal = await this.client.findJournal(mapping.odooJournalCode);
      if (!journal) {
        console.warn(`Journal ${mapping.odooJournalCode} not found`);
        continue;
      }

      const actualBalance = await this.client.getJournalBalance(journal.id);
      const matches = Math.abs(actualBalance - mapping.targetBalance) < 0.01;

      verifications.push({
        journal: mapping.odooJournalCode,
        currency: mapping.currency,
        expectedBalance: mapping.targetBalance,
        actualBalance,
        matches
      });

      console.log(
        `\n${mapping.ubsCode} (${mapping.currency}): ` +
        `Expected ${mapping.targetBalance.toFixed(2)}, ` +
        `Actual ${actualBalance.toFixed(2)} ` +
        `${matches ? '✓' : '✗ MISMATCH'}`
      );
    }

    return verifications;
  }

  /**
   * Generate statement name from UBS data
   */
  private generateStatementName(statement: UBSStatement, fileName: string): string {
    const { dateFrom, dateTo, currency } = statement.accountInfo;

    const formatDate = (date: Date) => {
      const d = date.getDate().toString().padStart(2, '0');
      const m = (date.getMonth() + 1).toString().padStart(2, '0');
      const y = date.getFullYear();
      return `${d}.${m}.${y}`;
    };

    return `UBS ${currency} ${formatDate(dateFrom)} - ${formatDate(dateTo)}`;
  }

  /**
   * Convert UBS statement to Odoo format
   */
  private convertUBSToOdoo(
    statement: UBSStatement,
    journalId: number,
    statementName: string
  ): CreateStatementInput {
    return {
      journalId,
      name: statementName,
      date: this.formatDate(statement.accountInfo.dateTo),
      balanceStart: statement.accountInfo.openingBalance,
      balanceEnd: statement.accountInfo.closingBalance,
      lines: statement.transactions.map((tx, index) => ({
        date: this.formatDate(tx.valueDate || tx.bookingDate || statement.accountInfo.dateTo),
        paymentRef: this.buildPaymentRef(tx),
        partnerName: tx.partner || undefined,
        amount: tx.amount,
        sequence: index + 1,
        reference: tx.reference || tx.transactionNumber
      }))
    };
  }

  /**
   * Build payment reference from transaction
   */
  private buildPaymentRef(tx: any): string {
    const parts: string[] = [];

    if (tx.description1) parts.push(tx.description1);
    if (tx.description2) parts.push(tx.description2);

    let ref = parts.join(' - ');

    // Truncate if too long (Odoo field limit)
    if (ref.length > 200) {
      ref = ref.substring(0, 197) + '...';
    }

    return ref || 'Unknown transaction';
  }

  /**
   * Format date for Odoo (YYYY-MM-DD)
   */
  private formatDate(date: Date | null): string {
    if (!date) return new Date().toISOString().split('T')[0];

    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');

    return `${y}-${m}-${d}`;
  }

  /**
   * Match file pattern (simple glob)
   */
  private matchPattern(fileName: string, pattern: string): boolean {
    const regex = new RegExp(
      '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$',
      'i'
    );
    return regex.test(fileName);
  }

  /**
   * Generate detailed import report
   */
  generateReport(summary: ImportSummary): string {
    const lines: string[] = [];

    lines.push('='.repeat(80));
    lines.push('BANK STATEMENT IMPORT REPORT');
    lines.push('='.repeat(80));
    lines.push('');

    lines.push(`Total files processed: ${summary.totalFiles}`);
    lines.push(`Successful imports: ${summary.successCount}`);
    lines.push(`Failed imports: ${summary.failureCount}`);
    lines.push(`Total transactions imported: ${summary.totalTransactions}`);
    lines.push('');

    if (summary.results.length > 0) {
      lines.push('-'.repeat(80));
      lines.push('IMPORT DETAILS');
      lines.push('-'.repeat(80));
      lines.push('');

      for (const result of summary.results) {
        lines.push(`File: ${result.fileName}`);
        lines.push(`Journal: ${result.journalName}`);
        lines.push(`Status: ${result.success ? 'SUCCESS' : 'FAILED'}`);

        if (result.statementId) {
          lines.push(`Statement ID: ${result.statementId}`);
        }

        lines.push(`Transactions: ${result.transactionsImported}`);
        lines.push(`Opening Balance: ${result.balanceStart.toFixed(2)}`);
        lines.push(`Closing Balance: ${result.balanceEnd.toFixed(2)}`);
        lines.push(`Computed Balance: ${result.computedBalance.toFixed(2)}`);
        lines.push(`Balance Matches: ${result.balanceMatches ? 'YES' : 'NO'}`);

        if (result.warnings.length > 0) {
          lines.push(`Warnings:`);
          result.warnings.forEach(w => lines.push(`  - ${w}`));
        }

        if (result.errors.length > 0) {
          lines.push(`Errors:`);
          result.errors.forEach(e => lines.push(`  - ${e}`));
        }

        lines.push('');
      }
    }

    if (summary.balanceVerification.length > 0) {
      lines.push('-'.repeat(80));
      lines.push('FINAL BALANCE VERIFICATION');
      lines.push('-'.repeat(80));
      lines.push('');

      for (const verification of summary.balanceVerification) {
        const status = verification.matches ? '✓ MATCH' : '✗ MISMATCH';
        const diff = verification.actualBalance - verification.expectedBalance;

        lines.push(`${verification.journal} (${verification.currency}):`);
        lines.push(`  Expected: ${verification.expectedBalance.toFixed(2)}`);
        lines.push(`  Actual: ${verification.actualBalance.toFixed(2)}`);
        lines.push(`  Difference: ${diff.toFixed(2)}`);
        lines.push(`  Status: ${status}`);
        lines.push('');
      }
    }

    lines.push('='.repeat(80));

    return lines.join('\n');
  }
}
