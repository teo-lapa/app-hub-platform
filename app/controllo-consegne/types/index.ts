// Types for Controllo Consegne App

export type AttachmentType = 'signature' | 'photo' | 'payment' | 'reso';

export interface DeliveryDocument {
  id: number;
  picking_name: string;
  customer_name: string;
  driver_name: string;
  vehicle: string;
  delivery_address: string;
  completion_time: string;
  completion_date: string;

  // Attachments by type
  attachments: {
    signature?: DocumentAttachment;
    photo?: DocumentAttachment;
    payment?: DocumentAttachment;
    reso?: DocumentAttachment;
  };

  // Payment details (if applicable)
  payment_amount?: number;
  payment_method?: 'cash' | 'card' | 'bonifico';

  // Reso details (if applicable)
  reso_note?: string;
  reso_products?: any[];
}

export interface DocumentAttachment {
  id: number;
  type: AttachmentType;
  data: string; // Base64 image or URL
  timestamp: string;
  note?: string;
  odoo_attachment_id?: number;
}

export interface FilterState {
  date: string; // Format: YYYY-MM-DD
  activeType: AttachmentType | 'all';
}
