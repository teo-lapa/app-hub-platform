// Types per l'app Gestione Arrivi - Flusso Automatizzato

// === ARRIVI ===

export interface ArrivalInvoice {
  id: number;
  name: string;
  state: string;
  ref: string | null;
  invoice_date: string | null;
}

export interface Arrival {
  id: number;
  name: string;
  partner_id: number;
  partner_name: string;
  scheduled_date: string;
  state: string;
  origin: string;
  purchase_order_id: number | null;
  purchase_order_name: string | null;
  attachments_count: number;
  attachments?: ArrivalAttachment[];
  products_count: number;
  // Fattura collegata
  invoice: ArrivalInvoice | null;
  has_invoice: boolean;
  // Flags
  has_purchase_order: boolean;
  has_attachments: boolean;
  is_ready: boolean;
  is_completed: boolean;
  is_processed: boolean; // Completato + fattura = verde
}

export interface ArrivalAttachment {
  id: number;
  name: string;
  mimetype: string;
  file_size: number;
  create_date: string;
}

// === DOCUMENTI ESTRATTI ===

export interface ExtractedLine {
  description: string;
  product_code?: string;
  quantity: number;
  unit: string;
  unit_price?: number;
  subtotal?: number;
  tax_rate?: number;
  lot_number?: string;
  expiry_date?: string;
  discount?: number;
}

export interface ExtractedDocument {
  attachment_id: number;
  filename: string;
  document_type: 'invoice' | 'ddt' | 'order' | 'other';
  supplier: {
    name: string;
    vat?: string;
  };
  document_info: {
    number: string;
    date: string;
    total?: number;
    subtotal?: number;
    tax?: number;
  };
  lines: ExtractedLine[];
}

// === TRASCRIZIONE JSON ===

export interface TranscriptionJSON {
  source_picking_id: number;
  source_picking_name: string;
  extracted_at: string;
  documents_read: {
    attachment_id: number;
    filename: string;
    document_type: string;
  }[];
  supplier: {
    name: string;
    vat?: string;
  };
  invoice: {
    number: string;
    date: string;
    total: number;
    subtotal: number;
    tax: number;
  };
  lines: ExtractedLine[];
}

// === PROCESSING ===

export type ProcessingStatus =
  | 'pending'
  | 'reading_documents'
  | 'transcribing'
  | 'processing_arrival'
  | 'validating_picking'
  | 'creating_invoice'
  | 'attaching_documents'
  | 'completed'
  | 'error';

export interface ArrivalProcessingState {
  arrival_id: number;
  arrival_name: string;
  status: ProcessingStatus;
  progress: number; // 0-100
  current_step: string;
  error?: string;
  result?: ProcessingResult;
}

export interface ProcessingResult {
  success: boolean;
  picking_validated: boolean;
  invoice_created: boolean;
  invoice_id?: number;
  invoice_name?: string;
  documents_attached: number;
  lines_updated: number;
  lines_created: number;
  lines_set_to_zero: number;
  unmatched_products: number;
  errors: string[];
  warnings: string[];
}

// === BATCH PROCESSING ===

export interface BatchProcessingState {
  is_running: boolean;
  total: number;
  completed: number;
  current_arrival?: ArrivalProcessingState;
  results: ArrivalProcessingState[];
}

// === API RESPONSES ===

export interface ListTodayResponse {
  success: boolean;
  date: string;
  count: number;
  arrivals: Arrival[];
}

export interface ReadDocumentsResponse {
  success: boolean;
  documents: ExtractedDocument[];
  combined_lines: ExtractedLine[];
  supplier: {
    name: string;
    vat?: string;
  };
  invoice_info: {
    number: string;
    date: string;
    total: number;
  };
}

export interface ProcessArrivalResponse {
  success: boolean;
  picking_id: number;
  picking_name: string;
  picking_validated: boolean;
  lines_updated: number;
  lines_created: number;
  lines_set_to_zero: number;
  unmatched_products: ExtractedLine[];
  errors: string[];
}

export interface CreateInvoiceResponse {
  success: boolean;
  invoice_id: number;
  invoice_name: string;
  amount_total: number;
  attachment_id?: number;
  error?: string;
}
