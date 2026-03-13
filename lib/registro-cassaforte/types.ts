// Shared types for Registro Cassaforte

export interface Employee {
  id: number;
  name: string;
  work_email: string;
  department_id?: [number, string];
  has_face_enrolled: boolean;
}

export interface PendingPayment {
  picking_id: number;
  picking_name: string;
  partner_id: number;
  partner_name: string;
  amount: number;
  date: string;
  driver_name: string;
  invoice_id?: number | null;
  invoice_name?: string | null;
  invoice_amount?: number | null;
}

export interface BanknoteCount {
  denomination: number;
  count: number;
  serial_numbers: string[];
}

export interface CoinCount {
  denomination: number;
  count: number;
}

export interface DepositSession {
  employee_id: number;
  employee_name: string;
  type: 'from_delivery' | 'extra';
  picking_ids?: number[];
  expected_amount?: number;
  customer_name?: string;
  banknotes: BanknoteCount[];
  coins: CoinCount[];
  total: number;
  video_session_id?: string;
  started_at: string;
}

export interface EnrolledFace {
  employee_id: number;
  employee_name: string;
  embedding: number[];
}

export type AppStep =
  | 'idle'
  | 'face_scan'
  | 'enrollment'
  | 'face_enroll'
  | 'welcome'
  | 'select_type'
  | 'select_pickings'
  | 'extra_input'
  | 'counting'
  | 'banknote_scan'
  | 'photo_capture'
  | 'confirm'
  | 'success';
