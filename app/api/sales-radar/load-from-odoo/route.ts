import { NextRequest, NextResponse } from 'next/server';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';

export const dynamic = 'force-dynamic';

/**
 * Haversine formula to calculate distance between two coordinates
 * Returns distance in meters
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// Tag names that mark a lead/partner as "not in target" (excluded)
const NOT_TARGET_TAGS = ['Chiuso definitivamente', 'Non interessato', 'Non in Target'];

/**
 * Parse coordinates from crm.lead description field
 * Looks for pattern: "Coordinate: lat, lng" or "Coordinates: lat, lng"
 */
function parseCoordinatesFromDescription(description: string | false): { latitude: number; longitude: number } | null {
  if (!description) return null;

  // Pattern: "Coordinate: 45.123456, 9.123456" or "Coordinates: 45.123456, 9.123456"
  const coordPattern = /Coordinat[ei]?s?:\s*([-\d.]+)\s*,\s*([-\d.]+)/i;
  const match = description.match(coordPattern);

  if (match) {
    const latitude = parseFloat(match[1]);
    const longitude = parseFloat(match[2]);

    if (!isNaN(latitude) && !isNaN(longitude) &&
        latitude >= -90 && latitude <= 90 &&
        longitude >= -180 && longitude <= 180) {
      return { latitude, longitude };
    }
  }

  return null;
}

/**
 * Response item interface
 */
interface MapMarker {
  id: number;
  type: 'customer' | 'lead';
  name: string;
  address: string;
  phone?: string;
  website?: string;
  latitude: number;
  longitude: number;
  color: 'green' | 'orange' | 'grey';
  sales_data?: {
    total_invoiced: number;
    order_count: number;
  };
  tags?: string[];
  distance?: number; // distance from user in meters
}

/**
 * GET /api/sales-radar/load-from-odoo
 *
 * Load Leads and Customers from Odoo for the static map view
 * Filters by distance using Haversine formula
 *
 * Query params:
 * - latitude: number (user GPS) - required
 * - longitude: number (user GPS) - required
 * - radius: number (meters) - required
 * - filter: 'all' | 'customers' | 'leads' | 'not_target' - required
 * - type?: string (restaurant, bar, etc.) - optional
 *
 * Response:
 * - success: boolean
 * - data: Array of map markers
 */
