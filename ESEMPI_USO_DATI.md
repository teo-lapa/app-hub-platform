# Esempi di Utilizzo dei Dati di Ricollocazione

## Panoramica File Generati

### 📊 File JSON
- **ANALISI_UBICAZIONI_SCARICHI_PARZIALI.json** - Dati strutturati completi
- **ESEMPIO_RISULTATO_ODOO.json** - Esempio risultato con connessione Odoo

### 📄 File CSV
- **REPORT_RICOLLOCAZIONE_PRODOTTI.csv** - Excel-friendly per analisi manuale

### 📖 File Documentazione
- **README_ANALISI_SCARICHI.md** - Documentazione completa
- **ESEMPI_USO_DATI.md** - Questo file

## Esempi Pratici

### 1. Filtro per Autista

**Scenario**: Vuoi la lista di tutti i prodotti nel furgone di Stefan

```javascript
const fs = require('fs');
const analisi = JSON.parse(fs.readFileSync('ANALISI_UBICAZIONI_SCARICHI_PARZIALI.json'));

const prodottiStefan = analisi
  .filter(ordine => ordine.autista === 'Stefan')
  .flatMap(ordine => ordine.prodotti);

console.log(`Stefan deve ricollocare ${prodottiStefan.length} prodotti:`);
prodottiStefan.forEach((p, i) => {
  console.log(`${i+1}. ${p.nome} - ${p.qty} ${p.uom} → ${p.ubicazione_destinazione}`);
});
```

**Output**:
```
Stefan deve ricollocare 7 prodotti:
1. GUANCIALE DI SUINO AL PEPE SV INTERO PZ CA 1.5KG SORR - 1 kg → Buffer/Frigo
2. NUTELLA 1000G 6PZ CRT M - 1 PZ → Buffer/Sopra
3. GRANA PADANO DOP SCAGLIE FRESCHE 1KG 10KG CRT LSM - 2 kg → Buffer/Frigo
...
```

### 2. Lista per Buffer

**Scenario**: Vuoi sapere quali prodotti vanno nel Frigo

```javascript
const perFrigo = analisi
  .flatMap(ordine => ordine.prodotti)
  .filter(p => p.ubicazione_destinazione === 'Buffer/Frigo');

console.log(`Prodotti da mettere in FRIGO: ${perFrigo.length}`);
perFrigo.forEach(p => {
  const ordine = analisi.find(o => o.prodotti.includes(p));
  console.log(`- ${p.nome}`);
  console.log(`  Furgone: ${p.ubicazione_attuale}`);
  console.log(`  Ordine: ${ordine.ordine}`);
  console.log('');
});
```

### 3. Report per Cliente

**Scenario**: Vuoi vedere tutti gli ordini di un cliente specifico

```javascript
const clienteCaterina = analisi.filter(ordine =>
  ordine.cliente.includes('Caterina')
);

console.log('Ordini Caterina con scarichi parziali:');
clienteCaterina.forEach(ordine => {
  console.log(`\nOrdine: ${ordine.ordine} (${ordine.data})`);
  console.log(`Autista: ${ordine.autista}`);
  console.log('Prodotti:');
  ordine.prodotti.forEach(p => {
    console.log(`  - ${p.nome}: ${p.qty} ${p.uom}`);
  });
});
```

### 4. Statistiche Buffer per Autista

**Scenario**: Vuoi vedere quanti prodotti per buffer ha ogni autista

```javascript
const statsPerAutista = {};

analisi.forEach(ordine => {
  if (!statsPerAutista[ordine.autista]) {
    statsPerAutista[ordine.autista] = { Frigo: 0, Pingu: 0, Sopra: 0 };
  }

  ordine.prodotti.forEach(p => {
    const buffer = p.ubicazione_destinazione.split('/')[1];
    statsPerAutista[ordine.autista][buffer]++;
  });
});

console.log('Distribuzione buffer per autista:\n');
Object.entries(statsPerAutista).forEach(([autista, buffers]) => {
  console.log(`${autista}:`);
  console.log(`  Frigo: ${buffers.Frigo}`);
  console.log(`  Pingu: ${buffers.Pingu}`);
  console.log(`  Sopra: ${buffers.Sopra}`);
  console.log('');
});
```

