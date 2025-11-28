import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { getOdooClient } from '@/lib/odoo-client';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

// Type per jsPDF con autoTable (evita conflitto con @types/jspdf-autotable)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsPDFWithAutoTable = jsPDF & { autoTable: (options: any) => jsPDF; lastAutoTable: { finalY: number } };

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
  break_type?: 'coffee_break' | 'lunch_break';
  break_max_minutes?: number;
}

interface BreakDetail {
  type: 'coffee_break' | 'lunch_break';
  name: string;
  start: string;
  end: string | null;
  duration_minutes: number;
}

interface DailyReport {
  date: string;
  contact_id: number;
  contact_name: string;
  company_name: string;
  first_clock_in: string | null;
  last_clock_out: string | null;
  break_minutes: number;
  coffee_break_minutes: number;
  lunch_break_minutes: number;
  breaks: BreakDetail[];
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

    console.log('[Export] Request params:', {
      contactId,
      companyId,
      startDateStr,
      endDateStr,
      format,
    });

    // Usa timezone Europe/Rome per calcoli corretti (come dashboard)
    const TIMEZONE = 'Europe/Rome';

    // Helper per calcolare i bounds di un giorno in timezone Rome
    // Restituisce date UTC che corrispondono a mezzanotte-23:59 in Rome
    const getRomeDayBounds = (refDate: Date) => {
      // Ottieni la data in formato Rome
      const romeStr = refDate.toLocaleDateString('en-CA', { timeZone: TIMEZONE });
      const [year, month, day] = romeStr.split('-').map(Number);

      // Determina se è ora legale in Italia
      const testDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
      const romeTime = testDate.toLocaleString('en-US', { timeZone: TIMEZONE, hour: 'numeric', hour12: false });
      const utcHour = testDate.getUTCHours();
      const romeHour = parseInt(romeTime);
      const offsetHours = romeHour - utcHour;

      // Crea mezzanotte Rome in UTC
      // Se offsetHours è 1 (CET), mezzanotte Rome = 23:00 UTC del giorno prima
      // Se offsetHours è 2 (CEST), mezzanotte Rome = 22:00 UTC del giorno prima
      const midnightUTC = Date.UTC(year, month - 1, day, 0, 0, 0) - (offsetHours * 60 * 60 * 1000);
      const endOfDayUTC = midnightUTC + (24 * 60 * 60 * 1000) - 1; // 23:59:59.999 Rome

      return {
        start: new Date(midnightUTC),
        end: new Date(endOfDayUTC),
        dateStr: romeStr
      };
    };

    // Date di default: oggi (se non specificate)
    const endDateRef = endDateStr ? new Date(endDateStr + 'T12:00:00Z') : new Date();
    const startDateRef = startDateStr ? new Date(startDateStr + 'T12:00:00Z') : endDateRef;

    // Calcola bounds corretti considerando timezone Rome
    const startBounds = getRomeDayBounds(startDateRef);
    const endBounds = getRomeDayBounds(endDateRef);

    const startDate = startBounds.start;
    const endDate = endBounds.end;

    console.log('[Export] Date range (Rome timezone):', {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      startLocal: startDate.toLocaleString('it-IT', { timeZone: TIMEZONE }),
      endLocal: endDate.toLocaleString('it-IT', { timeZone: TIMEZONE }),
    });

    // Query entries
    let entries: TimeEntry[] = [];

