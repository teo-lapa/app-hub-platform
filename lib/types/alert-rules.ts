// Types per Alert Rules System

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low';
export type AlertType = 'margin_negative' | 'price_zero' | 'price_discrepancy' | 'high_discount' | 'cost_increase';

export interface AlertRule {
  id: string;
  name: string;
  type: AlertType;
  severity: AlertSeverity;
  enabled: boolean;
  threshold?: number; // Soglia personalizzabile
  emailNotify: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  productId?: number;
  productName?: string;
  customerId?: number;
  customerName?: string;
  orderId?: number;
  orderName?: string;
  invoiceId?: number;
  invoiceName?: string;
  value: number; // Valore anomalo (es. margine negativo -15%)
  threshold: number; // Soglia configurata
  createdAt: string;
  acknowledged: boolean;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
}

export interface AlertStats {
  totalAlerts: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  unacknowledgedCount: number;
  byType: {
    [key in AlertType]?: number;
  };
}

export interface AlertsResponse {
  success: boolean;
  alerts: Alert[];
  stats: AlertStats;
  rules: AlertRule[];
  performanceMs: number;
  error?: string;
}

// Default alert rules
export const DEFAULT_ALERT_RULES: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Margine Negativo',
    type: 'margin_negative',
    severity: 'critical',
    enabled: true,
    threshold: 0,
    emailNotify: true,
  },
  {
    name: 'Prezzo Zero su Fatture >1000 CHF',
    type: 'price_zero',
    severity: 'high',
    enabled: true,
    threshold: 1000,
    emailNotify: true,
  },
  {
    name: 'Discrepanza Prezzo >20%',
    type: 'price_discrepancy',
    severity: 'high',
    enabled: true,
    threshold: 20,
    emailNotify: false,
  },
  {
    name: 'Sconto Eccessivo >30%',
    type: 'high_discount',
    severity: 'medium',
    enabled: true,
    threshold: 30,
    emailNotify: false,
  },
  {
    name: 'Aumento Costo >15%',
    type: 'cost_increase',
    severity: 'medium',
    enabled: false,
    threshold: 15,
    emailNotify: false,
  },
];
