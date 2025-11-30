# Analisi Ubicazioni Scarichi Parziali

## Descrizione

Questo sistema analizza gli ordini con scarichi parziali e determina:
1. **Ubicazione attuale** dei prodotti non scaricati (in quale furgone si trovano)
2. **Ubicazione destinazione** corretta per il buffer (Frigo/Pingu/Sopra)

## File Generati

### 📄 ANALISI_UBICAZIONI_SCARICHI_PARZIALI.json

Contiene l'analisi completa di tutti gli ordini con scarichi parziali:

```json
{
  "ordine": "WH/OUT/34443",
  "cliente": "Amare Food Truck, Amare Food CONSEGNA",
  "data": "2025-11-07 18:53:10",
  "salesOrder": "S34420",
  "autista": "Domingos",
  "prodotti": [
    {
      "id": null,
      "nome": "SALATINI 8 GUSTI 12G 4KG CRT SG",
      "qty": 1,
      "uom": "CRT",
      "ubicazione_attuale": "Furgone/Domingos",
      "ubicazione_destinazione": "Buffer/Pingu"
    }
  ]
}
```

## Script Disponibili

### 1. genera-ubicazioni-buffer-simulato.js ✅

**Status**: Funzionante (non richiede connessione Odoo)

Genera l'analisi basandosi su logiche di business:
- Identifica l'autista dai messaggi di scarico parziale
- Determina il buffer corretto dal nome del prodotto
- Non richiede connessione a Odoo

```bash
node genera-ubicazioni-buffer-simulato.js
```

**Logica di classificazione buffer:**

| Tipo Prodotto | Buffer | Criteri |
|--------------|--------|---------|
| **Surgelati** | `Buffer/Pingu` | Nome contiene: SG, surgel, congelat, gelato, frozen |
| **Refrigerati** | `Buffer/Frigo` | Nome contiene: S.V., salumi, formaggi, guanciale, mortadella, grana, fiordilatte, ecc. |
| **Altri** | `Buffer/Sopra` | Tutti gli altri prodotti (carta, plastica, scatole, farina, ecc.) |

### 2. analizza-scarichi-parziali-ubicazioni.js 🚧

**Status**: Richiede connessione Odoo (attualmente non disponibile)

Versione completa che si connette a Odoo staging per:
- Ottenere i veri ID prodotti
- Cercare le ubicazioni effettive tramite stock.quant
- Determinare il buffer dalla categoria Odoo

```bash
# Quando Odoo sarà disponibile:
node analizza-scarichi-parziali-ubicazioni.js
```

## Statistiche Report Attuale

### 📊 Riepilogo Generale
- **Ordini totali**: 26
- **Ordini con prodotti**: 10
- **Prodotti da ricollocare**: 19

### 👥 Distribuzione per Autista
| Autista | Ordini |
|---------|--------|
| Liviu | 4 |
| Stefan | 3 |
| Alexandru | 2 |
| Domingos | 1 |

### 📦 Distribuzione per Buffer
| Buffer | Prodotti | % |
|--------|----------|---|
| **Sopra** | 10 | 52.6% |
| **Frigo** | 8 | 42.1% |
| **Pingu** | 1 | 5.3% |

### 📏 Distribuzione per UOM
| UOM | Prodotti |
|-----|----------|
| kg | 10 |
| PZ | 5 |
| CRT | 2 |
| CRTc | 2 |

## Prossimi Step

### Per l'implementazione completa:

1. **Verificare connessione Odoo staging**
   ```bash
   curl https://lapadevadmin-lapa-v2-staging-2406-24517859.dev.odoo.com
   ```

2. **Eseguire script con connessione reale**
   ```bash
   node analizza-scarichi-parziali-ubicazioni.js
   ```

3. **Creare operazioni di trasferimento in Odoo**
   - Da: `Furgone/{Autista}`
   - A: `Buffer/{Frigo|Pingu|Sopra}`
   - Qty: come specificato nel report

4. **Validare i trasferimenti**
   - Verificare che le quantità corrispondano
   - Controllare che i buffer siano corretti

## Note Tecniche

### Requisiti
- Node.js v24+ (con fetch nativo)
- Accesso a Odoo staging (per lo script completo)
- File `REPORT_SCARICHI_PARZIALI_2025-11-08.json` presente

### Credenziali Odoo
- URL: `https://lapadevadmin-lapa-v2-staging-2406-24517859.dev.odoo.com`
- DB: `lapadevadmin-lapa-v2-staging-2406-24517859`
- Login: `paul@lapa.ch`
- Password: `lapa201180`

### Modelli Odoo Utilizzati

| Modello | Uso |
|---------|-----|
| `product.product` | Ricerca prodotti per nome e categoria |
| `stock.location` | Ricerca ubicazioni furgoni |
| `stock.quant` | Trova ubicazione attuale del prodotto |
| `product.category` | Determina se refrigerato/surgelato |

## Esempi di Uso

### Trovare prodotti in un furgone specifico

```javascript
const furgoneLiviu = analisi.filter(a => a.autista === 'Liviu');
console.log(`Prodotti nel furgone di Liviu: ${furgoneLiviu.length}`);
```

### Contare prodotti per buffer

```javascript
const prodottiPerBuffer = analisi.reduce((acc, ordine) => {
  ordine.prodotti.forEach(p => {
    const buffer = p.ubicazione_destinazione.split('/')[1];
    acc[buffer] = (acc[buffer] || 0) + 1;
  });
  return acc;
}, {});
```

### Filtrare solo refrigerati

```javascript
const refrigerati = analisi.flatMap(a => a.prodotti)
  .filter(p => p.ubicazione_destinazione === 'Buffer/Frigo');
```

## Troubleshooting

### Errore "fetch failed"
- Verificare connessione internet
- Controllare che Odoo staging sia online
- Usare lo script simulato come alternativa

### Prodotti non trovati
- Verificare che i nomi prodotti corrispondano esattamente
- Controllare che i prodotti esistano in Odoo
- Verificare la ricerca case-sensitive

### Buffer errato
- Controllare la categoria prodotto in Odoo
- Verificare le regole di classificazione
- Aggiornare la logica nel metodo `determineBuffer()`

## Contatti

Per domande o problemi contattare il team di sviluppo LAPA.
