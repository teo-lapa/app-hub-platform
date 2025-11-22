/**
 * Time & Attendance - Database Client
 * Gestisce organizzazioni, dipendenti e timbrature
 *
 * FALLBACK MODE: Se POSTGRES_URL non è configurato, usa memoria in-memory
 */

import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';
import {
  Organization,
  CreateOrganizationInput,
  Employee,
  CreateEmployeeInput,
  EmployeeWithStatus,
  WorkLocation,
  CreateWorkLocationInput,
  Shift,
  CreateShiftInput,
  TimeEntry,
  CreateTimeEntryInput,
  TimeEntryRequest,
  DailyWorkSummary,
} from './types';

// ========== CONFIG ==========

const hasDatabase = !!process.env.POSTGRES_URL;

// In-memory storage (fallback)
const memoryStore = {
  organizations: new Map<string, Organization>(),
  employees: new Map<string, Employee>(),
  locations: new Map<string, WorkLocation>(),
  shifts: new Map<string, Shift>(),
  timeEntries: new Map<string, TimeEntry>(),
  requests: new Map<string, TimeEntryRequest>(),
};

if (!hasDatabase) {
  console.warn('⚠️  POSTGRES_URL not found - Time Attendance using in-memory storage');
}

// ========== HELPER FUNCTIONS ==========

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// ========== ORGANIZATIONS ==========

export async function createOrganization(
  input: CreateOrganizationInput
): Promise<Organization> {
  const slug = input.slug || generateSlug(input.name);

  if (!hasDatabase) {
    const org: Organization = {
      id: generateId(),
      name: input.name,
      slug,
      email: input.email,
      phone: input.phone,
      address: input.address,
      plan: 'free',
      max_employees: 5,
      geofencing_enabled: false,
      auto_clock_enabled: false,
      photo_required: false,
      timezone: input.timezone || 'Europe/Rome',
      settings: {},
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    };
    memoryStore.organizations.set(org.id, org);
    return org;
  }

  const result = await sql<Organization>`
    INSERT INTO ta_organizations (name, slug, email, phone, address, timezone)
    VALUES (${input.name}, ${slug}, ${input.email}, ${input.phone || null}, ${input.address || null}, ${input.timezone || 'Europe/Rome'})
    RETURNING *
  `;

  return result.rows[0];
}

export async function getOrganization(id: string): Promise<Organization | null> {
  if (!hasDatabase) {
    return memoryStore.organizations.get(id) || null;
  }

  const result = await sql<Organization>`
    SELECT * FROM ta_organizations WHERE id = ${id}
  `;
  return result.rows[0] || null;
}

export async function getOrganizationBySlug(slug: string): Promise<Organization | null> {
  if (!hasDatabase) {
    const orgs = Array.from(memoryStore.organizations.values());
    for (const org of orgs) {
      if (org.slug === slug) return org;
    }
    return null;
  }

  const result = await sql<Organization>`
    SELECT * FROM ta_organizations WHERE slug = ${slug}
  `;
  return result.rows[0] || null;
}

