// Configurazione Odoo 17
export interface OdooConfig {
  host: string;
  database: string;
  username: string;
  password: string;
  port?: number;
  protocol?: 'http' | 'https';
}

export interface OdooAuthResponse {
  uid: number;
  session_id: string;
  user_context: Record<string, any>;
}

export interface OdooResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  error_code?: string;
}

// Configurazione di default (da environment variables)
export const getOdooConfig = (): OdooConfig => ({
  host: process.env.ODOO_HOST || 'localhost',
  database: process.env.ODOO_DATABASE || 'odoo',
  username: process.env.ODOO_USERNAME || 'admin',
  password: process.env.ODOO_PASSWORD || 'admin',
  port: parseInt(process.env.ODOO_PORT || '8069'),
  protocol: (process.env.ODOO_PROTOCOL as 'http' | 'https') || 'http',
});

// Endpoints Odoo disponibili
export const ODOO_ENDPOINTS = {
  // Authentication
  LOGIN: '/web/session/authenticate',
  LOGOUT: '/web/session/destroy',
  SESSION_INFO: '/web/session/get_session_info',

  // JSON-RPC
  JSONRPC: '/jsonrpc',

  // Common endpoints
  CALL_KW: '/web/dataset/call_kw',
  SEARCH_READ: '/web/dataset/search_read',

  // File uploads
  UPLOAD_ATTACHMENT: '/web/binary/upload_attachment',

  // Reports
  REPORT_PDF: '/web/report/pdf',
} as const;

// Modelli Odoo comunemente usati
export const ODOO_MODELS = {
  // Core models
  USERS: 'res.users',
  PARTNERS: 'res.partner',
  COMPANIES: 'res.company',

  // Sales & CRM
  SALES_ORDER: 'sale.order',
  SALES_ORDER_LINE: 'sale.order.line',
  CRM_LEAD: 'crm.lead',

  // Inventory
  PRODUCT_PRODUCT: 'product.product',
  PRODUCT_TEMPLATE: 'product.template',
  PRODUCT_CATEGORY: 'product.category',
  STOCK_MOVE: 'stock.move',
  STOCK_PICKING: 'stock.picking',

  // Accounting
  ACCOUNT_MOVE: 'account.move',
  ACCOUNT_MOVE_LINE: 'account.move.line',
  ACCOUNT_PAYMENT: 'account.payment',

  // HR
  HR_EMPLOYEE: 'hr.employee',
  HR_DEPARTMENT: 'hr.department',

  // Custom models (esempi per App Hub)
  RESTAURANT_MENU: 'restaurant.menu',
  RESTAURANT_CATEGORY: 'restaurant.menu.category',
  BOOKING_RESERVATION: 'booking.reservation',

} as const;

export type OdooModel = typeof ODOO_MODELS[keyof typeof ODOO_MODELS];