# Analisi Ubicazioni e Trasferimenti Interni Odoo

## 1. UBICAZIONI FURGONI

### Ubicazione Principale Furgoni
```json
{
  "id": 11,
  "name": "Furgoni",
  "complete_name": "WH/Furgoni",
  "parent_id": "WH",
  "usage": "internal",
  "active": true
}
```

**Totale ubicazioni furgoni trovate: 1**

---

## 2. UBICAZIONI BUFFER

### Ubicazioni Buffer Principali

#### a) Pingu (RUM)
```json
{
  "id": 23,
  "name": "Pingu",
  "complete_name": "RUM/Deposito/Pingu",
  "parent_id": "RUM/Deposito",
  "usage": "internal",
  "active": true
}
```

#### b) Pingu-01 (WH)
```json
{
  "id": 31,
  "name": "Pingu-01",
  "complete_name": "WH/Deposito/Pingu-01",
  "parent_id": "WH/Deposito",
  "usage": "internal",
  "active": true
}
```
**Note:** Contiene numerose sotto-ubicazioni (PINGU.CA.A01, PINGU.CA.A02, etc.)

#### c) Frigo-01
```json
{
  "id": 28,
  "name": "Frigo-01",
  "complete_name": "WH/Deposito/Frigo-01",
  "parent_id": "WH/Deposito",
  "usage": "internal",
  "active": true
}
```
**Note:** Contiene numerose sotto-ubicazioni (FRIGO.CA.A01, FRIGO.CA.B01, etc.)

#### d) Secco Sopra-02
```json
{
  "id": 30,
  "name": "Secco Sopra-02",
  "complete_name": "WH/Deposito/Secco Sopra-02",
  "parent_id": "WH/Deposito",
  "usage": "internal",
  "active": true
}
```
**Note:** Questa è l'ubicazione "Sopra" - contiene numerose sotto-ubicazioni stock e scaffali

### Ubicazioni Buffer Specifiche con "buffer tempora"
```json
[
  {
    "id": 551,
    "name": "FRIGO.CA.A09 buffer tempora",
    "complete_name": "WH/Deposito/Frigo-01/FRIGO.CA.A09 buffer tempora"
  },
  {
    "id": 120,
    "name": "PINGU.CA.A06 buffer tempora",
    "complete_name": "WH/Deposito/Pingu-01/PINGU.CA.A06 buffer tempora"
  }
]
```

**Totale ubicazioni buffer trovate: 217** (includendo tutte le sotto-ubicazioni)

---

## 3. PICKING TYPES INTERNI

### Picking Types Disponibili per Trasferimenti Interni

```json
[
  {
    "id": 5,
    "name": "Internal Transfers",
    "code": "internal",
    "sequence_code": "INT",
    "default_location_src_id": [8, "WH/Deposito"],
    "default_location_dest_id": [8, "WH/Deposito"],
    "warehouse_id": [1, "EMBRACH"]
  },
  {
    "id": 3,
    "name": "Pick",
    "code": "internal",
    "sequence_code": "PICK",
    "default_location_src_id": [8, "WH/Deposito"],
    "default_location_dest_id": [11, "WH/Furgoni"],
    "warehouse_id": [1, "EMBRACH"]
  },
  {
    "id": 12,
    "name": "Trasferimenti interni",
    "code": "internal",
    "sequence_code": "INT",
    "default_location_src_id": [23, "RUM/Deposito/Pingu"],
    "default_location_dest_id": [8, "WH/Deposito"],
    "warehouse_id": [10, "RUM"]
  },
  {
    "id": 33,
    "name": "Trasferimenti interni",
    "code": "internal",
    "sequence_code": "INT",
    "default_location_src_id": [519, "ItaEm/Stoc"],
    "default_location_dest_id": [519, "ItaEm/Stoc"],
    "warehouse_id": [18, "ItaEm"]
  }
]
```

**Picking Type raccomandato per trasferimenti verso furgoni: ID 3 (Pick)**
- Da: WH/Deposito
- A: WH/Furgoni

---

## 4. STRUTTURA TRASFERIMENTO INTERNO

### Campi Obbligatori per stock.picking

```javascript
{
  move_type: "direct",           // Tipo: selection - "direct" o "one"
  location_id: NUMBER,           // ID ubicazione sorgente (obbligatorio)
  location_dest_id: NUMBER,      // ID ubicazione destinazione (obbligatorio)
  picking_type_id: NUMBER        // ID tipo picking (obbligatorio)
}
```

### Campi Obbligatori per stock.move

```javascript
{
  name: STRING,                  // Descrizione movimento (obbligatorio)
  date: DATETIME,                // Data schedulata (obbligatorio)
  company_id: NUMBER,            // ID azienda (obbligatorio)
  product_id: NUMBER,            // ID prodotto (obbligatorio)
  product_uom_qty: FLOAT,        // Quantità (obbligatorio)
  product_uom: NUMBER,           // ID UoM (obbligatorio)
  location_id: NUMBER,           // ID ubicazione sorgente (obbligatorio)
  location_dest_id: NUMBER,      // ID ubicazione destinazione (obbligatorio)
  procure_method: STRING         // "make_to_stock" o "make_to_order" (obbligatorio)
}
```