### 5. Esportazione Personalizzata

**Scenario**: Vuoi creare un CSV solo per i prodotti refrigerati

```javascript
const refrigerati = analisi.flatMap(ordine =>
  ordine.prodotti
    .filter(p => p.ubicazione_destinazione === 'Buffer/Frigo')
    .map(p => ({
      ...p,
      ordine: ordine.ordine,
      autista: ordine.autista,
      cliente: ordine.cliente
    }))
);

const csvLines = [
  'Autista,Ordine,Cliente,Prodotto,Qty,UOM'
];

refrigerati.forEach(p => {
  csvLines.push(
    `"${p.autista}","${p.ordine}","${p.cliente}","${p.nome}",${p.qty},"${p.uom}"`
  );
});

fs.writeFileSync('SOLO_REFRIGERATI.csv', csvLines.join('\n'));
console.log('File SOLO_REFRIGERATI.csv creato!');
```

### 6. Check List per Autista

**Scenario**: Vuoi stampare una check list per ogni autista

```javascript
const autisti = [...new Set(analisi.map(o => o.autista))];

autisti.forEach(autista => {
  console.log('\n' + '='.repeat(60));
  console.log(`CHECK LIST - FURGONE ${autista.toUpperCase()}`);
  console.log('='.repeat(60) + '\n');

  const ordiniAutista = analisi.filter(o => o.autista === autista);

  ordiniAutista.forEach(ordine => {
    console.log(`□ Ordine: ${ordine.ordine}`);
    console.log(`  Cliente: ${ordine.cliente}`);
    console.log('  Prodotti da ricollocare:');

    ordine.prodotti.forEach(p => {
      const buffer = p.ubicazione_destinazione.split('/')[1];
      console.log(`    □ ${p.nome}`);
      console.log(`      Qty: ${p.qty} ${p.uom} → ${buffer}`);
    });
    console.log('');
  });
});
```

### 7. Ricerca Prodotto Specifico

**Scenario**: Vuoi trovare dove si trova un prodotto specifico

```javascript
function cercaProdotto(nomeProdotto) {
  const risultati = [];

  analisi.forEach(ordine => {
    ordine.prodotti.forEach(p => {
      if (p.nome.toLowerCase().includes(nomeProdotto.toLowerCase())) {
        risultati.push({
          prodotto: p.nome,
          qty: p.qty,
          uom: p.uom,
          dove: p.ubicazione_attuale,
          destinazione: p.ubicazione_destinazione,
          ordine: ordine.ordine,
          cliente: ordine.cliente,
          autista: ordine.autista
        });
      }
    });
  });

  return risultati;
}

// Esempio: cerca il Grana Padano
const granaPadano = cercaProdotto('GRANA PADANO');
console.log(`Trovati ${granaPadano.length} ordini con Grana Padano:`);
granaPadano.forEach(r => {
  console.log(`\n- ${r.qty} ${r.uom}`);
  console.log(`  Attualmente: ${r.dove}`);
  console.log(`  Destinazione: ${r.destinazione}`);
  console.log(`  Ordine: ${r.ordine}`);
  console.log(`  Autista: ${r.autista}`);
});
```

### 8. Validazione Completamento

**Scenario**: Vuoi controllare quali ordini sono stati completati

```javascript
// Supponi di avere una lista di ordini completati
const completati = ['WH/OUT/34443', 'WH/OUT/34464'];

const daCompletare = analisi.filter(ordine =>
  !completati.includes(ordine.ordine)
);

console.log('Ordini ancora da completare:');
daCompletare.forEach(ordine => {
  console.log(`- ${ordine.ordine} (${ordine.autista}): ${ordine.prodotti.length} prodotti`);
});

const percentuale = ((completati.length / analisi.length) * 100).toFixed(1);
console.log(`\nProgresso: ${completati.length}/${analisi.length} (${percentuale}%)`);
```

### 9. Excel Pivot-Like Analysis

**Scenario**: Vuoi un riassunto tipo tabella pivot

