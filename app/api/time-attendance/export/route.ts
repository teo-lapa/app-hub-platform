import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { getOdooClient } from '@/lib/odoo-client';

interface TimeEntry {
  id: string;
  contact_id: number;
  company_id: number;
  entry_type: string;
  timestamp: string;
  latitude?: number;
  longitude?: number;
  qr_code_verified: boolean;
  location_name?: string;
}

interface DailyReport {
  date: string;
  contact_id: number;
  contact_name: string;
  company_name: string;
  first_clock_in: string | null;
  last_clock_out: string | null;
  break_minutes: number;
  total_hours: number;
  entries: TimeEntry[];
}

interface ContactInfo {
  name: string;
  company_name: string;
}

/**
 * GET /api/time-attendance/export
 * Esporta i dati delle presenze in vari formati
 *
 * Query params:
 * - contact_id: ID del contatto (opzionale, se omesso prende tutti i dipendenti dell'azienda)
 * - company_id: ID dell'azienda (obbligatorio)
 * - start_date: Data inizio (YYYY-MM-DD)
 * - end_date: Data fine (YYYY-MM-DD)
 * - format: 'json' | 'csv' | 'excel'
 * - email: Email destinatario per invio report (opzionale)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get('contact_id');
    const companyId = searchParams.get('company_id');
    const startDateStr = searchParams.get('start_date');
    const endDateStr = searchParams.get('end_date');
    const format = searchParams.get('format') || 'json';
    const email = searchParams.get('email');

    if (!companyId) {
      return NextResponse.json({
        success: false,
        error: 'company_id richiesto',
      }, { status: 400 });
    }

    // Date di default: ultimo mese
    const endDate = endDateStr ? new Date(endDateStr) : new Date();
    const startDate = startDateStr
      ? new Date(startDateStr)
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    // Query entries
    let entries: TimeEntry[] = [];

    try {
      let result;

      if (contactId) {
        result = await sql`
          SELECT
            id,
            contact_id,
            company_id,
            entry_type,
            timestamp,
            latitude,
            longitude,
            qr_code_verified,
            location_name
          FROM ta_time_entries
          WHERE contact_id = ${parseInt(contactId)}
            AND timestamp >= ${startDate.toISOString()}
            AND timestamp <= ${endDate.toISOString()}
          ORDER BY timestamp ASC
        `;
      } else {
        result = await sql`
          SELECT
            id,
            contact_id,
            company_id,
            entry_type,
            timestamp,
            latitude,
            longitude,
            qr_code_verified,
            location_name
          FROM ta_time_entries
          WHERE company_id = ${parseInt(companyId)}
            AND timestamp >= ${startDate.toISOString()}
            AND timestamp <= ${endDate.toISOString()}
          ORDER BY contact_id, timestamp ASC
        `;
      }

      entries = result.rows.map(row => ({
        id: row.id,
        contact_id: row.contact_id,
        company_id: row.company_id,
        entry_type: row.entry_type,
        timestamp: row.timestamp,
        latitude: row.latitude,
        longitude: row.longitude,
        qr_code_verified: row.qr_code_verified,
        location_name: row.location_name,
      }));
    } catch (dbError) {
      console.warn('Database non disponibile:', dbError);
    }

    // Raggruppa per giorno e contatto
    const dailyReports: Map<string, DailyReport> = new Map();

    // Ottieni nomi dei contatti e aziende da Odoo
    const contactIds = Array.from(new Set(entries.map(e => e.contact_id)));
    const contactInfo: Map<number, ContactInfo> = new Map();

    if (contactIds.length > 0) {
      try {
        const odoo = await getOdooClient();
        // Prendi nome e parent_id (azienda) per ogni contatto
        const contacts = await odoo.searchRead(
          'res.partner',
          [['id', 'in', contactIds]],
          ['id', 'name', 'parent_id'],
          100
        );

        // Raccogli gli ID delle aziende parent
        const parentIds: number[] = [];
        for (const c of contacts as Array<{ id: number; name: string; parent_id: [number, string] | false }>) {
          if (c.parent_id && Array.isArray(c.parent_id)) {
            parentIds.push(c.parent_id[0]);
          }
        }

        // Ottieni i nomi delle aziende parent (se esistono)
        const parentNames: Map<number, string> = new Map();
        if (parentIds.length > 0) {
          const parents = await odoo.searchRead(
            'res.partner',
            [['id', 'in', parentIds]],
            ['id', 'name'],
            100
          );
          for (const p of parents as Array<{ id: number; name: string }>) {
            parentNames.set(p.id, p.name);
          }
        }

        // Costruisci la mappa completa
        for (const c of contacts as Array<{ id: number; name: string; parent_id: [number, string] | false }>) {
          let companyName = '-';
          if (c.parent_id && Array.isArray(c.parent_id)) {
            // parent_id è già [id, name], ma prendiamo dalla query per sicurezza
            companyName = parentNames.get(c.parent_id[0]) || c.parent_id[1] || '-';
          }
          contactInfo.set(c.id, {
            name: c.name,
            company_name: companyName,
          });
        }
      } catch (odooError) {
        console.warn('Errore Odoo:', odooError);
      }
    }

    // Processa entries
    for (const entry of entries) {
      const date = new Date(entry.timestamp).toISOString().split('T')[0];
      const key = `${entry.contact_id}_${date}`;

      if (!dailyReports.has(key)) {
        const info = contactInfo.get(entry.contact_id);
        dailyReports.set(key, {
          date,
          contact_id: entry.contact_id,
          contact_name: info?.name || `Contatto ID ${entry.contact_id}`,
          company_name: info?.company_name || '-',
          first_clock_in: null,
          last_clock_out: null,
          break_minutes: 0,
          total_hours: 0,
          entries: [],
        });
      }

      const report = dailyReports.get(key)!;
      report.entries.push(entry);

      if (entry.entry_type === 'clock_in' && !report.first_clock_in) {
        report.first_clock_in = entry.timestamp;
      }
      if (entry.entry_type === 'clock_out') {
        report.last_clock_out = entry.timestamp;
      }
    }

    // Calcola ore per ogni giorno
    const reportsArray = Array.from(dailyReports.values());
    for (const report of reportsArray) {
      let workingTime = 0;
      let breakTime = 0;
      let lastClockIn: Date | null = null;
      let lastBreakStart: Date | null = null;

      for (const entry of report.entries) {
        const entryTime = new Date(entry.timestamp);

        switch (entry.entry_type) {
          case 'clock_in':
            lastClockIn = entryTime;
            break;
          case 'clock_out':
            if (lastClockIn) {
              workingTime += entryTime.getTime() - lastClockIn.getTime();
              lastClockIn = null;
            }
            break;
          case 'break_start':
            lastBreakStart = entryTime;
            break;
          case 'break_end':
            if (lastBreakStart) {
              breakTime += entryTime.getTime() - lastBreakStart.getTime();
              lastBreakStart = null;
            }
            break;
        }
      }

      report.break_minutes = Math.round(breakTime / (1000 * 60));
      report.total_hours = Math.round((workingTime - breakTime) / (1000 * 60 * 60) * 100) / 100;
    }

    const reports = Array.from(dailyReports.values()).sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.contact_name.localeCompare(b.contact_name);
    });

    // Formato CSV
    if (format === 'csv') {
      const csvLines = [
        'Data,Nome Dipendente,Azienda,Entrata,Uscita,Pausa (min),Ore Lavorate',
      ];

      for (const report of reports) {
        const entrata = report.first_clock_in
          ? new Date(report.first_clock_in).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
          : '-';
        const uscita = report.last_clock_out
          ? new Date(report.last_clock_out).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
          : '-';
        // Escape virgole nei nomi per CSV
        const safeName = report.contact_name.includes(',') ? `"${report.contact_name}"` : report.contact_name;
        const safeCompany = report.company_name.includes(',') ? `"${report.company_name}"` : report.company_name;

        csvLines.push(
          `${report.date},${safeName},${safeCompany},${entrata},${uscita},${report.break_minutes},${report.total_hours}`
        );
      }

      const csv = csvLines.join('\n');

      // Se email specificata, qui andrebbe l'invio email
      if (email) {
        // TODO: Implementare invio email con allegato
        console.log(`TODO: Inviare report a ${email}`);
      }

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="presenze_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    // Formato Excel (semplice HTML table che Excel può aprire)
    if (format === 'excel') {
      const html = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
        <head>
          <meta charset="utf-8">
          <style>
            table { border-collapse: collapse; }
            th, td { border: 1px solid #000; padding: 5px; }
            th { background: #f0f0f0; font-weight: bold; }
            .employee-name { font-weight: bold; }
            .company-name { color: #666; }
          </style>
        </head>
        <body>
          <h2>Report Presenze</h2>
          <p>Periodo: ${startDate.toLocaleDateString('it-IT')} - ${endDate.toLocaleDateString('it-IT')}</p>
          <table>
            <tr>
              <th>Data</th>
              <th>Nome Dipendente</th>
              <th>Azienda</th>
              <th>Entrata</th>
              <th>Uscita</th>
              <th>Pausa (min)</th>
              <th>Ore Lavorate</th>
            </tr>
            ${reports.map(report => {
              const entrata = report.first_clock_in
                ? new Date(report.first_clock_in).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
                : '-';
              const uscita = report.last_clock_out
                ? new Date(report.last_clock_out).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
                : '-';
              return `<tr>
                <td>${report.date}</td>
                <td class="employee-name">${report.contact_name}</td>
                <td class="company-name">${report.company_name}</td>
                <td>${entrata}</td>
                <td>${uscita}</td>
                <td>${report.break_minutes}</td>
                <td>${report.total_hours}</td>
              </tr>`;
            }).join('')}
          </table>

          <h3>Riepilogo per Dipendente</h3>
          <table>
            <tr>
              <th>Nome Dipendente</th>
              <th>Azienda</th>
              <th>Giorni Lavorati</th>
              <th>Ore Totali</th>
              <th>Media Ore/Giorno</th>
            </tr>
            ${(() => {
              const byContact = new Map<string, { company: string; days: number; hours: number }>();
              for (const report of reports) {
                const key = report.contact_name;
                if (!byContact.has(key)) {
                  byContact.set(key, { company: report.company_name, days: 0, hours: 0 });
                }
                const data = byContact.get(key)!;
                data.days++;
                data.hours += report.total_hours;
              }
              return Array.from(byContact.entries())
                .map(([name, data]) => `<tr>
                  <td class="employee-name">${name}</td>
                  <td class="company-name">${data.company}</td>
                  <td>${data.days}</td>
                  <td>${data.hours.toFixed(2)}</td>
                  <td>${(data.hours / data.days).toFixed(2)}</td>
                </tr>`).join('');
            })()}
          </table>
        </body>
        </html>
      `;

      if (email) {
        console.log(`TODO: Inviare report Excel a ${email}`);
      }

      return new NextResponse(html, {
        headers: {
          'Content-Type': 'application/vnd.ms-excel; charset=utf-8',
          'Content-Disposition': `attachment; filename="presenze_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}.xls"`,
        },
      });
    }

    // Default: JSON
    // Calcola statistiche aggregate
    const totalHours = reports.reduce((sum, r) => sum + r.total_hours, 0);
    const totalDays = new Set(reports.map(r => r.date)).size;
    const totalEmployees = new Set(reports.map(r => r.contact_name)).size;

    return NextResponse.json({
      success: true,
      data: {
        period: {
          start: startDate.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0],
        },
        stats: {
          total_days: totalDays,
          total_employees: totalEmployees,
          total_hours: Math.round(totalHours * 100) / 100,
          average_hours_per_day: totalDays > 0
            ? Math.round((totalHours / totalDays) * 100) / 100
            : 0,
        },
        reports,
      },
    });

  } catch (error) {
    console.error('Export API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore nell\'export dei dati',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
