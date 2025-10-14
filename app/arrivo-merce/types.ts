// Types per l'app Arrivo Merce

export interface ParsedInvoiceProduct {
  article_code?: string;
  description: string;
  quantity: number;
  unit: string;
  lot_number?: string;
  expiry_date?: string;
  variant?: string; // es: "Quadrato, Verde, 250gr"
}

export interface ParsedInvoice {
  supplier_name: string;
  supplier_vat?: string;
  document_number: string;
  document_date: string;
  products: ParsedInvoiceProduct[];
}

export interface OdooPickingLine {
  id: number;
  move_id: number;
  product_id: number[];
  product_name: string;
  qty_done: number;
  lot_id: number[] | false;
  lot_name: string | false;
  expiry_date: string | false;
  product_tmpl_id?: number[];
}

export interface OdooPicking {
  id: number;
  name: string;
  partner_id: number[];
  partner_name: string;
  scheduled_date: string;
  state: string;
  move_line_ids: number[];
  move_line_ids_without_package: number[];
}

export interface MatchedProduct {
  invoice_product: ParsedInvoiceProduct;
  odoo_line?: OdooPickingLine;
  match_confidence: number;
  match_reason: string;
}

export interface ProcessingResult {
  success: boolean;
  picking_id?: number;
  picking_name?: string;
  matched_products?: MatchedProduct[];
  updated_lines?: number;
  errors?: string[];
  warnings?: string[];
}
