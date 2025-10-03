export interface Delivery {
  id: number;
  name: string;
  partner_id: [number, string];
  partner_street?: string;
  partner_city?: string;
  partner_zip?: string;
  partner_phone?: string;
  latitude?: number;
  longitude?: number;
  scheduled_date: string;
  state: 'assigned' | 'done' | 'cancel';
  origin?: string;
  note?: string;
  sale_id?: [number, string];
  amount_total?: number;
  payment_status?: 'paid' | 'to_pay' | 'partial';
  move_lines: Product[];
  eta?: number;
  sequence?: number;
}

export interface Product {
  id: number;
  product_id: [number, string];
  product_uom_qty: number;
  quantity_done: number;
  backorder_qty?: number;
  product_code?: string;
  note?: string;
  to_deliver?: boolean;
}

export interface Attachment {
  id?: number;
  picking_id: number;
  context: 'signature' | 'photo' | 'payment' | 'reso';
  data: string;
  timestamp: Date;
  uploaded: boolean;
  odoo_attachment_id?: number;
}

export interface OfflineAction {
  id?: number;
  action_type: 'validate' | 'payment' | 'reso';
  payload: any;
  timestamp: Date;
  synced: boolean;
}
