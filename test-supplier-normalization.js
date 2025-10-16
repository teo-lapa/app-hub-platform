/**
 * TEST SUPPLIER NORMALIZATION
 *
 * Test per verificare che la normalizzazione funzioni correttamente
 * con il caso reale: "BAGNOLI GROUP S.R.L."
 */

// Simula le funzioni TypeScript in JavaScript
function normalizeVat(vat) {
  if (!vat) return '';
  return vat
    .toUpperCase()
    .replace(/^IT/i, '')
    .replace(/^CHE-?/i, '')
    .replace(/\s+/g, '')
    .replace(/-/g, '')
    .replace(/\./g, '')
    .replace(/MWST$/i, '')
    .trim();
}

function normalizeName(name) {
  if (!name) return '';
  return name
    .trim()
    .toLowerCase()
    .replace(/\bs\.?r\.?l\.?\b/gi, '')
    .replace(/\bs\.?p\.?a\.?\b/gi, '')
    .replace(/\bs\.?a\.?s\.?\b/gi, '')
    .replace(/\bs\.?n\.?c\.?\b/gi, '')
    .replace(/\bsrl\b/gi, '')
    .replace(/\bspa\b/gi, '')
    .replace(/\bsas\b/gi, '')
    .replace(/\bsnc\b/gi, '')
    .replace(/\bgmbh\b/gi, '')
    .replace(/\bltd\b/gi, '')
    .replace(/\bllc\b/gi, '')
    .replace(/\binc\b/gi, '')
    .replace(/\bcorp\b/gi, '')
    .replace(/\bs\.?a\.?\b/gi, '')
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractKeywords(name) {
  const normalized = normalizeName(name);
  const withoutCommonWords = normalized
    .replace(/\b(il|lo|la|i|gli|le|un|uno|una|del|della|dello|degli|delle|di|da|in|con|su|per|tra|fra)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return withoutCommonWords;
}

function fuzzyMatchScore(name1, name2) {
  const normalized1 = normalizeName(name1);
  const normalized2 = normalizeName(name2);

  // Match esatto
  if (normalized1 === normalized2) {
    return 1.0;
  }

  // Uno contiene l'altro
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    return 0.85;
  }

  // Confronta parole
  const words1 = normalized1.split(' ').filter(w => w.length > 2);
  const words2 = normalized2.split(' ').filter(w => w.length > 2);

  if (words1.length === 0 || words2.length === 0) {
    return 0;
  }

  const commonWords = words1.filter(w => words2.includes(w));
  const score = commonWords.length / Math.max(words1.length, words2.length);

  return score;
}

// TEST CASES
console.log('='.repeat(80));
console.log('TEST SUPPLIER NORMALIZATION');
console.log('='.repeat(80));

const testCases = [
  {
    invoice: 'BAGNOLI GROUP S.R.L.',
    odoo: [
      'BAGNOLI GROUP S.R.L.',
      'BAGNOLI GROUP',
      'Bagnoli Group Srl',
      'BAGNOLI GROUP SRL',
      'Bagnoli Group S.r.l.'
    ]
  },
  {
    invoice: 'La bottega del caffè GmbH',
    odoo: [
      'La bottega del caffè GmbH',
      'LA BOTTEGA DEL CAFFE',
      'Bottega del caffè',
      'La Bottega Del Caffe GmbH'
    ]
  },
  {
    invoice: 'INNOVACTION S.R.L.',
    odoo: [
      'INNOVACTION S.R.L.',
      'INNOVACTION',
      'Innovaction Srl',
      'INNOVACTION SRL'
    ]
  },
  {
    invoice: 'Frantoio Oleario Fratelli Santoro S.r.l.',
    odoo: [
      'Frantoio Oleario Fratelli Santoro',
      'FRANTOIO OLEARIO FRATELLI SANTORO SRL',
      'Fratelli Santoro Srl'
    ]
  }
];

testCases.forEach((testCase, index) => {
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`TEST ${index + 1}: "${testCase.invoice}"`);
  console.log('─'.repeat(80));

  const invoiceNormalized = normalizeName(testCase.invoice);
  const invoiceKeywords = extractKeywords(testCase.invoice);

  console.log(`📄 Invoice name:       "${testCase.invoice}"`);
  console.log(`🔧 Normalized:         "${invoiceNormalized}"`);
  console.log(`🔑 Keywords:           "${invoiceKeywords}"`);
  console.log();

  console.log('📊 Matching with Odoo names:');
  testCase.odoo.forEach((odooName, i) => {
    const odooNormalized = normalizeName(odooName);
    const score = fuzzyMatchScore(testCase.invoice, odooName);
    const scorePercent = (score * 100).toFixed(0);
    const match = score >= 0.8 ? '✅ MATCH' : score >= 0.5 ? '⚠️  PARTIAL' : '❌ NO MATCH';

    console.log(`  ${i + 1}. ${match} (${scorePercent}%) "${odooName}"`);
    console.log(`     Normalized: "${odooNormalized}"`);
  });
});

console.log('\n' + '='.repeat(80));
console.log('TEST COMPLETATO');
console.log('='.repeat(80));
