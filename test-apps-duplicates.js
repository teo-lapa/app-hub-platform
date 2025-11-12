// Test per verificare ID duplicati nelle app
const { allApps } = require('./lib/data/apps-with-indicators.ts');

console.log('=== TEST VERIFICA APP ===\n');
console.log('Totale app definite:', allApps.length);

// Verifica duplicati
const ids = allApps.map(a => a.id);
const idCounts = {};
ids.forEach(id => {
  idCounts[id] = (idCounts[id] || 0) + 1;
});

const duplicates = Object.entries(idCounts).filter(([id, count]) => count > 1);

if (duplicates.length === 0) {
  console.log('✅ NESSUN ID DUPLICATO!');
} else {
  console.log('❌ ID DUPLICATI TROVATI:');
  duplicates.forEach(([id, count]) => {
    console.log(`  - ${id}: ${count} volte`);
    const apps = allApps.filter(a => a.id === id);
    apps.forEach(app => {
      console.log(`    * ${app.name} (${app.url})`);
    });
  });
}

// Cerca app specifiche
console.log('\n=== APP SPECIFICHE ===');
const scarichi = allApps.find(a => a.name.includes('Scarichi Parziali'));
if (scarichi) {
  console.log(`✅ Scarichi Parziali: ID=${scarichi.id}, URL=${scarichi.url}`);
} else {
  console.log('❌ Scarichi Parziali NON trovato');
}

const catalogoAI = allApps.filter(a => a.name.includes('Catalogo Venditori AI'));
console.log(`Catalogo Venditori AI: ${catalogoAI.length} trovati (dovrebbe essere 1)`);
catalogoAI.forEach(app => {
  console.log(`  - ID=${app.id}, URL=${app.url}`);
});

const controlloConsegne = allApps.filter(a => a.name.includes('Controllo Consegne'));
console.log(`\nControllo Consegne: ${controlloConsegne.length} trovati`);
controlloConsegne.forEach(app => {
  console.log(`  - ${app.name}: ID=${app.id}, URL=${app.url}`);
});
