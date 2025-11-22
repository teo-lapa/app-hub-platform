import { NextRequest, NextResponse } from 'next/server';
import { getOdooClient } from '@/lib/odoo-client';

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
  x_gender?: 'male' | 'female' | 'other';
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
    x_gender: raw.x_gender ? String(raw.x_gender) as 'male' | 'female' | 'other' : undefined,
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

    const odoo = await getOdooClient();

    // Cerca il contatto per email
    const contacts = await odoo.searchRead(
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
        'x_gender',
      ],
      1
    );

    if (!contacts || contacts.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Contatto non trovato in Odoo',
      }, { status: 404 });
    }

    const contact = normalizeOdooContact(contacts[0] as Record<string, unknown>);

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

    // Se il contatto è un'azienda o ha child_ids, carica i dipendenti
    if (contact.is_company || (contact.child_ids && contact.child_ids.length > 0)) {
      const childIds = contact.child_ids || [];

      if (childIds.length > 0) {
        const employeesData = await odoo.searchRead(
          'res.partner',
          [['id', 'in', childIds]],
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
            'x_gender',
          ],
          100
        );

        employees = (employeesData as Record<string, unknown>[]).map(emp =>
          normalizeOdooContact(emp)
        );
      }
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
