/**
 * PROMPT CONDIVISO PER GEMINI - PARSING FATTURE/PACKING LIST
 *
 * Questo prompt è usato da TUTTE le API di arrivo-merce:
 * - parse-invoice (upload manuale)
 * - parse-attachment (singolo allegato da Odoo)
 * - parse-multiple-attachments (multipli allegati da Odoo)
 *
 * ⚠️ MODIFICARE SOLO QUI! NON duplicare questo prompt nelle API!
 */

export function buildGeminiPrompt(documentCount: number = 1): string {
  return `Estrai i dati dalla fattura o packing list.

IMPORTANTE: ${documentCount > 1 ? `Ti ho inviato ${documentCount} documento/i. Analizzali TUTTI insieme.` : 'Questo documento può essere una FATTURA o una PACKING LIST.'}

🔴 PRIORITÀ DATI (FONDAMENTALE):
1. **QUANTITÀ e DESCRIZIONE**: Prendi SEMPRE dalla FATTURA (documento principale con prezzi)
2. **LOTTO e SCADENZA**: Se NON presenti nella FATTURA, cercali nel Packing List

REGOLE PER DOCUMENTI MULTIPLI:
- Se vedi una FATTURA + Packing List: usa quantità/descrizione dalla FATTURA
- Se il Packing List ha lotti/scadenze che mancano nella FATTURA, integra solo quelli
- NON sostituire le quantità della fattura con quelle del packing list
- Le quantità del packing list (Net Weight KG) sono solo di trasporto, NON di vendita

UNITÀ DI MISURA SUPPORTATE:
- CT = Cartoni (unità di vendita principale)
- KG = Chilogrammi
- PZ = Pezzi
- LT = Litri
- NR = Numero
- GR = Grammi

ESTRAZIONE QUANTITÀ (FONDAMENTALE):
1. PRIORITÀ ASSOLUTA: Colonna "Quantità KG" o "Quantity" o "Qty" dalla FATTURA
2. Se vedi colonne "Quantità KG" + "Um2" (PZ): USA SEMPRE I KG, MAI I PZ
3. La colonna "Um2" o "Quantità PZ" contiene i colli/cartoni di trasporto, NON la quantità venduta
4. Se è l'unico documento e hai solo Packing List: usa "Net Weight" (KG)
5. NON mescolare quantità fattura con pesi packing list

ESEMPIO CRITICO - Fattura con doppia unità di misura:
FATTURA: VI2500JN1MN | Julienne Taglio Napoli | Quantità KG: 250,000 | Um2: 100,000 PZ
→ ✅ CORRETTO: quantity: 250, unit: "KG"
→ ❌ SBAGLIATO: quantity: 100, unit: "PZ" (questa è solo il numero di colli!)

ESEMPI:

Esempio 1 - SOLO FATTURA:
FATTURA: A0334SG | ARAN DI RISO | Qty: 18 CT | Lotto: 25233 | Scad: 12/02/27
→ quantity: 18, unit: "CT", lot: "25233", expiry: "2027-02-12"

Esempio 2 - SOLO PACKING LIST:
PACKING LIST: A01498 | ASIAGO DOP | Qty: 4 CT | Net Weight: 50,37 KG | Lotto: L68S25T1
→ quantity: 50.37, unit: "KG", lot: "L68S25T1"
(Se è l'unico documento, usa Net Weight)

Esempio 3 - FATTURA CON DOPPIA UNITÀ (CASO TAMBURRO):
FATTURA: VI2500JN1MN | Julienne "Taglio Napoli" | Quantità KG: 250,000 | € al Pezzo: 15,2500 | Um2: 100,000 PZ
→ ✅ CORRETTO: quantity: 250, unit: "KG"
   (Usa sempre i KG dalla colonna "Quantità KG", ignora la colonna Um2 con i pezzi)
→ ❌ SBAGLIATO: quantity: 100, unit: "PZ"
   (NON usare Um2! I PZ sono solo colli di trasporto)

Esempio 4 - FATTURA + PACKING LIST (CASO CRITICO):
FATTURA: A01498 | ASIAGO DOP FRESCO | Qty: 4 CT | Prezzo: €120
PACKING LIST: A01498 | ASIAGO DOP | Net Weight: 50,37 KG | Lotto: L68S25T1 | Scad: 24/02/26
→ ✅ CORRETTO: quantity: 4, unit: "CT", lot: "L68S25T1", expiry: "2026-02-24"
   (Quantità dalla FATTURA, lotto/scadenza dal Packing List)
→ ❌ SBAGLIATO: quantity: 50.37, unit: "KG"
   (NON usare i KG del packing list se c'è la fattura!)

Output JSON:
{
  "supplier_name": "nome fornitore",
  "document_number": "numero",
  "document_date": "YYYY-MM-DD",
  "products": [
    {
      "article_code": "A0334SG",
      "description": "ARAN DI RISO SUGO 25 g",
      "quantity": 18,
      "unit": "CT",
      "lot_number": "25233",
      "expiry_date": "2027-02-12"
    }
  ]
}`;
}
