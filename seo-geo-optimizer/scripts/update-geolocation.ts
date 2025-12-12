/**
 * Script per aggiornare la geolocalizzazione di tutti gli indirizzi di consegna in Odoo
 * Usa Nominatim (OpenStreetMap) per il geocoding gratuito
 */

import { OdooConnector } from '../src/connectors/odoo.js';

interface Partner {
  id: number;
  name: string;
  street?: string;
  street2?: string;
  city?: string;
  zip?: string;
  country_id?: [number, string];
  state_id?: [number, string];
  partner_latitude?: number;
  partner_longitude?: number;
  category_id?: [number, string][];
  type?: string;
  write_date?: string;
}

interface GeocodingResult {
  lat: string;
  lon: string;
  display_name: string;
}

const odoo = new OdooConnector();

/**
 * Geocoding usando Nominatim (OpenStreetMap) - gratuito
 */
async function geocodeAddress(address: string): Promise<{ lat: number; lon: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'LAPA-GeoUpdater/1.0 (contact@lapa.ch)', // Richiesto da Nominatim
      },
    });

    if (!response.ok) {
      console.error(`Errore HTTP: ${response.status}`);
      return null;
    }

    const results: GeocodingResult[] = await response.json();

    if (results.length === 0) {
      return null;
    }

    return {
      lat: parseFloat(results[0].lat),
      lon: parseFloat(results[0].lon),
    };
  } catch (error) {
    console.error(`Errore geocoding: ${error}`);
    return null;
  }
}

/**
 * Costruisce l'indirizzo completo per il geocoding
 */
function buildAddress(partner: Partner): string {
  const parts: string[] = [];

  if (partner.street) parts.push(partner.street);
  if (partner.street2) parts.push(partner.street2);
  if (partner.zip) parts.push(partner.zip);
  if (partner.city) parts.push(partner.city);
  if (partner.country_id) parts.push(partner.country_id[1]);

  return parts.join(', ');
}

/**
 * Recupera tutti i partner con tag "Indirizzo Consegna" o di tipo 'delivery'
 */
async function getDeliveryAddresses(): Promise<Partner[]> {
  // Prima cerchiamo l'ID del tag "Indirizzo Consegna"
  const tags = await (odoo as any).execute<any[]>(
    'res.partner.category',
    'search_read',
    [[['name', 'ilike', 'Indirizzo Consegna']]],
    { fields: ['id', 'name'] }
  );

  console.log('Tag trovati:', tags);

  // Costruiamo il dominio di ricerca
  const domain: any[] = [];

  // Se abbiamo trovato il tag, lo usiamo
  if (tags.length > 0) {
    const tagId = tags[0].id;
    domain.push('|');
    domain.push(['category_id', 'in', [tagId]]);
    domain.push(['type', '=', 'delivery']);
  } else {
    // Altrimenti cerchiamo solo per tipo 'delivery'
    domain.push(['type', '=', 'delivery']);
  }

  const partners = await (odoo as any).execute<Partner[]>(
    'res.partner',
    'search_read',
    [domain],
    {
      fields: [
        'id', 'name', 'street', 'street2', 'city', 'zip',
        'country_id', 'state_id', 'partner_latitude', 'partner_longitude',
        'category_id', 'type', 'write_date'
      ],
      limit: 5000, // Limite alto per prendere tutti
    }
  );

  return partners;
}

/**
 * Aggiorna le coordinate di un partner in Odoo
 */
async function updatePartnerCoordinates(partnerId: number, lat: number, lon: number): Promise<boolean> {
  return (odoo as any).execute<boolean>(
    'res.partner',
    'write',
    [[partnerId], {
      partner_latitude: lat,
      partner_longitude: lon,
    }]
  );
}

/**
 * Main - Esegui l'aggiornamento
 */
async function main() {
  console.log('🔄 Connessione a Odoo...');

  try {
    const connResult = await odoo.testConnection();
    if (!connResult.success) {
      console.error('❌ Connessione fallita:', connResult.message);
      process.exit(1);
    }
    console.log('✅ Connesso a Odoo');

    // Recupera gli indirizzi di consegna
    console.log('\n📍 Recupero indirizzi di consegna...');
    const addresses = await getDeliveryAddresses();
    console.log(`Trovati ${addresses.length} indirizzi di consegna`);

    // Filtra quelli senza coordinate o con coordinate a 0
    const toUpdate = addresses.filter(a => {
      const hasValidCoords = a.partner_latitude && a.partner_longitude &&
                            a.partner_latitude !== 0 && a.partner_longitude !== 0;
      const hasAddress = a.street || a.city;
      return !hasValidCoords && hasAddress;
    });

    console.log(`\n🎯 ${toUpdate.length} indirizzi da aggiornare (senza coordinate valide)`);

    // Mostra anche quanti hanno già le coordinate
    const withCoords = addresses.filter(a =>
      a.partner_latitude && a.partner_longitude &&
      a.partner_latitude !== 0 && a.partner_longitude !== 0
    );
    console.log(`✅ ${withCoords.length} indirizzi hanno già le coordinate`);

    if (toUpdate.length === 0) {
      console.log('\n✨ Tutti gli indirizzi hanno già le coordinate!');
      return;
    }

    // Mostra anteprima
    console.log('\n📋 Anteprima indirizzi da aggiornare:');
    toUpdate.slice(0, 10).forEach((a, i) => {
      console.log(`  ${i + 1}. ${a.name} - ${buildAddress(a)}`);
    });
    if (toUpdate.length > 10) {
      console.log(`  ... e altri ${toUpdate.length - 10} indirizzi`);
    }

    // Chiedi conferma
    console.log('\n⚠️  Vuoi procedere con l\'aggiornamento? (Usa --confirm per confermare)');

    const args = process.argv.slice(2);
    if (!args.includes('--confirm')) {
      console.log('\n💡 Per eseguire l\'aggiornamento, rilancia con: npx tsx scripts/update-geolocation.ts --confirm');
      return;
    }

    // Procedi con l'aggiornamento
    console.log('\n🚀 Inizio aggiornamento...\n');

    let updated = 0;
    let failed = 0;
    let notFound = 0;

    for (let i = 0; i < toUpdate.length; i++) {
      const partner = toUpdate[i];
      const address = buildAddress(partner);

      process.stdout.write(`[${i + 1}/${toUpdate.length}] ${partner.name}... `);

      // Nominatim richiede max 1 richiesta/secondo
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 1100));
      }

      const coords = await geocodeAddress(address);

      if (coords) {
        const success = await updatePartnerCoordinates(partner.id, coords.lat, coords.lon);
        if (success) {
          console.log(`✅ ${coords.lat.toFixed(6)}, ${coords.lon.toFixed(6)}`);
          updated++;
        } else {
          console.log('❌ Errore salvataggio');
          failed++;
        }
      } else {
        console.log('⚠️ Indirizzo non trovato');
        notFound++;
      }
    }

    // Report finale
    console.log('\n' + '='.repeat(50));
    console.log('📊 REPORT FINALE');
    console.log('='.repeat(50));
    console.log(`✅ Aggiornati: ${updated}`);
    console.log(`⚠️ Non trovati: ${notFound}`);
    console.log(`❌ Falliti: ${failed}`);
    console.log(`📍 Totale processati: ${toUpdate.length}`);

  } catch (error) {
    console.error('❌ Errore:', error);
    process.exit(1);
  }
}

main();