---

## 5. ESEMPI JSON PER CREARE PICKING

### Esempio Base (Template)

```javascript
{
  picking_type_id: 3,  // Pick type (WH/Deposito -> WH/Furgoni)
  location_id: ID_LOCATION_SOURCE,
  location_dest_id: ID_LOCATION_DEST,
  scheduled_date: "2025-11-08T12:00:00Z",
  move_ids_without_package: [
    [0, 0, {
      name: "Descrizione trasferimento",
      product_id: ID_PRODOTTO,
      product_uom_qty: QUANTITA,
      product_uom: ID_UOM,  // es. 1 per unità
      location_id: ID_LOCATION_SOURCE,
      location_dest_id: ID_LOCATION_DEST
    }]
  ]
}
```

### Esempio Reale: Trasferimento da Pingu a Furgoni

```javascript
const pickingData = {
  picking_type_id: 3,              // Pick type
  location_id: 31,                 // Pingu-01 (WH/Deposito/Pingu-01)
  location_dest_id: 11,            // Furgoni (WH/Furgoni)
  scheduled_date: new Date().toISOString(),
  move_ids_without_package: [
    [0, 0, {
      name: "Trasferimento da Pingu-01 a Furgoni",
      product_id: 12968,           // Es: PICI 1KG
      product_uom_qty: 5,          // 5 kg
      product_uom: 1,              // Unità
      location_id: 31,             // Pingu-01
      location_dest_id: 11         // Furgoni
    }]
  ]
};
```

### Esempio Reale: Trasferimento da Frigo a Furgoni

```javascript
const pickingData = {
  picking_type_id: 3,              // Pick type
  location_id: 28,                 // Frigo-01 (WH/Deposito/Frigo-01)
  location_dest_id: 11,            // Furgoni (WH/Furgoni)
  scheduled_date: new Date().toISOString(),
  move_ids_without_package: [
    [0, 0, {
      name: "Trasferimento da Frigo-01 a Furgoni",
      product_id: PRODUCT_ID,
      product_uom_qty: 10,
      product_uom: 1,
      location_id: 28,             // Frigo-01
      location_dest_id: 11         // Furgoni
    }]
  ]
};
```

### Esempio Reale: Trasferimento da Sopra a Furgoni

```javascript
const pickingData = {
  picking_type_id: 3,              // Pick type
  location_id: 30,                 // Secco Sopra-02 (WH/Deposito/Secco Sopra-02)
  location_dest_id: 11,            // Furgoni (WH/Furgoni)
  scheduled_date: new Date().toISOString(),
  move_ids_without_package: [
    [0, 0, {
      name: "Trasferimento da Sopra a Furgoni",
      product_id: PRODUCT_ID,
      product_uom_qty: 8,
      product_uom: 1,
      location_id: 30,             // Secco Sopra-02
      location_dest_id: 11         // Furgoni
    }]
  ]
};
```

### Esempio Multi-Prodotto

```javascript
const pickingData = {
  picking_type_id: 3,
  location_id: 31,                 // Pingu-01
  location_dest_id: 11,            // Furgoni
  scheduled_date: new Date().toISOString(),
  move_ids_without_package: [
    [0, 0, {
      name: "Prodotto 1 da Pingu a Furgoni",
      product_id: 12968,
      product_uom_qty: 5,
      product_uom: 1,
      location_id: 31,
      location_dest_id: 11
    }],
    [0, 0, {
      name: "Prodotto 2 da Pingu a Furgoni",
      product_id: 13456,
      product_uom_qty: 10,
      product_uom: 1,
      location_id: 31,
      location_dest_id: 11
    }],
    [0, 0, {
      name: "Prodotto 3 da Pingu a Furgoni",
      product_id: 14789,
      product_uom_qty: 3,
      product_uom: 1,
      location_id: 31,
      location_dest_id: 11
    }]
  ]
};
```

---

## 6. CODICE PER CREARE PICKING

### Usando odoo-xmlrpc

```javascript
const Odoo = require('odoo-xmlrpc');

const odoo = new Odoo({
  url: 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com',
  db: 'lapadevadmin-lapa-v2-main-7268478',
  username: 'apphubplatform@lapa.ch',
  password: 'apphubplatform2025'
});

async function createInternalTransfer(fromLocationId, toLocationId, products) {
  return new Promise((resolve, reject) => {
    odoo.connect(function(err) {
      if (err) return reject(err);

      const pickingData = {
        picking_type_id: 3,  // Pick type
        location_id: fromLocationId,
        location_dest_id: toLocationId,
        scheduled_date: new Date().toISOString(),
        move_ids_without_package: products.map(product => [0, 0, {
          name: `Trasferimento ${product.name}`,
          product_id: product.id,
          product_uom_qty: product.qty,
          product_uom: product.uom || 1,
          location_id: fromLocationId,
          location_dest_id: toLocationId
        }])
      };

      odoo.execute_kw('stock.picking', 'create', [[pickingData]],
        (err, pickingId) => {
          if (err) return reject(err);

          console.log(`Picking creato con ID: ${pickingId}`);

          // Opzionale: conferma automaticamente il picking
          odoo.execute_kw('stock.picking', 'action_confirm', [[pickingId]],
            (err, result) => {
              if (err) return reject(err);
              console.log(`Picking ${pickingId} confermato`);
              resolve(pickingId);
            }
          );
        }
      );
    });
  });
}

// Esempio di utilizzo
const products = [
  { id: 12968, name: 'PICI 1KG', qty: 5, uom: 1 },
  { id: 13456, name: 'ALTRO PROD', qty: 10, uom: 1 }
];

createInternalTransfer(31, 11, products)  // Da Pingu a Furgoni
  .then(pickingId => console.log('Successo:', pickingId))
  .catch(err => console.error('Errore:', err));
```