```javascript
// Matrice Autista x Buffer
const autisti = [...new Set(analisi.map(o => o.autista))];
const buffers = ['Frigo', 'Pingu', 'Sopra'];

console.log('Autista        | Frigo | Pingu | Sopra | Totale');
console.log('---------------|-------|-------|-------|-------');

autisti.forEach(autista => {
  const prodotti = analisi
    .filter(o => o.autista === autista)
    .flatMap(o => o.prodotti);

  const counts = {
    Frigo: prodotti.filter(p => p.ubicazione_destinazione.includes('Frigo')).length,
    Pingu: prodotti.filter(p => p.ubicazione_destinazione.includes('Pingu')).length,
    Sopra: prodotti.filter(p => p.ubicazione_destinazione.includes('Sopra')).length
  };

  const totale = counts.Frigo + counts.Pingu + counts.Sopra;

  console.log(
    `${autista.padEnd(14)} | ` +
    `${String(counts.Frigo).padStart(5)} | ` +
    `${String(counts.Pingu).padStart(5)} | ` +
    `${String(counts.Sopra).padStart(5)} | ` +
    `${String(totale).padStart(6)}`
  );
});
```

### 10. Timeline Ordini

**Scenario**: Vuoi vedere gli ordini in ordine cronologico

```javascript
const ordinatiPerData = [...analisi].sort((a, b) =>
  new Date(a.data) - new Date(b.data)
);

console.log('TIMELINE SCARICHI PARZIALI:\n');

ordinatiPerData.forEach(ordine => {
  const data = new Date(ordine.data);
  const dataStr = data.toLocaleDateString('it-IT', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });

  console.log(`${dataStr} | ${ordine.autista.padEnd(10)} | ${ordine.ordine}`);
  console.log(`  └─ ${ordine.cliente.substring(0, 50)}`);
  console.log(`     ${ordine.prodotti.length} prodotto/i da ricollocare\n`);
});
```

## File Completi di Esempio

### esempio-1-lista-per-autista.js

Salva questo in un file per avere una lista stampabile per ogni autista:

```javascript
const fs = require('fs');
const analisi = JSON.parse(fs.readFileSync('ANALISI_UBICAZIONI_SCARICHI_PARZIALI.json'));

const autisti = [...new Set(analisi.map(o => o.autista))];

let output = '';

autisti.forEach(autista => {
  output += '\n' + '═'.repeat(80) + '\n';
  output += `CHECK LIST RICOLLOCAZIONE - FURGONE ${autista.toUpperCase()}\n`;
  output += '═'.repeat(80) + '\n\n';

  const ordiniAutista = analisi.filter(o => o.autista === autista);
  const totaleProdotti = ordiniAutista.reduce((sum, o) => sum + o.prodotti.length, 0);

  output += `Ordini: ${ordiniAutista.length}\n`;
  output += `Prodotti da ricollocare: ${totaleProdotti}\n\n`;

  const perBuffer = { Frigo: [], Pingu: [], Sopra: [] };

  ordiniAutista.forEach(ordine => {
    ordine.prodotti.forEach(p => {
      const buffer = p.ubicazione_destinazione.split('/')[1];
      perBuffer[buffer].push({ ...p, ordine: ordine.ordine });
    });
  });

  ['Frigo', 'Pingu', 'Sopra'].forEach(buffer => {
    if (perBuffer[buffer].length > 0) {
      const icon = buffer === 'Frigo' ? '❄️' : buffer === 'Pingu' ? '🧊' : '📦';
      output += `\n${icon} ${buffer.toUpperCase()} (${perBuffer[buffer].length} prodotti):\n`;
      output += '─'.repeat(80) + '\n';

      perBuffer[buffer].forEach((p, i) => {
        output += `\n${i + 1}. □ ${p.nome}\n`;
        output += `   Qty: ${p.qty} ${p.uom}\n`;
        output += `   Ordine: ${p.ordine}\n`;
      });
    }
  });

  output += '\n\n';
});

fs.writeFileSync('LISTA_PER_AUTISTA.txt', output);
console.log('✅ File LISTA_PER_AUTISTA.txt creato!');
```

## Conclusione

Questi esempi mostrano come utilizzare i dati JSON generati per:
- Filtrare e cercare informazioni specifiche
- Generare report personalizzati
- Creare check list operative
- Analizzare statistiche
- Validare il completamento delle operazioni

Tutti gli script sono pronti all'uso e possono essere eseguiti con:
```bash
node nome-script.js
```
