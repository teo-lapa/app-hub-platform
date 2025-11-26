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
  salesperson?: string | null;
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

// ==================== VEHICLE CHECK TYPES ====================

export interface VehicleCheckItem {
  id: string;
  label: string;
  status: 'unchecked' | 'ok' | 'issue';
  note?: string;
  photos: VehicleCheckPhoto[];
  resolved?: boolean;
  resolved_date?: string;
}

export interface VehicleCheckPhoto {
  id: string;
  item_id: string;
  category_id: string;
  data: string; // base64
  preview?: string;
  uploaded: boolean;
  odoo_attachment_id?: number;
  timestamp: Date;
}

export interface VehicleCheckCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  items: VehicleCheckItem[];
}

export interface VehicleCheckData {
  check_id: string;
  check_date: string;
  driver_id: number;
  driver_name: string;
  vehicle_id: number;
  vehicle_name: string;
  vehicle_license_plate?: string;
  odometer?: number; // Chilometri del veicolo
  categories: VehicleCheckCategory[];
  summary: {
    total_items: number;
    ok_count: number;
    issue_count: number;
    unchecked_count: number;
    open_issues: number;
    resolved_issues: number;
  };
}

export interface VehicleInfo {
  id: number;
  name: string;
  license_plate: string;
  category_id: number | null;
  category_name: string | null;
}

export interface OpenIssue {
  id: string;
  category: string;
  category_id: string;
  item: string;
  item_id: string;
  note: string;
  reported_date: string;
  photos: VehicleCheckPhoto[];
  resolved: boolean;
  persistence_count?: number;
}