    try {
      let result;

      // Prima recupera l'ultima entry PRIMA del periodo per ogni contatto
      // Serve per includere clock_in che sono iniziati prima del range
      let lastEntriesBeforeResult;
      if (contactId) {
        // Quando c'è contact_id specifico, NON filtriamo per company_id
        // perché il contact potrebbe aver timbrato per diverse aziende
        lastEntriesBeforeResult = await sql`
          SELECT DISTINCT ON (contact_id)
            id,
            contact_id,
            company_id,
            entry_type,
            timestamp,
            latitude,
            longitude,
            qr_code_verified,
            location_name,
            break_type,
            break_max_minutes
          FROM ta_time_entries
          WHERE contact_id = ${parseInt(contactId)}
            AND timestamp < ${startDate.toISOString()}
          ORDER BY contact_id, timestamp DESC
        `;
      } else {
        lastEntriesBeforeResult = await sql`
          SELECT DISTINCT ON (contact_id)
            id,
            contact_id,
            company_id,
            entry_type,
            timestamp,
            latitude,
            longitude,
            qr_code_verified,
            location_name,
            break_type,
            break_max_minutes
          FROM ta_time_entries
          WHERE company_id = ${parseInt(companyId)}
            AND timestamp < ${startDate.toISOString()}
          ORDER BY contact_id, timestamp DESC
        `;
      }

      // Filtra solo i clock_in/break_start/break_end (dipendenti ancora in servizio)
      const previousEntries = lastEntriesBeforeResult.rows
        .filter(row =>
          row.entry_type === 'clock_in' ||
          row.entry_type === 'break_start' ||
          row.entry_type === 'break_end'
        )
        .map(row => ({
          id: row.id,
          contact_id: row.contact_id,
          company_id: row.company_id,
          entry_type: row.entry_type,
          timestamp: row.timestamp,
          latitude: row.latitude,
          longitude: row.longitude,
          qr_code_verified: row.qr_code_verified,
          location_name: row.location_name,
          break_type: row.break_type,
          break_max_minutes: row.break_max_minutes,
        }));

      console.log('[Export] Found previous entries (still on duty):', previousEntries.length);

      // Query entries nel periodo
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
            location_name,
            break_type,
            break_max_minutes
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
            location_name,
            break_type,
            break_max_minutes
          FROM ta_time_entries
          WHERE company_id = ${parseInt(companyId)}
            AND timestamp >= ${startDate.toISOString()}
            AND timestamp <= ${endDate.toISOString()}
          ORDER BY contact_id, timestamp ASC
        `;
      }

      const currentEntries = result.rows.map(row => ({
        id: row.id,
        contact_id: row.contact_id,
        company_id: row.company_id,
        entry_type: row.entry_type,
        timestamp: row.timestamp,
        latitude: row.latitude,
        longitude: row.longitude,
        qr_code_verified: row.qr_code_verified,
        location_name: row.location_name,
        break_type: row.break_type,
        break_max_minutes: row.break_max_minutes,
      }));

      // Combina entries precedenti + entries del periodo
      // Ordina per contact_id e timestamp
      entries = [...previousEntries, ...currentEntries].sort((a, b) => {
        if (a.contact_id !== b.contact_id) return a.contact_id - b.contact_id;
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      });

      console.log('[Export] Query result:', {
        previousEntriesCount: previousEntries.length,
        currentEntriesCount: currentEntries.length,
        totalEntriesCount: entries.length,
        dateRange: `${startDate.toISOString()} to ${endDate.toISOString()}`,
        companyIdUsed: companyId,
        contactIdUsed: contactId || 'ALL EMPLOYEES',
        sampleEntry: entries[0] || 'no entries',
        firstTenEntries: entries.slice(0, 10).map(e => ({
          contact_id: e.contact_id,
          entry_type: e.entry_type,
          timestamp: e.timestamp
        }))
      });

      // CRITICAL DEBUG: Se non ci sono entries, logga info per debug
      if (entries.length === 0) {
        console.error('[Export] NO ENTRIES FOUND! Debug info:', {
          companyId,
          contactId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          queryUsed: contactId ? 'WITH contact_id filter' : 'WITHOUT contact_id filter (all employees)'
        });

        // Ritorna errore invece di generare file vuoto
        return NextResponse.json({
          success: false,
          error: 'Nessuna timbratura trovata nel periodo selezionato',
          details: `Periodo: ${startDate.toLocaleDateString('it-IT')} - ${endDate.toLocaleDateString('it-IT')}`,
        }, { status: 404 });
      }
    } catch (dbError) {
      console.warn('Database non disponibile:', dbError);
    }

    // Raggruppa per giorno e contatto
    const dailyReports: Map<string, DailyReport> = new Map();

    // Raccogli tutti i contact_id unici
    const contactIds = Array.from(new Set(entries.map(e => e.contact_id)));
    const contactInfo: Map<number, ContactInfo> = new Map();

    // Tutti i contatti devono essere recuperati da Odoo
    const contactsWithoutName = contactIds;

    if (contactsWithoutName.length > 0) {
      console.log(`[Export] Fetching ${contactsWithoutName.length} contacts from Odoo:`, contactsWithoutName);
      try {
        const odoo = await getOdooClient();
        // Prendi nome e parent_id (azienda) per ogni contatto
        const contacts = await odoo.searchRead(
          'res.partner',
          [['id', 'in', contactsWithoutName]],
          ['id', 'name', 'parent_id'],
          100
        );

        const contactsArr = contacts as unknown[];
        console.log(`[Export] Odoo returned ${contactsArr.length} contacts for IDs:`, contactsWithoutName);

        // Log dei contatti non trovati
        const foundIds = (contacts as Array<{ id: number }>).map(c => c.id);
        const notFoundIds = contactsWithoutName.filter(id => !foundIds.includes(id));
        if (notFoundIds.length > 0) {
          console.warn(`[Export] Contacts NOT FOUND in Odoo:`, notFoundIds);
        }

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
          console.log(`[Export] Contact ${c.id}: ${c.name} @ ${companyName}`);
        }
      } catch (odooError) {
        console.error('[Export] Errore Odoo fetch contacts:', odooError);
        // Fallback: crea nomi placeholder per i contatti non trovati
        for (const id of contactsWithoutName) {
          if (!contactInfo.has(id)) {
            contactInfo.set(id, {
              name: `Dipendente #${id}`,
              company_name: '-',
            });
          }
        }
      }
    }

    // Fallback finale: assicurati che ogni contatto abbia un nome
    for (const contactId of contactIds) {
      if (!contactInfo.has(contactId)) {
        contactInfo.set(contactId, {
          name: `Dipendente #${contactId}`,
          company_name: '-',
        });
      }
    }

    // Aggiorna company_name per i contatti con nome locale
    if (contactInfo.size > 0) {
      try {
        const odoo = createOdooRPCClient();
        const allContactIds = Array.from(contactInfo.keys());
        const contacts = await odoo.searchRead(
          'res.partner',
          [['id', 'in', allContactIds]],
          ['id', 'parent_id'],
          100
        ) as Array<{ id: number; parent_id: [number, string] | false }>;

        for (const c of contacts) {
          if (c.parent_id && Array.isArray(c.parent_id)) {
            const info = contactInfo.get(c.id);
            if (info) {
              info.company_name = c.parent_id[1] || '-';
            }
          }
        }
      } catch {
        // Ignora errori Odoo per company_name
      }
    }

    // Log dei contatti senza nome
    for (const contactId of contactIds) {
      if (!contactInfo.has(contactId)) {
        console.warn(`[Export] Contact ID ${contactId} has no name (local or Odoo)`);
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
          contact_name: info?.name || `Dipendente #${entry.contact_id}`,
          company_name: info?.company_name || '-',
          first_clock_in: null,
          last_clock_out: null,
          break_minutes: 0,
          coffee_break_minutes: 0,
          lunch_break_minutes: 0,
          breaks: [],
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
      let coffeeBreakTime = 0;
      let lunchBreakTime = 0;
      let lastClockIn: Date | null = null;
      let lastBreakStart: { time: Date; type: 'coffee_break' | 'lunch_break' | null } | null = null;

      // Calcola bounds del giorno corrente
      const dayDate = new Date(report.date + 'T12:00:00Z');
      const dayBounds = getRomeDayBounds(dayDate);
      const dayStartTime = dayBounds.start.getTime();
      const dayEndTime = dayBounds.end.getTime();

      // Controlla se c'era un clock_in attivo prima del giorno
      for (const entry of report.entries) {
        const entryTime = new Date(entry.timestamp);
        if (entryTime.getTime() < dayStartTime) {
          // Entry prima del giorno corrente
          if (entry.entry_type === 'clock_in' || entry.entry_type === 'break_end') {
            lastClockIn = new Date(dayStartTime); // Inizia a contare dalla mezzanotte
          } else if (entry.entry_type === 'break_start') {
            lastBreakStart = { time: new Date(dayStartTime), type: entry.break_type || null };
          }
        }
      }

      for (const entry of report.entries) {
        const entryTime = new Date(entry.timestamp);
        const entryTimeMs = entryTime.getTime();

        // Salta entries prima del giorno corrente (già processate sopra)
        if (entryTimeMs < dayStartTime) continue;

        // Limita entries alla fine del giorno
        const effectiveTime = Math.min(entryTimeMs, dayEndTime);

        switch (entry.entry_type) {
          case 'clock_in':
            lastClockIn = entryTime;
            break;
          case 'clock_out':
            if (lastClockIn) {
              workingTime += effectiveTime - lastClockIn.getTime();
              lastClockIn = null;
            }
            break;
          case 'break_start':
            lastBreakStart = { time: entryTime, type: entry.break_type || null };
            break;
          case 'break_end':
            if (lastBreakStart) {
              const breakDuration = effectiveTime - lastBreakStart.time.getTime();
              const breakMinutes = Math.round(breakDuration / (1000 * 60));
              breakTime += breakDuration;

              // Traccia per tipo
              if (lastBreakStart.type === 'coffee_break') {
                coffeeBreakTime += breakDuration;
              } else if (lastBreakStart.type === 'lunch_break') {
                lunchBreakTime += breakDuration;
              }

              // Aggiungi dettaglio pausa solo se nel range del giorno
              if (lastBreakStart.time.getTime() >= dayStartTime) {
                report.breaks.push({
                  type: lastBreakStart.type || 'coffee_break',
                  name: lastBreakStart.type === 'lunch_break' ? 'Pausa Pranzo' : 'Pausa Caffè',
                  start: lastBreakStart.time.toISOString(),
                  end: entryTime.toISOString(),
                  duration_minutes: breakMinutes,
                });
              }

              lastBreakStart = null;
            }
            break;
        }
      }

      // Determina se il giorno è completo o in corso
      const isDayComplete = dayEndTime < Date.now();
      const endTimeForCalculation = isDayComplete ? dayEndTime : Date.now();

      // Se ancora in servizio, calcola ore fino a fine giorno o ora corrente
      if (lastClockIn) {
        const clockInTime = lastClockIn.getTime();
        if (clockInTime < dayEndTime) {
          workingTime += endTimeForCalculation - clockInTime;
        }
      }

      // Se c'è una pausa ancora aperta, la contiamo fino a fine giorno o ora corrente
      if (lastBreakStart) {
        const breakStartTime = lastBreakStart.time.getTime();
        if (breakStartTime < dayEndTime) {
          const breakDuration = endTimeForCalculation - breakStartTime;
          const breakMinutes = Math.round(breakDuration / (1000 * 60));
          breakTime += breakDuration;

          if (lastBreakStart.type === 'coffee_break') {
            coffeeBreakTime += breakDuration;
          } else if (lastBreakStart.type === 'lunch_break') {
            lunchBreakTime += breakDuration;
          }

          // Aggiungi dettaglio pausa solo se nel range del giorno
          if (breakStartTime >= dayStartTime) {
            report.breaks.push({
              type: lastBreakStart.type || 'coffee_break',
              name: lastBreakStart.type === 'lunch_break' ? 'Pausa Pranzo' : 'Pausa Caffè',
              start: lastBreakStart.time.toISOString(),
              end: null, // ancora in corso
              duration_minutes: breakMinutes,
            });
          }
        }
      }

      report.break_minutes = Math.round(breakTime / (1000 * 60));
      report.coffee_break_minutes = Math.round(coffeeBreakTime / (1000 * 60));
      report.lunch_break_minutes = Math.round(lunchBreakTime / (1000 * 60));
      report.total_hours = Math.round((workingTime - breakTime) / (1000 * 60 * 60) * 100) / 100;
    }

    const reports = Array.from(dailyReports.values()).sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.contact_name.localeCompare(b.contact_name);
    });

    // Formato CSV
    if (format === 'csv') {
      const csvLines = [
        'Data,ID Contatto,Nome Dipendente,Azienda,Entrata,Uscita,Pausa Caffè (min),Pausa Pranzo (min),Pausa Totale (min),Ore Lavorate',
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
          `${report.date},${report.contact_id},${safeName},${safeCompany},${entrata},${uscita},${report.coffee_break_minutes},${report.lunch_break_minutes},${report.break_minutes},${report.total_hours}`
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

    // Formato Excel (vero .xlsx con libreria xlsx)
    if (format === 'excel') {
      // Crea workbook
      const wb = XLSX.utils.book_new();

      // Sheet 1: Dettaglio Presenze
      const detailData = reports.map(report => ({
        'Data': report.date,
        'ID': report.contact_id,
        'Nome Dipendente': report.contact_name,
        'Azienda': report.company_name,
        'Entrata': report.first_clock_in
          ? new Date(report.first_clock_in).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
          : '-',
        'Uscita': report.last_clock_out
          ? new Date(report.last_clock_out).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
          : '-',
        'Pausa Caffè (min)': report.coffee_break_minutes,
        'Pausa Pranzo (min)': report.lunch_break_minutes,
        'Pausa Totale (min)': report.break_minutes,
        'Ore Lavorate': report.total_hours,
      }));

      const wsDetail = XLSX.utils.json_to_sheet(detailData);
      // Imposta larghezza colonne
      wsDetail['!cols'] = [
        { wch: 12 }, // Data
        { wch: 8 },  // ID
        { wch: 25 }, // Nome
        { wch: 20 }, // Azienda
        { wch: 10 }, // Entrata
        { wch: 10 }, // Uscita
        { wch: 18 }, // Pausa Caffè
        { wch: 18 }, // Pausa Pranzo
        { wch: 18 }, // Pausa Totale
        { wch: 12 }, // Ore
      ];
      XLSX.utils.book_append_sheet(wb, wsDetail, 'Presenze');

      // Sheet 2: Riepilogo per Dipendente
      const byContact = new Map<number, { id: number; name: string; company: string; days: number; hours: number; coffeeMin: number; lunchMin: number }>();
      for (const report of reports) {
        const key = report.contact_id;
        if (!byContact.has(key)) {
          byContact.set(key, { id: report.contact_id, name: report.contact_name, company: report.company_name, days: 0, hours: 0, coffeeMin: 0, lunchMin: 0 });
        }
        const data = byContact.get(key)!;
        data.days++;
        data.hours += report.total_hours;
        data.coffeeMin += report.coffee_break_minutes;
        data.lunchMin += report.lunch_break_minutes;
      }

      const summaryData = Array.from(byContact.values()).map(data => ({
        'ID': data.id,
        'Nome Dipendente': data.name,
        'Azienda': data.company,
        'Giorni Lavorati': data.days,
        'Pausa Caffè Tot (min)': data.coffeeMin,
        'Pausa Pranzo Tot (min)': data.lunchMin,
        'Ore Totali': Number(data.hours.toFixed(2)),
        'Media Ore/Giorno': Number((data.hours / data.days).toFixed(2)),
      }));

      const wsSummary = XLSX.utils.json_to_sheet(summaryData);
      wsSummary['!cols'] = [
        { wch: 8 },  // ID
        { wch: 25 }, // Nome
        { wch: 20 }, // Azienda
        { wch: 15 }, // Giorni
        { wch: 20 }, // Pausa Caffè
        { wch: 20 }, // Pausa Pranzo
        { wch: 12 }, // Ore Tot
        { wch: 15 }, // Media
      ];
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Riepilogo');

      // Sheet 3: Dettaglio Pause
      const breakData = reports.flatMap(report =>
        report.breaks.map(b => ({
          'Data': report.date,
          'ID': report.contact_id,
          'Nome Dipendente': report.contact_name,
          'Tipo Pausa': b.name,
          'Inizio': new Date(b.start).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
          'Fine': b.end ? new Date(b.end).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : 'In corso',
          'Durata (min)': b.duration_minutes,
        }))
      );

      if (breakData.length > 0) {
        const wsBreaks = XLSX.utils.json_to_sheet(breakData);
        wsBreaks['!cols'] = [
          { wch: 12 }, // Data
          { wch: 8 },  // ID
          { wch: 25 }, // Nome
          { wch: 15 }, // Tipo
          { wch: 10 }, // Inizio
          { wch: 10 }, // Fine
          { wch: 12 }, // Durata
        ];
        XLSX.utils.book_append_sheet(wb, wsBreaks, 'Pause');
      }

      // Genera buffer Excel
      const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      if (email) {
        console.log(`TODO: Inviare report Excel a ${email}`);
      }

      return new NextResponse(excelBuffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="presenze_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}.xlsx"`,
        },
      });
    }

    // Formato PDF
    if (format === 'pdf') {
      const doc = new jsPDF() as JsPDFWithAutoTable;

      // Header
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('Report Presenze', 14, 20);

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      doc.text(`Periodo: ${startDate.toLocaleDateString('it-IT')} - ${endDate.toLocaleDateString('it-IT')}`, 14, 28);

      // Se non ci sono dati, mostra messaggio
      if (reports.length === 0) {
        doc.setFontSize(12);
        doc.setTextColor(150);
        doc.text('Nessuna presenza registrata nel periodo selezionato.', 14, 50);

        const pdfOutput = doc.output('arraybuffer');
        return new NextResponse(pdfOutput, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="presenze_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}.pdf"`,
          },
        });
      }

      // Calcola riepilogo per dipendente
      const byContact = new Map<number, { id: number; name: string; company: string; days: number; hours: number; coffeeMin: number; lunchMin: number }>();
      for (const report of reports) {
        const key = report.contact_id;
        if (!byContact.has(key)) {
          byContact.set(key, { id: report.contact_id, name: report.contact_name, company: report.company_name, days: 0, hours: 0, coffeeMin: 0, lunchMin: 0 });
        }
        const data = byContact.get(key)!;
        data.days++;
        data.hours += report.total_hours;
        data.coffeeMin += report.coffee_break_minutes;
        data.lunchMin += report.lunch_break_minutes;
      }

      // Calcola totali
      const totalHours = reports.reduce((sum, r) => sum + r.total_hours, 0);
      const totalDays = new Set(reports.map(r => r.date)).size;

      // Statistiche
      doc.setFontSize(10);
      doc.setTextColor(0);
      doc.text(`Dipendenti: ${byContact.size}  |  Giorni: ${totalDays}  |  Ore Totali: ${totalHours.toFixed(2)}`, 14, 36);

      // Riepilogo per Dipendente
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Riepilogo per Dipendente', 14, 48);

      const summaryBody: (string | number)[][] = [];
      for (const data of Array.from(byContact.values())) {
        summaryBody.push([
          data.name,
          data.days,
          data.hours.toFixed(2),
          data.days > 0 ? (data.hours / data.days).toFixed(2) : '0.00',
        ]);
      }

      doc.autoTable({
        head: [['Dipendente', 'Giorni', 'Ore Totali', 'Media/Giorno']],
        body: summaryBody,
        startY: 52,
        theme: 'striped',
        headStyles: { fillColor: [66, 139, 202], fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        margin: { left: 14, right: 14 },
      });

      // Dettaglio Presenze
      const startYDetail = (doc.lastAutoTable?.finalY || 70) + 15;
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Dettaglio Presenze', 14, startYDetail);

      const detailBody: (string | number)[][] = [];
      for (const report of reports) {
        const entrata = report.first_clock_in
          ? new Date(report.first_clock_in).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
          : '-';
        const uscita = report.last_clock_out
          ? new Date(report.last_clock_out).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
          : '-';

        detailBody.push([
          report.date,
          report.contact_name,
          entrata,
          uscita,
          report.break_minutes,
          report.total_hours.toFixed(2),
        ]);
      }

      doc.autoTable({
        head: [['Data', 'Dipendente', 'Entrata', 'Uscita', 'Pause (min)', 'Ore']],
        body: detailBody,
        startY: startYDetail + 4,
        theme: 'striped',
        headStyles: { fillColor: [66, 139, 202], fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 22 },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 18 },
          3: { cellWidth: 18 },
          4: { cellWidth: 22 },
          5: { cellWidth: 15 },
        },
        margin: { left: 14, right: 14 },
      });

      // Genera output come ArrayBuffer
      const pdfOutput = doc.output('arraybuffer');

      return new NextResponse(pdfOutput, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="presenze_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}.pdf"`,
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
