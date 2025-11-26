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

// Mapping of English place types to Italian equivalents for Odoo search
const TYPE_TRANSLATIONS: Record<string, string[]> = {
  'restaurant': ['ristorante', 'ristoranti', 'trattoria', 'pizzeria', 'osteria'],
  'cafe': ['caffè', 'caffe', 'bar', 'pasticceria'],
  'bar': ['bar', 'pub', 'birreria', 'lounge'],
  'bakery': ['panetteria', 'panificio', 'forno', 'pasticceria'],
  'supermarket': ['supermercato', 'alimentari', 'market', 'negozio'],
  'hotel': ['hotel', 'albergo', 'residence', 'pensione'],
  'lodging': ['alloggio', 'b&b', 'bed and breakfast', 'agriturismo'],
  'food': ['alimentari', 'gastronomia', 'food', 'cibo'],
  'store': ['negozio', 'store', 'shop', 'bottega'],
  'shopping_mall': ['centro commerciale', 'mall', 'galleria']
};

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
  locationType?: 'company' | 'delivery'; // 'company' = sede legale, 'delivery' = indirizzo consegna
  parentId?: number; // ID azienda madre (per indirizzi di consegna)
  parentName?: string; // Nome azienda madre (per indirizzi di consegna)
  name: string;
  address: string;
  phone?: string;
  website?: string;
  latitude: number;
  longitude: number;
  color: 'green' | 'orange' | 'grey';
  sales_data?: {
    invoiced_3_months: number;    // Fatturato ultimi 3 mesi
    order_count_3_months: number; // Ordini ultimi 3 mesi
    last_order_date?: string;     // Data ultimo ordine (YYYY-MM-DD)
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
 * - latitude: number (user GPS) - required (unless all_active=true)
 * - longitude: number (user GPS) - required (unless all_active=true)
 * - radius: number (meters) - required (unless all_active=true)
 * - filter: 'all' | 'customers' | 'leads' | 'not_target' | 'active_6m' - required
 * - type?: string (restaurant, bar, etc.) - optional
 * - all_active?: 'true' - Load ALL active customers without radius limit
 * - period?: '1m' | '3m' | '6m' - Period for active customers (default: 3m)
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
    const filter = searchParams.get('filter') as 'all' | 'customers' | 'leads' | 'not_target' | 'active_6m';
    const type = searchParams.get('type') || undefined;
    const allActive = searchParams.get('all_active') === 'true';
    const period = searchParams.get('period') as '1m' | '3m' | '6m' | null;

    // Validate required parameters (skip for all_active mode)
    if (!allActive) {
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
    }

    // Skip filter validation for all_active mode
    if (!allActive && (!filter || !['all', 'customers', 'leads', 'not_target', 'active_6m'].includes(filter))) {
      return NextResponse.json({
        success: false,
        error: 'Parametro "filter" deve essere: all, customers, leads, not_target, active_6m'
      }, { status: 400 });
    }

    console.log('[LOAD-FROM-ODOO] Caricamento dati:', { latitude, longitude, radius, filter, type, allActive, period });

    const markers: MapMarker[] = [];

    // Calculate date 1 month ago
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const oneMonthAgoStr = oneMonthAgo.toISOString().split('T')[0];

    // Calculate date 3 months ago for filtering orders
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const threeMonthsAgoStr = threeMonthsAgo.toISOString().split('T')[0];

    // Calculate date 6 months ago for active_6m filter
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0];

    // Determine period date filter based on period parameter
    const getPeriodDateFilter = () => {
      if (period === '1m') return oneMonthAgoStr;
      if (period === '6m') return sixMonthsAgoStr;
      return threeMonthsAgoStr; // Default to 3 months
    };

    // === SPECIAL MODE: LOAD ALL ACTIVE CUSTOMERS (no radius limit) ===
    if (allActive) {
      console.log(`[LOAD-FROM-ODOO] 🚀 Caricamento TUTTI i clienti attivi (periodo: ${period || '3m'})...`);

      // Get all companies with coordinates that have orders in the specified period
      const customerDomain: any[] = [
        ['is_company', '=', true],
        ['partner_latitude', '!=', false],
        ['partner_latitude', '!=', 0],
        ['partner_longitude', '!=', false],
        ['partner_longitude', '!=', 0]
      ];

      try {
        const customers = await client.searchRead(
          'res.partner',
          customerDomain,
          [
            'id', 'name', 'display_name', 'phone', 'mobile',
            'street', 'street2', 'zip', 'city',
            'partner_latitude', 'partner_longitude',
            'category_id', 'website'
          ],
          0,
          'name asc'
        );

        console.log(`[LOAD-FROM-ODOO] Trovati ${customers.length} clienti con coordinate`);

        const customerIds = customers.map((c: any) => c.id);
        const periodDateFilter = getPeriodDateFilter();

        // Fetch orders for the specified period
        let salesDataMap: Record<number, { invoiced: number; orderCount: number; lastOrderDate: string | null }> = {};

        if (customerIds.length > 0) {
          const orders = await client.searchRead(
            'sale.order',
            [
              ['partner_id', 'in', customerIds],
              ['state', 'in', ['sale', 'done']],
              ['date_order', '>=', periodDateFilter]
            ],
            ['partner_id', 'amount_total', 'date_order'],
            0,
            'date_order desc'
          );

          // Aggregate by partner
          for (const order of orders) {
            const partnerId = order.partner_id[0];
            if (!salesDataMap[partnerId]) {
              salesDataMap[partnerId] = { invoiced: 0, orderCount: 0, lastOrderDate: null };
            }
            salesDataMap[partnerId].invoiced += order.amount_total || 0;
            salesDataMap[partnerId].orderCount += 1;
            if (!salesDataMap[partnerId].lastOrderDate) {
              salesDataMap[partnerId].lastOrderDate = order.date_order ? order.date_order.split(' ')[0] : null;
            }
          }

          console.log(`[LOAD-FROM-ODOO] Clienti con ordini nel periodo: ${Object.keys(salesDataMap).length}`);
        }

        // Only include customers that have orders in the period
        for (const customer of customers) {
          const salesData = salesDataMap[customer.id];
          if (!salesData) continue; // Skip customers without orders in period

          const custLat = customer.partner_latitude;
          const custLng = customer.partner_longitude;

          const addressParts = [
            customer.street,
            customer.street2,
            customer.zip,
            customer.city
          ].filter(Boolean);
          const address = addressParts.join(', ');

          const tags = customer.category_id ?
            (Array.isArray(customer.category_id) ? customer.category_id.map((t: any) => t[1] || t) : []) : [];

          markers.push({
            id: customer.id,
            type: 'customer',
            locationType: 'company',
            name: customer.display_name || customer.name,
            address,
            phone: customer.phone || customer.mobile || undefined,
            website: customer.website || undefined,
            latitude: custLat,
            longitude: custLng,
            color: 'green',
            sales_data: {
              invoiced_3_months: Math.round(salesData.invoiced * 100) / 100,
              order_count_3_months: salesData.orderCount,
              last_order_date: salesData.lastOrderDate || undefined
            },
            tags: tags.length > 0 ? tags : undefined
          });
        }

        console.log(`[LOAD-FROM-ODOO] ✅ Totale clienti attivi (sedi): ${markers.length}`);

        // === CARICA INDIRIZZI DI CONSEGNA per i clienti attivi ===
        const activeCustomerIds = markers.map(m => m.id);
        if (activeCustomerIds.length > 0) {
          try {
            const deliveryAddresses = await client.searchRead(
              'res.partner',
              [
                ['parent_id', 'in', activeCustomerIds],
                ['type', '=', 'delivery'],
                ['partner_latitude', '!=', false],
                ['partner_latitude', '!=', 0],
                ['partner_longitude', '!=', false],
                ['partner_longitude', '!=', 0]
              ],
              [
                'id', 'name', 'display_name', 'phone', 'mobile',
                'street', 'street2', 'zip', 'city',
                'partner_latitude', 'partner_longitude',
                'parent_id'
              ],
              0,
              'name asc'
            );

            console.log(`[LOAD-FROM-ODOO] Trovati ${deliveryAddresses.length} indirizzi di consegna`);

            // Crea una mappa dei clienti per accesso rapido
            const customerMap = new Map(customers.map((c: any) => [c.id, c]));

            for (const delivery of deliveryAddresses) {
              const parentId = delivery.parent_id ? delivery.parent_id[0] : null;
              const parentName = delivery.parent_id ? delivery.parent_id[1] : null;
              if (!parentId) continue;

              const parentCustomer = customerMap.get(parentId);
              if (!parentCustomer) continue;

              const parentSalesData = salesDataMap[parentId];
              if (!parentSalesData) continue; // Il parent non è attivo

              const deliveryLat = delivery.partner_latitude;
              const deliveryLng = delivery.partner_longitude;
              const parentLat = parentCustomer.partner_latitude;
              const parentLng = parentCustomer.partner_longitude;

              // Calcola distanza tra sede e indirizzo di consegna
              const distanceFromParent = calculateDistance(parentLat, parentLng, deliveryLat, deliveryLng);

              // Se la distanza è > 50m, aggiungi come marker separato
              if (distanceFromParent > 50) {
                const addressParts = [
                  delivery.street,
                  delivery.street2,
                  delivery.zip,
                  delivery.city
                ].filter(Boolean);
                const address = addressParts.join(', ');

                const parentTags = parentCustomer.category_id ?
                  (Array.isArray(parentCustomer.category_id) ? parentCustomer.category_id.map((t: any) => t[1] || t) : []) : [];

                markers.push({
                  id: delivery.id,
                  type: 'customer',
                  locationType: 'delivery',
                  parentId: parentId,
                  parentName: parentName,
                  name: delivery.display_name || delivery.name || `Consegna - ${parentName}`,
                  address,
                  phone: delivery.phone || delivery.mobile || parentCustomer.phone || parentCustomer.mobile || undefined,
                  website: parentCustomer.website || undefined,
                  latitude: deliveryLat,
                  longitude: deliveryLng,
                  color: 'green',
                  sales_data: {
                    invoiced_3_months: Math.round(parentSalesData.invoiced * 100) / 100,
                    order_count_3_months: parentSalesData.orderCount,
                    last_order_date: parentSalesData.lastOrderDate || undefined
                  },
                  tags: parentTags.length > 0 ? parentTags : undefined
                });
              }
            }

            console.log(`[LOAD-FROM-ODOO] ✅ Totale marker (sedi + consegne): ${markers.length}`);
          } catch (deliveryError) {
            console.error('[LOAD-FROM-ODOO] Errore caricamento indirizzi consegna:', deliveryError);
          }
        }

      } catch (error) {
        console.error('[LOAD-FROM-ODOO] Errore caricamento clienti attivi:', error);
      }

      // Sort by invoiced amount (highest first)
      markers.sort((a, b) => (b.sales_data?.invoiced_3_months || 0) - (a.sales_data?.invoiced_3_months || 0));

      return NextResponse.json({
        success: true,
        data: markers,
        meta: {
          total: markers.length,
          mode: 'all_active',
          period: period || '3m'
        }
      });
    }

    // === 1. LOAD CUSTOMERS (res.partner) ===
    if (filter === 'all' || filter === 'customers' || filter === 'not_target' || filter === 'active_6m') {
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

      // Filter by type/category if specified (with Italian translations)
      // Searches in BOTH partner name AND category tags
      if (type) {
        const translations = TYPE_TRANSLATIONS[type] || [type];
        console.log(`[LOAD-FROM-ODOO] Filtering customers by type: ${type} -> translations:`, translations);

        // Build OR domain: search in name OR category_id.name for each translation
        // For each term we check: name ilike term OR category_id.name ilike term
        // For N terms with 2 conditions each, we need N*2-1 OR operators
        const allConditions: any[] = [];
        translations.forEach(term => {
          allConditions.push(['name', 'ilike', term]);
          allConditions.push(['category_id.name', 'ilike', term]);
        });

        // Add OR operators for all conditions
        for (let i = 0; i < allConditions.length - 1; i++) {
          customerDomain.push('|');
        }
        allConditions.forEach(cond => customerDomain.push(cond));
      }

      try {
        const customers = await client.searchRead(
          'res.partner',
          customerDomain,
          [
            'id', 'name', 'display_name', 'phone', 'mobile',
            'street', 'street2', 'zip', 'city',
            'partner_latitude', 'partner_longitude',
            'category_id', // Tags
            'website', // Website URL
            'comment' // Contains Google Place ID if converted from lead
          ],
          0, // No limit, we'll filter by distance
          'name asc'
        );

        console.log(`[LOAD-FROM-ODOO] Trovati ${customers.length} clienti con coordinate`);

        // Filter customers by distance first to reduce the number of order queries
        const customersInRadius: any[] = [];
        for (const customer of customers) {
          const custLat = customer.partner_latitude;
          const custLng = customer.partner_longitude;
          if (!custLat || !custLng) continue;

          const distance = calculateDistance(latitude, longitude, custLat, custLng);
          if (distance <= radius) {
            customersInRadius.push({ ...customer, _distance: distance });
          }
        }

        console.log(`[LOAD-FROM-ODOO] ${customersInRadius.length} clienti nel raggio`);

        // Get sales data for customers in radius (last 3 or 6 months depending on filter)
        const customerIds = customersInRadius.map(c => c.id);

        // Use 6 months for active_6m filter, 3 months for others
        const orderDateFilter = filter === 'active_6m' ? sixMonthsAgoStr : threeMonthsAgoStr;

        // Fetch orders for these customers
        let salesDataMap: Record<number, { invoiced: number; orderCount: number; lastOrderDate: string | null }> = {};

        if (customerIds.length > 0) {
          try {
            const orders = await client.searchRead(
              'sale.order',
              [
                ['partner_id', 'in', customerIds],
                ['state', 'in', ['sale', 'done']],
                ['date_order', '>=', orderDateFilter]
              ],
              ['partner_id', 'amount_total', 'date_order'],
              0,
              'date_order desc'
            );

            // Aggregate by partner
            for (const order of orders) {
              const partnerId = order.partner_id[0];
              if (!salesDataMap[partnerId]) {
                salesDataMap[partnerId] = { invoiced: 0, orderCount: 0, lastOrderDate: null };
              }
              salesDataMap[partnerId].invoiced += order.amount_total || 0;
              salesDataMap[partnerId].orderCount += 1;
              // First order in desc order is the most recent
              if (!salesDataMap[partnerId].lastOrderDate) {
                salesDataMap[partnerId].lastOrderDate = order.date_order ? order.date_order.split(' ')[0] : null;
              }
            }

            console.log(`[LOAD-FROM-ODOO] Dati vendite caricati per ${Object.keys(salesDataMap).length} clienti`);
          } catch (e) {
            console.warn('[LOAD-FROM-ODOO] Errore caricamento ordini:', e);
          }
        }

        for (const customer of customersInRadius) {
          const custLat = customer.partner_latitude;
          const custLng = customer.partner_longitude;
          const distance = customer._distance;

          // Get sales data for this customer
          const salesData = salesDataMap[customer.id];
          const hasOrders = salesData && (salesData.invoiced > 0 || salesData.orderCount > 0);

          // Determine color based on sales data and tags
          const tags = customer.category_id ?
            (Array.isArray(customer.category_id) ? customer.category_id.map((t: any) => t[1] || t) : []) : [];
          const isNotTarget = tags.some((tag: string) =>
            typeof tag === 'string' && NOT_TARGET_TAGS.some(notTag =>
              tag.toLowerCase().includes(notTag.toLowerCase())
            )
          );

          // IMPORTANT: Contacts (res.partner) are NEVER orange (orange is only for leads)
          // - Green: Active customer with recent orders
          // - Purple: Customer without recent orders (will be rendered as purple in frontend)
          // - Grey: Marked as "not in target"
          let color: 'green' | 'orange' | 'grey' = 'green'; // Default to green for contacts

          if (isNotTarget) {
            color = 'grey';
          } else if (!hasOrders) {
            // Contacts without orders should appear as purple (but we store as 'green'
            // and let frontend decide based on sales_data presence)
            color = 'green'; // Frontend will show purple if no sales_data
          }

          // Apply filter
          if (filter === 'customers' && color !== 'green') continue;
          if (filter === 'active_6m' && color !== 'green') continue;  // Only active customers (with orders in 6 months)
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
            locationType: 'company',
            name: customer.display_name || customer.name,
            address,
            phone: customer.phone || customer.mobile || undefined,
            website: customer.website || undefined,
            latitude: custLat,
            longitude: custLng,
            color,
            sales_data: hasOrders ? {
              invoiced_3_months: Math.round(salesData.invoiced * 100) / 100,
              order_count_3_months: salesData.orderCount,
              last_order_date: salesData.lastOrderDate || undefined
            } : undefined,
            tags: tags.length > 0 ? tags : undefined,
            distance: Math.round(distance)
          });
        }

        // === CARICA INDIRIZZI DI CONSEGNA per i clienti nel raggio ===
        if (customerIds.length > 0) {
          try {
            const deliveryAddresses = await client.searchRead(
              'res.partner',
              [
                ['parent_id', 'in', customerIds],
                ['type', '=', 'delivery'],
                ['partner_latitude', '!=', false],
                ['partner_latitude', '!=', 0],
                ['partner_longitude', '!=', false],
                ['partner_longitude', '!=', 0]
              ],
              [
                'id', 'name', 'display_name', 'phone', 'mobile',
                'street', 'street2', 'zip', 'city',
                'partner_latitude', 'partner_longitude',
                'parent_id'
              ],
              0,
              'name asc'
            );

            console.log(`[LOAD-FROM-ODOO] Trovati ${deliveryAddresses.length} indirizzi di consegna`);

            // Crea una mappa dei clienti per accesso rapido
            const customerMap = new Map(customersInRadius.map((c: any) => [c.id, c]));

            for (const delivery of deliveryAddresses) {
              const parentId = delivery.parent_id ? delivery.parent_id[0] : null;
              const parentName = delivery.parent_id ? delivery.parent_id[1] : null;
              if (!parentId) continue;

              const parentCustomer = customerMap.get(parentId);
              if (!parentCustomer) continue;

              const deliveryLat = delivery.partner_latitude;
              const deliveryLng = delivery.partner_longitude;
              const parentLat = parentCustomer.partner_latitude;
              const parentLng = parentCustomer.partner_longitude;

              // Calcola distanza tra sede e indirizzo di consegna
              const distanceFromParent = calculateDistance(parentLat, parentLng, deliveryLat, deliveryLng);

              // Se la distanza è > 50m, aggiungi come marker separato
              if (distanceFromParent > 50) {
                // Calcola distanza dalla posizione utente
                const distanceFromUser = calculateDistance(latitude, longitude, deliveryLat, deliveryLng);

                // Includi solo se nel raggio
                if (distanceFromUser > radius) continue;

                const addressParts = [
                  delivery.street,
                  delivery.street2,
                  delivery.zip,
                  delivery.city
                ].filter(Boolean);
                const address = addressParts.join(', ');

                const parentTags = parentCustomer.category_id ?
                  (Array.isArray(parentCustomer.category_id) ? parentCustomer.category_id.map((t: any) => t[1] || t) : []) : [];
                const isNotTarget = parentTags.some((tag: string) =>
                  typeof tag === 'string' && NOT_TARGET_TAGS.some(notTag =>
                    tag.toLowerCase().includes(notTag.toLowerCase())
                  )
                );

                const parentSalesData = salesDataMap[parentId];
                const hasOrders = parentSalesData && (parentSalesData.invoiced > 0 || parentSalesData.orderCount > 0);

                let color: 'green' | 'orange' | 'grey' = 'orange';
                if (isNotTarget) {
                  color = 'grey';
                } else if (hasOrders) {
                  color = 'green';
                }

                // Applica filtro
                if (filter === 'customers' && color !== 'green') continue;
                if (filter === 'active_6m' && color !== 'green') continue;
                if (filter === 'not_target' && color !== 'grey') continue;

                markers.push({
                  id: delivery.id,
                  type: 'customer',
                  locationType: 'delivery',
                  parentId: parentId,
                  parentName: parentName,
                  name: delivery.display_name || delivery.name || `Consegna - ${parentName}`,
                  address,
                  phone: delivery.phone || delivery.mobile || parentCustomer.phone || parentCustomer.mobile || undefined,
                  website: parentCustomer.website || undefined,
                  latitude: deliveryLat,
                  longitude: deliveryLng,
                  color,
                  sales_data: hasOrders ? {
                    invoiced_3_months: Math.round(parentSalesData.invoiced * 100) / 100,
                    order_count_3_months: parentSalesData.orderCount,
                    last_order_date: parentSalesData.lastOrderDate || undefined
                  } : undefined,
                  tags: parentTags.length > 0 ? parentTags : undefined,
                  distance: Math.round(distanceFromUser)
                });
              }
            }

            console.log(`[LOAD-FROM-ODOO] ✅ Totale marker clienti (sedi + consegne): ${markers.filter(m => m.type === 'customer').length}`);
          } catch (deliveryError) {
            console.error('[LOAD-FROM-ODOO] Errore caricamento indirizzi consegna:', deliveryError);
          }
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

      // Filter by type in name or description if specified (with Italian translations)
      if (type) {
        const translations = TYPE_TRANSLATIONS[type] || [type];
        // Each term needs OR between name and description search
        // For N terms we need: '|' '|' ... (N*2-1 OR operators) then all conditions
        const allConditions: any[] = [];
        translations.forEach(term => {
          allConditions.push(['name', 'ilike', term]);
          allConditions.push(['description', 'ilike', term]);
        });
        // Add OR operators for all conditions
        for (let i = 0; i < allConditions.length - 1; i++) {
          leadDomain.push('|');
        }
        allConditions.forEach(cond => leadDomain.push(cond));
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

        // Build a set of Place IDs from existing customers to avoid showing duplicate leads
        // When a lead is converted to a contact, the Place ID is stored in the comment field
        const existingPlaceIds = new Set<string>();

        // We need to fetch the customers again to check their comment fields for Place IDs
        // Or we can store this info when we create markers above
        try {
          const customerIdsInMarkers = markers
            .filter(m => m.type === 'customer')
            .map(m => m.id);

          if (customerIdsInMarkers.length > 0) {
            const customersWithComments = await client.searchRead(
              'res.partner',
              [['id', 'in', customerIdsInMarkers]],
              ['id', 'comment'],
              0
            );

            for (const customer of customersWithComments) {
              if (customer.comment) {
                const placeIdMatch = customer.comment.match(/Google Place ID:\s*([^\n]+)/);
                if (placeIdMatch) {
                  const placeId = placeIdMatch[1].trim();
                  existingPlaceIds.add(placeId);
                  console.log(`[LOAD-FROM-ODOO] 📍 Customer "${customer.id}" has Place ID: ${placeId}`);
                }
              }
            }
          }
        } catch (e) {
          console.warn('[LOAD-FROM-ODOO] Errore recupero Place IDs da customers:', e);
        }

        console.log(`[LOAD-FROM-ODOO] 🔍 Found ${existingPlaceIds.size} Place IDs from existing customers`);

        for (const lead of leads) {
          // Parse coordinates from description
          const coords = parseCoordinatesFromDescription(lead.description);

          if (!coords) continue; // Skip leads without coordinates

          // CRITICAL: Check if this lead has been converted to a contact
          // Extract Place ID from lead description
          let leadPlaceId: string | null = null;
          if (lead.description) {
            const placeIdMatch = lead.description.match(/Place ID:\s*([^\n]+)/);
            if (placeIdMatch) {
              leadPlaceId = placeIdMatch[1].trim();
            }
          }

          // Skip this lead if a customer marker already exists with the same Place ID
          if (leadPlaceId && existingPlaceIds.has(leadPlaceId)) {
            console.log(`[LOAD-FROM-ODOO] ⚠️ Skipping lead "${lead.name}" - already exists as customer (Place ID: ${leadPlaceId})`);
            continue;
          }

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
