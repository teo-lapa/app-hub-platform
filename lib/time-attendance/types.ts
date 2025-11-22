/**
 * Time & Attendance - TypeScript Types
 * Definizioni di tutti i tipi per il modulo presenze
 */

// ========== ORGANIZATIONS ==========

export type OrganizationPlan = 'free' | 'starter' | 'pro' | 'enterprise';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone?: string;
  address?: string;
  logo_url?: string;

  // Piano e limiti
  plan: OrganizationPlan;
  max_employees: number;

  // Features
  geofencing_enabled: boolean;
  auto_clock_enabled: boolean;
  photo_required: boolean;

  // Impostazioni
  timezone: string;
  settings: Record<string, any>;

  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateOrganizationInput {
  name: string;
  slug: string;
  email: string;
  phone?: string;
  address?: string;
  timezone?: string;
}

// ========== EMPLOYEES ==========

export type EmployeeRole = 'admin' | 'manager' | 'employee';

export interface Employee {
  id: string;
  org_id: string;

  email: string;
  name: string;
  phone?: string;
  avatar_url?: string;

  role: EmployeeRole;

  hourly_rate?: number;
  contract_hours_per_week?: number;

  is_active: boolean;
  last_login_at?: Date;

  // GDPR
  gps_consent: boolean;
  gps_consent_at?: Date;
  notifications_consent: boolean;

  created_at: Date;
  updated_at: Date;
}

export interface CreateEmployeeInput {
  org_id: string;
  email: string;
  name: string;
  password: string;
  phone?: string;
  role?: EmployeeRole;
  hourly_rate?: number;
  contract_hours_per_week?: number;
}

export interface EmployeeWithStatus extends Employee {
  is_on_duty: boolean;
  last_entry_type?: TimeEntryType;
  last_entry_time?: Date;
  location_name?: string;
}

// ========== WORK LOCATIONS ==========

export interface WorkLocation {
  id: string;
  org_id: string;

  name: string;
  address?: string;

  latitude: number;
  longitude: number;
  radius_meters: number;

  timezone: string;
  is_primary: boolean;
  is_active: boolean;

  created_at: Date;
  updated_at: Date;
}

export interface CreateWorkLocationInput {
  org_id: string;
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  radius_meters?: number;
  is_primary?: boolean;
}

// ========== SHIFTS ==========

export interface Shift {
  id: string;
  org_id: string;

  name: string;
  start_time: string; // "HH:MM"
  end_time: string; // "HH:MM"
  break_minutes: number;

  days_of_week: number[]; // 1=Mon, 7=Sun
  color: string;
  is_active: boolean;

  created_at: Date;
  updated_at: Date;
}

export interface CreateShiftInput {
  org_id: string;
  name: string;
  start_time: string;
  end_time: string;
  break_minutes?: number;
  days_of_week?: number[];
  color?: string;
}

export interface EmployeeShift {
  id: string;
  employee_id: string;
  shift_id: string;
  location_id?: string;

  valid_from: Date;
  valid_to?: Date;

  notes?: string;
  created_at: Date;
}

// ========== TIME ENTRIES ==========

export type TimeEntryType = 'clock_in' | 'clock_out' | 'break_start' | 'break_end';
export type ClockMethod = 'manual' | 'geofence_auto' | 'kiosk' | 'nfc' | 'qr';

export interface TimeEntry {
  id: string;
  org_id: string;
  employee_id: string;
  location_id?: string;

  entry_type: TimeEntryType;
  timestamp: Date;

  // Geolocation
  latitude?: number;
  longitude?: number;
  accuracy_meters?: number;
  is_within_geofence?: boolean;

  // Method
  clock_method: ClockMethod;
  device_info: DeviceInfo;

  // Edit audit
  is_edited: boolean;
  edited_by?: string;
  edited_at?: Date;
  edit_reason?: string;
  original_timestamp?: Date;

  note?: string;
  photo_url?: string;

  created_at: Date;
}

export interface DeviceInfo {
  user_agent?: string;
  device_id?: string;
  platform?: string;
  app_version?: string;
}

export interface CreateTimeEntryInput {
  org_id: string;
  employee_id: string;
  entry_type: TimeEntryType;
  timestamp?: Date; // Default: now
  location_id?: string;
  latitude?: number;
  longitude?: number;
  accuracy_meters?: number;
  is_within_geofence?: boolean;
  clock_method?: ClockMethod;
  device_info?: DeviceInfo;
  note?: string;
  photo_url?: string;
}

// ========== TIME ENTRY REQUESTS ==========

export type RequestType = 'add_entry' | 'edit_entry' | 'delete_entry';
export type RequestStatus = 'pending' | 'approved' | 'rejected';

export interface TimeEntryRequest {
  id: string;
  org_id: string;
  employee_id: string;

  request_type: RequestType;
  target_entry_id?: string;

  requested_data: Partial<CreateTimeEntryInput>;
  reason: string;

  status: RequestStatus;
  reviewed_by?: string;
  reviewed_at?: Date;
  review_note?: string;

  created_at: Date;
}

// ========== DAILY SUMMARY ==========

export interface DailyWorkSummary {
  org_id: string;
  employee_id: string;
  employee_name: string;
  work_date: Date;
  first_clock_in?: Date;
  last_clock_out?: Date;
  clock_in_count: number;
  clock_out_count: number;
  total_hours?: number;
  total_break_minutes?: number;
}

// ========== GEOFENCING ==========

export interface GeofenceStatus {
  isInsideGeofence: boolean;
  currentLocation: {
    lat: number;
    lng: number;
  } | null;
  nearestLocation: WorkLocation | null;
  distanceMeters: number | null;
  accuracy: number | null;
  lastUpdate: Date | null;
  error: string | null;
}

// ========== REPORTS ==========

export interface WorkHoursReport {
  employee_id: string;
  employee_name: string;
  period_start: Date;
  period_end: Date;
  total_days_worked: number;
  total_hours_worked: number;
  total_overtime_hours: number;
  average_hours_per_day: number;
  late_arrivals: number;
  early_departures: number;
  entries: DailyWorkSummary[];
}

export interface OrganizationReport {
  org_id: string;
  org_name: string;
  period_start: Date;
  period_end: Date;
  total_employees: number;
  active_employees: number;
  total_hours_worked: number;
  employees_summary: WorkHoursReport[];
}

// ========== AUTH ==========

export interface TAAuthPayload {
  employee_id: string;
  org_id: string;
  role: EmployeeRole;
  email: string;
  name: string;
}

export interface TALoginResponse {
  success: boolean;
  token?: string;
  employee?: Employee;
  organization?: Organization;
  error?: string;
}

// ========== API RESPONSES ==========

export interface TAApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}