export async function updateOrganization(
  id: string,
  updates: Partial<Organization>
): Promise<Organization | null> {
  if (!hasDatabase) {
    const org = memoryStore.organizations.get(id);
    if (!org) return null;
    const updated = { ...org, ...updates, updated_at: new Date() };
    memoryStore.organizations.set(id, updated);
    return updated;
  }

  // Build dynamic update query
  const setClause: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (updates.name !== undefined) {
    setClause.push(`name = $${paramIndex++}`);
    values.push(updates.name);
  }
  if (updates.email !== undefined) {
    setClause.push(`email = $${paramIndex++}`);
    values.push(updates.email);
  }
  if (updates.phone !== undefined) {
    setClause.push(`phone = $${paramIndex++}`);
    values.push(updates.phone);
  }
  if (updates.geofencing_enabled !== undefined) {
    setClause.push(`geofencing_enabled = $${paramIndex++}`);
    values.push(updates.geofencing_enabled);
  }

  if (setClause.length === 0) {
    return await getOrganization(id);
  }

  setClause.push('updated_at = NOW()');
  values.push(id);

  const result = await sql.query<Organization>(
    `UPDATE ta_organizations SET ${setClause.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );

  return result.rows[0] || null;
}

// ========== EMPLOYEES ==========

export async function createEmployee(
  input: CreateEmployeeInput
): Promise<Employee> {
  const passwordHash = await bcrypt.hash(input.password, 12);

  if (!hasDatabase) {
    const employee: Employee = {
      id: generateId(),
      org_id: input.org_id,
      email: input.email,
      name: input.name,
      phone: input.phone,
      role: input.role || 'employee',
      hourly_rate: input.hourly_rate,
      contract_hours_per_week: input.contract_hours_per_week,
      is_active: true,
      gps_consent: false,
      notifications_consent: false,
      created_at: new Date(),
      updated_at: new Date(),
    };
    memoryStore.employees.set(employee.id, employee);
    return employee;
  }

  const result = await sql<Employee>`
    INSERT INTO ta_employees (org_id, email, name, password_hash, phone, role, hourly_rate, contract_hours_per_week)
    VALUES (
      ${input.org_id},
      ${input.email},
      ${input.name},
      ${passwordHash},
      ${input.phone || null},
      ${input.role || 'employee'},
      ${input.hourly_rate || null},
      ${input.contract_hours_per_week || null}
    )
    RETURNING id, org_id, email, name, phone, role, hourly_rate, contract_hours_per_week,
              is_active, gps_consent, gps_consent_at, notifications_consent,
              created_at, updated_at
  `;

  return result.rows[0];
}

export async function getEmployee(id: string): Promise<Employee | null> {
  if (!hasDatabase) {
    return memoryStore.employees.get(id) || null;
  }

  const result = await sql<Employee>`
    SELECT id, org_id, email, name, phone, avatar_url, role, hourly_rate,
           contract_hours_per_week, is_active, last_login_at, gps_consent,
           gps_consent_at, notifications_consent, created_at, updated_at
    FROM ta_employees
    WHERE id = ${id}
  `;
  return result.rows[0] || null;
}

export async function getEmployeeByEmail(
  orgId: string,
  email: string
): Promise<Employee | null> {
  if (!hasDatabase) {
    const emps = Array.from(memoryStore.employees.values());
    for (const emp of emps) {
      if (emp.org_id === orgId && emp.email === email) return emp;
    }
    return null;
  }

  const result = await sql<Employee>`
    SELECT id, org_id, email, name, phone, avatar_url, role, hourly_rate,
           contract_hours_per_week, is_active, last_login_at, gps_consent,
           gps_consent_at, notifications_consent, created_at, updated_at
    FROM ta_employees
    WHERE org_id = ${orgId} AND email = ${email}
  `;
  return result.rows[0] || null;
}

export async function validateEmployeePassword(
  orgId: string,
  email: string,
  password: string
): Promise<Employee | null> {
  if (!hasDatabase) {
    // In-memory non supporta verifica password
    const emp = await getEmployeeByEmail(orgId, email);
    return emp;
  }

  const result = await sql`
    SELECT id, org_id, email, name, phone, avatar_url, role, password_hash,
           hourly_rate, contract_hours_per_week, is_active, gps_consent,
           gps_consent_at, notifications_consent, created_at, updated_at
    FROM ta_employees
    WHERE org_id = ${orgId} AND email = ${email} AND is_active = true
  `;

  if (result.rows.length === 0) return null;

  const employee = result.rows[0];
  const isValid = await bcrypt.compare(password, employee.password_hash);

  if (!isValid) return null;

  // Update last login
  await sql`
    UPDATE ta_employees SET last_login_at = NOW() WHERE id = ${employee.id}
  `;

  // Remove password_hash from returned object
  const { password_hash, ...employeeWithoutPassword } = employee;
  return employeeWithoutPassword as Employee;
}

export async function getOrganizationEmployees(
  orgId: string,
  includeInactive: boolean = false
): Promise<Employee[]> {
  if (!hasDatabase) {
    return Array.from(memoryStore.employees.values())
      .filter(e => e.org_id === orgId && (includeInactive || e.is_active));
  }

  if (includeInactive) {
    const result = await sql<Employee>`
      SELECT id, org_id, email, name, phone, avatar_url, role, hourly_rate,
             contract_hours_per_week, is_active, last_login_at, gps_consent,
             gps_consent_at, notifications_consent, created_at, updated_at
      FROM ta_employees
      WHERE org_id = ${orgId}
      ORDER BY name ASC
    `;
    return result.rows;
  }

  const result = await sql<Employee>`
    SELECT id, org_id, email, name, phone, avatar_url, role, hourly_rate,
           contract_hours_per_week, is_active, last_login_at, gps_consent,
           gps_consent_at, notifications_consent, created_at, updated_at
    FROM ta_employees
    WHERE org_id = ${orgId} AND is_active = true
    ORDER BY name ASC
  `;

  return result.rows;
}

export async function getEmployeesOnDuty(orgId: string): Promise<EmployeeWithStatus[]> {
  if (!hasDatabase) {
    const employees = Array.from(memoryStore.employees.values())
      .filter(e => e.org_id === orgId && e.is_active);

    return employees.map(e => {
      const entries = Array.from(memoryStore.timeEntries.values())
        .filter(te => te.employee_id === e.id)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      const lastEntry = entries[0];

      return {
        ...e,
        is_on_duty: lastEntry?.entry_type === 'clock_in',
        last_entry_type: lastEntry?.entry_type,
        last_entry_time: lastEntry?.timestamp,
      };
    });
  }

  const result = await sql<EmployeeWithStatus>`
    SELECT * FROM ta_employees_on_duty WHERE org_id = ${orgId}
  `;

  return result.rows;
}

export async function updateEmployeeGPSConsent(
  employeeId: string,
  consent: boolean
): Promise<Employee | null> {
  if (!hasDatabase) {
    const emp = memoryStore.employees.get(employeeId);
    if (!emp) return null;
    emp.gps_consent = consent;
    emp.gps_consent_at = consent ? new Date() : undefined;
    emp.updated_at = new Date();
    return emp;
  }

  const result = await sql<Employee>`
    UPDATE ta_employees
    SET gps_consent = ${consent},
        gps_consent_at = ${consent ? new Date().toISOString() : null},
        updated_at = NOW()
    WHERE id = ${employeeId}
    RETURNING *
  `;

  // Log GDPR consent
  await sql`
    INSERT INTO ta_gdpr_consents (employee_id, consent_type, is_granted, granted_at)
    VALUES (${employeeId}, 'gps_tracking', ${consent}, ${consent ? new Date().toISOString() : null})
  `;

  return result.rows[0] || null;
}

// ========== WORK LOCATIONS ==========

export async function createWorkLocation(
  input: CreateWorkLocationInput
): Promise<WorkLocation> {
  if (!hasDatabase) {
    const location: WorkLocation = {
      id: generateId(),
      org_id: input.org_id,
      name: input.name,
      address: input.address,
      latitude: input.latitude,
      longitude: input.longitude,
      radius_meters: input.radius_meters || 100,
      timezone: 'Europe/Rome',
      is_primary: input.is_primary || false,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    };
    memoryStore.locations.set(location.id, location);
    return location;
  }

  const result = await sql<WorkLocation>`
    INSERT INTO ta_work_locations (org_id, name, address, latitude, longitude, radius_meters, is_primary)
    VALUES (
      ${input.org_id},
      ${input.name},
      ${input.address || null},
      ${input.latitude},
      ${input.longitude},
      ${input.radius_meters || 100},
      ${input.is_primary || false}
    )
    RETURNING *
  `;

  return result.rows[0];
}

export async function getOrganizationLocations(orgId: string): Promise<WorkLocation[]> {
  if (!hasDatabase) {
    return Array.from(memoryStore.locations.values())
      .filter(l => l.org_id === orgId && l.is_active);
  }

  const result = await sql<WorkLocation>`
    SELECT * FROM ta_work_locations
    WHERE org_id = ${orgId} AND is_active = true
    ORDER BY is_primary DESC, name ASC
  `;

  return result.rows;
}

// ========== TIME ENTRIES ==========

export async function createTimeEntry(
  input: CreateTimeEntryInput
): Promise<TimeEntry> {
  const timestamp = input.timestamp || new Date();

  if (!hasDatabase) {
    const entry: TimeEntry = {
      id: generateId(),
      org_id: input.org_id,
      employee_id: input.employee_id,
      location_id: input.location_id,
      entry_type: input.entry_type,
      timestamp,
      latitude: input.latitude,
      longitude: input.longitude,
      accuracy_meters: input.accuracy_meters,
      is_within_geofence: input.is_within_geofence,
      clock_method: input.clock_method || 'manual',
      device_info: input.device_info || {},
      is_edited: false,
      note: input.note,
      photo_url: input.photo_url,
      created_at: new Date(),
    };
    memoryStore.timeEntries.set(entry.id, entry);
    return entry;
  }

  const result = await sql<TimeEntry>`
    INSERT INTO ta_time_entries (
      org_id, employee_id, location_id, entry_type, timestamp,
      latitude, longitude, accuracy_meters, is_within_geofence,
      clock_method, device_info, note, photo_url
    )
    VALUES (
      ${input.org_id},
      ${input.employee_id},
      ${input.location_id || null},
      ${input.entry_type},
      ${timestamp.toISOString()},
      ${input.latitude || null},
      ${input.longitude || null},
      ${input.accuracy_meters || null},
      ${input.is_within_geofence || null},
      ${input.clock_method || 'manual'},
      ${JSON.stringify(input.device_info || {})},
      ${input.note || null},
      ${input.photo_url || null}
    )
    RETURNING *
  `;

  return result.rows[0];
}

export async function getEmployeeTimeEntries(
  employeeId: string,
  startDate: Date,
  endDate: Date
): Promise<TimeEntry[]> {
  if (!hasDatabase) {
    return Array.from(memoryStore.timeEntries.values())
      .filter(te =>
        te.employee_id === employeeId &&
        te.timestamp >= startDate &&
        te.timestamp <= endDate
      )
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  const result = await sql<TimeEntry>`
    SELECT * FROM ta_time_entries
    WHERE employee_id = ${employeeId}
      AND timestamp >= ${startDate.toISOString()}
      AND timestamp <= ${endDate.toISOString()}
    ORDER BY timestamp DESC
  `;

  return result.rows;
}

export async function getEmployeeLastEntry(
  employeeId: string
): Promise<TimeEntry | null> {
  if (!hasDatabase) {
    const entries = Array.from(memoryStore.timeEntries.values())
      .filter(te => te.employee_id === employeeId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return entries[0] || null;
  }

  const result = await sql<TimeEntry>`
    SELECT * FROM ta_time_entries
    WHERE employee_id = ${employeeId}
    ORDER BY timestamp DESC
    LIMIT 1
  `;

  return result.rows[0] || null;
}

export async function getTodayEntries(
  employeeId: string
): Promise<TimeEntry[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return getEmployeeTimeEntries(employeeId, today, tomorrow);
}

// ========== DAILY SUMMARY ==========

export async function getDailySummary(
  orgId: string,
  date: Date
): Promise<DailyWorkSummary[]> {
  if (!hasDatabase) {
    const dateStr = date.toISOString().split('T')[0];
    const employees = Array.from(memoryStore.employees.values())
      .filter(e => e.org_id === orgId);

    return employees.map(e => {
      const entries = Array.from(memoryStore.timeEntries.values())
        .filter(te =>
          te.employee_id === e.id &&
          te.timestamp.toISOString().split('T')[0] === dateStr
        );

      const clockIns = entries.filter(te => te.entry_type === 'clock_in');
      const clockOuts = entries.filter(te => te.entry_type === 'clock_out');

      const firstClockIn = clockIns.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())[0];
      const lastClockOut = clockOuts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

      let totalHours = 0;
      if (firstClockIn && lastClockOut) {
        totalHours = (lastClockOut.timestamp.getTime() - firstClockIn.timestamp.getTime()) / (1000 * 60 * 60);
      }

      return {
        org_id: orgId,
        employee_id: e.id,
        employee_name: e.name,
        work_date: date,
        first_clock_in: firstClockIn?.timestamp,
        last_clock_out: lastClockOut?.timestamp,
        clock_in_count: clockIns.length,
        clock_out_count: clockOuts.length,
        total_hours: Math.round(totalHours * 100) / 100,
      };
    });
  }

  const result = await sql<DailyWorkSummary>`
    SELECT
      org_id,
      employee_id,
      employee_name,
      work_date,
      first_clock_in,
      last_clock_out,
      clock_in_count,
      clock_out_count,
      EXTRACT(EPOCH FROM (last_clock_out - first_clock_in)) / 3600 as total_hours
    FROM ta_daily_work_summary
    WHERE org_id = ${orgId}
      AND work_date = ${date.toISOString().split('T')[0]}
  `;

  return result.rows;
}

export async function getEmployeeMonthlySummary(
  employeeId: string,
  year: number,
  month: number
): Promise<DailyWorkSummary[]> {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  if (!hasDatabase) {
    const employee = memoryStore.employees.get(employeeId);
    if (!employee) return [];

    const summaries: DailyWorkSummary[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const entries = Array.from(memoryStore.timeEntries.values())
        .filter(te =>
          te.employee_id === employeeId &&
          te.timestamp.toISOString().split('T')[0] === dateStr
        );

      if (entries.length > 0) {
        const clockIns = entries.filter(te => te.entry_type === 'clock_in');
        const clockOuts = entries.filter(te => te.entry_type === 'clock_out');

        const firstClockIn = clockIns.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())[0];
        const lastClockOut = clockOuts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

        let totalHours = 0;
        if (firstClockIn && lastClockOut) {
          totalHours = (lastClockOut.timestamp.getTime() - firstClockIn.timestamp.getTime()) / (1000 * 60 * 60);
        }

        summaries.push({
          org_id: employee.org_id,
          employee_id: employeeId,
          employee_name: employee.name,
          work_date: new Date(currentDate),
          first_clock_in: firstClockIn?.timestamp,
          last_clock_out: lastClockOut?.timestamp,
          clock_in_count: clockIns.length,
          clock_out_count: clockOuts.length,
          total_hours: Math.round(totalHours * 100) / 100,
        });
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return summaries;
  }

  const result = await sql<DailyWorkSummary>`
    SELECT
      org_id,
      employee_id,
      employee_name,
      work_date,
      first_clock_in,
      last_clock_out,
      clock_in_count,
      clock_out_count,
      EXTRACT(EPOCH FROM (last_clock_out - first_clock_in)) / 3600 as total_hours
    FROM ta_daily_work_summary
    WHERE employee_id = ${employeeId}
      AND work_date >= ${startDate.toISOString().split('T')[0]}
      AND work_date <= ${endDate.toISOString().split('T')[0]}
    ORDER BY work_date ASC
  `;

  return result.rows;
}
