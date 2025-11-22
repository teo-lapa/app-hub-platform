import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

/**
 * Pulisce l'IP address per renderlo compatibile con PostgreSQL inet
 * Rimuove il prefisso IPv6-mapped (::ffff:) se presente
 */
function cleanIpAddress(ip: string | null): string | null {
  if (!ip) return null;

  // Rimuovi prefisso IPv6-mapped IPv4
  if (ip.startsWith('::ffff:')) {
    return ip.substring(7);
  }

  // Se contiene virgole (proxy chain), prendi il primo
  if (ip.includes(',')) {
    return ip.split(',')[0].trim();
  }

  return ip;
}

interface ConsentRecord {
  id: string;
  contact_id: number;
  consent_type: 'gps_tracking' | 'data_processing' | 'privacy_policy';
  is_granted: boolean;
  granted_at: string | null;
  revoked_at: string | null;
  consent_version: string;
}

/**
 * GET /api/time-attendance/consent?contact_id=xxx
 * Ottiene lo stato dei consensi per un contatto
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get('contact_id');

    if (!contactId) {
      return NextResponse.json({
        success: false,
        error: 'contact_id richiesto',
      }, { status: 400 });
    }

    const contactIdNum = parseInt(contactId, 10);

    let consents: ConsentRecord[] = [];

    try {
      const result = await sql`
        SELECT
          id,
          contact_id,
          consent_type,
          is_granted,
          granted_at,
          revoked_at,
          consent_version
        FROM ta_odoo_consents
        WHERE contact_id = ${contactIdNum}
        ORDER BY consent_type
      `;

      consents = result.rows.map(row => ({
        id: row.id,
        contact_id: row.contact_id,
        consent_type: row.consent_type,
        is_granted: row.is_granted,
        granted_at: row.granted_at,
        revoked_at: row.revoked_at,
        consent_version: row.consent_version,
      }));
    } catch (dbError) {
      console.warn('Database non disponibile:', dbError);
    }

    // Determina quali consensi sono stati dati
    const gpsConsent = consents.find(c => c.consent_type === 'gps_tracking');
    const dataConsent = consents.find(c => c.consent_type === 'data_processing');
    const privacyConsent = consents.find(c => c.consent_type === 'privacy_policy');

    // Tutti i consensi devono essere dati per usare l'app
    const allConsentsGranted =
      gpsConsent?.is_granted &&
      dataConsent?.is_granted &&
      privacyConsent?.is_granted;

    return NextResponse.json({
      success: true,
      data: {
        all_granted: allConsentsGranted,
        consents: {
          gps_tracking: {
            granted: gpsConsent?.is_granted ?? false,
            granted_at: gpsConsent?.granted_at,
            version: gpsConsent?.consent_version ?? '1.0',
          },
          data_processing: {
            granted: dataConsent?.is_granted ?? false,
            granted_at: dataConsent?.granted_at,
            version: dataConsent?.consent_version ?? '1.0',
          },
          privacy_policy: {
            granted: privacyConsent?.is_granted ?? false,
            granted_at: privacyConsent?.granted_at,
            version: privacyConsent?.consent_version ?? '1.0',
          },
        },
      },
    });

  } catch (error) {
    console.error('Consent GET error:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore nel recupero consensi',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

/**
 * POST /api/time-attendance/consent
 * Registra i consensi GDPR per un contatto
 *
 * Body:
 * - contact_id: ID del contatto Odoo
 * - consents: {
 *     gps_tracking: boolean,
 *     data_processing: boolean,
 *     privacy_policy: boolean
 *   }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contact_id, consents } = body;

    if (!contact_id || !consents) {
      return NextResponse.json({
        success: false,
        error: 'contact_id e consents richiesti',
      }, { status: 400 });
    }

    const consentTypes = ['gps_tracking', 'data_processing', 'privacy_policy'] as const;

    // Ottieni IP e User Agent (pulisci IP per compatibilità PostgreSQL inet)
    const rawIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null;
    const ipAddress = cleanIpAddress(rawIp);
    const userAgent = request.headers.get('user-agent') || null;

    console.log('[Consent] Saving consents for contact_id:', contact_id, 'IP:', ipAddress);

    const timestamp = new Date().toISOString();
    const savedConsents: ConsentRecord[] = [];

    for (const consentType of consentTypes) {
      const isGranted = consents[consentType] ?? false;

      try {
        // Verifica se esiste già un consenso
        const existing = await sql`
          SELECT id, is_granted
          FROM ta_odoo_consents
          WHERE contact_id = ${contact_id}
            AND consent_type = ${consentType}
          LIMIT 1
        `;

        if (existing.rows.length > 0) {
          // Aggiorna consenso esistente
          console.log(`[Consent] Updating existing consent ${consentType} for contact ${contact_id}`);
          if (isGranted) {
            // Prova con IP, se fallisce riprova senza
            try {
              await sql`
                UPDATE ta_odoo_consents
                SET is_granted = ${isGranted},
                    granted_at = ${timestamp},
                    revoked_at = NULL,
                    ip_address = ${ipAddress}::inet,
                    user_agent = ${userAgent}
                WHERE contact_id = ${contact_id}
                  AND consent_type = ${consentType}
              `;
            } catch (ipError) {
              console.warn(`[Consent] IP cast failed, retrying without IP:`, ipError);
              await sql`
                UPDATE ta_odoo_consents
                SET is_granted = ${isGranted},
                    granted_at = ${timestamp},
                    revoked_at = NULL,
                    user_agent = ${userAgent}
                WHERE contact_id = ${contact_id}
                  AND consent_type = ${consentType}
              `;
            }
          } else {
            try {
              await sql`
                UPDATE ta_odoo_consents
                SET is_granted = ${isGranted},
                    revoked_at = ${timestamp},
                    ip_address = ${ipAddress}::inet,
                    user_agent = ${userAgent}
                WHERE contact_id = ${contact_id}
                  AND consent_type = ${consentType}
              `;
            } catch (ipError) {
              console.warn(`[Consent] IP cast failed, retrying without IP:`, ipError);
              await sql`
                UPDATE ta_odoo_consents
                SET is_granted = ${isGranted},
                    revoked_at = ${timestamp},
                    user_agent = ${userAgent}
                WHERE contact_id = ${contact_id}
                  AND consent_type = ${consentType}
              `;
            }
          }
        } else {
          // Crea nuovo consenso
          console.log(`[Consent] Creating new consent ${consentType} for contact ${contact_id}`);
          try {
            await sql`
              INSERT INTO ta_odoo_consents (
                contact_id,
                consent_type,
                is_granted,
                granted_at,
                consent_version,
                ip_address,
                user_agent
              ) VALUES (
                ${contact_id},
                ${consentType},
                ${isGranted},
                ${isGranted ? timestamp : null},
                '1.0',
                ${ipAddress}::inet,
                ${userAgent}
              )
            `;
          } catch (ipError) {
            console.warn(`[Consent] IP cast failed on INSERT, retrying without IP:`, ipError);
            await sql`
              INSERT INTO ta_odoo_consents (
                contact_id,
                consent_type,
                is_granted,
                granted_at,
                consent_version,
                user_agent
              ) VALUES (
                ${contact_id},
                ${consentType},
                ${isGranted},
                ${isGranted ? timestamp : null},
                '1.0',
                ${userAgent}
              )
            `;
          }
        }

        console.log(`[Consent] Successfully saved ${consentType} = ${isGranted} for contact ${contact_id}`);
        savedConsents.push({
          id: '',
          contact_id,
          consent_type: consentType,
          is_granted: isGranted,
          granted_at: isGranted ? timestamp : null,
          revoked_at: isGranted ? null : timestamp,
          consent_version: '1.0',
        });
      } catch (dbError) {
        // Errore critico - log e propaga
        console.error(`[Consent] CRITICAL: Failed to save consent ${consentType} for contact ${contact_id}:`, dbError);
        return NextResponse.json({
          success: false,
          error: `Errore nel salvataggio del consenso ${consentType}`,
          details: dbError instanceof Error ? dbError.message : 'Database error',
        }, { status: 500 });
      }
    }

    const allGranted = savedConsents.every(c => c.is_granted);

    return NextResponse.json({
      success: true,
      data: {
        all_granted: allGranted,
        consents: savedConsents,
      },
      message: allGranted
        ? 'Tutti i consensi sono stati registrati'
        : 'Consensi aggiornati',
    });

  } catch (error) {
    console.error('Consent POST error:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore nel salvataggio dei consensi',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
