/**
 * Parser per Fatture Elettroniche PA (XML)
 * Supporta il formato standard FatturaPA 1.2
 */

export interface FatturaPAData {
  supplier_name: string;
  supplier_vat: string | null;
  invoice_number: string;
  invoice_date: string;
  subtotal_amount: number;
  tax_amount: number;
  total_amount: number;
  currency: string;
  lines: Array<{
    description: string;
    product_code: string | null;
    quantity: number;
    unit_price: number;
    subtotal: number;
    tax_rate: number;
    unit: string;
  }>;
}

/**
 * Estrae il testo da un nodo XML
 */
function getNodeText(node: any, path: string): string | null {
  const parts = path.split('/');
  let current = node;

  for (const part of parts) {
    if (!current) return null;
    if (Array.isArray(current)) {
      current = current[0];
    }
    current = current[part];
  }

  if (!current) return null;
  if (typeof current === 'string') return current;
  if (current._text) return current._text;
  if (current[0]?._text) return current[0]._text;

  return null;
}

/**
 * Estrae un numero da un nodo XML
 */
function getNodeNumber(node: any, path: string, defaultValue: number = 0): number {
  const text = getNodeText(node, path);
  if (!text) return defaultValue;

  const num = parseFloat(text.replace(',', '.'));
  return isNaN(num) ? defaultValue : num;
}

/**
 * Converte data da formato XML (YYYY-MM-DD) a standard
 */
function parseDate(dateStr: string | null): string {
  if (!dateStr) return new Date().toISOString().split('T')[0];

  // Il formato FatturaPA è YYYY-MM-DD
  return dateStr;
}

/**
 * Parse FatturaPA XML e restituisce dati strutturati
 */
export async function parseFatturaPA(xmlString: string): Promise<FatturaPAData> {
  // Usa xml2js per parsare l'XML
  const { Parser } = await import('xml2js');
  const parser = new Parser({
    explicitArray: true,
    mergeAttrs: true,
    explicitRoot: true
  });

  const result = await parser.parseStringPromise(xmlString);

  // Naviga la struttura XML della FatturaPA
  const fatturaPA = result['p:FatturaElettronica'] || result['FatturaElettronica'];
  if (!fatturaPA) {
    throw new Error('File XML non è una FatturaPA valida');
  }

  const header = fatturaPA.FatturaElettronicaHeader?.[0];
  const body = fatturaPA.FatturaElettronicaBody?.[0];

  if (!header || !body) {
    throw new Error('Struttura FatturaPA non valida');
  }

  // Estrai dati cedente/prestatore (fornitore)
  const cedente = header.CedentePrestatore?.[0];
  const datiAnagrafici = cedente?.DatiAnagrafici?.[0];
  const anagrafica = datiAnagrafici?.Anagrafica?.[0];

  const supplier_name = anagrafica?.Denominazione?.[0] ||
                        `${anagrafica?.Nome?.[0] || ''} ${anagrafica?.Cognome?.[0] || ''}`.trim();
  const supplier_vat = datiAnagrafici?.IdFiscaleIVA?.[0]?.IdCodice?.[0] || null;

  // Estrai dati generali documento
  const datiGenerali = body.DatiGenerali?.[0]?.DatiGeneraliDocumento?.[0];
  const invoice_number = datiGenerali?.Numero?.[0] || 'N/A';
  const invoice_date = parseDate(datiGenerali?.Data?.[0]);
  const currency = datiGenerali?.Divisa?.[0] || 'EUR';

  // Estrai righe dettaglio
  const dettaglioLinee = body.DatiBeniServizi?.[0]?.DettaglioLinee || [];
  const lines = dettaglioLinee.map((linea: any) => {
    const description = linea.Descrizione?.[0] || 'N/A';
    const product_code = linea.CodiceArticolo?.[0]?.CodiceValore?.[0] || null;
    const quantity = getNodeNumber(linea, 'Quantita', 1);
    const unit_price = getNodeNumber(linea, 'PrezzoUnitario', 0);
    const subtotal = getNodeNumber(linea, 'PrezzoTotale', quantity * unit_price);
    const tax_rate = getNodeNumber(linea, 'AliquotaIVA', 22);
    const unit = linea.UnitaMisura?.[0] || 'PZ';

    return {
      description,
      product_code,
      quantity,
      unit_price,
      subtotal,
      tax_rate,
      unit
    };
  });

  // Calcola totali
  type InvoiceLine = FatturaPAData['lines'][0];
  const subtotal_amount = lines.reduce((sum: number, line: InvoiceLine) => sum + line.subtotal, 0);

  // Estrai riepilogo IVA
  const riepilogoIVA = body.DatiBeniServizi?.[0]?.DatiRiepilogo || [];
  const tax_amount = riepilogoIVA.reduce((sum: number, riepilogo: any) => {
    return sum + getNodeNumber(riepilogo, 'Imposta', 0);
  }, 0);

  // Totale documento
  const datiPagamento = body.DatiPagamento?.[0]?.DettaglioPagamento?.[0];
  const total_amount = getNodeNumber(datiPagamento, 'ImportoPagamento', subtotal_amount + tax_amount);

  return {
    supplier_name,
    supplier_vat,
    invoice_number,
    invoice_date,
    subtotal_amount: parseFloat(subtotal_amount.toFixed(2)),
    tax_amount: parseFloat(tax_amount.toFixed(2)),
    total_amount: parseFloat(total_amount.toFixed(2)),
    currency,
    lines
  };
}

/**
 * Verifica se un file è una FatturaPA XML
 */
export function isFatturaPA(content: string): boolean {
  return content.includes('FatturaElettronica') &&
         (content.includes('xmlns') || content.includes('FatturaElettronicaHeader'));
}
