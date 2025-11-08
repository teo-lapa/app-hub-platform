#!/usr/bin/env node

/**
 * Script di validazione per prevenire ID duplicati nelle app
 *
 * Esegui questo script prima di ogni commit per verificare
 * che non ci siano ID duplicati in apps-with-indicators.ts
 *
 * Usage: node scripts/validate-app-ids.js
 */

const fs = require('fs');
const path = require('path');

const APPS_FILE = path.join(__dirname, '../lib/data/apps-with-indicators.ts');

console.log('🔍 Validazione ID app...\n');

// Leggi il file
const content = fs.readFileSync(APPS_FILE, 'utf8');

// Estrai tutti gli ID
const idMatches = content.matchAll(/id:\s*'([^']+)'/g);
const ids = [];
const idPositions = {};

for (const match of idMatches) {
  const id = match[1];
  ids.push(id);

  if (!idPositions[id]) {
    idPositions[id] = [];
  }
  idPositions[id].push(match.index);
}

// Cerca duplicati
const duplicates = Object.entries(idPositions).filter(([id, positions]) => positions.length > 1);

if (duplicates.length === 0) {
  console.log('✅ VALIDAZIONE SUPERATA!');
  console.log(`   Totale app: ${ids.length}`);
  console.log('   Nessun ID duplicato trovato\n');
  process.exit(0);
} else {
  console.error('❌ VALIDAZIONE FALLITA!\n');
  console.error('   ID DUPLICATI TROVATI:\n');

  duplicates.forEach(([id, positions]) => {
    console.error(`   🔴 ID "${id}" appare ${positions.length} volte`);

    // Per ogni duplicato, mostra il nome dell'app
    positions.forEach((pos, index) => {
      const snippet = content.substring(pos, pos + 300);
      const nameMatch = snippet.match(/name:\s*'([^']+)'/);
      if (nameMatch) {
        console.error(`      ${index + 1}. ${nameMatch[1]}`);
      }
    });
    console.error('');
  });

  console.error('⚠️  Correggi i duplicati prima di procedere con il commit!\n');
  process.exit(1);
}
