import { NextRequest, NextResponse } from 'next/server';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';

// Odoo returns `false` for empty related fields, so we use `any` for raw response
// and then normalize to proper types
interface FormattedContact {
  id: number;
  name: string;
  email: string;
  phone?: string;
  mobile?: string;
  function?: string;
  title?: { id: number; name: string };
  parent_id?: [number, string];
  child_ids?: number[];
  is_company: boolean;
  image_128?: string;
  street?: string;
  city?: string;
  country_id?: [number, string];
}

/**
 * Normalizza una risposta Odoo in un formato TypeScript pulito
 * Odoo ritorna `false` per campi vuoti, quindi convertiamo in undefined
 */
function normalizeOdooContact(raw: Record<string, unknown>): FormattedContact {
  return {
    id: raw.id as number,
    name: raw.name as string,
    email: raw.email as string,
    phone: raw.phone ? String(raw.phone) : undefined,
    mobile: raw.mobile ? String(raw.mobile) : undefined,
    function: raw.function ? String(raw.function) : undefined,
    title: raw.title && Array.isArray(raw.title)
      ? { id: raw.title[0] as number, name: raw.title[1] as string }
      : undefined,
    parent_id: raw.parent_id && Array.isArray(raw.parent_id)
      ? [raw.parent_id[0] as number, raw.parent_id[1] as string]
      : undefined,
    child_ids: Array.isArray(raw.child_ids) ? raw.child_ids as number[] : undefined,
    is_company: Boolean(raw.is_company),
    image_128: raw.image_128 ? String(raw.image_128) : undefined,
    street: raw.street ? String(raw.street) : undefined,
    city: raw.city ? String(raw.city) : undefined,
    country_id: raw.country_id && Array.isArray(raw.country_id)
      ? [raw.country_id[0] as number, raw.country_id[1] as string]
      : undefined,
  };
}

/**
 * GET /api/time-attendance/contact?email=xxx
 * Cerca un contatto in Odoo per email e ritorna i dati completi
 * Se il contatto appartiene ad un'azienda (parent_id), ritorna anche l'azienda
 * Se il contatto è un'azienda, ritorna anche i dipendenti (child_ids)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({
        success: false,
        error: 'Email richiesta',
      }, { status: 400 });
    }

    console.log('[TIME-ATTENDANCE] Cercando contatto con email:', email);

    // Usa il client RPC con session manager e auto-reconnect
    const odoo = createOdooRPCClient();
    console.log('[TIME-ATTENDANCE] Client Odoo creato con session manager');

    // Cerca il contatto per email
    let contacts;
    try {
      // Prima prova ricerca esatta
      contacts = await odoo.searchRead(
        'res.partner',
        [['email', '=', email]],
        [
          'id',
          'name',
          'email',
          'phone',
          'mobile',
          'function',
          'title',
          'parent_id',
          'child_ids',
          'is_company',
          'image_128',
          'street',
          'city',
          'country_id',
        ],
        10
      );
      console.log('[TIME-ATTENDANCE] Risultati ricerca esatta:', contacts?.length || 0, 'contatti trovati');

      // Se non trova, prova con email lowercase
      if (!contacts || contacts.length === 0) {
        console.log('[TIME-ATTENDANCE] Provo con email lowercase:', email.toLowerCase());
        contacts = await odoo.searchRead(
          'res.partner',
          [['email', '=', email.toLowerCase()]],
          [
            'id',
            'name',
            'email',
            'phone',
            'mobile',
            'function',
            'title',
            'parent_id',
            'child_ids',
            'is_company',
            'image_128',
            'street',
            'city',
            'country_id',
          ],
          10
        );
        console.log('[TIME-ATTENDANCE] Risultati ricerca lowercase:', contacts?.length || 0, 'contatti trovati');
      }
    } catch (searchErr) {
      console.error('[TIME-ATTENDANCE] Errore ricerca Odoo:', searchErr);
      const errorMessage = searchErr instanceof Error ? searchErr.message : JSON.stringify(searchErr);
      return NextResponse.json({
        success: false,
        error: 'Errore ricerca in Odoo',
        details: errorMessage,
        searched_email: email,
      }, { status: 500 });
    }

    if (!contacts || contacts.length === 0) {
      console.log('[TIME-ATTENDANCE] Nessun contatto trovato per email:', email);
      return NextResponse.json({
        success: false,
        error: `Contatto non trovato in Odoo per email: ${email}`,
        searched_email: email,
      }, { status: 404 });
    }

    // Prendi il primo contatto trovato
    const foundContact = contacts[0];
    console.log('[TIME-ATTENDANCE] Contatto trovato:', foundContact?.name, foundContact?.email);

    const contact = normalizeOdooContact(foundContact as Record<string, unknown>);

    let company: FormattedContact | null = null;
    let employees: FormattedContact[] = [];

    // Se il contatto ha un parent_id (è un dipendente), carica l'azienda
    if (contact.parent_id) {
      const companyData = await odoo.searchRead(
        'res.partner',
        [['id', '=', contact.parent_id[0]]],
        [
          'id',
          'name',
          'email',
          'phone',
          'mobile',
          'is_company',
          'image_128',
          'street',
          'city',
          'country_id',
          'child_ids',
        ],
        1
      );

      if (companyData && companyData.length > 0) {
        company = normalizeOdooContact(companyData[0] as Record<string, unknown>);
      }
    }

    // Se il contatto è un'azienda o ha child_ids, carica SOLO i dipendenti
    // Esclude indirizzi di fatturazione (type='invoice') e consegna (type='delivery')
    const companyId = contact.is_company ? contact.id : contact.parent_id?.[0];

    if (companyId) {
      // Cerca dipendenti con filtro type = 'contact' (dipendenti veri, non indirizzi)
      const employeesData = await odoo.searchRead(
        'res.partner',
        [
          ['parent_id', '=', companyId],
          ['type', '=', 'contact'],  // SOLO dipendenti, NO indirizzi
          ['is_company', '=', false],
        ],
        [
          'id',
          'name',
          'email',
          'phone',
          'mobile',
          'function',
          'title',
          'is_company',
          'image_128',
          'type',
        ],
        100
      );

      employees = (employeesData as Record<string, unknown>[]).map(emp =>
        normalizeOdooContact(emp)
      );

      console.log(`[TIME-ATTENDANCE] Trovati ${employees.length} dipendenti (filtrati per type=contact)`);
    }

    return NextResponse.json({
      success: true,
      data: {
        contact,
        company,
        employees,
      },
    });

  } catch (error) {
    console.error('Contact API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore nel recupero contatto da Odoo',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