---

## 7. STRUTTURA ESEMPIO PICKING ESISTENTE

### Esempio Picking Reale (ID: 27656)

```json
{
  "id": 27656,
  "name": "WH/PICK/13751",
  "state": "done",
  "picking_type_id": [3, "EMBRACH: Pick"],
  "picking_type_code": "internal",
  "location_id": [8, "WH/Deposito"],
  "location_dest_id": [11, "WH/Furgoni"],
  "scheduled_date": "2024-04-25 12:00:00",
  "date_done": "2024-04-25 05:50:19",
  "move_ids_without_package": [189786],
  "move_type": "direct",
  "origin": "S12754",
  "partner_id": [6069, "Franco Martorelli Rest. La Vista..."],
  "user_id": [268, "RAZVAN CUC"],
  "driver_id": [30, "Razvan Cuc"],
  "vehicle_id": [10, "IVECO/IVECO/Daily 35 S 17/ZH965948"],
  "carrier_id": [5, "GIRO LAGO SUD"]
}
```

### Stock Move Associato

```json
{
  "id": 189786,
  "name": "PICI 1KG CA 6KG CRT MARC",
  "product_id": [12968, "PICI 1KG CA 6KG CRT MARC"],
  "product_uom_qty": 3,
  "product_uom": [3, "kg"],
  "location_id": [8, "WH/Deposito"],
  "location_dest_id": [11, "WH/Furgoni"],
  "state": "done",
  "picking_id": [27656, "WH/PICK/13751"]
}
```

---

## 8. RIEPILOGO ID CHIAVE

### Ubicazioni Buffer
- **Pingu (RUM)**: 23
- **Pingu-01 (WH)**: 31
- **Frigo-01**: 28
- **Secco Sopra-02**: 30

### Ubicazioni Furgoni
- **Furgoni**: 11

### Picking Types
- **Pick (Deposito -> Furgoni)**: 3
- **Internal Transfers**: 5
- **Trasferimenti interni (RUM)**: 12

### Altri ID Utili
- **WH/Deposito**: 8
- **Company ID**: 1
- **UoM Unità**: 1
- **UoM kg**: 3

---

## 9. NOTE IMPORTANTI

1. **Sintassi Array One2many/Many2many**:
   - `[0, 0, {...}]` = crea nuovo record
   - `[1, id, {...}]` = aggiorna record esistente
   - `[2, id]` = elimina record
   - `[3, id]` = unlink record
   - `[4, id]` = link record esistente
   - `[5]` = unlink tutti
   - `[6, 0, [ids]]` = sostituisci con lista

2. **Stati Picking**:
   - `draft`: bozza
   - `waiting`: in attesa
   - `confirmed`: confermato
   - `assigned`: pronto
   - `done`: completato
   - `cancel`: annullato

3. **Workflow Picking**:
   - Crea picking -> `action_confirm()` -> `action_assign()` -> `button_validate()`

4. **Move Type**:
   - `direct`: consegna parziale consentita
   - `one`: consegna tutto insieme

5. **Procure Method**:
   - `make_to_stock`: prendi da stock esistente
   - `make_to_order`: crea procurement

---

## 10. QUERY UTILI

### Cerca tutti i picking da una ubicazione specifica
```javascript
odoo.execute_kw('stock.picking', 'search_read', [[
  [['location_id', '=', 31]],  // Da Pingu-01
  ['id', 'name', 'state', 'location_dest_id', 'scheduled_date']
]], callback);
```

### Cerca stock disponibile in una ubicazione
```javascript
odoo.execute_kw('stock.quant', 'search_read', [[
  [
    ['location_id', '=', 31],  // Pingu-01
    ['quantity', '>', 0]
  ],
  ['product_id', 'quantity', 'location_id', 'lot_id']
]], callback);
```

### Ottieni dettagli prodotto
```javascript
odoo.execute_kw('product.product', 'search_read', [[
  [['id', '=', 12968]],
  ['name', 'default_code', 'uom_id', 'uom_po_id']
]], callback);
```

---

**Data analisi**: 2025-11-08
**Database**: lapadevadmin-lapa-v2-main-7268478
**URL Odoo**: https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com
