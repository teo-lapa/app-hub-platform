#!/usr/bin/env ts-node

/**
 * Test UBS CSV Parser
 *
 * Quick test to verify the parser works correctly
 */

import { parseUBSCSV, validateStatement, getStatementSummary } from '../lib/parsers/ubs-csv-parser.js';

const testFile = 'C:\\Users\\lapa\\Downloads\\CHIUSURA 2024\\CHIUSURA 2024\\UBS CHF\\UBS CHF 1.1-31.3.2024.csv';

async function main() {
  console.log('Testing UBS CSV Parser');
  console.log('='.repeat(60));
  console.log(`File: ${testFile}\n`);

  try {
    // Parse
    const statement = parseUBSCSV(testFile);

    console.log('Account Info:');
    console.log(`  Account Number: ${statement.accountInfo.accountNumber}`);
    console.log(`  IBAN: ${statement.accountInfo.iban}`);
    console.log(`  Period: ${statement.accountInfo.dateFrom.toLocaleDateString()} - ${statement.accountInfo.dateTo.toLocaleDateString()}`);
    console.log(`  Currency: ${statement.accountInfo.currency}`);
    console.log(`  Opening Balance: ${statement.accountInfo.openingBalance.toFixed(2)}`);
    console.log(`  Closing Balance: ${statement.accountInfo.closingBalance.toFixed(2)}`);
    console.log(`  Transaction Count: ${statement.accountInfo.transactionCount}`);
    console.log('');

    // Validate
    const validation = validateStatement(statement);
    console.log('Validation:');
    console.log(`  Valid: ${validation.valid ? 'YES' : 'NO'}`);
    console.log(`  Expected Balance: ${validation.expectedBalance.toFixed(2)}`);
    console.log(`  Actual Balance: ${validation.actualBalance.toFixed(2)}`);
    console.log(`  Difference: ${validation.difference.toFixed(2)}`);
    console.log('');

    // Summary
    const summary = getStatementSummary(statement);
    console.log('Summary:');
    console.log(`  Transactions Parsed: ${summary.transactionCount}`);
    console.log(`  Total Credits: ${summary.totalCredits.toFixed(2)}`);
    console.log(`  Total Debits: ${summary.totalDebits.toFixed(2)}`);
    console.log(`  Net Change: ${summary.netChange.toFixed(2)}`);
    console.log('');

    // Sample transactions
    console.log('Sample Transactions (first 5):');
    statement.transactions.slice(0, 5).forEach((tx, i) => {
      console.log(`\n  [${i + 1}] ${tx.valueDate?.toLocaleDateString()}`);
      console.log(`      Amount: ${tx.amount.toFixed(2)} ${tx.currency}`);
      console.log(`      Partner: ${tx.partner || '(none)'}`);
      console.log(`      Desc: ${tx.description1.substring(0, 60)}...`);
      console.log(`      Ref: ${tx.reference || '(none)'}`);
      console.log(`      TxID: ${tx.transactionNumber}`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('✓ Parser test completed successfully!');

  } catch (error) {
    console.error('ERROR:', error);
    process.exit(1);
  }
}

main();
