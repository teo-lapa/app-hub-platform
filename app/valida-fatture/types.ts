// Types per Valida Fatture Bozza

// Fattura bozza da Odoo
export interface DraftInvoice {
  id: number;
  name: string;
  partner_id: [number, string]; // [id, nome fornitore]
  company_id: [number, string]; // [id, nome azienda]
  invoice_date: string | false;
  amount_untaxed: number;
  amount_tax: number;
  amount_total: number;
  currency_id: [number, string];
  state: 'draft' | 'posted' | 'cancel';
  move_type: 'in_invoice' | 'out_invoice' | 'in_refund' | 'out_refund';
  ref?: string; // Riferimento fornitore
  invoice_origin?: string;
  has_attachment: boolean; // Custom field che calcoliamo noi
  attachment_ids?: number[];
}

// Dettaglio completo fattura con righe
export interface DraftInvoiceDetail extends DraftInvoice {
  invoice_line_ids: InvoiceLine[];
  attachments: InvoiceAttachment[];
}

// Riga fattura
export interface InvoiceLine {
  id: number;
  product_id: [number, string] | false;
  name: string; // Descrizione
  quantity: number;
  price_unit: number;
  price_subtotal: number;
  price_total: number;
  tax_ids: number[];
  discount?: number;
  product_uom_id?: [number, string];
}

// Allegato PDF
export interface InvoiceAttachment {
  id: number;
  name: string;
  datas_fname?: string;
  mimetype: string;
  file_size?: number;
  create_date: string;
  datas?: string; // Base64 PDF content
}

// Dati estratti dal PDF con Claude Vision
export interface ParsedInvoiceData {
  supplier_name: string;
  supplier_vat?: string;
  invoice_number?: string;
  invoice_date?: string;
  total_amount: number;
  subtotal_amount?: number;
  tax_amount?: number;
  currency?: string;
  lines: ParsedInvoiceLine[];
}

// Riga fattura parsata dal PDF
export interface ParsedInvoiceLine {
  description: string;
  product_code?: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  tax_rate?: number;
  unit?: string;
}

// Risultato del confronto AI
export interface ComparisonResult {
  is_valid: boolean;
  total_difference: number; // Differenza in euro
  differences: InvoiceDifference[];
  corrections_needed: CorrectionAction[];
  can_auto_fix: boolean;
}

// Differenza trovata
export interface InvoiceDifference {
  type: 'missing_product' | 'extra_product' | 'price_mismatch' | 'quantity_mismatch' | 'total_mismatch';
  severity: 'critical' | 'warning' | 'info';
  draft_line_id?: number;
  description: string;
  expected_value?: any;
  actual_value?: any;
  amount_difference?: number;
}

// Azione di correzione
export interface CorrectionAction {
  action: 'update' | 'delete' | 'create' | 'manual';
  line_id?: number; // ID riga da modificare/eliminare
  changes?: Partial<InvoiceLine>; // Campi da aggiornare
  new_line?: Partial<InvoiceLine>; // Nuova riga da creare
  reason: string;
  requires_user_approval: boolean;
}

// Risultato applicazione correzioni
export interface CorrectionResult {
  success: boolean;
  updated_lines: number;
  deleted_lines: number;
  created_lines: number;
  new_total: number;
  remaining_difference: number;
  errors?: string[];
}

// Stato workflow
export type ValidationStep = 'select' | 'analyzing' | 'review' | 'manage_missing_products' | 'correcting' | 'completed' | 'error';

export interface ValidationState {
  step: ValidationStep;
  selected_invoice?: DraftInvoiceDetail;
  parsed_data?: ParsedInvoiceData;
  comparison?: ComparisonResult;
  correction_result?: CorrectionResult;
  missing_products?: MissingProductCorrection[]; // Prodotti da gestire manualmente
  iterations: number; // Quante volte ha provato a correggere
  error_message?: string;
}

// Prodotto mancante da gestire
export interface MissingProductCorrection extends CorrectionAction {
  parsed_line?: ParsedInvoiceLine; // Dati dal PDF
  suggested_products?: OdooProduct[]; // Prodotti suggeriti da Odoo
  selected_product_id?: number; // Prodotto selezionato dall'utente
}

// Prodotto Odoo per ricerca
export interface OdooProduct {
  id: number;
  name: string;
  default_code?: string;
  barcode?: string;
  list_price: number;
  standard_price: number;
  uom_id: [number, string];
  seller_ids: number[]; // IDs fornitori
}
