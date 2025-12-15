/**
 * PROMPT PER CLASSIFICAZIONE DOCUMENTI - Gemini
 *
 * Questo prompt classifica i documenti PRIMA di estrarli.
 * Identifica quali sono validi per fare un arrivo merce.
 *
 * USATO DA: app/api/gestione-arrivi/classify-documents/route.ts
 */

export function buildClassifyPrompt(documentCount: number = 1): string {
  return `Analizza ${documentCount > 1 ? `questi ${documentCount} documenti` : 'questo documento'} e classificali.
NON estrarre i dati dei prodotti, solo classificare il tipo di documento.

Per OGNI documento, identifica:
1. Il tipo di documento
2. Se è valido per fare un arrivo merce
3. Il fornitore/emittente del documento
4. Il numero del documento (se presente)

TIPI DI DOCUMENTO:
- "fattura_fornitore" = Fattura/Rechnung/Invoice/Facture emessa DAL fornitore (ha prezzi, totali, IVA)
- "ddt_fornitore" = DDT/Lieferschein/Delivery Note/Bon de livraison del fornitore (documento di trasporto)
- "packing_list" = Lista di imballaggio/Packing List con lotti e scadenze
- "scontrino" = Scontrino/ricevuta fiscale/Quittung/Receipt del fornitore
- "ordine_interno" = Ordine di acquisto (P.O./Purchase Order/Bestellung) - documento INVIATO al fornitore, non ricevuto. Riconoscibile perché ha come intestazione/emittente l'azienda che ordina, NON il fornitore.
- "conferma_ordine" = Conferma d'ordine/Order Confirmation/Auftragsbestätigung ricevuta dal fornitore (senza dettaglio prodotti completo)
- "altro" = Foto, comunicazioni, email, documenti non classificabili

COME DISTINGUERE ORDINE INTERNO vs FATTURA FORNITORE:
- ORDINE INTERNO: L'intestazione/logo è dell'azienda che ORDINA (es. "LAPA Srl", "LAPA AG"). È il documento che VOI avete inviato al fornitore.
- FATTURA FORNITORE: L'intestazione/logo è del FORNITORE (es. "ALIGRO", "Freshlink", "Bigler"). È il documento che il fornitore vi ha mandato.

DOCUMENTI VALIDI per arrivo merce: fattura_fornitore, ddt_fornitore, packing_list, scontrino
DOCUMENTI NON VALIDI (da ignorare): ordine_interno, conferma_ordine, altro

Output JSON:
{
  "documents": [
    {
      "document_index": 0,
      "document_type": "fattura_fornitore",
      "is_valid_for_arrival": true,
      "emittente": "Nome del fornitore che ha emesso il documento",
      "numero_documento": "FAT-2024-001",
      "description": "Breve descrizione del documento (es: Fattura con 6 prodotti alimentari)"
    }
  ],
  "valid_document_indices": [0],
  "has_valid_documents": true,
  "summary": "Riepilogo in italiano: quanti documenti validi trovati e quali ignorati"
}

ESEMPIO OUTPUT per 2 documenti (1 valido, 1 non valido):
{
  "documents": [
    {
      "document_index": 0,
      "document_type": "fattura_fornitore",
      "is_valid_for_arrival": true,
      "emittente": "ALIGRO Demaurex & Cie SA",
      "numero_documento": "FAT-2024-12345",
      "description": "Fattura con 6 prodotti alimentari, totale CHF 1'234.50"
    },
    {
      "document_index": 1,
      "document_type": "ordine_interno",
      "is_valid_for_arrival": false,
      "emittente": "LAPA Srl",
      "numero_documento": "P11436",
      "description": "Ordine di acquisto interno inviato al fornitore ALIGRO"
    }
  ],
  "valid_document_indices": [0],
  "has_valid_documents": true,
  "summary": "Trovata 1 fattura valida (ALIGRO FAT-2024-12345). 1 documento ignorato: ordine interno P11436."
}

ESEMPIO OUTPUT quando NON ci sono documenti validi:
{
  "documents": [
    {
      "document_index": 0,
      "document_type": "ordine_interno",
      "is_valid_for_arrival": false,
      "emittente": "LAPA Srl",
      "numero_documento": "P11436",
      "description": "Ordine di acquisto interno"
    }
  ],
  "valid_document_indices": [],
  "has_valid_documents": false,
  "summary": "Nessun documento valido trovato. Presente solo: ordine interno P11436. Caricare fattura o DDT del fornitore."
}`;
}
