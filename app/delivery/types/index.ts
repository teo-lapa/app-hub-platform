export interface Delivery {
  id: number;
  name: string;
  customer: string;
  customerName: string;
  address: string;
  phone: string;
  lat: number | null;
  lng: number | null;
  latitude?: number;
  longitude?: number;
  products: Product[];
  note: string;
  state: 'assigned' | 'done' | 'cancel';
  origin: string;
  carrier: string;
  scheduledDate: string;
  backorderId?: any;
  isBackorder: boolean;
  completed: boolean;
  eta?: number;
  sequence?: number;
  amount_total?: number;
  payment_status?: 'paid' | 'to_pay' | 'partial';
  sale_id?: [number, string];
  partner_street?: string;
  partner_city?: string;
  partner_zip?: string;
  partner_phone?: string;
  partner_id?: [number, string];
}

export interface Product {
  id: number;
  name: string;
  qty: number;
  image: string | null;
  category: string;
  delivered: number; // Quantità scaricata
  note?: string;
  completed?: boolean;
  picked?: boolean;
  product_id?: number;
  move_line_id?: number; // ID della stock.move.line
  quantity_done?: number;
  reso_qty?: number;
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