export async function GET(request: NextRequest) {
  try {
    // Get odoo_session_id from cookies
    const sessionId = request.cookies.get('odoo_session_id')?.value;

    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Non autenticato - Odoo session non trovata'
      }, { status: 401 });
    }

    const client = createOdooRPCClient(sessionId);

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const latitude = parseFloat(searchParams.get('latitude') || '');
    const longitude = parseFloat(searchParams.get('longitude') || '');
    const radius = parseFloat(searchParams.get('radius') || '');
    const filter = searchParams.get('filter') as 'all' | 'customers' | 'leads' | 'not_target';
    const type = searchParams.get('type') || undefined;

    // Validate required parameters
    if (isNaN(latitude) || isNaN(longitude)) {
      return NextResponse.json({
        success: false,
        error: 'Parametri "latitude" e "longitude" richiesti'
      }, { status: 400 });
    }

    if (isNaN(radius) || radius <= 0) {
      return NextResponse.json({
        success: false,
        error: 'Parametro "radius" deve essere un numero positivo (in metri)'
      }, { status: 400 });
    }

    if (!filter || !['all', 'customers', 'leads', 'not_target'].includes(filter)) {
      return NextResponse.json({
        success: false,
        error: 'Parametro "filter" deve essere: all, customers, leads, not_target'
      }, { status: 400 });
    }

    console.log('[LOAD-FROM-ODOO] Caricamento dati:', { latitude, longitude, radius, filter, type });

    const markers: MapMarker[] = [];

    // === 1. LOAD CUSTOMERS (res.partner) ===
    if (filter === 'all' || filter === 'customers' || filter === 'not_target') {
      console.log('[LOAD-FROM-ODOO] Ricerca clienti in res.partner...');

      // Search for companies with coordinates
      // partner_latitude and partner_longitude are standard Odoo fields from contacts module
      const customerDomain: any[] = [
        ['is_company', '=', true],
        ['partner_latitude', '!=', false],
        ['partner_latitude', '!=', 0],
        ['partner_longitude', '!=', false],
        ['partner_longitude', '!=', 0]
      ];

      // Filter by type/category if specified
      if (type) {
        customerDomain.push(['category_id.name', 'ilike', type]);
      }

      try {
        const customers = await client.searchRead(
          'res.partner',
          customerDomain,
          [
            'id', 'name', 'display_name', 'phone', 'mobile',
            'street', 'street2', 'zip', 'city',
            'partner_latitude', 'partner_longitude',
            'total_invoiced', 'sale_order_count',
            'category_id', // Tags
            'website' // Website URL
          ],
          0, // No limit, we'll filter by distance
          'name asc'
        );

        console.log(`[LOAD-FROM-ODOO] Trovati ${customers.length} clienti con coordinate`);

        for (const customer of customers) {
          const custLat = customer.partner_latitude;
          const custLng = customer.partner_longitude;

          if (!custLat || !custLng) continue;

          // Calculate distance
          const distance = calculateDistance(latitude, longitude, custLat, custLng);

          // Filter by radius
          if (distance > radius) continue;

          // Determine color based on sales data and tags
          const hasOrders = (customer.total_invoiced || 0) > 0 || (customer.sale_order_count || 0) > 0;
          const tags = customer.category_id ?
            (Array.isArray(customer.category_id) ? customer.category_id.map((t: any) => t[1] || t) : []) : [];
          const isNotTarget = tags.some((tag: string) =>
            typeof tag === 'string' && NOT_TARGET_TAGS.some(notTag =>
              tag.toLowerCase().includes(notTag.toLowerCase())
            )
          );

          let color: 'green' | 'orange' | 'grey' = 'orange'; // Default to lead color

          if (isNotTarget) {
            color = 'grey';
          } else if (hasOrders) {
            color = 'green';
          }

          // Apply filter
          if (filter === 'customers' && color !== 'green') continue;
          if (filter === 'not_target' && color !== 'grey') continue;

          // Build address
          const addressParts = [
            customer.street,
            customer.street2,
            customer.zip,
            customer.city
          ].filter(Boolean);
          const address = addressParts.join(', ');

          markers.push({
            id: customer.id,
            type: 'customer',
            name: customer.display_name || customer.name,
            address,
            phone: customer.phone || customer.mobile || undefined,
            website: customer.website || undefined,
            latitude: custLat,
            longitude: custLng,
            color,
            sales_data: hasOrders ? {
              total_invoiced: customer.total_invoiced || 0,
              order_count: customer.sale_order_count || 0
            } : undefined,
            tags: tags.length > 0 ? tags : undefined,
            distance: Math.round(distance)
          });
        }
      } catch (error) {
        console.error('[LOAD-FROM-ODOO] Errore caricamento clienti:', error);
      }
    }

    // === 2. LOAD LEADS (crm.lead) ===
    if (filter === 'all' || filter === 'leads' || filter === 'not_target') {
      console.log('[LOAD-FROM-ODOO] Ricerca lead in crm.lead...');

      // Search for leads (type=lead means it's a lead, not an opportunity)
      // Include both active AND archived leads (for not_target view)
      const leadDomain: any[] = [
        ['type', '=', 'lead'],
        '|',
        ['active', '=', true],
        ['active', '=', false]  // Include archived/excluded leads
      ];

      // Filter by type in name or description if specified
      if (type) {
        leadDomain.push('|');
        leadDomain.push(['name', 'ilike', type]);
        leadDomain.push(['description', 'ilike', type]);
      }

      try {
        const leads = await client.searchRead(
          'crm.lead',
          leadDomain,
          [
            'id', 'name', 'contact_name', 'partner_name',
            'phone', 'mobile',
            'street', 'street2', 'zip', 'city',
            'description', // Contains coordinates
            'tag_ids', // Tags
            'website' // Website URL
          ],
          0, // No limit, we'll filter by distance
          'name asc'
        );

        console.log(`[LOAD-FROM-ODOO] Trovati ${leads.length} lead`);

        // Get tag names for leads that have tags
        const leadTagIds = leads
          .filter((l: any) => l.tag_ids && l.tag_ids.length > 0)
          .flatMap((l: any) => l.tag_ids);

        let tagMap: Record<number, string> = {};
        if (leadTagIds.length > 0) {
          try {
            const tags = await client.searchRead(
              'crm.tag',
              [['id', 'in', Array.from(new Set(leadTagIds))]],
              ['id', 'name'],
              0
            );
            tagMap = Object.fromEntries(tags.map((t: any) => [t.id, t.name]));
          } catch (e) {
            console.warn('[LOAD-FROM-ODOO] Errore caricamento tag lead:', e);
          }
        }

        for (const lead of leads) {
          // Parse coordinates from description
          const coords = parseCoordinatesFromDescription(lead.description);

          if (!coords) continue; // Skip leads without coordinates

          // Calculate distance
          const distance = calculateDistance(latitude, longitude, coords.latitude, coords.longitude);

          // Filter by radius
          if (distance > radius) continue;

          // Get tag names
          const tags = lead.tag_ids ?
            lead.tag_ids.map((tagId: number) => tagMap[tagId]).filter(Boolean) : [];

          const isNotTarget = tags.some((tag: string) =>
            typeof tag === 'string' && NOT_TARGET_TAGS.some(notTag =>
              tag.toLowerCase().includes(notTag.toLowerCase())
            )
          );

          // Leads are always orange unless marked as not_target (grey)
          const color: 'green' | 'orange' | 'grey' = isNotTarget ? 'grey' : 'orange';

          // Apply filter for not_target
          if (filter === 'not_target' && color !== 'grey') continue;
          if (filter === 'leads' && color === 'grey') continue; // Exclude archived from normal leads view

          // Build address
          const addressParts = [
            lead.street,
            lead.street2,
            lead.zip,
            lead.city
          ].filter(Boolean);
          const address = addressParts.join(', ') || lead.partner_name || '';

          markers.push({
            id: lead.id,
            type: 'lead',
            name: lead.partner_name || lead.name || lead.contact_name || 'Lead',
            address,
            phone: lead.phone || lead.mobile || undefined,
            website: lead.website || undefined,
            latitude: coords.latitude,
            longitude: coords.longitude,
            color,
            tags: tags.length > 0 ? tags : undefined,
            distance: Math.round(distance)
          });
        }
      } catch (error) {
        console.error('[LOAD-FROM-ODOO] Errore caricamento lead:', error);
      }
    }

    // Sort by distance
    markers.sort((a, b) => (a.distance || 0) - (b.distance || 0));

    console.log(`[LOAD-FROM-ODOO] Totale marker nel raggio: ${markers.length}`);

    return NextResponse.json({
      success: true,
      data: markers,
      meta: {
        total: markers.length,
        filter,
        radius,
        center: { latitude, longitude }
      }
    });

  } catch (error) {
    console.error('[LOAD-FROM-ODOO] Errore:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore durante il caricamento dati da Odoo',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
