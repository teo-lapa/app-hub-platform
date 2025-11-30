/**
 * Test UBS CSV Parser - Simple JavaScript version
 */

const fs = require('fs');
const csv = require('csv-parse/sync');

const testFile = 'C:\\Users\\lapa\\Downloads\\CHIUSURA 2024\\CHIUSURA 2024\\UBS CHF\\UBS CHF 1.1-31.3.2024.csv';

function parseUBSDate(dateStr) {
  if (!dateStr || dateStr.trim() === '') return null;
  const [day, month, year] = dateStr.split('/').map(Number);
  if (!day || !month || !year) return null;
  return new Date(year, month - 1, day);
}

function parseUBSNumber(numStr) {
  if (!numStr || numStr.trim() === '') return 0;
  const cleaned = numStr.replace(/['\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parseUBSCSV(filePath) {
  const content = fs.readFileSync(filePath, { encoding: 'utf-8' });
  const lines = content.split('\n');

  // Parse header
  const getField = (lineIndex) => {
    const parts = lines[lineIndex].split(';');
    return parts[1] || '';
  };

  const accountInfo = {
    accountNumber: getField(0).trim(),
    iban: getField(1).trim(),
    dateFrom: parseUBSDate(getField(2)),
    dateTo: parseUBSDate(getField(3)),
    openingBalance: parseUBSNumber(getField(4)),
    closingBalance: parseUBSNumber(getField(5)),
    currency: getField(6).trim(),
    transactionCount: parseInt(getField(7)) || 0
  };

  // Parse transactions (skip header lines 0-10)
  const transactions = [];
  let currentTx = null;

  for (let i = 10; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.trim() === '') continue;

    const fields = line.split(';');

    const hasSettlementDate = fields[0] && fields[0].trim() !== '';
    const hasBookingDate = fields[2] && fields[2].trim() !== '';

    if (hasSettlementDate || hasBookingDate) {
      // Save previous transaction
      if (currentTx && currentTx.transactionNumber) {
        transactions.push(currentTx);
      }

      // New transaction
      // Belastung (debit) is already negative, Gutschrift (credit) is positive
      const debit = parseUBSNumber(fields[5]); // Already negative
      const credit = parseUBSNumber(fields[6]); // Positive
      const amount = credit || debit; // Use whichever is non-zero

      currentTx = {
        settlementDate: parseUBSDate(fields[0]),
        valueDate: parseUBSDate(fields[3]),
        currency: fields[4]?.trim() || accountInfo.currency,
        debit,
        credit,
        balance: parseUBSNumber(fields[8]),
        transactionNumber: fields[9]?.trim() || '',
        description1: fields[10]?.trim() || '',
        description2: fields[11]?.trim() || '',
        description3: fields[12]?.trim() || '',
        amount
      };
    }
  }

  // Save last transaction
  if (currentTx && currentTx.transactionNumber) {
    transactions.push(currentTx);
  }

  return {
    accountInfo,
    transactions
  };
}

async function main() {
  console.log('Testing UBS CSV Parser');
  console.log('='.repeat(60));
  console.log(`File: ${testFile}\n`);

  try {
    const statement = parseUBSCSV(testFile);

    console.log('Account Info:');
    console.log(`  Account Number: ${statement.accountInfo.accountNumber}`);
    console.log(`  IBAN: ${statement.accountInfo.iban}`);
    console.log(`  Period: ${statement.accountInfo.dateFrom?.toLocaleDateString()} - ${statement.accountInfo.dateTo?.toLocaleDateString()}`);
    console.log(`  Currency: ${statement.accountInfo.currency}`);
    console.log(`  Opening Balance: ${statement.accountInfo.openingBalance.toFixed(2)}`);
    console.log(`  Closing Balance: ${statement.accountInfo.closingBalance.toFixed(2)}`);
    console.log(`  Transaction Count: ${statement.accountInfo.transactionCount}`);
    console.log('');

    // Calculate totals
    const totalCredits = statement.transactions
      .filter(tx => tx.amount > 0)
      .reduce((sum, tx) => sum + tx.amount, 0);

    const totalDebits = statement.transactions
      .filter(tx => tx.amount < 0)
      .reduce((sum, tx) => sum + tx.amount, 0);

    const computedBalance = statement.accountInfo.openingBalance + totalCredits + totalDebits;

    console.log('Summary:');
    console.log(`  Transactions Parsed: ${statement.transactions.length}`);
    console.log(`  Total Credits: ${totalCredits.toFixed(2)}`);
    console.log(`  Total Debits: ${totalDebits.toFixed(2)}`);
    console.log(`  Net Change: ${(totalCredits + totalDebits).toFixed(2)}`);
    console.log(`  Computed Balance: ${computedBalance.toFixed(2)}`);
    console.log(`  Balance Match: ${Math.abs(computedBalance - statement.accountInfo.closingBalance) < 0.01 ? 'YES' : 'NO'}`);
    console.log('');

    // Sample transactions
    console.log('Sample Transactions (first 5):');
    statement.transactions.slice(0, 5).forEach((tx, i) => {
      console.log(`\n  [${i + 1}] ${tx.valueDate?.toLocaleDateString()}`);
      console.log(`      Amount: ${tx.amount.toFixed(2)} ${tx.currency}`);
      console.log(`      Desc: ${tx.description1.substring(0, 60)}${tx.description1.length > 60 ? '...' : ''}`);
      console.log(`      TxID: ${tx.transactionNumber}`);
      console.log(`      Balance: ${tx.balance.toFixed(2)}`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('✓ Parser test completed successfully!');
    console.log(`✓ Parsed ${statement.transactions.length} transactions`);

  } catch (error) {
    console.error('ERROR:', error);
    process.exit(1);
  }
}

main();
